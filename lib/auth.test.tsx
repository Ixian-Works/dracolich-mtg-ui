import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { api } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { deferred, failure, fakeApi, ok, type Reply } from '@/test/fake-api';
import { accessTokenExpiringIn, storeTokens, storedTokens } from '@/test/tokens';

const REFRESH = '/auth/refresh';
const LOGOUT = '/auth/logout';
const DECK_KEY = ['decks', 'byId', 'deck-1'];

const expired = () => accessTokenExpiringIn(-60, 'old');
const live = (label = 'new') => accessTokenExpiringIn(900, label);

/** The two providers the app wraps every screen in, around a fresh query cache. */
function providers() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { queryClient, wrapper };
}

function openApp() {
  const { queryClient, wrapper } = providers();
  const view = renderHook(() => useAuth(), { wrapper });
  return { auth: view.result, queryClient };
}

/** Waits until the provider has read the stored tokens. */
async function ready(auth: { current: ReturnType<typeof useAuth> }) {
  await waitFor(() => expect(auth.current.loading).toBe(false));
}

describe('opening the app', () => {
  it('shows a visitor as signed out', async () => {
    const { auth } = openApp();
    await ready(auth);

    expect(auth.current.user).toBeNull();
    expect(fakeApi.requests).toHaveLength(0);
  });

  it('shows the player and asks user-api nothing while the access token is live', async () => {
    await storeTokens(live(), 'refresh-1');

    const { auth } = openApp();
    await ready(auth);

    expect(auth.current.user).toEqual({ userId: 'user-1', username: 'jace', accessLevel: 'USER' });
    expect(fakeApi.requests).toHaveLength(0);
  });

  it('renews an expired access token at once, and sends nothing with the dead one', async () => {
    const dead = expired();
    const fresh = live();
    await storeTokens(dead, 'refresh-1');
    fakeApi.on('POST', REFRESH, () => ok({ accessToken: fresh, refreshToken: 'refresh-2' }));
    fakeApi.on('GET', '/decks/', () => ok([]));

    const { auth } = openApp();
    await ready(auth);
    // The first screen asks for the player's decks straight away.
    await act(() => api.deckBuilder('/decks/'));

    expect(auth.current.user?.username).toBe('jace');
    expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1);
    expect(fakeApi.requestsTo('/decks/')[0].authorization).toBe(`Bearer ${fresh}`);
    expect(fakeApi.requests.some((request) => request.authorization === `Bearer ${dead}`)).toBe(
      false
    );
    expect(await storedTokens()).toEqual({ access: fresh, refresh: 'refresh-2' });
  });

  it('leaves the player signed in when the refresh cannot reach the server', async () => {
    const dead = expired();
    await storeTokens(dead, 'refresh-1');
    fakeApi.on('POST', REFRESH, () => 'network-error');

    const { auth } = openApp();
    await ready(auth);
    await waitFor(() => expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1));

    expect(auth.current.user?.username).toBe('jace');
    expect(await storedTokens()).toEqual({ access: dead, refresh: 'refresh-1' });
  });

  it('signs the player out when user-api no longer accepts the refresh token', async () => {
    await storeTokens(expired(), 'refresh-1');
    fakeApi.on('POST', REFRESH, () => failure(401, 'DMD017'));

    const { auth } = openApp();
    await ready(auth);
    await waitFor(() => expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1));

    await waitFor(() => expect(auth.current.user).toBeNull());
    expect(await storedTokens()).toEqual({ access: null, refresh: null });
  });
});

describe('signing out', () => {
  it('hands the refresh token back to user-api and forgets both tokens', async () => {
    await storeTokens(live(), 'refresh-1');
    fakeApi.on('POST', LOGOUT, () => ok('Logged out'));
    const { auth } = openApp();
    await ready(auth);

    await act(() => auth.current.logout());

    expect(fakeApi.requestsTo(LOGOUT)).toHaveLength(1);
    expect(fakeApi.requestsTo(LOGOUT)[0].body).toEqual({ refreshToken: 'refresh-1' });
    expect(auth.current.user).toBeNull();
    expect(await storedTokens()).toEqual({ access: null, refresh: null });
  });

  it.each<[string, Reply]>([
    ['the network is off', 'network-error'],
    ['user-api answers 500', failure(500, 'DMD001')],
  ])('still signs out on this device when %s', async (_case, reply) => {
    await storeTokens(live(), 'refresh-1');
    fakeApi.on('POST', LOGOUT, () => reply);
    const { auth } = openApp();
    await ready(auth);

    await act(() => auth.current.logout());

    expect(fakeApi.requestsTo(LOGOUT)).toHaveLength(1);
    expect(auth.current.user).toBeNull();
    expect(await storedTokens()).toEqual({ access: null, refresh: null });
  });

  it('forgets what the last player loaded', async () => {
    await storeTokens(live(), 'refresh-1');
    fakeApi.on('POST', LOGOUT, () => ok('Logged out'));
    const { auth, queryClient } = openApp();
    await ready(auth);
    queryClient.setQueryData(DECK_KEY, { name: "Jace's private deck" });

    await act(() => auth.current.logout());

    expect(queryClient.getQueryData(DECK_KEY)).toBeUndefined();
  });

  it("empties a screen showing the last player's deck, and loads it again as a visitor", async () => {
    const token = live();
    await storeTokens(token, 'refresh-1');
    fakeApi.on('POST', LOGOUT, () => ok('Logged out'));
    fakeApi.on('GET', '/decks/deck-1', (request) =>
      request.authorization ? ok({ name: "Jace's private deck" }) : failure(401, 'DMD034')
    );
    const { wrapper } = providers();
    const screen = renderHook(
      () => ({
        auth: useAuth(),
        deck: useQuery({
          queryKey: DECK_KEY,
          queryFn: () => api.deckBuilder<{ name: string }>('/decks/deck-1'),
        }),
      }),
      { wrapper }
    );
    await waitFor(() =>
      expect(screen.result.current.deck.data).toEqual({ name: "Jace's private deck" })
    );

    await act(() => screen.result.current.auth.logout());

    await waitFor(() => expect(screen.result.current.deck.isError).toBe(true));
    expect(screen.result.current.deck.data).toBeUndefined();
    expect(fakeApi.requestsTo('/decks/deck-1').map((request) => request.authorization)).toEqual([
      `Bearer ${token}`,
      null,
    ]);
  });

  it('is not undone by a refresh that was already on its way', async () => {
    await storeTokens(expired(), 'refresh-1');
    const refresh = deferred<Reply>();
    fakeApi.on('POST', REFRESH, () => refresh.promise);
    fakeApi.on('POST', LOGOUT, () => ok('Logged out'));
    const { auth } = openApp();
    await ready(auth);
    await waitFor(() => expect(fakeApi.requestsTo(REFRESH)).toHaveLength(1));

    await act(() => auth.current.logout());
    await act(async () => {
      refresh.resolve(ok({ accessToken: live(), refreshToken: 'refresh-2' }));
    });

    // The refresh made `refresh-2` valid on the server. Nothing on this device
    // keeps it, so it is handed back as well.
    await waitFor(() =>
      expect(fakeApi.requestsTo(LOGOUT).map((request) => request.body)).toContainEqual({
        refreshToken: 'refresh-2',
      })
    );
    expect(auth.current.user).toBeNull();
    expect(await storedTokens()).toEqual({ access: null, refresh: null });
  });
});

describe('a session user-api has ended', () => {
  it('signs the player out and forgets what they loaded', async () => {
    await storeTokens(accessTokenExpiringIn(600, 'refused'), 'refresh-1');
    fakeApi.on('GET', '/decks/', () => failure(401, 'DMD034'));
    fakeApi.on('POST', REFRESH, () => failure(401, 'DMD017'));
    const { auth, queryClient } = openApp();
    await ready(auth);
    queryClient.setQueryData(DECK_KEY, { name: "Jace's private deck" });

    await act(async () => {
      await api.deckBuilder('/decks/').catch(() => {});
    });

    await waitFor(() => expect(auth.current.user).toBeNull());
    expect(queryClient.getQueryData(DECK_KEY)).toBeUndefined();
    expect(await storedTokens()).toEqual({ access: null, refresh: null });
  });
});

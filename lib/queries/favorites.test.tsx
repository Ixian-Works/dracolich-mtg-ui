import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { AuthProvider, useAuth } from '@/lib/auth';
import type { PageRecord } from '@/lib/queries/cards';
import type { DeckDto } from '@/lib/queries/decks';
import { favoritesKey, useFavoriteDecks, useIsFavorite, useToggleFavorite } from '@/lib/queries/favorites';
import { deferred, failure, fakeApi, ok, type Reply } from '@/test/fake-api';
import { accessTokenExpiringIn, storeTokens } from '@/test/tokens';

const ME = 'user-1';
const FAVORITES = `/users/${ME}/favorites`;
const someoneElsesDeck: DeckDto = { id: 'deck-9', name: 'Mono Red', user_id: 'user-2', favorites_count: 3 };

const page = (decks: DeckDto[]): PageRecord<DeckDto> => ({
  content: decks,
  totalElements: decks.length,
  totalPages: 1,
  size: 100,
  number: 0,
  first: true,
  last: true,
  empty: decks.length === 0,
});

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

/** A signed-in player, with the app's two providers around a fresh cache. */
async function openApp(serverFavorites: DeckDto[]) {
  await storeTokens(accessTokenExpiringIn(900, 'live'), 'refresh-1');
  fakeApi.on('GET', FAVORITES, () => ok(page(serverFavorites)));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  // The deck as the popular list and the deck page have it cached.
  queryClient.setQueryData(['decks', 'byId', someoneElsesDeck.id], someoneElsesDeck);
  queryClient.setQueryData(['decks', 'popular', {}], page([someoneElsesDeck]));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  const view = renderHook(
    () => ({
      auth: useAuth(),
      favorites: useFavoriteDecks(),
      isFavorite: useIsFavorite(someoneElsesDeck.id),
      toggle: useToggleFavorite(),
    }),
    { wrapper }
  );
  cleanups.push(() => {
    view.unmount();
    queryClient.clear();
  });
  await waitFor(() => expect(view.result.current.favorites.isSuccess).toBe(true));
  return { result: view.result, queryClient };
}

const countIn = (queryClient: QueryClient) => ({
  page: queryClient.getQueryData<DeckDto>(['decks', 'byId', someoneElsesDeck.id])?.favorites_count,
  popular: queryClient.getQueryData<PageRecord<DeckDto>>(['decks', 'popular', {}])?.content[0].favorites_count,
});

test('favoriting a deck adds it to Favorites and raises its count by exactly one, at once', async () => {
  const answer = deferred<Reply>();
  fakeApi.on('POST', '/favorites', () => answer.promise);
  const { result, queryClient } = await openApp([]);
  expect(result.current.isFavorite).toBe(false);

  act(() => {
    result.current.toggle.mutate({ deck: someoneElsesDeck, favorite: true });
  });

  // Before the server answers: on, in the list, and one more everywhere it is shown.
  await waitFor(() => expect(result.current.isFavorite).toBe(true));
  expect(countIn(queryClient)).toEqual({ page: 4, popular: 4 });
  expect(queryClient.getQueryData<PageRecord<DeckDto>>(favoritesKey(ME))?.content.map((d) => d.id)).toEqual(['deck-9']);
  const writes = fakeApi.requestsTo('/favorites').filter((r) => r.method !== 'GET');
  expect(writes.map((r) => [r.method, r.query])).toEqual([['POST', { deck_id: 'deck-9' }]]);

  fakeApi.on('GET', FAVORITES, () => ok(page([{ ...someoneElsesDeck, favorites_count: 4 }])));
  fakeApi.on('GET', `/decks/${someoneElsesDeck.id}`, () => ok({ ...someoneElsesDeck, favorites_count: 4 }));
  answer.resolve(ok(true));
  await waitFor(() => expect(result.current.toggle.isSuccess).toBe(true));
  expect(result.current.isFavorite).toBe(true);
});

test('a second favorite of the same deck counts nothing', async () => {
  fakeApi.on('POST', '/favorites', () => ok(true));
  fakeApi.on('GET', `/decks/${someoneElsesDeck.id}`, () => ok(someoneElsesDeck));
  const { result, queryClient } = await openApp([someoneElsesDeck]);
  expect(result.current.isFavorite).toBe(true);

  await act(() => result.current.toggle.mutateAsync({ deck: someoneElsesDeck, favorite: true }));
  await waitFor(() => expect(result.current.toggle.isSuccess).toBe(true));

  expect(countIn(queryClient)).toEqual({ page: 3, popular: 3 });
});

test('a failed save puts the star and the count back', async () => {
  fakeApi.on('POST', '/favorites', () => failure(503, 'DMD032'));
  fakeApi.on('GET', `/decks/${someoneElsesDeck.id}`, () => ok(someoneElsesDeck));
  const { result, queryClient } = await openApp([]);

  await act(() =>
    result.current.toggle.mutateAsync({ deck: someoneElsesDeck, favorite: true }).catch(() => undefined)
  );
  await waitFor(() => expect(result.current.toggle.isError).toBe(true));

  expect(result.current.isFavorite).toBe(false);
  expect(countIn(queryClient)).toEqual({ page: 3, popular: 3 });
});

test('unfavoriting takes the deck out of Favorites and lowers its count', async () => {
  fakeApi.on('DELETE', '/favorites', () => ok(true));
  fakeApi.on('GET', `/decks/${someoneElsesDeck.id}`, () => ok({ ...someoneElsesDeck, favorites_count: 2 }));
  const { result, queryClient } = await openApp([someoneElsesDeck]);
  // After the change, the server's listing no longer has it.
  fakeApi.on('GET', FAVORITES, () => ok(page([])));

  act(() => {
    result.current.toggle.mutate({ deck: someoneElsesDeck, favorite: false });
  });

  await waitFor(() => expect(result.current.isFavorite).toBe(false));
  expect(countIn(queryClient).popular).toBe(2);
  await waitFor(() => expect(result.current.toggle.isSuccess).toBe(true));
});

test('the star is right after a restart, from the server and not from memory', async () => {
  // A fresh cache, as after the app restarts: the state comes from the listing.
  const { result } = await openApp([someoneElsesDeck]);

  expect(result.current.isFavorite).toBe(true);
  expect(fakeApi.requestsTo(FAVORITES)[0].query).toEqual({ page: '0', size: '100' });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';

import { FavoriteToggle } from '@/components/favorite-toggle';
import { AuthProvider } from '@/lib/auth';
import * as feedback from '@/lib/feedback';
import type { DeckDto } from '@/lib/queries/decks';
import { failure, fakeApi, ok } from '@/test/fake-api';
import { accessTokenExpiringIn, storeTokens } from '@/test/tokens';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const someoneElsesDeck: DeckDto = { id: 'deck-9', name: 'Mono Red', user_id: 'user-2', favorites_count: 12 };
const myDeck: DeckDto = { id: 'deck-1', name: 'Mine', user_id: 'user-1', favorites_count: 5 };

const listing = (decks: DeckDto[]) =>
  ok({ content: decks, totalElements: decks.length, totalPages: 1, size: 100, number: 0, first: true, last: true, empty: !decks.length });

let queryClient: QueryClient;
afterEach(() => queryClient?.clear());

function show(deck: DeckDto) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return render(<FavoriteToggle deck={deck} />, { wrapper });
}

async function signedIn(favorites: DeckDto[]) {
  await storeTokens(accessTokenExpiringIn(900, 'live'), 'refresh-1');
  fakeApi.on('GET', '/users/user-1/favorites', () => listing(favorites));
}

test('is a toggle button with a name and an on/off state, and reads its count as favorites', async () => {
  await signedIn([someoneElsesDeck]);
  show(someoneElsesDeck);

  const button = await screen.findByRole('togglebutton', { name: 'Favorite Mono Red' });
  await waitFor(() => expect(button.props.accessibilityState).toEqual({ checked: true }));
  // The count is read with the button, after its name.
  expect(button.props.accessibilityValue).toEqual({ text: '12 favorites' });
});

test('on your own deck it is only the count, with no button', async () => {
  await signedIn([]);
  show(myDeck);

  await waitFor(() => expect(screen.getByLabelText('5 favorites')).toBeTruthy());
  expect(screen.queryByRole('togglebutton')).toBeNull();
});

test('signed out, a tap opens sign-in with the reason', async () => {
  show(someoneElsesDeck);

  fireEvent.press(await screen.findByRole('togglebutton'));

  // A key, never the sentence: sign-in picks its own words.
  expect(router.push).toHaveBeenCalledWith({ pathname: '/login', params: { reason: 'favorites' } });
  expect(fakeApi.requestsTo('/favorites')).toHaveLength(0);
});

test('a failed save puts the star back and says so', async () => {
  await signedIn([]);
  fakeApi.on('POST', '/favorites', () => failure(503, 'DMD032'));
  fakeApi.on('GET', '/decks/deck-9', () => ok(someoneElsesDeck));
  const toast = jest.spyOn(feedback, 'showFeedback').mockImplementation(() => ({ update: () => {}, close: () => {} }));
  show(someoneElsesDeck);
  const button = await screen.findByRole('togglebutton');
  await waitFor(() => expect(fakeApi.requestsTo('/users/user-1/favorites')).toHaveLength(1));

  fireEvent.press(button);

  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
  expect(screen.getByRole('togglebutton').props.accessibilityState).toEqual({ checked: false });
  toast.mockRestore();
});

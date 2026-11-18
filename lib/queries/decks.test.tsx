import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError } from '@/lib/api';
import { type DeckDto, useRemoveCardFromDeck } from '@/lib/queries/decks';
import { deferred, failure, fakeApi, ok, type Reply } from '@/test/fake-api';

const DECK = 'deck-1';
const CARD_PATH = `/decks/${DECK}/cards/bolt`;

/** A deck holding Lightning Bolt in two boards, as two entries. */
const deckWithBoltTwice = (): DeckDto =>
  ({
    id: DECK,
    name: 'Burn',
    cards: [
      { card_id: 'bolt', name: 'Lightning Bolt', count: 4, card_category: 'MAINBOARD' },
      { card_id: 'bolt', name: 'Lightning Bolt', count: 2, card_category: 'SIDEBOARD' },
      { card_id: 'shock', name: 'Shock', count: 4, card_category: 'MAINBOARD' },
    ],
  }) as DeckDto;

const cleanups: (() => void)[] = [];

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

function setUp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  queryClient.setQueryData(['decks', 'byId', DECK], deckWithBoltTwice());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(() => useRemoveCardFromDeck(DECK), { wrapper });
  cleanups.push(() => {
    unmount();
    queryClient.clear();
  });
  return {
    queryClient,
    result,
    cachedEntries: () =>
      (queryClient.getQueryData<DeckDto>(['decks', 'byId', DECK])?.cards ?? []).map(
        (c) => `${c.card_id}:${c.card_category}`
      ),
  };
}

test('removing a card names its board in the request', async () => {
  fakeApi.on('DELETE', CARD_PATH, () => ok(true));
  const { result } = setUp();

  await act(() => result.current.mutateAsync({ cardId: 'bolt', category: 'SIDEBOARD' }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(fakeApi.requestsTo(CARD_PATH).map((r) => [r.method, r.query])).toEqual([
    ['DELETE', { category: 'SIDEBOARD' }],
  ]);
});

test('without a board the request says MAINBOARD', async () => {
  fakeApi.on('DELETE', CARD_PATH, () => ok(true));
  const { result } = setUp();

  await act(() => result.current.mutateAsync({ cardId: 'bolt' }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(fakeApi.requestsTo(CARD_PATH)[0].query).toEqual({ category: 'MAINBOARD' });
});

test('the sideboard copy goes at once, and the mainboard copy stays', async () => {
  const answer = deferred<Reply>();
  fakeApi.on('DELETE', CARD_PATH, () => answer.promise);
  const { result, cachedEntries } = setUp();

  act(() => {
    result.current.mutate({ cardId: 'bolt', category: 'SIDEBOARD' });
  });

  // Before the server answers: only the sideboard entry is gone.
  await waitFor(() =>
    expect(cachedEntries()).toEqual(['bolt:MAINBOARD', 'shock:MAINBOARD'])
  );
  answer.resolve(ok(true));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
});

test('a 404 puts the card back and says so in words a player can read', async () => {
  fakeApi.on('DELETE', CARD_PATH, () => failure(404, 'DMD033', 'remove_card_from_deck: card not found: bolt'));
  const { result, cachedEntries } = setUp();

  const error = await act(() =>
    result.current.mutateAsync({ cardId: 'bolt', category: 'SIDEBOARD' }).then(
      () => null,
      (e: unknown) => e
    )
  );

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(404);
  expect((error as ApiError).message).toBe(
    'That card was no longer in your sideboard. Your deck has been refreshed.'
  );
  await waitFor(() =>
    expect(cachedEntries()).toEqual(['bolt:MAINBOARD', 'bolt:SIDEBOARD', 'shock:MAINBOARD'])
  );
});

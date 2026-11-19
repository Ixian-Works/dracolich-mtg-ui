import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Share } from 'react-native';

import { CopiedFrom } from '@/components/copied-from';
import { DeckActions } from '@/components/deck-actions';
import { AuthProvider } from '@/lib/auth';
import { deckExportText } from '@/lib/deck-export';
import * as feedback from '@/lib/feedback';
import type { DeckDto } from '@/lib/queries/decks';
import { deferred, failure, fakeApi, ok, type Reply } from '@/test/fake-api';
import { accessTokenExpiringIn, storeTokens } from '@/test/tokens';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, Link: ({ children }: { children: ReactNode }) => children }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `dracolichmtgui://${path.replace(/^\//, '')}` }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
// A jest.mock factory runs before imports, so it has to require.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

let mockWidth = 1024;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 800, scale: 1, fontScale: 1 }),
}));

const card = (name: string, count: number, card_category?: 'MAINBOARD' | 'SIDEBOARD' | 'MAYBE_BOARD') => ({
  card_id: name,
  name,
  count,
  card_category,
});

const mine: DeckDto = {
  id: 'deck-1',
  name: 'Goblins',
  user_id: 'user-1',
  visibility: 'PRIVATE',
  favorites_count: 3,
  commander: [card('Krenko, Mob Boss', 1)],
  cards: [card('Mountain', 30, 'MAINBOARD'), card('Goblin Lackey', 1, 'MAINBOARD'), card('Pyroblast', 2, 'SIDEBOARD'), card('Shock', 1, 'MAYBE_BOARD')],
};
const theirs: DeckDto = { ...mine, id: 'deck-9', name: 'Mono Red', user_id: 'user-2', visibility: 'PUBLIC', favorites_count: 12 };

const emptyPage = { content: [], totalElements: 0, totalPages: 0, size: 100, number: 0, first: true, last: true, empty: true };

let toast: jest.SpyInstance;
let queryClient: QueryClient;
beforeEach(() => {
  mockWidth = 1024;
  toast = jest.spyOn(feedback, 'showFeedback').mockReturnValue({ update: () => {}, close: () => {} });
  (router.push as jest.Mock).mockClear();
  (Clipboard.setStringAsync as jest.Mock).mockClear();
});
afterEach(async () => {
  // Let every query answer and TanStack's batched notify run inside act, so
  // no update lands after the test.
  if (queryClient) {
    await settle();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  toast.mockRestore();
  queryClient?.clear();
});

function show(element: React.ReactElement) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return render(element, { wrapper });
}

/** Wait for every query to answer, so nothing updates after the test ends. */
const settle = () => waitFor(() => expect(queryClient.isFetching()).toBe(0));

async function signedIn() {
  await storeTokens(accessTokenExpiringIn(900, 'live'), 'refresh-1');
  fakeApi.on('GET', '/users/user-1/favorites', () => ok(emptyPage));
}

/** The section rules of deck-builder's DeckTextParser.detectSection, to check a round trip. */
function importLikeTheService(text: string) {
  let section = 'MAINBOARD';
  const result: { name: string; count: number; section: string }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('//')) {
      const lower = line.toLowerCase();
      if (lower.includes('commander')) section = 'COMMANDER';
      else if (lower.includes('sideboard') || lower.includes('outside')) section = 'SIDEBOARD';
      else if (lower.includes('maybe')) section = 'MAYBE_BOARD';
      continue;
    }
    const [, count, name] = line.match(/^(\d+)\s+(.+)$/)!;
    result.push({ name, count: Number(count), section });
  }
  return result;
}

describe('the export text', () => {
  test('one card per line, grouped by board, Deck first', () => {
    expect(deckExportText(mine)).toBe(
      [
        '// Deck',
        '1 Goblin Lackey',
        '30 Mountain',
        '',
        '// Commander',
        '1 Krenko, Mob Boss',
        '',
        '// Sideboard',
        '2 Pyroblast',
        '',
        '// Maybe',
        '1 Shock',
        '',
      ].join('\n')
    );
  });

  test("imports back as the same list under the service's section rules", () => {
    const back = importLikeTheService(deckExportText(mine));
    const expected = [
      ...mine.commander!.map((c) => ({ name: c.name, count: c.count, section: 'COMMANDER' })),
      ...mine.cards!.map((c) => ({ name: c.name, count: c.count, section: c.card_category })),
    ];
    expect(back).toEqual(expect.arrayContaining(expected));
    expect(back).toHaveLength(expected.length);
  });
});

describe('on a wide screen', () => {
  test('the owner: Edit first, then Share, Export and Duplicate; no Copy, no star', async () => {
    await signedIn();
    show(<DeckActions deck={{ ...mine, visibility: 'PUBLIC' }} />);

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeTruthy();
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? within(b).queryAllByText(/.+/)[0]?.props.children);
    expect(labels).toEqual(['Edit', 'Share', 'Export', 'Duplicate']);
    expect(screen.queryByText('Copy to my decks')).toBeNull();
  });

  test("the owner of a private deck can't share it yet, and is told why", async () => {
    await signedIn();
    show(<DeckActions deck={mine} />);

    const shareButton = await screen.findByRole('button', { name: 'Share' });
    expect(shareButton.props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByText('This deck is private. Only you can open it.')).toBeTruthy();
  });

  test("someone else's public deck: Copy to my decks, the star, Share and Export; no Edit or Duplicate", async () => {
    await signedIn();
    show(<DeckActions deck={theirs} />);

    expect(await screen.findByRole('button', { name: 'Copy to my decks' })).toBeTruthy();
    expect(screen.getByRole('togglebutton', { name: 'Favorite Mono Red' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
  });

  test("an unlisted deck that isn't yours can't be copied", async () => {
    await signedIn();
    show(<DeckActions deck={{ ...theirs, visibility: 'UNLISTED' }} />);

    await screen.findByRole('button', { name: 'Export' });
    expect(screen.queryByRole('button', { name: 'Copy to my decks' })).toBeNull();
  });
});

describe('copying', () => {
  test('reads "Copying" while it works, then opens the builder on the copy with its toast', async () => {
    await signedIn();
    const answer = deferred<Reply>();
    fakeApi.on('POST', '/decks/deck-9/copy', () => answer.promise);
    show(<DeckActions deck={theirs} />);

    fireEvent.press(await screen.findByRole('button', { name: 'Copy to my decks' }));
    expect(await screen.findByRole('button', { name: 'Copying' })).toBeTruthy();
    answer.resolve(ok({ ...theirs, id: 'deck-new', user_id: 'user-1', visibility: 'PRIVATE', copied_from_id: 'deck-9' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/decks/deck-new/build'));
    expect(toast).toHaveBeenCalledWith({ kind: 'success', title: 'Copied. This one is yours.' });
  });

  test('a duplicate of your own deck has its own toast', async () => {
    await signedIn();
    fakeApi.on('POST', '/decks/deck-1/copy', () => ok({ ...mine, id: 'deck-2', name: 'Goblins (copy)' }));
    show(<DeckActions deck={mine} />);

    fireEvent.press(await screen.findByRole('button', { name: 'Duplicate' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/decks/deck-2/build'));
    expect(toast).toHaveBeenCalledWith({ kind: 'success', title: 'Duplicated. This is the copy.' });
  });

  test('a failed copy says so and goes nowhere', async () => {
    await signedIn();
    fakeApi.on('POST', '/decks/deck-9/copy', () => failure(503, 'DMD001'));
    show(<DeckActions deck={theirs} />);

    fireEvent.press(await screen.findByRole('button', { name: 'Copy to my decks' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ kind: 'error', title: "This deck didn't copy. Try again." }));
    expect(router.push).not.toHaveBeenCalled();
  });

  test('signed out, Copy opens sign-in with its reason and sends nothing', async () => {
    show(<DeckActions deck={theirs} />);

    fireEvent.press(await screen.findByRole('button', { name: 'Copy to my decks' }));

    expect(router.push).toHaveBeenCalledWith({ pathname: '/login', params: { reason: 'copy' } });
    expect(fakeApi.requestsTo('/copy')).toHaveLength(0);
  });
});

describe('on a phone', () => {
  test('one full-width primary action and More; every action in the sheet has a line', async () => {
    mockWidth = 390;
    await signedIn();
    show(<DeckActions deck={theirs} />);

    expect(await screen.findByRole('button', { name: 'Copy to my decks' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByText('Keep this deck in your Favorites.')).toBeTruthy();
    expect(screen.getByText('Send the link to this deck.')).toBeTruthy();
    expect(screen.getByText('The list as text, to paste anywhere.')).toBeTruthy();
    expect(screen.getByLabelText('12 favorites')).toBeTruthy();
    await settle();
  });

  test('Share hands the link to the system share sheet', async () => {
    mockWidth = 390;
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
    await signedIn();
    show(<DeckActions deck={theirs} />);

    fireEvent.press(await screen.findByRole('button', { name: 'More' }));
    fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    await waitFor(() => expect(shareSpy).toHaveBeenCalled());
    expect(shareSpy.mock.calls[0][0]).toMatchObject({ url: expect.stringContaining('/decks/deck-9') });
    shareSpy.mockRestore();
    await settle();
  });
});

describe('the Export sheet', () => {
  test('shows the text and Copy text puts it on the clipboard with a toast', async () => {
    await signedIn();
    show(<DeckActions deck={theirs} />);

    fireEvent.press(await screen.findByRole('button', { name: 'Export' }));
    expect(screen.getByText('Export deck')).toBeTruthy();
    expect(screen.getByTestId('export-text').props.children).toBe(deckExportText(theirs));
    expect(screen.getByText('Plain text, one card per line.')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Copy text' }));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith(deckExportText(theirs)));
    expect(toast).toHaveBeenCalledWith({ kind: 'success', title: 'Deck list copied' });
    await settle();
  });
});

describe('Copied from', () => {
  test("names the original, as a link", async () => {
    fakeApi.on('GET', '/decks/deck-9', () => ok(theirs));
    show(<CopiedFrom copiedFromId="deck-9" />);

    expect(await screen.findByText('Copied from Mono Red')).toBeTruthy();
  });

  test('is left out when the original can no longer be opened', async () => {
    fakeApi.on('GET', '/decks/deck-9', () => failure(401, 'DMD034'));
    show(<CopiedFrom copiedFromId="deck-9" />);

    await waitFor(() => expect(fakeApi.requestsTo('/decks/deck-9')).toHaveLength(1));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.queryByText(/Copied from/)).toBeNull();
  });
});

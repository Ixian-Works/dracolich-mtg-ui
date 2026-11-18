import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SetScreen from '@/app/(app)/sets/[code]';
import SetsScreen from '@/app/(app)/sets/index';
import { SetRow, releaseMonth } from '@/components/set-row';
import type { SetDto } from '@/lib/queries/sets';
import { deferred, failure, fakeApi, ok, type Reply } from '@/test/fake-api';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  router: { replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ code: 'mh3' }),
  Link: ({ children }: { children: ReactNode }) => children,
}));

const mh3: SetDto = {
  id: 'set-1',
  name: 'Modern Horizons 3',
  code: 'mh3',
  collection_set_type: 'DRAFT_INNOVATION',
  release_date: '2024-06-14',
  icon_svg_uri: 'https://svgs.scryfall.io/sets/mh3.svg',
  card_count: 303,
};
const noSymbol: SetDto = { id: 'set-2', name: 'Secret Lair Drop', code: 'sld', collection_set_type: 'BOX', release_date: '2019-12-02' };

const page = <T,>(content: T[], last = true) => ({
  content,
  totalElements: content.length,
  totalPages: 1,
  size: 40,
  number: 0,
  first: true,
  last,
  empty: content.length === 0,
});

let queryClient: QueryClient;
afterEach(() => queryClient?.clear());

function show(element: React.ReactElement) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe('a set row', () => {
  test('a set with no symbol shows its code in a badge', () => {
    render(<SetRow set={noSymbol} onPress={() => {}} />);
    expect(screen.getByTestId('set-code-badge')).toBeTruthy();
    expect(screen.getByText('SLD')).toBeTruthy();
  });

  test('a set with a symbol shows no badge, and its caption is code, type and month', () => {
    render(<SetRow set={mh3} onPress={() => {}} />);
    expect(screen.queryByTestId('set-code-badge')).toBeNull();
    expect(screen.getByText('MH3 · Draft innovation · June 2024')).toBeTruthy();
  });

  test('the release month is never shifted by the time zone', () => {
    expect(releaseMonth('2024-06-01')).toBe('June 2024');
  });
});

describe('the Sets list', () => {
  test('loading, then the sets, leaving digital-only sets out', async () => {
    const answer = deferred<Reply>();
    fakeApi.on('POST', '/sets/search', () => answer.promise);
    show(<SetsScreen />);

    expect(screen.getByLabelText('Loading sets')).toBeTruthy();
    answer.resolve(ok(page([mh3, noSymbol])));

    expect(await screen.findByText('Modern Horizons 3')).toBeTruthy();
    const request = fakeApi.requestsTo('/sets/search')[0];
    expect(request.body).toEqual({ digital: false });
    expect(request.query).toEqual({ page: '0', size: '40' });
  });

  test('a type and the digital switch change what is asked for', async () => {
    fakeApi.on('POST', '/sets/search', () => ok(page([mh3])));
    show(<SetsScreen />);
    await screen.findByText('Modern Horizons 3');

    fireEvent.press(screen.getByText('Commander'));
    fireEvent(screen.getByLabelText('Include digital-only sets'), 'valueChange', true);

    await waitFor(() =>
      expect(fakeApi.requestsTo('/sets/search').at(-1)?.body).toEqual({ collection_set_type: 'COMMANDER' })
    );
  });

  test('nothing found says so, with the query, and Clear search', async () => {
    jest.useFakeTimers();
    fakeApi.on('POST', '/sets/search', () => ok(page([])));
    show(<SetsScreen />);

    fireEvent.changeText(screen.getByLabelText('Search sets by name'), 'zzz');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    jest.useRealTimers();

    expect(await screen.findByText('No set matches “zzz”.')).toBeTruthy();
    expect(screen.getByText('Clear search')).toBeTruthy();
    expect(fakeApi.requestsTo('/sets/search').at(-1)?.query).toEqual({ name: 'zzz', page: '0', size: '40' });
  });

  test('a failure offers Retry, which asks again', async () => {
    fakeApi.on('POST', '/sets/search', () => failure(503, 'DMD001'));
    show(<SetsScreen />);

    fireEvent.press(await screen.findByText('Retry'));

    await waitFor(() => expect(fakeApi.requestsTo('/sets/search')).toHaveLength(2));
  });

  test('a row opens its set page', async () => {
    fakeApi.on('POST', '/sets/search', () => ok(page([mh3])));
    show(<SetsScreen />);

    fireEvent.press(await screen.findByText('Modern Horizons 3'));

    expect(mockPush).toHaveBeenCalledWith('/sets/mh3');
  });
});

describe("a set's page", () => {
  test('the header, the note, and the cards searched by this set', async () => {
    fakeApi.on('GET', '/sets', () => ok(mh3));
    fakeApi.on('POST', '/cards/search', () =>
      ok(page([{ id: 'c1', name: 'Ugin, Eye of the Storms', default_face: { full_type: 'Legendary Planeswalker — Ugin' } }]))
    );
    show(<SetScreen />);

    expect(await screen.findByText('Modern Horizons 3')).toBeTruthy();
    expect(screen.getByText('MH3 · Draft innovation · June 14, 2024 · 303 cards')).toBeTruthy();
    expect(
      screen.getByText('Some cards from this set may be missing. Dracolich holds one printing of each card for now.')
    ).toBeTruthy();
    expect(await screen.findByText('Ugin, Eye of the Storms')).toBeTruthy();
    expect(fakeApi.requestsTo('/sets')[0].query).toEqual({ code: 'mh3' });
    expect(fakeApi.requestsTo('/cards/search')[0].body).toEqual({ set_code: 'mh3' });
  });

  test('a set with no cards says so', async () => {
    fakeApi.on('GET', '/sets', () => ok(mh3));
    fakeApi.on('POST', '/cards/search', () => ok(page([])));
    show(<SetScreen />);

    expect(await screen.findByText('No cards from this set yet.')).toBeTruthy();
  });
});

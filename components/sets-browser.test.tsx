import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SetScreen from '@/app/(app)/sets/[code]';
import SetsScreen from '@/app/(app)/sets/index';
import { SET_ROW_HEIGHT, SetRow, releaseMonth } from '@/components/set-row';
import { COMMON_SET_TYPES, OTHER_SET_TYPES } from '@/components/set-type-picker';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
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

  test('a row is 56 points tall, the strip height', () => {
    expect(SET_ROW_HEIGHT).toBe(56);
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

    fireEvent.press(screen.getByRole('button', { name: 'Type' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Commander' }));
    expect(screen.getByRole('button', { name: 'Type: Commander' })).toBeTruthy();
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

describe('the Type control', () => {
  test('one button; its list has the five common types, a divider, then the rest A to Z', async () => {
    fakeApi.on('POST', '/sets/search', () => ok(page([mh3])));
    show(<SetsScreen />);
    await screen.findByText('Modern Horizons 3');

    // One control, not a chip per type.
    expect(screen.queryByText('Expansion')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Type' }));

    const names = screen.getAllByRole('menuitem').map((item) => item.props.accessibilityLabel ?? '');
    const labels = screen.getAllByRole('menuitem').map((item) => {
      const texts = item.findAll((n: any) => typeof n.props.children === 'string');
      return texts[0].props.children as string;
    });
    expect(labels.slice(0, 5)).toEqual(['Expansion', 'Core', 'Masters', 'Commander', 'Draft innovation']);
    expect(labels.slice(5)).toEqual([...labels.slice(5)].sort((a, b) => a.localeCompare(b)));
    expect(labels).toHaveLength(COMMON_SET_TYPES.length + OTHER_SET_TYPES.length);
    expect(names).toHaveLength(24);
    expect(screen.getByTestId('set-type-divider')).toBeTruthy();
    await act(async () => {});
  });

  test('a chosen type can be cleared', async () => {
    fakeApi.on('POST', '/sets/search', () => ok(page([mh3])));
    show(<SetsScreen />);
    await screen.findByText('Modern Horizons 3');

    fireEvent.press(screen.getByRole('button', { name: 'Type' }));
    fireEvent.press(screen.getByRole('menuitem', { name: 'Masters' }));
    await waitFor(() =>
      expect(fakeApi.requestsTo('/sets/search').at(-1)?.body).toEqual({ collection_set_type: 'MASTERS', digital: false })
    );

    fireEvent.press(screen.getByRole('button', { name: 'Clear type' }));
    expect(screen.getByRole('button', { name: 'Type' })).toBeTruthy();
    await waitFor(() => expect(fakeApi.requestsTo('/sets/search').at(-1)?.body).toEqual({ digital: false }));
  });
});

describe("a set's page", () => {
  test('while it loads: placeholders, never a spinner', async () => {
    const answer = deferred<Reply>();
    fakeApi.on('GET', '/sets', () => answer.promise);
    fakeApi.on('POST', '/cards/search', () => ok(page([])));
    show(<SetScreen />);

    expect(screen.getByLabelText('Loading the set')).toBeTruthy();
    expect(screen.getAllByTestId('row-placeholder')).toHaveLength(8);
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    answer.resolve(ok(mh3));
    await screen.findByText('Modern Horizons 3');
    await screen.findByText('No cards from this set yet.');
  });

  test('a code that is no set: "No set with that code." and Browse sets', async () => {
    fakeApi.on('GET', '/sets', () => failure(404, 'DMD021'));
    fakeApi.on('POST', '/cards/search', () => ok(page([])));
    show(<SetScreen />);

    expect(await screen.findByText('No set with that code.')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Browse sets' }));
    expect(router.replace).toHaveBeenCalledWith('/sets');
  });

  test('a failed request still offers Retry', async () => {
    fakeApi.on('GET', '/sets', () => failure(503, 'DMD001'));
    fakeApi.on('POST', '/cards/search', () => ok(page([])));
    show(<SetScreen />);

    expect(await screen.findByText("This set didn't load. Check your connection and try again.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

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

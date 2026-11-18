import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeckPileGrid } from '@/components/deck-pile-grid';
import { DeckPileView } from '@/components/deck-pile-view';
import type { DeckDto } from '@/lib/queries/decks';

/** Lightning Bolt in the deck and in the sideboard, as two entries. */
const deck = {
  id: 'deck-1',
  name: 'Burn',
  format: 'MODERN',
  cards: [
    { card_id: 'bolt', name: 'Lightning Bolt', count: 4, card_category: 'MAINBOARD', type_line: 'Instant' },
    { card_id: 'bolt', name: 'Lightning Bolt', count: 2, card_category: 'SIDEBOARD', type_line: 'Instant' },
  ],
} as DeckDto;

test('phones: a tap on the sideboard copy reports the sideboard', () => {
  const onCardPress = jest.fn();
  render(<DeckPileView deck={deck} containerWidth={360} onCardPress={onCardPress} />);

  const copies = screen.getAllByLabelText('Lightning Bolt');
  fireEvent.press(copies[copies.length - 1]);
  fireEvent.press(copies[0]);

  expect(onCardPress.mock.calls).toEqual([
    ['bolt', 'SIDEBOARD'],
    ['bolt', 'MAINBOARD'],
  ]);
});

test('wide screens: a tap on the sideboard copy reports the sideboard', () => {
  const onCardPress = jest.fn();
  render(<DeckPileGrid deck={deck} containerWidth={900} onCardPress={onCardPress} />);

  const copies = screen.getAllByLabelText('Lightning Bolt');
  fireEvent.press(copies[copies.length - 1]);
  fireEvent.press(copies[0]);

  expect(onCardPress.mock.calls).toEqual([
    ['bolt', 'SIDEBOARD'],
    ['bolt', 'MAINBOARD'],
  ]);
});

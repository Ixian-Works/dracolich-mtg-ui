import { editorTargetFor, removalFor, removeButtonLabel } from '@/lib/boards';
import type { DeckDto } from '@/lib/queries/decks';

/** Lightning Bolt in two boards: four in the deck, two in the sideboard. */
const deck = {
  id: 'deck-1',
  name: 'Burn',
  commander: [{ card_id: 'krenko', name: 'Krenko', count: 1 }],
  cards: [
    { card_id: 'bolt', name: 'Lightning Bolt', count: 4, card_category: 'MAINBOARD', type_line: 'Instant' },
    { card_id: 'bolt', name: 'Lightning Bolt', count: 2, card_category: 'SIDEBOARD', type_line: 'Instant' },
    { card_id: 'shock', name: 'Shock', count: 1, card_category: 'MAYBE_BOARD', type_line: 'Instant' },
  ],
} as DeckDto;

describe('removing a tapped card (wide screens)', () => {
  test('a tap on the sideboard copy removes only the sideboard entry, and says so', () => {
    const removal = removalFor(deck, 'bolt', 'SIDEBOARD');
    expect(removal?.board).toBe('SIDEBOARD');
    expect(removal?.entry.count).toBe(2);
    expect(removal?.message).toBe('Remove both copies of Lightning Bolt from your sideboard?');
  });

  test('a tap on the deck copy removes only the deck entry', () => {
    const removal = removalFor(deck, 'bolt', 'MAINBOARD');
    expect(removal?.entry.count).toBe(4);
    expect(removal?.message).toBe('Remove all 4 copies of Lightning Bolt from your deck?');
  });

  test('one copy in the maybe board is named in a sentence', () => {
    expect(removalFor(deck, 'shock', 'MAYBE_BOARD')?.message).toBe('Remove Shock from your maybe board?');
  });

  test('a board that does not hold the card, or a commander, removes nothing', () => {
    expect(removalFor(deck, 'shock', 'SIDEBOARD')).toBeUndefined();
    expect(removalFor(deck, 'krenko', undefined)).toBeUndefined();
  });
});

describe('opening the editor on a tapped card (phones)', () => {
  test('a tap on the sideboard copy opens the sideboard entry, not the deck copy', () => {
    const target = editorTargetFor(deck, 'bolt', 'SIDEBOARD');
    expect(target?.board).toBe('SIDEBOARD');
    expect(target?.entry.count).toBe(2);
  });

  test('a tap on the commander opens the commander', () => {
    expect(editorTargetFor(deck, 'krenko', undefined)?.entry.name).toBe('Krenko');
  });
});

test("the Remove button's name says which board it removes from", () => {
  expect(removeButtonLabel({ name: 'Lightning Bolt', card_category: 'SIDEBOARD' })).toBe(
    'Remove Lightning Bolt from your sideboard'
  );
  expect(removeButtonLabel({ name: 'Lightning Bolt' })).toBe('Remove Lightning Bolt from your deck');
});

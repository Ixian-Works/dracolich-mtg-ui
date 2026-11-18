// A deck's boards, and what a tap on a card in one of them acts on.
//
// A card can sit in several boards as separate entries. Every tap, prompt and
// removal acts on the entry in the board that was tapped, never on the card's
// entries in other boards.

import type { CardBoard, DeckCardDto, DeckDto } from "@/lib/queries/decks";

/** A board's name as a label: Deck, Sideboard, Maybe. */
export const BOARD_LABEL: Record<CardBoard, string> = {
  MAINBOARD: "Deck",
  SIDEBOARD: "Sideboard",
  MAYBE_BOARD: "Maybe",
};

/** A board's name inside a sentence, after "your": "your deck", "your maybe board". */
export const BOARD_IN_SENTENCE: Record<CardBoard, string> = {
  MAINBOARD: "deck",
  SIDEBOARD: "sideboard",
  MAYBE_BOARD: "maybe board",
};

/** The board an entry sits in. An entry saved without one is in the deck. */
export function boardOf(card: Pick<DeckCardDto, "card_category">): CardBoard {
  return card.card_category ?? "MAINBOARD";
}

/** The entry of `cardId` in `board`, or undefined if that board doesn't hold it. */
export function entryIn(deck: DeckDto | undefined, cardId: string, board: CardBoard): DeckCardDto | undefined {
  return (deck?.cards ?? []).find((c) => c.card_id === cardId && boardOf(c) === board);
}

function copies(count: number): string {
  return count === 2 ? "both copies" : `all ${count} copies`;
}

/**
 * What removing a tapped card asks, and the one entry it removes: the card's
 * entry in the board that was tapped. Undefined when that board doesn't hold
 * the card, or for a commander, which isn't removed this way.
 */
export function removalFor(
  deck: DeckDto | undefined,
  cardId: string,
  board: CardBoard | undefined
): { entry: DeckCardDto; board: CardBoard; message: string } | undefined {
  if (!board) return undefined;
  const entry = entryIn(deck, cardId, board);
  if (!entry) return undefined;
  const count = entry.count ?? 1;
  const where = `your ${BOARD_IN_SENTENCE[board]}`;
  const message =
    count > 1 ? `Remove ${copies(count)} of ${entry.name} from ${where}?` : `Remove ${entry.name} from ${where}?`;
  return { entry, board, message };
}

/**
 * The entry a tap opens the card editor on: the tapped board's entry, or the
 * commander's when no board was given. The editor shows that board's pile.
 */
export function editorTargetFor(
  deck: DeckDto | undefined,
  cardId: string,
  board: CardBoard | undefined
): { entry: DeckCardDto; board: CardBoard } | undefined {
  if (board) {
    const entry = entryIn(deck, cardId, board);
    return entry ? { entry, board } : undefined;
  }
  const commander = (deck?.commander ?? []).find((c) => c.card_id === cardId);
  return commander ? { entry: commander, board: "MAINBOARD" } : undefined;
}

/** The Remove button's name for screen readers, naming the row's board. */
export function removeButtonLabel(card: Pick<DeckCardDto, "name" | "card_category">): string {
  return `Remove ${card.name} from your ${BOARD_IN_SENTENCE[boardOf(card)]}`;
}

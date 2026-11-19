// A deck as text: one card per line, "<count> <name>", grouped by board under
// a "//" heading each.
//
// The Deck section comes first. Today's importer (deck-builder's
// DeckTextParser) doesn't know a "// Deck" heading and keeps the section it
// was in, so "// Commander" then "// Deck" would bring the whole deck back as
// commanders. Written Deck first, the text imports back as the same list.
// Alia agreed on Ixian-Works/dracolich-mtg-ui#35; Commander can go first again
// once Ixian-Works/dracolich-mtg-deck-builder-api#30 teaches the importer
// "// Deck".

import type { DeckCardDto, DeckDto } from "@/lib/queries/decks";

const byName = (a: DeckCardDto, b: DeckCardDto) => (a.name ?? "").localeCompare(b.name ?? "");

function section(heading: string, cards: DeckCardDto[]): string | null {
  if (cards.length === 0) return null;
  const lines = [...cards].sort(byName).map((card) => `${card.count ?? 1} ${card.name ?? ""}`);
  return [`// ${heading}`, ...lines].join("\n");
}

export function deckExportText(deck: DeckDto): string {
  const cards = deck.cards ?? [];
  const on = (board: string) => cards.filter((card) => (card.card_category ?? "MAINBOARD") === board);
  return [
    section("Deck", on("MAINBOARD")),
    section("Commander", deck.commander ?? []),
    section("Sideboard", on("SIDEBOARD")),
    section("Maybe", on("MAYBE_BOARD")),
  ]
    .filter((part): part is string => part !== null)
    .join("\n\n")
    .concat("\n");
}

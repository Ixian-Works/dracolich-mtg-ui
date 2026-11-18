// Favorite decks: the signed-in player's favorites listing, the star's state
// derived from it, and the toggle.
//
// deck-builder answers POST/DELETE /favorites?deck_id= with only `true`, and a
// deck doesn't say whether the viewer has favorited it. So the player's own
// listing, GET /users/{id}/favorites, is the source of both the Favorites
// screen and the star's state. It holds exactly the decks a star can show on:
// other players' public decks. One page of FAVORITES_PAGE_SIZE covers a
// player's first 100 favorites.

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { api } from "../api";
import { useAuth } from "../auth";
import type { PageRecord } from "./cards";
import type { DeckDto } from "./decks";

export const FAVORITES_PAGE_SIZE = 100;

export const favoritesKey = (userId: string | undefined) => ["favorites", userId ?? "signed-out"] as const;

/** The signed-in player's favorite decks. Disabled when signed out. */
export function useFavoriteDecks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: favoritesKey(user?.userId),
    enabled: !!user,
    queryFn: () =>
      api.deckBuilder<PageRecord<DeckDto>>(`/users/${user!.userId}/favorites`, {
        params: { page: 0, size: FAVORITES_PAGE_SIZE },
      }),
  });
}

/** Whether the signed-in player has favorited this deck. False while loading or signed out. */
export function useIsFavorite(deckId: string | undefined): boolean {
  const favorites = useFavoriteDecks();
  return !!deckId && (favorites.data?.content ?? []).some((deck) => deck.id === deckId);
}

/** Moves a deck's favorites count by `delta` in every cached copy of it. */
function shiftCount(qc: QueryClient, deckId: string, delta: number) {
  const shift = (deck: DeckDto): DeckDto =>
    deck.id === deckId
      ? { ...deck, favorites_count: Math.max(0, (deck.favorites_count ?? 0) + delta) }
      : deck;
  for (const [key, data] of qc.getQueriesData<unknown>({ queryKey: ["decks"] })) {
    if (!data || typeof data !== "object") continue;
    if ("content" in data && Array.isArray((data as PageRecord<DeckDto>).content)) {
      const page = data as PageRecord<DeckDto>;
      qc.setQueryData(key, { ...page, content: page.content.map(shift) });
    } else if ("id" in data) {
      qc.setQueryData(key, shift(data as DeckDto));
    }
  }
}

/**
 * Favorite or unfavorite a deck. The star and the count change at once; on
 * failure both go back and the error reaches the caller.
 */
export function useToggleFavorite() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = favoritesKey(user?.userId);

  return useMutation({
    mutationFn: ({ deck, favorite }: { deck: DeckDto; favorite: boolean }) =>
      api.deckBuilder<boolean>("/favorites", {
        method: favorite ? "POST" : "DELETE",
        params: { deck_id: deck.id },
      }),
    onMutate: async ({ deck, favorite }) => {
      await qc.cancelQueries({ queryKey: key });
      await qc.cancelQueries({ queryKey: ["decks"] });
      const previousFavorites = qc.getQueryData<PageRecord<DeckDto>>(key);
      const previousDecks = qc.getQueriesData<unknown>({ queryKey: ["decks"] });

      const content = previousFavorites?.content ?? [];
      const already = content.some((d) => d.id === deck.id);
      if (favorite !== already) {
        const counted = { ...deck, favorites_count: Math.max(0, (deck.favorites_count ?? 0) + (favorite ? 1 : -1)) };
        qc.setQueryData<PageRecord<DeckDto>>(key, {
          ...(previousFavorites ?? emptyPage()),
          content: favorite ? [counted, ...content] : content.filter((d) => d.id !== deck.id),
          totalElements: (previousFavorites?.totalElements ?? content.length) + (favorite ? 1 : -1),
        });
        shiftCount(qc, deck.id, favorite ? 1 : -1);
      }
      return { previousFavorites, previousDecks };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData(key, ctx.previousFavorites);
      for (const [queryKey, data] of ctx.previousDecks) qc.setQueryData(queryKey, data);
    },
    onSettled: (_data, _err, { deck }) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["decks", "byId", deck.id] });
    },
  });
}

function emptyPage(): PageRecord<DeckDto> {
  return {
    content: [],
    totalElements: 0,
    totalPages: 0,
    size: FAVORITES_PAGE_SIZE,
    number: 0,
    first: true,
    last: true,
    empty: true,
  };
}

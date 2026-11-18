// The card library's sets: a searchable, paged list and one set by its code.

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api } from "../api";
import type { PageRecord } from "./cards";

export interface SetDto {
  id: string;
  name: string;
  code: string;
  block?: string;
  collection_set_type?: SetType;
  release_date?: string; // ISO date, "2024-06-14"
  icon_svg_uri?: string;
  card_count?: number;
  digital?: boolean;
}

/** The library's set types, in the order the Type filter offers them. */
export const SET_TYPES = [
  "EXPANSION",
  "CORE",
  "MASTERS",
  "COMMANDER",
  "DRAFT_INNOVATION",
  "FUNNY",
  "STARTER",
  "BOX",
  "DUEL_DECK",
  "FROM_THE_VAULT",
  "SPELLBOOK",
  "PREMIUM_DECK",
  "ARSENAL",
  "MASTERPIECE",
  "PLANECHASE",
  "ARCHENEMY",
  "VANGUARD",
  "TREASURE_CHEST",
  "PROMO",
  "TOKEN",
  "MEMORABILIA",
  "MINIGAME",
  "ALCHEMY",
  "ETERNAL",
] as const;
export type SetType = (typeof SET_TYPES)[number];

/** A set type as a label: "DRAFT_INNOVATION" is "Draft innovation". */
export function setTypeLabel(type: SetType | undefined): string {
  if (!type) return "";
  const words = type.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const SET_PAGE_SIZE = 40;

/**
 * False while the library imports one printing of each card, so a set's page
 * shows only some of its cards. Turn on with
 * Ixian-Works/dracolich-mtg-library-api#12, and the note on set pages goes.
 */
export const LIBRARY_HOLDS_EVERY_PRINTING = false;

/**
 * Sets matching a name and a type, a page at a time. Digital-only sets are
 * left out unless `includeDigital`. The library can't sort sets yet, so they
 * come in its order.
 */
export function useInfiniteSets({
  name,
  type,
  includeDigital = false,
}: {
  name?: string;
  type?: SetType;
  includeDigital?: boolean;
}) {
  return useInfiniteQuery({
    queryKey: ["sets", "search", { name: name || undefined, type, includeDigital }],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const body: Record<string, unknown> = {};
      if (type) body.collection_set_type = type;
      if (!includeDigital) body.digital = false;
      return api.mtgLibrary<PageRecord<SetDto>>("/sets/search", {
        method: "POST",
        params: { name: name || undefined, page: pageParam, size: SET_PAGE_SIZE },
        data: body,
      });
    },
    getNextPageParam: (lastPage) => (lastPage.last ? undefined : lastPage.number + 1),
  });
}

/** One set, by its code as the library stores it (lower case, "mh3"). */
export function useSetByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["sets", "byCode", code],
    enabled: !!code,
    queryFn: () => api.mtgLibrary<SetDto>("/sets", { params: { code } }),
  });
}

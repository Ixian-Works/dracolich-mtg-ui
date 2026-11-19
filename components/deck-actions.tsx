// The deck page's actions (Ixian-Works/dracolich-mtg-ui#35, Alia's layout).
//
//   The owner:      Edit (primary), Share, Export, Duplicate
//   Anyone else:    Copy to my decks (primary), Favorite, Share, Export
//
// On a wide screen they sit in one row. On a phone the primary action is full
// width and the rest are behind one "More" button, in a sheet with a line
// under each. An action shows only to a viewer who can use it.

import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, Share, Text, View, useWindowDimensions } from "react-native";

import { PrimaryButton, SecondaryButton } from "@/components/buttons";
import { ExportDeckSheet } from "@/components/export-deck-sheet";
import { FavoriteToggle } from "@/components/favorite-toggle";
import { Sheet } from "@/components/sheet";
import { useAuth } from "@/lib/auth";
import { DECK_ACTIONS, type SignInReason } from "@/lib/copy";
import { deckLink } from "@/lib/deck-link";
import { showFeedback } from "@/lib/feedback";
import { useCopyDeck, type DeckDto } from "@/lib/queries/decks";
import { useIsFavorite, useToggleFavorite } from "@/lib/queries/favorites";
import { palette } from "@/lib/tokens";


const WIDE_BREAKPOINT = 768;

interface Action {
  key: string;
  label: string;
  line: string;
  onPress: () => void;
  disabled?: boolean;
  reason?: string;
}

export function DeckActions({ deck }: { deck: DeckDto }) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const { user } = useAuth();
  const isOwner = !!user && deck.user_id === user.userId;
  const linkable = deck.visibility === "PUBLIC" || deck.visibility === "UNLISTED";

  const copyDeck = useCopyDeck();
  const favorited = useIsFavorite(deck.id);
  const toggleFavorite = useToggleFavorite();
  const [exporting, setExporting] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const signIn = (reason: SignInReason) => router.push({ pathname: "/login", params: { reason } });

  const copy = (duplicate: boolean) => {
    if (!user) return signIn("copy");
    copyDeck.mutate(deck.id, {
      onSuccess: (made) => {
        router.push(`/decks/${made.id}/build` as any);
        showFeedback({ kind: "success", title: duplicate ? DECK_ACTIONS.duplicated : DECK_ACTIONS.copied });
      },
      onError: () => showFeedback({ kind: "error", title: DECK_ACTIONS.copyFailed }),
    });
  };

  const share = async () => {
    const url = deckLink(deck.id);
    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(url);
      showFeedback({ kind: "success", title: DECK_ACTIONS.linkCopied });
    } else {
      await Share.share({ message: url, url, title: deck.name }).catch(() => {});
    }
  };

  const edit: Action = { key: "edit", ...DECK_ACTIONS.edit, onPress: () => router.push(`/decks/${deck.id}/build` as any) };
  const copyAction: Action = {
    key: "copy",
    ...DECK_ACTIONS.copy,
    label: copyDeck.isPending ? DECK_ACTIONS.copying : DECK_ACTIONS.copy.label,
    disabled: copyDeck.isPending,
    onPress: () => copy(false),
  };
  const shareAction: Action = {
    key: "share",
    ...DECK_ACTIONS.share,
    label: Platform.OS === "web" ? DECK_ACTIONS.copyLink : DECK_ACTIONS.share.label,
    onPress: share,
    // Until the Share sheet of #31, a private deck's owner can't share it, and
    // is told why.
    disabled: !linkable,
    reason: linkable ? undefined : DECK_ACTIONS.privateShare,
  };
  const exportAction: Action = { key: "export", ...DECK_ACTIONS.export, onPress: () => setExporting(true) };
  const duplicate: Action = {
    key: "duplicate",
    ...DECK_ACTIONS.duplicate,
    disabled: copyDeck.isPending,
    onPress: () => copy(true),
  };
  const favoriteAction: Action = {
    key: "favorite",
    ...(favorited ? DECK_ACTIONS.unfavorite : DECK_ACTIONS.favorite),
    onPress: () => {
      if (!user) return signIn("favorites");
      toggleFavorite.mutate(
        { deck, favorite: !favorited },
        { onError: () => showFeedback({ kind: "error", title: DECK_ACTIONS.favoriteFailed }) }
      );
    },
  };

  // Someone else's deck can be copied only while it's public; a viewer who can
  // see a private deck is its owner.
  const primary: Action | null = isOwner ? edit : deck.visibility === "PUBLIC" ? copyAction : null;
  const others: Action[] = isOwner ? [shareAction, exportAction, duplicate] : [favoriteAction, shareAction, exportAction];

  const exportSheet = <ExportDeckSheet deck={deck} visible={exporting} onClose={() => setExporting(false)} />;

  if (isWide) {
    return (
      <View className="mt-4 flex-row flex-wrap items-start" style={{ gap: 12 }}>
        {primary && <PrimaryButton label={primary.label} onPress={primary.onPress} disabled={primary.disabled} />}
        {others.map((action) =>
          action.key === "favorite" ? (
            <FavoriteToggle key="favorite" deck={deck} />
          ) : (
            <View key={action.key} style={{ maxWidth: 220 }}>
              <SecondaryButton label={action.label} onPress={action.onPress} disabled={action.disabled} />
              {action.reason && <Text className="mt-1 text-xs text-bone-dim">{action.reason}</Text>}
            </View>
          )
        )}
        {exportSheet}
      </View>
    );
  }

  return (
    <View className="mt-4" style={{ gap: 12 }}>
      {primary && <PrimaryButton label={primary.label} onPress={primary.onPress} disabled={primary.disabled} fill />}
      <View className="flex-row items-center justify-between">
        {!isOwner && <FavoriteCount deck={deck} />}
        <SecondaryButton label={DECK_ACTIONS.more} onPress={() => setMoreOpen(true)} />
      </View>
      <Sheet visible={moreOpen} title={deck.name} onClose={() => setMoreOpen(false)}>
        {others.map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityHint={action.reason ?? action.line}
            accessibilityState={{ disabled: !!action.disabled }}
            disabled={action.disabled}
            onPress={() => {
              setMoreOpen(false);
              action.onPress();
            }}
            className="border-b border-hairline py-3 hover:bg-lair-700 active:bg-lair-700"
            style={{ minHeight: 56, opacity: action.disabled ? 0.6 : 1 }}
          >
            <Text className="text-base text-bone">{action.label}</Text>
            <Text className="mt-1 text-sm text-bone-dim">{action.reason ?? action.line}</Text>
          </Pressable>
        ))}
      </Sheet>
      {exportSheet}
    </View>
  );
}

/** On a phone the star moves into More; its count stays on the page. */
function FavoriteCount({ deck }: { deck: DeckDto }) {
  const count = deck.favorites_count ?? 0;
  return (
    <View
      className="flex-row items-center"
      style={{ gap: 4 }}
      accessible
      accessibilityLabel={`${count.toLocaleString()} ${count === 1 ? "favorite" : "favorites"}`}
    >
      <Ionicons name="star-outline" size={16} color={palette.boneDim} />
      <Text className="text-sm text-bone-dim">{count.toLocaleString()}</Text>
    </View>
  );
}


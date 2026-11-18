// Favorites: the community decks the player has starred.
//
// A grid of deck boxes from the player's favorites listing, with the four
// states every screen has: loading, empty, error and ready. Unstarring a deck
// here takes its box out at once and offers Undo for five seconds.
//
// The order is the listing's, by when each deck last changed, not by when it
// was favorited: the deck builder doesn't record that yet
// (Ixian-Works/dracolich-mtg-deck-builder-api#32).

import { Link, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { DeckTile } from "@/components/deck-tile";
import { FavoriteToggle } from "@/components/favorite-toggle";
import { PageContent } from "@/components/page-content";
import { useAuth } from "@/lib/auth";
import { showFeedback } from "@/lib/feedback";
import type { DeckDto } from "@/lib/queries/decks";
import { useFavoriteDecks, useToggleFavorite } from "@/lib/queries/favorites";
import { palette } from "@/lib/tokens";

const TILE_WIDTH = 180;
const PLACEHOLDERS = 6;
const UNDO_MS = 5000;

export default function FavoritesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const favorites = useFavoriteDecks();
  const toggle = useToggleFavorite();

  const offerUndo = useCallback(
    (deck: DeckDto) => {
      showFeedback({
        kind: "success",
        title: "Removed from favorites",
        message: deck.name,
        autoCloseMs: UNDO_MS,
        action: { label: "Undo", onPress: () => toggle.mutate({ deck, favorite: true }) },
      });
    },
    [toggle]
  );

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 64 }}>
      <PageContent style={{ paddingHorizontal: 24 }}>
        <Text
          className="pt-8 font-brand text-bone"
          style={{ fontSize: 32, fontWeight: "700" }}
          accessibilityRole="header"
        >
          Favorites
        </Text>

        <View style={{ marginTop: 24 }}>
          {!user ? (
            <Message
              text="Sign in to keep favorites."
              actionLabel="Sign in"
              onAction={() => router.push("/login")}
            />
          ) : favorites.isLoading ? (
            <Grid>
              {Array.from({ length: PLACEHOLDERS }, (_, i) => (
                <Placeholder key={i} />
              ))}
            </Grid>
          ) : favorites.error ? (
            <Message
              text={`Your favorites didn't load. ${(favorites.error as Error).message}`}
              actionLabel="Retry"
              onAction={() => favorites.refetch()}
            />
          ) : (favorites.data?.content ?? []).length === 0 ? (
            <Message
              text="No favorites yet. Star a deck to keep it here."
              actionLabel="Browse decks"
              href="/decks"
            />
          ) : (
            <Grid>
              {(favorites.data?.content ?? []).map((deck) => (
                <DeckTile
                  key={deck.id}
                  deck={deck}
                  width={TILE_WIDTH}
                  onPress={() => router.push(`/decks/${deck.id}` as any)}
                  footer={<FavoriteToggle deck={deck} onUnfavorite={offerUndo} />}
                />
              ))}
            </Grid>
          )}
        </View>
      </PageContent>
    </ScrollView>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>{children}</View>;
}

function Placeholder() {
  return (
    <View
      accessibilityLabel="Loading"
      style={{
        width: TILE_WIDTH,
        aspectRatio: 63 / 88,
        borderRadius: 16,
        backgroundColor: palette.lair800,
        opacity: 0.6,
      }}
    />
  );
}

function Message({
  text,
  actionLabel,
  onAction,
  href,
}: {
  text: string;
  actionLabel: string;
  onAction?: () => void;
  href?: string;
}) {
  const button = (
    <Pressable
      onPress={onAction}
      accessibilityRole="button"
      className="mt-4 self-start rounded-md border border-hoard-gold px-4 py-2"
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text className="text-sm text-hoard-gold">{actionLabel}</Text>
    </Pressable>
  );
  return (
    <View>
      <Text className="text-bone-dim" style={{ fontSize: 15 }}>
        {text}
      </Text>
      {href ? (
        <Link href={href as any} asChild>
          {button}
        </Link>
      ) : (
        button
      )}
    </View>
  );
}

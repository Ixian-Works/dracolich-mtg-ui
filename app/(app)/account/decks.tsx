// My decks — the user's own deck collection.
//
// Two sections: Ready (status=READY_TO_PLAY) and Drafts (status=DRAFT).
// Drafts are decks the user started in the wizard but didn't finalize via
// step 4. They live on the server (the wizard creates the deck up front at
// step 1) but are intentionally hidden from the dashboard's "Your recent
// decks" rail so they don't compete with finished work.
//
// Auth gate: showing a "Sign in to see your decks" hero for anonymous
// visitors, matching the /account hub behavior.

import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DeckTile } from "@/components/deck-tile";
import { PageContent } from "@/components/page-content";
import { useAuth } from "@/lib/auth";
import { useMyDecks, type DeckDto } from "@/lib/queries/decks";
import { alpha, palette } from "@/lib/tokens";

const TILE_WIDTH = 180;

export default function MyDecksScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Two separate queries — keeps the empty-state messaging per section
  // simple and lets each refetch independently after a deck transition
  // (e.g. finalize a draft, only the Ready section refetches).
  const readyDecks = useMyDecks({
    status: "READY_TO_PLAY",
    size: 50,
  });
  const draftDecks = useMyDecks({ status: "DRAFT", size: 50 });

  if (!user) {
    return <SignInPrompt />;
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 64 }}
    >
      <PageContent style={{ paddingHorizontal: 24 }}>
        <View className="pt-8" style={{ gap: 8 }}>
          <Text
            className="font-brand text-bone"
            style={{
              fontSize: 32,
              fontWeight: "700",
              ...(Platform.OS === "web"
                ? ({ textShadow: `0 0 22px ${alpha(palette.soulfire, 0.45)}` } as object)
                : {}),
            }}
          >
            My decks
          </Text>
          <Text className="text-bone-dim" style={{ fontSize: 14 }}>
            Your saved deck collection, including drafts in progress.
          </Text>
        </View>

        <DeckSection
          icon="checkmark-circle-outline"
          iconColor={palette.success}
          title="Ready"
          subtitle="Finalized decks ready to play."
          query={readyDecks}
          emptyHint="No finished decks yet. Hit “Finalize” on a draft to publish it."
          onDeckPress={(deck) => router.push(`/decks/${deck.id}` as any)}
        />

        <DeckSection
          icon="document-text-outline"
          iconColor={palette.soulfire}
          title="Drafts"
          subtitle="Decks you started but haven’t finalized — pick up where you left off."
          query={draftDecks}
          emptyHint="No drafts in progress."
          // Drafts resume in the build wizard rather than the read-only
          // detail page so the user can keep editing.
          onDeckPress={(deck) =>
            router.push(`/decks/${deck.id}/build` as any)
          }
          spacingTop={36}
        />
      </PageContent>
    </ScrollView>
  );
}

// ---------- Section ----------

function DeckSection({
  icon,
  iconColor,
  title,
  subtitle,
  query,
  emptyHint,
  onDeckPress,
  spacingTop = 32,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  title: string;
  subtitle: string;
  query: ReturnType<typeof useMyDecks>;
  emptyHint: string;
  onDeckPress: (deck: DeckDto) => void;
  spacingTop?: number;
}) {
  const { data, isLoading, error } = query;
  const decks = data?.content ?? [];
  const count = data?.totalElements ?? decks.length;

  return (
    <View style={{ marginTop: spacingTop }}>
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Ionicons name={icon} size={20} color={iconColor} />
          <Text
            className="font-brand text-bone"
            style={{ fontSize: 22, fontWeight: "600" }}
          >
            {title}
          </Text>
          {data && (
            <Text className="text-xs text-bone-dim">
              ({count.toLocaleString()})
            </Text>
          )}
        </View>
      </View>
      <Text className="mb-4 text-xs text-bone-dim">{subtitle}</Text>

      {isLoading && (
        <View className="items-center py-8">
          <ActivityIndicator color={palette.soulfire} />
        </View>
      )}

      {error && (
        <View className="rounded-md bg-danger/20 p-3">
          <Text className="text-sm text-danger">
            {(error as Error).message}
          </Text>
        </View>
      )}

      {!isLoading && !error && decks.length === 0 && (
        <View className="items-center justify-center rounded-lg border border-dashed border-hairline py-10">
          <Text
            className="text-sm text-bone-dim"
            style={{ textAlign: "center", paddingHorizontal: 16 }}
          >
            {emptyHint}
          </Text>
        </View>
      )}

      {decks.length > 0 && (
        <View className="flex-row flex-wrap" style={{ gap: 16 }}>
          {decks.map((deck) => (
            <DeckTile
              key={deck.id}
              deck={deck}
              width={TILE_WIDTH}
              onPress={() => onDeckPress(deck)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------- Sign in prompt ----------

function SignInPrompt() {
  return (
    <View className="flex-1 items-center justify-center bg-lair-900 p-6">
      <Text className="font-brand text-3xl text-hoard-gold">My decks</Text>
      <Text className="mt-2 text-center text-bone-dim">
        Sign in to see your saved decks and drafts.
      </Text>
      <Link href="/login" asChild>
        <Pressable className="mt-6 rounded-md bg-soulfire px-6 py-3">
          <Text className="font-semibold text-white">Sign in</Text>
        </Pressable>
      </Link>
    </View>
  );
}

// Decks browse page.
//
// Two horizontal-scroll carousel rows:
//   - Popular  → GET /decks/popular (sorted by favoritesCount DESC)
//   - Newest   → GET /decks/latest  (sorted by created_at DESC)
//
// Tapping a deck navigates to /decks/[id] (detail comes in the next step).
//
// Note: we're using horizontal snap-scroll rather than the Pokemon-style
// swipe stack from the Cards screen — for a "browse" page with two
// sections, multiple items visible at once is more useful than the
// focused-showcase one-at-a-time pattern. Easy to swap to the swipe
// stack later if the Decks page needs to lean into showpiece UX.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DeckTile } from "@/components/deck-tile";
import { PageContent } from "@/components/page-content";
import {
  useLatestDecks,
  usePopularDecks,
  type DeckDto,
} from "@/lib/queries/decks";
import { alpha, palette } from "@/lib/tokens";

export default function DecksScreen() {
  const router = useRouter();
  const popular = usePopularDecks({ size: 10 });
  const latest = useLatestDecks({ size: 10 });

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="py-6"
      // Pull-to-refresh refetches both rows.
      refreshControl={
        <RefreshControl
          refreshing={popular.isRefetching || latest.isRefetching}
          onRefresh={() => {
            popular.refetch();
            latest.refetch();
          }}
        />
      }
    >
      <PageContent>
        <View className="mb-6 px-6">
          <View className="flex-row items-center justify-between">
            <Text
              className="font-brand text-bone"
              style={{
                fontSize: 32,
                fontWeight: "700",
                // Match the dashboard hero's purple text-shadow on web so
                // the brand title carries the same mystical glow across
                // top-level routes.
                ...(Platform.OS === "web"
                  ? ({ textShadow: `0 0 22px ${alpha(palette.soulfire, 0.45)}` } as object)
                  : {}),
              }}
            >
              Decks
            </Text>
            <Pressable
              onPress={() => router.push("/decks/new" as any)}
              className="flex-row items-center rounded-full bg-soulfire px-4 py-2 hover:bg-soulfire/90 active:bg-soulfire/80"
              // Single object — see comment in app/(app)/index.tsx
              // QuickActionCard for why we avoid style arrays here.
              style={{
                gap: 6,
                ...(Platform.OS === "web"
                  ? ({ boxShadow: `0 0 18px ${alpha(palette.soulfire, 0.45)}` } as object)
                  : {
                      shadowColor: palette.soulfire,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.45,
                      shadowRadius: 12,
                    }),
              }}
            >
              <Ionicons name="add" size={16} color={palette.white} />
              <Text className="font-semibold text-white">New deck</Text>
            </Pressable>
          </View>
          <Text className="mt-1 text-bone-dim">
            Browse community decks and your own collection.
          </Text>
        </View>

        <DeckRow
          title="Popular"
          query={popular}
          onDeckPress={(d) => router.push(`/decks/${d.id}` as any)}
        />

        <View style={{ height: 32 }} />

        <DeckRow
          title="Newest"
          query={latest}
          onDeckPress={(d) => router.push(`/decks/${d.id}` as any)}
        />
      </PageContent>
    </ScrollView>
  );
}

interface DeckRowProps {
  title: string;
  query: ReturnType<typeof usePopularDecks>;
  onDeckPress: (deck: DeckDto) => void;
}

function DeckRow({ title, query, onDeckPress }: DeckRowProps) {
  const { data, isLoading, error } = query;
  return (
    <View>
      <View className="mb-3 flex-row items-baseline justify-between px-6">
        <Text className="text-xs uppercase tracking-wider text-bone-dim">
          {title}
        </Text>
        {data && (
          <Text className="text-xs text-bone-dim">
            {data.totalElements.toLocaleString()} total
          </Text>
        )}
      </View>

      {isLoading && (
        <View className="items-center py-6">
          <ActivityIndicator size="small" color={palette.hoardGold} />
        </View>
      )}

      {error && (
        <View className="mx-6 rounded-md bg-danger/20 p-3">
          <Text className="text-sm text-danger">
            Failed to load {title.toLowerCase()} decks.
          </Text>
        </View>
      )}

      {data && data.content.length === 0 && !isLoading && (
        <View className="mx-6 rounded-md border border-hairline bg-lair-700 p-3">
          <Text className="text-sm text-bone-dim">
            No decks yet — check back once the community has built some.
          </Text>
        </View>
      )}

      {data && data.content.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
          snapToInterval={192} // tile width (180) + gap (12)
          decelerationRate="fast"
        >
          {data.content.map((deck) => (
            <DeckTile
              key={deck.id}
              deck={deck}
              onPress={() => onDeckPress(deck)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

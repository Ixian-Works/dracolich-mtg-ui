// One set: its header, then its cards from card search, already filtered to
// the set, with the colour and type filters.
//
// The library holds one printing of each card for now, so a card is in one
// set only and a set looks incomplete. A note says so until it holds every
// printing (Ixian-Works/dracolich-mtg-library-api#12).

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View, useWindowDimensions } from "react-native";

import { CardDetailPanel } from "@/components/card-detail-panel";
import { CardDetailSheet } from "@/components/card-detail-sheet";
import { CardTile } from "@/components/card-tile";
import { ColorFilterChips, TypeFilterChips, toggleSetKey } from "@/components/filter-chips";
import { PageContent } from "@/components/page-content";
import { SetSymbol } from "@/components/set-row";
import { useInfiniteSearchCards } from "@/lib/queries/cards";
import { LIBRARY_HOLDS_EVERY_PRINTING, setTypeLabel, useSetByCode, type SetDto } from "@/lib/queries/sets";
import { palette } from "@/lib/tokens";

const WIDE_BREAKPOINT = 768;
const SIDE_PANEL_WIDTH = 440;

function releaseDate(isoDate: string | undefined): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function SetScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const set = useSetByCode(code);
  const [colors, setColors] = useState<Set<string>>(() => new Set());
  const [types, setTypes] = useState<Set<string>>(() => new Set());
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const cards = useInfiniteSearchCards({
    setCode: code,
    colorIdentity: colors.size > 0 ? Array.from(colors) : undefined,
    types: types.size > 0 ? Array.from(types) : undefined,
  });
  const rows = useMemo(() => cards.data?.pages.flatMap((page) => page.content) ?? [], [cards.data]);
  const closeDetail = useCallback(() => setSelectedCardId(null), []);

  if (set.isLoading) {
    return (
      <View className="flex-1 items-center justify-center" accessibilityLabel="Loading the set">
        <ActivityIndicator size="large" color={palette.soulfire} />
      </View>
    );
  }
  if (set.error || !set.data) {
    return (
      <Message
        text="This set didn't load. Check your connection and try again."
        action="Retry"
        onAction={() => set.refetch()}
      />
    );
  }

  const header = (
    <PageContent>
      <SetHeader set={set.data} />
      {!LIBRARY_HOLDS_EVERY_PRINTING && (
        <View className="mx-6 mb-4 flex-row items-start" style={{ gap: 8 }}>
          <Ionicons name="information-circle-outline" size={18} color={palette.boneDim} />
          <Text className="flex-1 text-sm text-bone-dim">
            Some cards from this set may be missing. Dracolich holds one printing of each card for now.
          </Text>
        </View>
      )}
      <View className="mb-3">
        <ColorFilterChips selected={colors} onToggle={(c) => setColors((s) => toggleSetKey(s, c))} />
      </View>
      <View className="mb-4">
        <TypeFilterChips selected={types} onToggle={(t) => setTypes((s) => toggleSetKey(s, t))} />
      </View>
    </PageContent>
  );

  let body: React.ReactElement | null = null;
  if (cards.isLoading) {
    body = (
      <View className="items-center py-8" accessibilityLabel="Loading cards">
        <ActivityIndicator size="large" color={palette.soulfire} />
      </View>
    );
  } else if (cards.error) {
    body = (
      <Message
        text="The cards didn't load. Check your connection and try again."
        action="Retry"
        onAction={() => cards.refetch()}
      />
    );
  } else if (rows.length === 0) {
    body = (
      <View className="px-6">
        <Text className="text-bone-dim">No cards from this set yet.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <FlatList
        className="flex-1"
        data={body ? [] : rows}
        keyExtractor={(card) => card.id}
        renderItem={({ item }) => (
          <View className="px-6">
            <CardTile card={item} mode="list" onPress={() => setSelectedCardId(item.id)} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={body}
        onEndReached={() => {
          if (cards.hasNextPage && !cards.isFetchingNextPage) cards.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 48, paddingRight: isWide && selectedCardId ? SIDE_PANEL_WIDTH : 0 }}
      />
      {isWide ? (
        <CardDetailPanel cardId={selectedCardId} onClose={closeDetail} width={SIDE_PANEL_WIDTH} />
      ) : (
        <CardDetailSheet cardId={selectedCardId} onClose={closeDetail} />
      )}
    </View>
  );
}

function SetHeader({ set }: { set: SetDto }) {
  const details = [
    set.code.toUpperCase(),
    setTypeLabel(set.collection_set_type),
    releaseDate(set.release_date),
    set.card_count != null ? `${set.card_count.toLocaleString()} cards` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View className="px-6 pt-6 pb-4" style={{ gap: 8 }}>
      <SetSymbol set={set} size={40} />
      <Text className="text-bone" style={{ fontSize: 32, fontWeight: "700" }} accessibilityRole="header">
        {set.name}
      </Text>
      <Text className="text-sm text-bone-dim">{details}</Text>
    </View>
  );
}

function Message({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <View className="px-6 pt-6">
      <Text className="text-bone-dim" style={{ fontSize: 15 }}>
        {text}
      </Text>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        className="mt-4 self-start rounded-md border px-4"
        style={{ minHeight: 44, justifyContent: "center", borderColor: palette.edge }}
      >
        <Text className="text-sm text-soulfire">{action}</Text>
      </Pressable>
    </View>
  );
}

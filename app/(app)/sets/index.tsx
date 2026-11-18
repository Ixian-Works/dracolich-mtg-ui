// The Sets browser: find a set by name, narrow by type, open its cards.
//
// A virtualised list, one row per set. Digital-only sets are left out unless
// the switch is on. The library can't sort sets yet, so rows come in its order
// with no year headings; they arrive with newest-first sorting.

import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { CardsSetsSwitch } from "@/components/cards-sets-switch";
import { Chip } from "@/components/filter-chips";
import { PageContent } from "@/components/page-content";
import { SET_ROW_HEIGHT, SetRow } from "@/components/set-row";
import { SET_TYPES, setTypeLabel, useInfiniteSets, type SetType } from "@/lib/queries/sets";
import { palette } from "@/lib/tokens";

const PLACEHOLDER_ROWS = 10;
const SEARCH_DEBOUNCE_MS = 250;

export default function SetsScreen() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<SetType | undefined>(undefined);
  const [includeDigital, setIncludeDigital] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setName(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const sets = useInfiniteSets({ name, type, includeDigital });
  const rows = useMemo(() => sets.data?.pages.flatMap((page) => page.content) ?? [], [sets.data]);

  const clearSearch = () => {
    setText("");
    setName("");
    setType(undefined);
  };

  const header = (
    <PageContent>
      <View className="px-6 pt-6">
        <CardsSetsSwitch current="sets" />
        <Text className="mb-4 font-brand text-3xl text-bone" accessibilityRole="header">
          Sets
        </Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Search sets by name"
          placeholderTextColor={palette.boneFaint}
          accessibilityLabel="Search sets by name"
          autoCorrect={false}
          className="rounded-md border px-3 text-bone"
          style={{ minHeight: 44, borderColor: palette.edge, backgroundColor: palette.lair700 }}
        />
      </View>
      <View className="mt-3 flex-row flex-wrap px-6" style={{ gap: 8 }}>
        {SET_TYPES.map((t) => (
          <Chip
            key={t}
            label={setTypeLabel(t)}
            selected={type === t}
            onPress={() => setType(type === t ? undefined : t)}
          />
        ))}
      </View>
      <View className="mt-3 mb-2 flex-row items-center px-6" style={{ gap: 10, minHeight: 44 }}>
        <Switch
          value={includeDigital}
          onValueChange={setIncludeDigital}
          accessibilityLabel="Include digital-only sets"
          trackColor={{ true: palette.soulfireDeep, false: palette.hairline }}
        />
        <Text className="text-sm text-bone-dim">Include digital-only sets</Text>
      </View>
    </PageContent>
  );

  let body: React.ReactElement | null = null;
  if (sets.isLoading) {
    body = (
      <View accessible accessibilityLabel="Loading sets">
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
          <View key={i} className="flex-row items-center px-6" style={{ height: SET_ROW_HEIGHT, gap: 14 }}>
            <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: palette.lair700 }} />
            <View style={{ flex: 1, height: 14, borderRadius: 4, backgroundColor: palette.lair700 }} />
          </View>
        ))}
      </View>
    );
  } else if (sets.error) {
    body = (
      <Message text="Sets didn't load. Check your connection and try again." action="Retry" onAction={() => sets.refetch()} />
    );
  } else if (rows.length === 0) {
    body = (
      <Message
        text={name ? `No set matches “${name}”.` : "No set matches."}
        action="Clear search"
        onAction={clearSearch}
      />
    );
  }

  return (
    <FlatList
      className="flex-1"
      data={body ? [] : rows}
      keyExtractor={(set) => set.id}
      renderItem={({ item }) => <SetRow set={item} onPress={() => router.push(`/sets/${item.code}` as any)} />}
      getItemLayout={(_, index) => ({ length: SET_ROW_HEIGHT, offset: SET_ROW_HEIGHT * index, index })}
      ListHeaderComponent={header}
      ListEmptyComponent={body}
      onEndReached={() => {
        if (sets.hasNextPage && !sets.isFetchingNextPage) sets.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ paddingBottom: 48 }}
    />
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

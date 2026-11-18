// One set in the Sets list: its symbol, or its code in a badge when it has
// none; the name; then code, type and release month.

import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { setTypeLabel, type SetDto } from "@/lib/queries/sets";
import { palette } from "@/lib/tokens";

/** The height of a row, the design's strip-height. */
export const SET_ROW_HEIGHT = 64;

/** "June 2024" from "2024-06-14". Read as a date, never shifted by the time zone. */
export function releaseMonth(isoDate: string | undefined): string {
  if (!isoDate) return "";
  const [year, month] = isoDate.split("-").map(Number);
  if (!year || !month) return "";
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Code, type and release month, as the row's caption. */
export function setCaption(set: SetDto): string {
  return [set.code.toUpperCase(), setTypeLabel(set.collection_set_type), releaseMonth(set.release_date)]
    .filter(Boolean)
    .join(" · ");
}

export function SetSymbol({ set, size }: { set: SetDto; size: number }) {
  if (set.icon_svg_uri) {
    return (
      <Image
        source={{ uri: set.icon_svg_uri }}
        style={{ width: size, height: size }}
        contentFit="contain"
        tintColor={palette.bone}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      testID="set-code-badge"
      className="items-center justify-center rounded border"
      style={{ minWidth: size, height: size, paddingHorizontal: 4, borderColor: palette.edge }}
    >
      <Text className="text-xs font-semibold text-bone-dim">{set.code.toUpperCase()}</Text>
    </View>
  );
}

export function SetRow({ set, onPress }: { set: SetDto; onPress: () => void }) {
  const caption = setCaption(set);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${set.name}, ${caption}`}
      className="flex-row items-center px-6 hover:bg-lair-700 active:bg-lair-700"
      style={{ height: SET_ROW_HEIGHT, gap: 14 }}
    >
      <SetSymbol set={set} size={28} />
      <View className="flex-1">
        <Text className="text-base text-bone" numberOfLines={1}>
          {set.name}
        </Text>
        <Text className="text-xs text-bone-dim" numberOfLines={1}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

// On a phone, Cards and Sets share one place: a switch at the top of both
// screens, so the tab bar stays at four. On a wide screen Sets is in the top
// bar and this draws nothing. It takes its side margin from the screen's
// padded block, so it lines up with the search field under it.

import { router } from "expo-router";
import { Pressable, Text, View, useWindowDimensions } from "react-native";

import { palette } from "@/lib/tokens";

const WIDE_BREAKPOINT = 768;

export function CardsSetsSwitch({ current }: { current: "cards" | "sets" }) {
  const { width } = useWindowDimensions();
  if (width >= WIDE_BREAKPOINT) return null;

  return (
    <View
      accessibilityRole="tablist"
      className="mb-4 flex-row rounded-full border"
      style={{ borderColor: palette.edge, padding: 2 }}
    >
      {(["cards", "sets"] as const).map((tab) => {
        const selected = tab === current;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={selected ? undefined : () => router.replace(tab === "cards" ? "/cards" : "/sets")}
            className="flex-1 items-center justify-center rounded-full"
            style={{ minHeight: 44, backgroundColor: selected ? palette.lair700 : "transparent" }}
          >
            <Text className={selected ? "text-sm font-semibold text-bone" : "text-sm text-bone-dim"}>
              {tab === "cards" ? "Cards" : "Sets"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

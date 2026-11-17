// "Under construction" placeholder used on routes that exist in the
// nav menu but aren't built yet (Settings, Favorite decks, etc).
// Replaces the dead-end 404 / blank screen with a themed surface so the
// app reads as "coming soon" rather than broken.
//
// Renders a centered card with a hammer icon, a brand-styled title, a
// short body line explaining what's coming, and a back-to-home button.
// Optional secondary action lets the consumer wire a back-to-section link.

import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import { alpha, palette } from "@/lib/tokens";

interface UnderConstructionProps {
  title: string;
  message?: string;
  // Optional secondary CTA back to a related section that does exist.
  secondaryLabel?: string;
  secondaryHref?: string;
}

export function UnderConstruction({
  title,
  message,
  secondaryLabel,
  secondaryHref,
}: UnderConstructionProps) {
  return (
    <View className="flex-1 items-center justify-center bg-lair-900 p-6">
      <View
        className="w-full max-w-md items-center rounded-lg border border-hairline p-8"
        style={{
          backgroundColor: alpha(palette.lair800, 0.78),
          ...(Platform.OS === "web"
            ? ({
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                boxShadow: `0 0 32px ${alpha(palette.soulfire, 0.25)}`,
              } as object)
            : {
                shadowColor: palette.soulfire,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 18,
              }),
        }}
      >
        {/* Decorative icon — purple glow on web. */}
        <View
          className="mb-5 items-center justify-center rounded-full bg-soulfire/15"
          style={{
            width: 72,
            height: 72,
            ...(Platform.OS === "web"
              ? ({ boxShadow: `0 0 28px ${alpha(palette.soulfire, 0.45)}` } as object)
              : {}),
          }}
        >
          <Ionicons name="construct-outline" size={36} color={palette.soulfire} />
        </View>

        <Text
          className="text-center font-brand text-bone"
          style={{
            fontSize: 26,
            fontWeight: "700",
            ...(Platform.OS === "web"
              ? ({ textShadow: `0 0 16px ${alpha(palette.soulfire, 0.4)}` } as object)
              : {}),
          }}
        >
          {title}
        </Text>
        <Text className="mt-2 text-center text-sm uppercase tracking-wider text-hoard-gold">
          Under construction
        </Text>

        <Text className="mt-4 text-center text-bone-dim">
          {message ?? "This corner of Dracolich is still being built. Check back soon — it'll be here."}
        </Text>

        <View
          className="mt-6 flex-row flex-wrap justify-center"
          style={{ gap: 12 }}
        >
          <Link href={"/" as any} asChild>
            <Pressable className="rounded-md bg-soulfire px-5 py-2.5 hover:bg-soulfire/90 active:bg-soulfire/80">
              <Text className="font-semibold text-white">Back to home</Text>
            </Pressable>
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link href={secondaryHref as any} asChild>
              <Pressable className="rounded-md border border-hairline px-5 py-2.5 hover:bg-lair-700 active:bg-lair-700/80">
                <Text className="text-bone">{secondaryLabel}</Text>
              </Pressable>
            </Link>
          )}
        </View>
      </View>
    </View>
  );
}

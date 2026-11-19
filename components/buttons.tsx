// The two button styles: primary is filled with soulfire-deep, the system's
// only fill; secondary has an edge border and soulfire text. Gold is kept for
// game objects. At least 44 points tall.

import { Pressable, Text } from "react-native";

import { palette } from "@/lib/tokens";

export function PrimaryButton({ label, onPress, disabled, fill }: { label: string; onPress: () => void; disabled?: boolean; fill?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className="items-center justify-center rounded-md px-5 hover:opacity-90 active:opacity-80"
      style={{ minHeight: 44, backgroundColor: palette.soulfireDeep, opacity: disabled ? 0.6 : 1, alignSelf: fill ? "stretch" : "flex-start" }}
    >
      <Text className="font-semibold text-bone">{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className="items-center justify-center rounded-md border px-4 hover:bg-lair-700 active:bg-lair-700"
      style={{ minHeight: 44, borderColor: palette.edge, opacity: disabled ? 0.5 : 1 }}
    >
      <Text className="text-sm text-soulfire">{label}</Text>
    </Pressable>
  );
}

// The app's one switch: soulfire-deep when on, hairline when off, a bone
// thumb. Every on/off control uses it so they stay alike.

import { Switch, type SwitchProps } from "react-native";

import { palette } from "@/lib/tokens";

export function ToggleSwitch(props: Omit<SwitchProps, "trackColor" | "thumbColor">) {
  return (
    <Switch
      {...props}
      trackColor={{ true: palette.soulfireDeep, false: palette.hairline }}
      thumbColor={palette.bone}
    />
  );
}

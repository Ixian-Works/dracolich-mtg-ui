// Settings: one column, groups of rows under a small heading. A row appears
// only when what it does exists, so change password, delete account, About,
// privacy and terms join as their pieces land (user-api#9 and #11, ui#10,
// #40 and #53). Laid out by Alia on Ixian-Works/dracolich-mtg-ui#37.

import Constants from "expo-constants";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { ToggleSwitch } from "@/components/toggle-switch";
import { SETTINGS, SIGN_OUT_CONFIRM } from "@/lib/copy";
import { useAuth } from "@/lib/auth";
import { confirmDialog } from "@/lib/dialogs";
import { useAssistantPreference } from "@/lib/preferences";
import { palette } from "@/lib/tokens";

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const assistant = useAssistantPreference();

  const signOut = async () => {
    if (await confirmDialog(SIGN_OUT_CONFIRM)) await logout();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
      <View style={{ width: "100%", maxWidth: 640 }}>
        <Text accessibilityRole="header" className="font-brand text-bone" style={{ fontSize: 32 }}>
          {SETTINGS.title}
        </Text>

        {user ? (
          <>
            <Group title={SETTINGS.account}>
              <Row label={SETTINGS.username} right={<Value text={user.username} />} />
              <Row label={SETTINGS.signOut} onPress={signOut} />
            </Group>

            <Group title={SETTINGS.assistant}>
              {/* The whole row is the switch: one target the row's height, read
                  as one switch with its name and state. */}
              <Row
                label={SETTINGS.counsel}
                hint={SETTINGS.counselHint}
                role="switch"
                checked={assistant.on}
                disabled={!assistant.loaded}
                onPress={() => assistant.setOn(!assistant.on)}
                right={
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
                    <ToggleSwitch value={assistant.on} disabled={!assistant.loaded} />
                  </View>
                }
              />
            </Group>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/login")}
            className="mt-8 items-center justify-center rounded-md px-6 hover:opacity-90 active:opacity-80"
            style={{ minHeight: 44, backgroundColor: palette.soulfireDeep }}
          >
            <Text className="font-semibold text-bone">{SETTINGS.signIn}</Text>
          </Pressable>
        )}

        <Text className="mt-10 text-xs text-bone-faint">
          {`${Constants.expoConfig?.version ?? ""} · ${SETTINGS.maker}`}
        </Text>
      </View>
    </ScrollView>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-8">
      <Text
        accessibilityRole="header"
        className="mb-2 text-xs uppercase tracking-widest text-bone-dim"
      >
        {title}
      </Text>
      <View className="border-t border-hairline">{children}</View>
    </View>
  );
}

function Row({
  label,
  hint,
  right,
  onPress,
  role = "button",
  checked,
  disabled,
}: {
  label: string;
  hint?: string;
  right?: ReactNode;
  onPress?: () => void;
  role?: "button" | "switch";
  checked?: boolean;
  disabled?: boolean;
}) {
  const body = (
    <>
      <View className="flex-1 pr-4">
        <Text className="text-base text-bone">{label}</Text>
        {hint && <Text className="mt-1 text-sm text-bone-dim">{hint}</Text>}
      </View>
      {right}
    </>
  );
  const style = { minHeight: 56 };
  const className = "flex-row items-center border-b border-hairline py-3";
  return onPress ? (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={role === "switch" ? { checked, disabled } : { disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`${className} hover:bg-lair-700 active:bg-lair-700`}
      style={style}
    >
      {body}
    </Pressable>
  ) : (
    <View className={className} style={style}>
      {body}
    </View>
  );
}

function Value({ text }: { text: string }) {
  return <Text className="text-base text-bone-dim">{text}</Text>;
}

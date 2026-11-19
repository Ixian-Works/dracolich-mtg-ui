// Settings: one column, groups of rows under a small heading. A row appears
// only when what it does exists, so change password, delete account, About,
// privacy and terms join as their pieces land (user-api#9 and #11, ui#10,
// #40 and #53). Laid out by Alia on Ixian-Works/dracolich-mtg-ui#37.

import Constants from "expo-constants";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";

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
        <Text accessibilityRole="header" className="font-brand text-3xl text-bone">
          {SETTINGS.title}
        </Text>

        {user ? (
          <>
            <Group title={SETTINGS.account}>
              <Row label={SETTINGS.username} right={<Value text={user.username} />} />
              <Row label={SETTINGS.signOut} onPress={signOut} />
            </Group>

            <Group title={SETTINGS.assistant}>
              <Row
                label={SETTINGS.counsel}
                hint={SETTINGS.counselHint}
                right={
                  <Switch
                    accessibilityLabel={SETTINGS.counsel}
                    accessibilityHint={SETTINGS.counselHint}
                    value={assistant.on}
                    disabled={!assistant.loaded}
                    onValueChange={assistant.setOn}
                    trackColor={{ false: palette.lair700, true: palette.soulfire }}
                    thumbColor={palette.bone}
                  />
                }
              />
            </Group>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/login")}
            className="mt-8 items-center justify-center rounded-md bg-soulfire px-6"
            style={{ minHeight: 44 }}
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
}: {
  label: string;
  hint?: string;
  right?: ReactNode;
  onPress?: () => void;
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
    <Pressable accessibilityRole="button" onPress={onPress} className={className} style={style}>
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

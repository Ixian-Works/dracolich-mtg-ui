// A sheet: rises from the bottom on a phone, a centred panel on a wide
// screen. The backdrop and the panel are siblings, so a tap inside the panel
// is never taken by the backdrop (the UI guide's gotcha 4). Back and Escape
// close it through the Modal's onRequestClose.

import type { ReactNode } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { alpha, palette } from "@/lib/tokens";

const WIDE_BREAKPOINT = 768;

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= WIDE_BREAKPOINT;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: alpha(palette.black, 0.5) }}
      />
      <View
        accessibilityViewIsModal
        style={
          isWide
            ? {
                position: "absolute",
                top: "15%",
                alignSelf: "center",
                width: 560,
                maxHeight: "70%",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: palette.edge,
                backgroundColor: palette.lair800,
                padding: 24,
              }
            : {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "85%",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                backgroundColor: palette.lair800,
                paddingHorizontal: 24,
                paddingTop: 20,
                paddingBottom: 24 + insets.bottom,
              }
        }
      >
        <Text accessibilityRole="header" className="mb-4 text-bone" style={{ fontSize: 20, fontWeight: "700" }}>
          {title}
        </Text>
        {children}
      </View>
    </Modal>
  );
}

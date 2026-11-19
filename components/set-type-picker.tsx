// The one Type control on the Sets list. A chip reading "Type", or
// "Type: Commander" with a clear button once one is chosen. It opens a sheet
// on a phone and a menu under the chip on a wide screen: the five common
// types first, the rest under a divider in alphabetical order.
// Laid out by Alia on Ixian-Works/dracolich-mtg-ui#57.

import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { SET_TYPES, setTypeLabel, type SetType } from "@/lib/queries/sets";
import { alpha, palette } from "@/lib/tokens";

const WIDE_BREAKPOINT = 768;
const MENU_WIDTH = 260;

export const COMMON_SET_TYPES: readonly SetType[] = ["EXPANSION", "CORE", "MASTERS", "COMMANDER", "DRAFT_INNOVATION"];

/** Every other type, by its label, A to Z. */
export const OTHER_SET_TYPES: readonly SetType[] = SET_TYPES.filter((t) => !COMMON_SET_TYPES.includes(t)).sort((a, b) =>
  setTypeLabel(a).localeCompare(setTypeLabel(b))
);

interface Props {
  value: SetType | undefined;
  onChange: (type: SetType | undefined) => void;
}

export function SetTypePicker({ value, onChange }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const chip = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    if (isWide && chip.current?.measureInWindow) {
      chip.current.measureInWindow((x, y, _w, h) => {
        setAnchor({ x, y: y + h + 4 });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  };
  const choose = (type: SetType) => {
    onChange(type);
    setOpen(false);
  };

  const label = value ? `Type: ${setTypeLabel(value)}` : "Type";

  return (
    <>
      <View ref={chip} className="flex-row items-center self-start rounded-full border" style={{ borderColor: value ? palette.soulfire : palette.edge }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Choose a set type"
          accessibilityState={{ expanded: open }}
          onPress={show}
          className="flex-row items-center pl-4"
          style={{ minHeight: 44, gap: 6, paddingRight: value ? 4 : 14 }}
        >
          <Text className={value ? "text-sm text-bone" : "text-sm text-bone-dim"}>{label}</Text>
          {!value && <Ionicons name="chevron-down" size={14} color={palette.boneDim} />}
        </Pressable>
        {value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear type"
            onPress={() => onChange(undefined)}
            className="items-center justify-center"
            style={{ width: 44, height: 44 }}
          >
            <Ionicons name="close" size={16} color={palette.boneDim} />
          </Pressable>
        )}
      </View>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* The backdrop and the list are siblings, so a tap on a type is never
            taken by the backdrop first (the UI guide's gotcha 4). */}
        <Pressable
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: isWide ? "transparent" : alpha(palette.black, 0.5) }}
        />
        <View
          accessibilityRole="menu"
          accessibilityLabel="Set types"
          style={
            isWide
              ? {
                  position: "absolute",
                  top: anchor?.y ?? 120,
                  left: anchor?.x ?? 24,
                  width: MENU_WIDTH,
                  maxHeight: 420,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: palette.edge,
                  backgroundColor: palette.lair800,
                }
              : {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  maxHeight: "75%",
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  backgroundColor: palette.lair800,
                  paddingBottom: 24,
                }
          }
        >
          {!isWide && (
            <Text accessibilityRole="header" className="px-6 pt-5 pb-2 text-xs uppercase tracking-widest text-bone-dim">
              Type
            </Text>
          )}
          <ScrollView>
            {COMMON_SET_TYPES.map((t) => (
              <Option key={t} type={t} selected={t === value} onPress={() => choose(t)} />
            ))}
            <View testID="set-type-divider" style={{ height: 1, marginVertical: 4, backgroundColor: palette.hairline }} />
            {OTHER_SET_TYPES.map((t) => (
              <Option key={t} type={t} selected={t === value} onPress={() => choose(t)} />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Option({ type, selected, onPress }: { type: SetType; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="flex-row items-center justify-between px-6 hover:bg-lair-700 focus:bg-lair-700"
      style={{ minHeight: 44 }}
    >
      <Text className={selected ? "text-base text-bone" : "text-base text-bone-dim"}>{setTypeLabel(type)}</Text>
      {selected && <Ionicons name="checkmark" size={18} color={palette.soulfire} />}
    </Pressable>
  );
}

// Export: the deck as text in a box the player can select, "Copy text" as
// the primary action with a toast, and on a phone "Share" for the system
// share sheet. Laid out by Alia on Ixian-Works/dracolich-mtg-ui#35.

import * as Clipboard from "expo-clipboard";
import { Platform, ScrollView, Share, Text, View } from "react-native";

import { PrimaryButton, SecondaryButton } from "@/components/buttons";
import { Sheet } from "@/components/sheet";
import { EXPORT_SHEET } from "@/lib/copy";
import { deckExportText } from "@/lib/deck-export";
import { showFeedback } from "@/lib/feedback";
import type { DeckDto } from "@/lib/queries/decks";
import { palette } from "@/lib/tokens";

export function ExportDeckSheet({ deck, visible, onClose }: { deck: DeckDto; visible: boolean; onClose: () => void }) {
  const text = deckExportText(deck);

  const copyText = async () => {
    await Clipboard.setStringAsync(text);
    showFeedback({ kind: "success", title: EXPORT_SHEET.copied });
  };

  return (
    <Sheet visible={visible} title={EXPORT_SHEET.title} onClose={onClose}>
      <ScrollView
        style={{ maxHeight: 320, borderWidth: 1, borderColor: palette.edge, borderRadius: 8, backgroundColor: palette.lair900 }}
        contentContainerStyle={{ padding: 12 }}
      >
        <Text selectable testID="export-text" className="text-sm text-bone" style={{ fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) }}>
          {text}
        </Text>
      </ScrollView>
      <Text className="mt-2 text-xs text-bone-faint">{EXPORT_SHEET.caption}</Text>

      <View className="mt-4 flex-row flex-wrap" style={{ gap: 12 }}>
        <PrimaryButton label={EXPORT_SHEET.copyText} onPress={copyText} />
        {Platform.OS !== "web" && (
          <SecondaryButton label={EXPORT_SHEET.share} onPress={() => Share.share({ message: text, title: deck.name }).catch(() => {})} />
        )}
        <SecondaryButton label={EXPORT_SHEET.close} onPress={onClose} />
      </View>
    </Sheet>
  );
}

// Full-screen card detail.
//
// Used by:
//   - narrow viewports (mobile), where the side panel doesn't fit
//   - direct deep links to /cards/{id}
//
// The wide-viewport in-app navigation from /cards uses the slide-in
// CardDetailPanel instead and never lands here.

import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { CardDetailContent } from "@/components/card-detail-content";

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) {
    return (
      <View className="flex-1 items-center justify-center bg-lair-900 p-6">
        <Text className="text-bone">No card id provided.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-lair-900">
      <View className="px-6 pt-4">
        <Pressable
          onPress={() => router.back()}
          className="self-start rounded-md px-3 py-1.5 hover:bg-lair-700 active:bg-lair-700"
        >
          <Text className="text-sm text-hoard-gold">← Back</Text>
        </Pressable>
      </View>

      <CardDetailContent cardId={id} />
    </View>
  );
}

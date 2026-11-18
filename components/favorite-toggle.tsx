// The favorite star with the deck's count beside it.
//
// Not favorited: an outline star in bone-dim. Favorited: a filled star in
// hoard-gold. A tap flips the star and the count in the same frame, with a
// small spring and one light haptic; a failed save puts both back and says so.
// Signed out, a tap opens sign-in. On the viewer's own deck it is only the
// count, with no button.

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAuth } from "@/lib/auth";
import type { SignInReason } from "@/lib/copy";
import { showFeedback } from "@/lib/feedback";
import type { DeckDto } from "@/lib/queries/decks";
import { useIsFavorite, useToggleFavorite } from "@/lib/queries/favorites";
import { palette } from "@/lib/tokens";


// The design system's spring-pop. It moves to the shared motion tokens with #32.
const SPRING_POP = { stiffness: 420, damping: 18 };

function countLabel(count: number): string {
  return count === 1 ? "1 favorite" : `${count.toLocaleString()} favorites`;
}

export function FavoriteToggle({
  deck,
  onUnfavorite,
}: {
  deck: DeckDto;
  // Called as the star goes off, such as for the Favorites screen's Undo.
  onUnfavorite?: (deck: DeckDto) => void;
}) {
  const { user } = useAuth();
  const favorited = useIsFavorite(deck.id);
  const toggle = useToggleFavorite();
  const scale = useSharedValue(1);
  const starStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const count = deck.favorites_count ?? 0;

  if (user && deck.user_id === user.userId) {
    return (
      <View
        className="flex-row items-center"
        style={{ gap: 4, minHeight: 44 }}
        accessible
        accessibilityLabel={countLabel(count)}
      >
        <Ionicons name="star-outline" size={16} color={palette.boneDim} />
        <Text className="text-sm text-bone-dim">{count.toLocaleString()}</Text>
      </View>
    );
  }

  const onPress = () => {
    if (!user) {
      router.push({ pathname: "/login", params: { reason: "favorites" satisfies SignInReason } });
      return;
    }
    scale.value = 1.25;
    scale.value = withSpring(1, SPRING_POP);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    if (favorited) onUnfavorite?.(deck);
    toggle.mutate(
      { deck, favorite: !favorited },
      {
        onError: () =>
          showFeedback({
            kind: "error",
            title: favorited ? "Couldn't remove the favorite" : "Couldn't save the favorite",
            message: "Your connection may have dropped. Try again.",
          }),
      }
    );
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="togglebutton"
      accessibilityLabel={`Favorite ${deck.name}`}
      accessibilityState={{ checked: favorited }}
      // Read after the name: "Favorite Mono Red, 12 favorites, on".
      accessibilityValue={{ text: countLabel(count) }}
      hitSlop={4}
      style={{
        minHeight: 44,
        minWidth: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingHorizontal: 6,
      }}
    >
      <Animated.View style={starStyle}>
        <Ionicons
          name={favorited ? "star" : "star-outline"}
          size={20}
          color={favorited ? palette.hoardGold : palette.boneDim}
        />
      </Animated.View>
      <Text className={favorited ? "text-sm text-hoard-gold" : "text-sm text-bone-dim"}>
        {count.toLocaleString()}
      </Text>
    </Pressable>
  );
}

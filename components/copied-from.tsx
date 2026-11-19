// "Copied from", then the original deck's name as a link, under a copy's
// title. Left out when the original is gone or can no longer be opened.

import { Link } from "expo-router";
import { Text } from "react-native";

import { DECK_ACTIONS } from "@/lib/copy";
import { useDeckOrigin } from "@/lib/queries/decks";
import { alpha, palette } from "@/lib/tokens";

export function CopiedFrom({ copiedFromId }: { copiedFromId: string | undefined }) {
  const origin = useDeckOrigin(copiedFromId);
  if (!origin.data) return null;
  return (
    <Text
      className="mt-1 text-sm text-bone-dim"
      style={{ textShadowColor: alpha(palette.black, 0.6), textShadowRadius: 6 }}
    >
      {`${DECK_ACTIONS.copiedFrom} `}
      <Link href={`/decks/${origin.data.id}` as any} accessibilityRole="link" className="text-soulfire underline">
        {origin.data.name}
      </Link>
    </Text>
  );
}

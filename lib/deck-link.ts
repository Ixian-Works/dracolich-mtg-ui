// The link to a deck, for Share. On the web it's the page's own address,
// which anyone can open while the deck is public or unlisted. On a phone it
// uses the app's link scheme, which Ixian-Works/dracolich-mtg-ui#9 may rename.

import * as Linking from "expo-linking";
import { Platform } from "react-native";

export function deckLink(deckId: string): string {
  const path = `/decks/${encodeURIComponent(deckId)}`;
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    return `${window.location.origin}${path}`;
  }
  return Linking.createURL(path);
}

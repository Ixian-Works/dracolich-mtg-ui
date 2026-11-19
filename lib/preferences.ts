// Settings kept on this device, not on the account. They outlive sign-out,
// because they belong to the device's owner, not to the player signed in.
//
// Each one is a TanStack Query entry over lib/storage.ts, so every screen
// that reads it sees a change at once. A cache reset (sign-out) only means
// the next read goes back to storage.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SETTINGS } from "./copy";
import { showFeedback } from "./feedback";

import { storage } from "./storage";

export const PreferenceKeys = {
  assistantOn: "dracolich.pref.assistant_on",
} as const;

const assistantKey = ["preferences", "assistantOn"] as const;

/**
 * Whether the assistant counsels while building. Off until the player turns
 * it on: nothing limits how much one player can ask of it yet.
 */
export function useAssistantPreference() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: assistantKey,
    queryFn: async () => (await storage.get(PreferenceKeys.assistantOn)) === "on",
    staleTime: Infinity,
  });
  const mutation = useMutation({
    mutationFn: (on: boolean) => storage.set(PreferenceKeys.assistantOn, on ? "on" : "off"),
    onMutate: (on) => {
      const before = queryClient.getQueryData<boolean>(assistantKey);
      queryClient.setQueryData(assistantKey, on);
      return { before };
    },
    onError: (_error, _on, context) => {
      queryClient.setQueryData(assistantKey, context?.before ?? false);
      showFeedback({ kind: "error", title: SETTINGS.saveFailed });
    },
  });
  return {
    on: query.data ?? false,
    loaded: query.isSuccess,
    setOn: (on: boolean) => mutation.mutate(on),
  };
}

/**
 * The builder's own assistant switch: it starts from the setting and, once
 * flipped, changes only the deck being built, never the setting.
 */
export function useAssistantForThisDeck(): [boolean, (on: boolean) => void] {
  const preference = useAssistantPreference();
  const [choice, setChoice] = useState<boolean | null>(null);
  return [choice ?? preference.on, setChoice];
}

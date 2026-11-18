// FeedbackProvider — small toast banner anchored at the top of the
// viewport. Replaces an earlier Modal-based design that stacked badly
// with confirmDialog (RN's <Modal> close+open race on the same tick
// would swallow the second mount, leaving the user staring at a frozen
// "Deleting…" forever).
//
// The toast renders as an absolutely-positioned card inside the
// provider's host View — no <Modal>, so there's nothing for confirmDialog
// to race with. Safe-area aware on iOS.
//
// API is unchanged: `showFeedback({ kind, title, ... })` returns a
// handle with `update()` to transition state and `close()` to dismiss.

import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import Animated, {
  SlideInUp,
  SlideOutUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type FeedbackHandle,
  type FeedbackState,
  clearFeedbackHandler,
  setFeedbackHandler,
} from "@/lib/feedback";
import { alpha, palette, radii } from "@/lib/tokens";

const DEFAULT_SUCCESS_MS = 1500;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<FeedbackState | null>(null);
  // Bumped on every update so the toast remounts and re-runs its
  // entrance animation when content changes (loading → success).
  const [iter, setIter] = useState(0);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  function clearTimer() {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }

  function scheduleAutoClose(state: FeedbackState) {
    clearTimer();
    if (state.kind !== "success") return;
    const ms = state.autoCloseMs ?? DEFAULT_SUCCESS_MS;
    if (ms <= 0) return;
    autoCloseTimerRef.current = setTimeout(() => {
      autoCloseTimerRef.current = null;
      setActive(null);
    }, ms);
  }

  useEffect(() => {
    setFeedbackHandler((initial): FeedbackHandle => {
      setActive(initial);
      setIter((n) => n + 1);
      scheduleAutoClose(initial);
      return {
        update: (next) => {
          setActive(next);
          setIter((n) => n + 1);
          scheduleAutoClose(next);
        },
        close: () => {
          clearTimer();
          setActive(null);
        },
      };
    });
    return clearFeedbackHandler;
    // scheduleAutoClose / clearTimer don't change identity across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount.
  useEffect(() => clearTimer, []);

  const dismiss = () => {
    clearTimer();
    setActive(null);
  };

  // Errors stay until dismissed (they carry information the user needs
  // to read). Loading + success are non-tap-dismissible (loading is
  // busy; success auto-closes on its own).
  const tapToDismiss = active?.kind === "error";

  return (
    <View style={{ flex: 1 }}>
      {children}
      {active && (
        <Animated.View
          key={iter}
          entering={SlideInUp.duration(180)}
          exiting={SlideOutUp.duration(140)}
          // Anchored at the top of the screen, edges with 12px gutters.
          // pointerEvents: "box-none" lets taps pass through except on
          // the Pressable child (which handles its own taps for errors).
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: insets.top + 12,
            left: 12,
            right: 12,
            zIndex: 9999,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={tapToDismiss ? dismiss : undefined}
            // Card-sized — sits at the top, doesn't claim the whole
            // screen. Width caps at 420 so it stays toast-shaped on
            // wide monitors instead of stretching edge-to-edge.
            style={{
              width: "100%",
              maxWidth: 420,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 14,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: borderColorFor(active.kind),
              backgroundColor: alpha(palette.lair800, 0.96),
              shadowColor: palette.black,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 18,
              ...(Platform.OS === "web"
                ? ({
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  } as object)
                : {}),
            }}
          >
            <FeedbackIcon kind={active.kind} />
            <View style={{ flex: 1 }}>
              <Text
                className="font-semibold text-bone"
                style={{ fontSize: 14 }}
                numberOfLines={1}
              >
                {active.title}
              </Text>
              {active.message && (
                <Text
                  className="text-bone-dim"
                  style={{ fontSize: 12, marginTop: 2 }}
                  numberOfLines={2}
                >
                  {active.message}
                </Text>
              )}
            </View>
            {active.action && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const { onPress } = active.action!;
                  dismiss();
                  onPress();
                }}
                hitSlop={8}
                style={{ minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 8 }}
              >
                <Text className="font-semibold text-soulfire" style={{ fontSize: 14 }}>
                  {active.action.label}
                </Text>
              </Pressable>
            )}
            {tapToDismiss && (
              <Ionicons name="close" size={18} color={palette.boneDim} />
            )}
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

function borderColorFor(kind: FeedbackState["kind"]): string {
  switch (kind) {
    case "loading":
      return alpha(palette.soulfire, 0.45);
    case "success":
      return alpha(palette.success, 0.45);
    case "error":
      return alpha(palette.danger, 0.45);
  }
}

function FeedbackIcon({ kind }: { kind: FeedbackState["kind"] }) {
  // Small circular icon — 36px so it sits beside the title nicely
  // without dominating the toast.
  if (kind === "loading") {
    return (
      <View
        className="items-center justify-center rounded-full bg-soulfire/15"
        style={{ width: 36, height: 36 }}
      >
        <ActivityIndicator size="small" color={palette.soulfire} />
      </View>
    );
  }
  if (kind === "success") {
    return (
      <View
        className="items-center justify-center rounded-full bg-success/15"
        style={{ width: 36, height: 36 }}
      >
        <Ionicons name="checkmark" size={22} color={palette.success} />
      </View>
    );
  }
  return (
    <View
      className="items-center justify-center rounded-full bg-danger/15"
      style={{ width: 36, height: 36 }}
    >
      <Ionicons name="alert-circle" size={22} color={palette.danger} />
    </View>
  );
}

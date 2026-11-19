// Words the interface owns. A screen that is told why it was opened gets a
// key, never a sentence, and picks its own words here. A key it doesn't know
// shows its usual words.
//
// The start of the one copy file Ixian-Works/dracolich-mtg-ui#12 asks for.

/** Why sign-in was opened, by the key a screen passes as `reason`. */
export const SIGN_IN_REASONS = {
  favorites: "Sign in to keep favorites.",
} as const;

export type SignInReason = keyof typeof SIGN_IN_REASONS;

export const SIGN_IN_DEFAULT = "Welcome back to Dracolich";

/** The line above the sign-in form for this `reason`, or the usual one. */
export function signInLine(reason: unknown): string {
  return typeof reason === "string" && Object.hasOwn(SIGN_IN_REASONS, reason)
    ? SIGN_IN_REASONS[reason as SignInReason]
    : SIGN_IN_DEFAULT;
}

/** The question before signing out, wherever sign-out is offered. */
export const SIGN_OUT_CONFIRM = {
  title: "Sign out?",
  message: "You'll need to sign in again to access your account.",
  confirmText: "Sign out",
  cancelText: "Cancel",
  destructive: true,
} as const;

export const SETTINGS = {
  title: "Settings",
  account: "Account",
  username: "Username",
  signOut: "Sign out",
  assistant: "Assistant",
  counsel: "Counsel while building",
  counselHint: "The dracolich suggests cards and reviews your deck as you build.",
  signIn: "Sign in",
  maker: "An Ixian Works product",
  saveFailed: "That setting didn't save. Try again.",
} as const;

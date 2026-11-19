// Words the interface owns. A screen that is told why it was opened gets a
// key, never a sentence, and picks its own words here. A key it doesn't know
// shows its usual words.
//
// The start of the one copy file Ixian-Works/dracolich-mtg-ui#12 asks for.

/** Why sign-in was opened, by the key a screen passes as `reason`. */
export const SIGN_IN_REASONS = {
  favorites: "Sign in to keep favorites.",
  copy: "Sign in to copy decks to your own.",
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

/**
 * The deck page's actions (Ixian-Works/dracolich-mtg-ui#35). Each has a label
 * and the one line the phone's More sheet shows under it.
 */
export const DECK_ACTIONS = {
  edit: { label: "Edit", line: "Change the cards and the details." },
  copy: { label: "Copy to my decks", line: "Make a private copy that is yours to change." },
  copying: "Copying",
  duplicate: { label: "Duplicate", line: "Make a private copy to try a variant." },
  share: { label: "Share", line: "Send the link to this deck." },
  copyLink: "Copy link",
  export: { label: "Export", line: "The list as text, to paste anywhere." },
  favorite: { label: "Favorite", line: "Keep this deck in your Favorites." },
  unfavorite: { label: "Unfavorite", line: "Take this deck out of your Favorites." },
  more: "More",
  privateShare: "This deck is private. Only you can open it.",
  linkCopied: "Link copied",
  copied: "Copied. This one is yours.",
  duplicated: "Duplicated. This is the copy.",
  copyFailed: "This deck didn't copy. Try again.",
  favoriteFailed: "That didn't save. Try again.",
  copiedFrom: "Copied from",
} as const;

export const EXPORT_SHEET = {
  title: "Export deck",
  copyText: "Copy text",
  share: "Share",
  caption: "Plain text, one card per line.",
  copied: "Deck list copied",
  close: "Close",
} as const;

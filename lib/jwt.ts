// Reads what an access token says about itself. Nothing here checks the
// signature: the services do that. The app only needs the claims to show who
// is signed in, and to know when the token stops being worth sending.

export interface AccessTokenClaims {
  sub?: string;
  username?: string;
  accessLevel?: string;
  /** Expiry, in seconds since the epoch. */
  exp?: number;
}

export function readClaims(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split(".")[1];
    // The payload is base64url without padding; atob wants base64 with it.
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/")));
    return claims !== null && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

/**
 * True when the token has expired, or will within `withinMs`.
 *
 * A token whose expiry can't be read is not called expired. This device can't
 * tell either way, so the server's answer decides.
 */
export function expiresWithin(token: string, withinMs: number, now: number = Date.now()): boolean {
  const exp = readClaims(token)?.exp;
  if (typeof exp !== "number") return false;
  return exp * 1000 - now <= withinMs;
}

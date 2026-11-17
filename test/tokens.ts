// Access tokens for tests. They have the shape user-api issues (the claims
// `sub`, `username`, `accessLevel` and `exp`) and a signature that is not one:
// the app never verifies it, and nothing here reaches a server that would.

import { StorageKeys, storage } from '@/lib/storage';

interface Claims {
  sub?: string;
  username?: string;
  accessLevel?: string;
}

function base64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * An access token whose `exp` is `seconds` from now. A negative number makes
 * one that has already expired. `label` only makes two tokens with the same
 * expiry different strings.
 */
export function accessTokenExpiringIn(seconds: number, label = 'a', claims: Claims = {}): string {
  const payload = {
    sub: 'user-1',
    username: 'jace',
    accessLevel: 'USER',
    ...claims,
    exp: Math.floor(Date.now() / 1000) + seconds,
  };
  return `${base64Url({ alg: 'ES384', typ: 'JWT' })}.${base64Url(payload)}.signature-${label}`;
}

/** Puts a pair of tokens where the app keeps them, as a login would have. */
export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await storage.set(StorageKeys.accessToken, accessToken);
  await storage.set(StorageKeys.refreshToken, refreshToken);
}

export async function storedTokens(): Promise<{ access: string | null; refresh: string | null }> {
  return {
    access: await storage.get(StorageKeys.accessToken),
    refresh: await storage.get(StorageKeys.refreshToken),
  };
}

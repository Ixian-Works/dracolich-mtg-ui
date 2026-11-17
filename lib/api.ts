// HTTP client wrapper for the dracolich backend.
// - Attaches the access token from secure storage, renewing it first when it
//   has expired or is about to, so no request leaves with a dead token
// - Auto-includes credentials (anon cookie for OWNED endpoints)
// - Unwraps DmdResponse<T> envelope → T
// - Throws ApiError with the response error envelope for non-2xx
// - On a 401, renews the access token (single-flight) and retries the
//   original request once
// - Ends the session only when user-api refuses the refresh token. A refresh
//   that fails any other way (no network, a timeout, a 5xx) keeps the tokens

import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { env } from "./env";
import { expiresWithin } from "./jwt";
import { StorageKeys, storage } from "./storage";

export interface DmdResponse<T> {
  success: boolean;
  httpStatus: string;
  message: string;
  payload: T | null;
  errors: Array<{ error: string; severity?: string; field?: string }> | null;
}

export class ApiError extends Error {
  status: number;
  errors: DmdResponse<unknown>["errors"];

  constructor(status: number, message: string, errors: DmdResponse<unknown>["errors"]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

// user-api no longer accepts this device's refresh token, so the player has to
// sign in again. Callers see an ApiError with status 401.
class SessionExpiredError extends ApiError {
  constructor() {
    super(401, "Your session has ended. Sign in again.", null);
  }
}

// Turns whatever a request failed with into an ApiError. `status` is 0 when
// no response arrived at all: no network, or a timeout.
function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError<DmdResponse<unknown>>(error)) {
    const body = error.response?.data;
    return new ApiError(
      error.response?.status ?? 0,
      body?.message ?? error.message ?? "Request failed",
      body?.errors ?? null
    );
  }
  return new ApiError(0, error instanceof Error ? error.message : "Request failed", null);
}

const REQUEST_TIMEOUT_MS = 15_000;

// /auth/* is how a session is made, renewed and ended. Those requests never
// wait on a refresh and are never retried through one.
function isAuthPath(url: string | undefined): boolean {
  return (url ?? "").includes("/auth/");
}

// ---------- Session ----------
//
// The two tokens live in storage. This module is the only place that writes
// or removes them, so that a refresh, a sign-in and a sign-out that overlap
// can't leave the device holding tokens for a session that is over.

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

// The AuthProvider registers a callback here on mount, and it is called once
// each time user-api ends the session. Keeps this module React-free while
// still letting auth state react to expiry.
let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpired = cb;
}

// Counts the times the session on this device was replaced or dropped. A
// refresh compares the count from before its request with the one after, to
// learn whether the session it renewed is still the one on this device.
let sessionChanges = 0;

async function writeTokens(tokens: TokenPair): Promise<void> {
  await storage.set(StorageKeys.accessToken, tokens.accessToken);
  await storage.set(StorageKeys.refreshToken, tokens.refreshToken);
}

/** Stores the tokens of a new sign-in. */
export async function storeSession(tokens: TokenPair): Promise<void> {
  sessionChanges += 1;
  await writeTokens(tokens);
}

/**
 * Forgets the tokens on this device. Resolves with the refresh token it held,
 * so the caller can hand it back to user-api with `revokeRefreshToken`.
 */
export async function clearSession(): Promise<string | null> {
  sessionChanges += 1;
  const refreshToken = await storage.get(StorageKeys.refreshToken);
  await storage.remove(StorageKeys.accessToken);
  await storage.remove(StorageKeys.refreshToken);
  return refreshToken;
}

/**
 * Asks user-api to revoke a refresh token. It never rejects: signing out on
 * this device must not depend on the network. A token that could not be
 * revoked stays valid on the server until its own expiry.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await axios.post(
      `${env.apiBase}${env.paths.user}/auth/logout`,
      { refreshToken },
      { timeout: REQUEST_TIMEOUT_MS }
    );
  } catch {
    // Nothing more to do from here.
  }
}

// ---------- Token refresh ----------

// How long before its expiry an access token counts as already dead. Covers
// the request's own travel time and a little drift between this device's
// clock and the server's.
const EXPIRY_LEEWAY_MS = 30_000;

// A token fresh from user-api that this device's clock says has expired
// already. Only the clock can be wrong about that, so this one token is sent
// until the server refuses it, instead of being renewed before every request.
let trustedDespiteClock: string | null = null;

/** True when an access token has to be renewed before it is sent anywhere. */
export function isStale(accessToken: string): boolean {
  return accessToken !== trustedDespiteClock && expiresWithin(accessToken, EXPIRY_LEEWAY_MS);
}

let refreshPromise: Promise<string> | null = null;

/**
 * Trades the stored refresh token for a new pair of tokens. Resolves with the
 * new access token.
 *
 * Single-flight: a refresh token works once, so every caller that arrives
 * while a refresh is running gets that refresh's promise.
 *
 * Rejects with an ApiError either way it fails:
 * - user-api refused the refresh token (401 or 403). The session is over: the
 *   tokens are gone and the AuthProvider has been told, once.
 * - the refresh could not be made (no network, a timeout, a 5xx). That says
 *   nothing about the session, so the tokens are kept.
 */
export function refreshSession(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = requestNewTokens().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function requestNewTokens(): Promise<string> {
  const session = sessionChanges;

  const refreshToken = await storage.get(StorageKeys.refreshToken);
  if (!refreshToken) {
    // An access token with nothing to renew it.
    await expireSession(session);
    throw new SessionExpiredError();
  }

  let body: DmdResponse<TokenPair>;
  let status: number;
  try {
    // A bare axios call, not `client`: the client's own interceptors would
    // wait on this very refresh.
    const response = await axios.post<DmdResponse<TokenPair>>(
      `${env.apiBase}${env.paths.user}/auth/refresh`,
      { refreshToken },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    body = response.data;
    status = response.status;
  } catch (error) {
    const failure = toApiError(error);
    if (failure.status === 401 || failure.status === 403) {
      await expireSession(session);
      throw new SessionExpiredError();
    }
    throw failure;
  }

  const tokens = body?.payload;
  if (!body?.success || !tokens?.accessToken || !tokens.refreshToken) {
    throw new ApiError(status, body?.message ?? "Refresh failed", body?.errors ?? null);
  }

  if (session !== sessionChanges) {
    // The player signed out, or signed in again, while this was on its way.
    // Storing these tokens would sign the old session back in. The refresh
    // token is valid on the server all the same, so hand it back.
    void revokeRefreshToken(tokens.refreshToken);
    throw new SessionExpiredError();
  }

  await writeTokens(tokens);
  trustedDespiteClock = expiresWithin(tokens.accessToken, EXPIRY_LEEWAY_MS)
    ? tokens.accessToken
    : null;
  return tokens.accessToken;
}

// user-api refused the refresh token. If the session it belonged to is still
// the one on this device, end it; if the player has signed out or in again
// meanwhile, there is nothing of it left to end.
async function expireSession(session: number): Promise<void> {
  if (session !== sessionChanges) return;
  await clearSession();
  onSessionExpired?.();
}

// ---------- Client setup ----------

const client: AxiosInstance = axios.create({
  baseURL: env.apiBase,
  withCredentials: true, // anon cookie passthrough
  timeout: REQUEST_TIMEOUT_MS,
});

client.interceptors.request.use(async (config) => {
  let token = await storage.get(StorageKeys.accessToken);
  if (token && isStale(token)) {
    // A dead token is never sent: recovering from one would depend on every
    // service answering it with a 401. If the refresh fails, this request
    // fails with the refresh's error and is not sent at all.
    token = isAuthPath(config.url) ? null : await refreshSession();
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    // The request interceptor gave up before sending: the refresh failed.
    if (error instanceof ApiError) throw error;

    const original = axios.isAxiosError(error)
      ? (error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined)
      : undefined;
    const status = axios.isAxiosError(error) ? (error.response?.status ?? 0) : 0;

    // Conditions for renewing the token and retrying:
    //   - 401 specifically
    //   - the request carried a token. A visitor's 401 is the server's plain
    //     answer, and there is no session to renew or to end
    //   - we haven't already retried this same request
    //   - the failing request isn't an /auth/* endpoint itself
    //     (login/register/refresh — those errors are real, not stale-token)
    const shouldRefresh =
      status === 401 &&
      original !== undefined &&
      !original._retried &&
      !isAuthPath(original.url) &&
      AxiosHeaders.from(original.headers).has("Authorization");

    if (shouldRefresh) {
      original._retried = true;
      // If this rejects, the caller gets the refresh's error: the session has
      // ended, or the refresh could not be made. Either says more about what
      // to do next than the 401 that led here.
      const accessToken = await refreshSession();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return client.request(original);
    }

    throw toApiError(error);
  }
);

// Generic request that unwraps DmdResponse<T>.payload.
//
// Throws only on `success: false`. A null payload is legitimate — DELETE
// and other no-content endpoints come back as
//   { success: true, payload: null, message: "..." }
// and an earlier "null payload also throws" rule was rejecting those
// (and incidentally any optimistic-but-null body field) as if they were
// errors. Callers expecting a non-null T should defend in their own
// code; the success flag is the canonical signal from the backend.
async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await client.request<DmdResponse<T>>(config);
  const body = response.data;
  if (!body.success) {
    throw new ApiError(response.status, body.message, body.errors);
  }
  return body.payload as T;
}

// Per-service helpers — prepend the service's base-path
export const api = {
  user: <T>(path: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url: `${env.paths.user}${path}` }),
  mtgLibrary: <T>(path: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url: `${env.paths.mtgLibrary}${path}` }),
  deckBuilder: <T>(path: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, url: `${env.paths.deckBuilder}${path}` }),
};

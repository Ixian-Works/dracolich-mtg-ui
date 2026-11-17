// Auth context: reads the stored session on mount, exposes user state + login/logout.
// Login calls user-api and stores the access/refresh tokens; the access token's
// claims say who the player is. Writing, renewing and removing the tokens is
// lib/api.ts's job.

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import {
  api,
  clearSession,
  isStale,
  refreshSession,
  revokeRefreshToken,
  setOnSessionExpired,
  storeSession,
} from "./api";
import { readClaims } from "./jwt";
import { StorageKeys, storage } from "./storage";

interface AuthUser {
  userId: string;
  username: string;
  accessLevel: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
}

interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

// user-api may either auto-confirm and return tokens, or require email
// confirmation first. The form decides what to do based on this shape.
type RegisterResult =
  | { autoSignedIn: true }
  | { autoSignedIn: false; message: string };

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Who an access token belongs to, read from its claims without verifying the
// signature. Verification happens server-side; the client only needs the
// claims for display.
function userFrom(accessToken: string): AuthUser | null {
  const claims = readClaims(accessToken);
  if (!claims || typeof claims.sub !== "string") return null;
  return {
    userId: claims.sub,
    username: claims.username ?? "",
    accessLevel: claims.accessLevel ?? "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Everything in the query cache was loaded for the player who was signed
  // in, private decks included. None of it is for whoever holds the device
  // next. A reset empties the cache and the screens showing it, and loads
  // what is on screen again as the visitor the device now is.
  const forgetPlayerData = useCallback(() => {
    queryClient.getMutationCache().clear();
    void queryClient.resetQueries();
  }, [queryClient]);

  // lib/api.ts calls this when user-api refuses the refresh token. By then
  // the tokens are gone; this brings the React state in line. Declared before
  // the effect below, which can start a refresh.
  useEffect(() => {
    setOnSessionExpired(() => {
      setUser(null);
      forgetPlayerData();
    });
    return () => setOnSessionExpired(null);
  }, [forgetPlayerData]);

  // Read the stored session on mount. Access tokens last 15 minutes, so after
  // any break the stored one has expired. It still says who the player is,
  // and the refresh token is what keeps them signed in, so the player is
  // shown at once and the access token is renewed in the background. No
  // request waits for this in order to be safe: lib/api.ts never sends a
  // stale token.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const accessToken = await storage.get(StorageKeys.accessToken);
      if (!mounted) return;
      setUser(accessToken ? userFrom(accessToken) : null);
      setLoading(false);
      if (accessToken && isStale(accessToken)) {
        refreshSession().catch(() => {
          // Refused by user-api: the callback above has signed the player
          // out. Not reachable: they stay signed in, and each request fails
          // with the network's own error until it is back.
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function login(username: string, password: string) {
    const result = await api.user<LoginResponse>("/auth/login", {
      method: "POST",
      data: { username, password },
    });
    await storeSession(result);
    setUser(userFrom(result.accessToken));
  }

  async function register(input: RegisterInput): Promise<RegisterResult> {
    // user-api may return either tokens (auto-login) or just a message
    // (account created, email confirmation required). Handle both shapes.
    const result = await api.user<Partial<LoginResponse> & { message?: string }>(
      "/auth/register",
      { method: "POST", data: input }
    );

    if (result.accessToken && result.refreshToken) {
      await storeSession({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setUser(userFrom(result.accessToken));
      return { autoSignedIn: true };
    }

    return {
      autoSignedIn: false,
      message: result.message ?? "Account created. Check your email to confirm.",
    };
  }

  async function logout() {
    // This device first, so signing out is immediate and works offline.
    const refreshToken = await clearSession();
    setUser(null);
    forgetPlayerData();
    // Then user-api, so a copy of the refresh token is worth nothing for the
    // rest of its seven days.
    if (refreshToken) await revokeRefreshToken(refreshToken);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

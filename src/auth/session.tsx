import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import type { ReverificationHint } from '../api/reverify';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  /** False when the account has no second factor yet (the API refuses it with mfa_required). */
  twoStep?: boolean;
}

/** The signed-in session as the app sees it; the identity provider sits behind this (Clerk in the build, a fake in tests). */
export interface AuthSession {
  /** False when the build has no identity provider (tests, or no publishable key). */
  available: boolean;
  loaded: boolean;
  signedIn: boolean;
  /** A step the identity provider still needs before the session starts (Clerk: choose-organization, reset-password, setup-mfa). */
  pendingTask?: string;
  /** The provider's form for [pendingTask], shown in place so sign-in never bounces between pages. */
  Task?: ComponentType<{ task: string }>;
  /** Asks the person to verify their second factor again (step-up); false when they cancel. */
  reverify?(hint?: ReverificationHint): Promise<boolean>;
  user?: AuthUser;
  /** A session token for the API, or null when signed out; `fresh` skips the cache after a 401. */
  getToken(opts?: { fresh?: boolean }): Promise<string | null>;
  signOut(): Promise<void>;
  /** Opens the provider's account page (profile, security, two-step verification). */
  manageAccount?(): void;
  /** Opens the provider's security page to add a second factor. */
  setUpTwoStep?(): void;
  /** The provider's sign-in form. */
  SignIn?: ComponentType;
}

export const NO_AUTH: AuthSession = {
  available: false,
  loaded: true,
  signedIn: false,
  getToken: () => Promise.resolve(null),
  signOut: () => Promise.resolve(),
};

const AuthContext = createContext<AuthSession>(NO_AUTH);

export function AuthProvider({ value, children }: { value: AuthSession; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession(): AuthSession {
  return useContext(AuthContext);
}

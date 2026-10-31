import {
  ClerkProvider,
  SignIn,
  TaskChooseOrganization,
  TaskResetPassword,
  TaskSetupMFA,
  useAuth,
  useClerk,
  useReverification,
  useUser,
} from '@clerk/react';
import { isReverificationCancelledError } from '@clerk/react/errors';
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { ReverificationHint } from '../api/reverify';
import { activeTheme, useTheme } from '../design-system';
import { clerkAppearance } from './appearance';
import { AuthProvider, NO_AUTH, type AuthSession } from './session';

/**
 * The Clerk customer instance's publishable key (ADR-0045), never the ops instance's and never a secret key. Blank until
 * Karim creates the customer instance: then the web app runs in demo mode only (OG-030 R1).
 */
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? '';

function ThemedSignIn() {
  const { theme } = useTheme();
  const appearance = useMemo(() => clerkAppearance(theme), [theme]);
  return <SignIn routing="hash" appearance={appearance} />;
}

/** Where Clerk sends a pending session: the console itself, which shows the task in place (no hosted page, no loop). */
const TASK_URLS = { 'choose-organization': '/', 'reset-password': '/', 'setup-mfa': '/' } as const;

/** Clerk's form for a pending session's task, themed; after it the console reloads on the page the person was on. */
function ThemedTask({ task }: { task: string }) {
  const { theme } = useTheme();
  const appearance = useMemo(() => clerkAppearance(theme), [theme]);
  const done = typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search;
  if (task === 'reset-password')
    return <TaskResetPassword redirectUrlComplete={done} appearance={appearance} />;
  if (task === 'setup-mfa') return <TaskSetupMFA redirectUrlComplete={done} appearance={appearance} />;
  return <TaskChooseOrganization redirectUrlComplete={done} appearance={appearance} />;
}

const DEFAULT_HINT: ReverificationHint = { level: 'second_factor', afterMinutes: 10 };

/** Reverification as Clerk's hook expects it: the first call answers Clerk's hint, the retry after the dialog answers done. */
async function askOnce(state: { asked: boolean; hint: ReverificationHint }) {
  if (state.asked) return true;
  state.asked = true;
  return {
    clerk_error: {
      type: 'forbidden',
      reason: 'reverification-error',
      metadata: { reverification: state.hint },
    },
  };
}

function Bridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const pendingTask = clerk.session?.status === 'pending' ? clerk.session.currentTask?.key : undefined;
  // Clerk hands out a new getToken on renders; keep one stable function so the API client is not rebuilt.
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);
  const token = useCallback(
    (opts?: { fresh?: boolean }) => tokenRef.current(opts?.fresh ? { skipCache: true } : undefined),
    [],
  );
  const out = useCallback(() => signOut(), [signOut]);
  const verify = useReverification(askOnce);
  const verifyRef = useRef(verify);
  useEffect(() => {
    verifyRef.current = verify;
  }, [verify]);
  const reverify = useCallback(async (hint?: ReverificationHint) => {
    try {
      await verifyRef.current({ asked: false, hint: hint ?? DEFAULT_HINT });
      return true;
    } catch (e) {
      if (isReverificationCancelledError(e)) return false;
      throw e;
    }
  }, []);
  // The account modal opens outside the theme tree, so it takes the theme last applied to the page.
  const themed = () => {
    const theme = activeTheme();
    return theme ? { appearance: clerkAppearance(theme) } : {};
  };
  const account = useCallback(() => clerk.openUserProfile(themed()), [clerk]);
  const twoStep = useCallback(
    () => clerk.openUserProfile({ ...themed(), __experimental_startPath: '/security' }),
    [clerk],
  );

  const value = useMemo<AuthSession>(
    () => ({
      available: true,
      loaded: isLoaded,
      signedIn: !!isSignedIn,
      pendingTask,
      Task: ThemedTask,
      reverify,
      user: user
        ? {
            id: user.id,
            name: user.fullName || user.primaryEmailAddress?.emailAddress || user.id,
            email: user.primaryEmailAddress?.emailAddress,
            twoStep: user.twoFactorEnabled,
          }
        : undefined,
      getToken: token,
      signOut: out,
      manageAccount: account,
      setUpTwoStep: twoStep,
      SignIn: ThemedSignIn,
    }),
    [isLoaded, isSignedIn, pendingTask, user, token, out, account, twoStep, reverify],
  );
  return <AuthProvider value={value}>{children}</AuthProvider>;
}

export function ClerkAuth({ children }: { children: ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) return <AuthProvider value={NO_AUTH}>{children}</AuthProvider>;
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/" taskUrls={TASK_URLS}>
      <Bridge>{children}</Bridge>
    </ClerkProvider>
  );
}

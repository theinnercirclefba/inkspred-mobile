import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { signInWithApple as appleSignIn, signInWithGoogle as googleSignIn } from "./socialAuth";

/**
 * Auth state for the whole app. Wraps Supabase auth (email + password, session
 * persisted in AsyncStorage by the client) and exposes the signed-in user's
 * `public.users.role` so the router can send them to the right tab group.
 *
 * The role lives in a separate table (public.users) from the auth identity, so
 * after any session change we fetch it. RLS `users_select_own` lets a user read
 * their own row; `users_insert_own` lets them create it at sign-up.
 */

export type UserRole = "customer" | "artist" | "studio_admin";

/** The three sign-up account types the join screen offers (maps to a role). */
export type AccountType = "customer" | "artist" | "studio";

const ACCOUNT_ROLE: Record<AccountType, UserRole> = {
  customer: "customer",
  artist: "artist",
  studio: "studio_admin",
};

export interface Profile {
  id: string;
  role: UserRole;
  email: string;
  fullName: string;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  /** True when sign-up succeeded but email confirmation is required (no session). */
  needsEmailConfirmation?: boolean;
  /** The user backed out of a native/OAuth sheet — the UI should stay put. */
  cancelled?: boolean;
}

interface AuthContextValue {
  /** Still resolving the initial session — hold the splash / show a loader. */
  initialising: boolean;
  session: Session | null;
  profile: Profile | null;
  /** The signed-in user's role, or null when signed out / unresolved. */
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (args: {
    fullName: string;
    email: string;
    password: string;
    accountType: AccountType;
  }) => Promise<AuthResult>;
  /** Native "Continue with Apple". Establishes the session; role comes later. */
  signInWithApple: () => Promise<AuthResult>;
  /** Browser-based "Continue with Google" (gated behind isGoogleConfigured). */
  signInWithGoogle: () => Promise<AuthResult>;
  /**
   * Create the public.users row for a signed-in social user who has no profile
   * yet, using the chosen account type plus name/email from session metadata.
   */
  completeProfile: (accountType: AccountType) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Re-fetch the profile row (after onboarding writes, etc.). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MIN_PASSWORD_LENGTH = 8;

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, role, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { id: string; role: UserRole; email: string; full_name: string };
  return {
    id: row.id,
    role: row.role,
    email: row.email,
    fullName: row.full_name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialising, setInitialising] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Guards against a late async profile fetch overwriting a newer session state.
  const activeUserId = useRef<string | null>(null);

  const loadProfileFor = useCallback(async (nextSession: Session | null) => {
    const userId = nextSession?.user?.id ?? null;
    activeUserId.current = userId;
    if (!userId) {
      setProfile(null);
      return;
    }
    const p = await fetchProfile(userId);
    // Ignore if the session changed while we were fetching.
    if (activeUserId.current === userId) setProfile(p);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      await loadProfileFor(data.session);
      if (mounted) setInitialising(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfileFor(nextSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfileFor]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        const message = /invalid login credentials/i.test(error.message)
          ? "That email and password don't match. Please try again."
          : "We couldn't sign you in. Please try again.";
        return { ok: false, error: message };
      }
      await loadProfileFor(data.session);
      return { ok: true };
    },
    [loadProfileFor],
  );

  const signUp = useCallback(
    async ({
      fullName,
      email,
      password,
      accountType,
    }: {
      fullName: string;
      email: string;
      password: string;
      accountType: AccountType;
    }): Promise<AuthResult> => {
      const role = ACCOUNT_ROLE[accountType];
      const cleanEmail = email.trim();
      const cleanName = fullName.trim();

      if (password.length < MIN_PASSWORD_LENGTH) {
        return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.` };
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        const message = /already registered|already exists|already been registered/i.test(error.message)
          ? "An account with this email already exists. Try signing in instead."
          : "We couldn't create your account. Please try again.";
        return { ok: false, error: message };
      }
      if (!data.user) {
        return { ok: false, error: "We couldn't create your account. Please try again." };
      }

      // Write the public.users row. When a session is present (email
      // auto-confirm on), RLS `users_insert_own` permits this self-insert
      // because auth.uid() now equals data.user.id. When confirmation is
      // required, there's no session yet — the row is created on first
      // authenticated load instead (see ensureProfileRow).
      if (data.session) {
        const { error: insertError } = await supabase.from("users").insert({
          id: data.user.id,
          role,
          email: cleanEmail,
          full_name: cleanName,
        });
        if (insertError && insertError.code !== "23505") {
          return { ok: false, error: "We couldn't finish setting up your account. Please try again." };
        }
        await loadProfileFor(data.session);
        return { ok: true };
      }

      // No session: stash the intended role/name so a later confirmed sign-in
      // can complete the profile. For this build we simply report that email
      // confirmation is needed.
      return { ok: true, needsEmailConfirmation: true };
    },
    [loadProfileFor],
  );

  // Shared tail for a social sign-in: on success, load the profile so the
  // router can tell a returning user (has a row) from a new one (needs /complete).
  const finishSocial = useCallback(
    async (result: Awaited<ReturnType<typeof appleSignIn>>): Promise<AuthResult> => {
      if (!result.ok) {
        if (result.cancelled) return { ok: false, cancelled: true };
        return { ok: false, error: result.error ?? "We couldn't sign you in. Please try again." };
      }
      if (result.session) {
        setSession(result.session);
        await loadProfileFor(result.session);
      }
      return { ok: true };
    },
    [loadProfileFor],
  );

  const signInWithApple = useCallback(
    async (): Promise<AuthResult> => finishSocial(await appleSignIn()),
    [finishSocial],
  );

  const signInWithGoogle = useCallback(
    async (): Promise<AuthResult> => finishSocial(await googleSignIn()),
    [finishSocial],
  );

  const completeProfile = useCallback(
    async (accountType: AccountType): Promise<AuthResult> => {
      const user = session?.user;
      if (!user) {
        return { ok: false, error: "Your session has expired. Please sign in again." };
      }

      const role = ACCOUNT_ROLE[accountType];
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      // Apple/Google surface the name under a few keys; take the first we find.
      const metaName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        "";
      const email = user.email ?? (typeof meta.email === "string" ? meta.email : "") ?? "";

      const { error } = await supabase.from("users").insert({
        id: user.id,
        role,
        email,
        full_name: metaName,
      });
      // 23505 = row already exists (e.g. a double-tap); treat as success.
      if (error && error.code !== "23505") {
        return { ok: false, error: "We couldn't finish setting up your account. Please try again." };
      }

      await loadProfileFor(session);
      return { ok: true };
    },
    [session, loadProfileFor],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    activeUserId.current = null;
    setProfile(null);
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    await loadProfileFor(session);
  }, [loadProfileFor, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialising,
      session,
      profile,
      role: profile?.role ?? null,
      signIn,
      signUp,
      signInWithApple,
      signInWithGoogle,
      completeProfile,
      signOut,
      refresh,
    }),
    [
      initialising,
      session,
      profile,
      signIn,
      signUp,
      signInWithApple,
      signInWithGoogle,
      completeProfile,
      signOut,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** The tab-group home route for a role — the native mirror of web's roleHome. */
export function roleHome(role: UserRole | null): string {
  switch (role) {
    case "artist":
      return "/(artist)/(tabs)/today";
    case "studio_admin":
      return "/(studio)/(tabs)/shop";
    case "customer":
    default:
      return "/(customer)/(tabs)/find";
  }
}

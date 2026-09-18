import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ensureProfile, fetchProfile, isPaidPlanActive } from "@/lib/profiles";
import { getGuestId, getGuestName, clearGuestIdentity } from "@/lib/guest";
import type { AccountType, UserProfile } from "@/types";

interface AuthState {
  profile: UserProfile | null;
  accountType: AccountType;
  loading: boolean;
  isPaid: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>("guest");

  const loadGuestProfile = useCallback(async () => {
    const guestId = getGuestId();
    const guestName = getGuestName();

    // For guests, we use a deterministic UUID derived from the guest device ID
    // Since we can't create auth.users entries for guests, we create a profile
    // using the anon key. But profiles.id references auth.users(id) with FK.
    // For guests, we'll use a local-only profile object that's not in the DB.
    // The profile is only persisted for registered users.
    const guestProfile: UserProfile = {
      id: guestId,
      display_name: guestName,
      is_guest: true,
      is_premium: false,
      guest_device_id: guestId,
      plan: "free",
      plan_expires_at: null,
    };

    setProfile(guestProfile);
    setAccountType("guest");
    setLoading(false);
  }, []);

  const loadRegisteredProfile = useCallback(
    async (session: Session) => {
      const prof = await ensureProfile(session.user.id, false);
      if (prof) {
        // If the user was previously a guest, clear guest identity
        clearGuestIdentity();
        setProfile(prof);
        setAccountType("registered");
      } else {
        // Fallback: fetch existing
        const fetched = await fetchProfile(session.user.id);
        if (fetched) {
          setProfile(fetched);
          setAccountType("registered");
        } else {
          // Could not create profile, fall back to guest
          await loadGuestProfile();
          return;
        }
      }
      setLoading(false);
    },
    [loadGuestProfile],
  );

  useEffect(() => {
    let mounted = true;

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        void loadRegisteredProfile(session);
      } else {
        void loadGuestProfile();
      }
    });

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        void loadRegisteredProfile(session);
      } else {
        void loadGuestProfile();
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadGuestProfile, loadRegisteredProfile]);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });

      if (error) {
        // Map common errors to neutral messages
        if (error.message.includes("already registered") || error.message.includes("already been registered")) {
          return { error: "An account with this email already exists. Try signing in instead." };
        }
        return { error: "Could not create your account. Please try again." };
      }

      // If signup returned a session, update the display name
      if (data.user) {
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ display_name: displayName, is_guest: false })
          .eq("id", data.user.id);

        if (updateErr) {
          console.error("Failed to set display name:", updateErr);
        }
      }

      return { error: null };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: "Incorrect email or password. Please try again." };
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearGuestIdentity();
    await loadGuestProfile();
  }, [loadGuestProfile]);

  const refreshProfile = useCallback(async () => {
    if (!profile) return;
    if (accountType === "guest") return;

    const fetched = await fetchProfile(profile.id);
    if (fetched) setProfile(fetched);
  }, [profile, accountType]);

  const value: AuthState = {
    profile,
    accountType,
    loading,
    isPaid: isPaidPlanActive(profile),
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

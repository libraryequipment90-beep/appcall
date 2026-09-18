import { supabase } from "@/lib/supabase";
import { getGuestId, getGuestName } from "@/lib/guest";
import type { UserProfile } from "@/types";

/**
 * Ensures a profile row exists for the given user ID.
 * For guests, creates a profile with is_guest=true and the guest device ID.
 * For registered users, creates with is_guest=false.
 */
export async function ensureProfile(
  userId: string,
  isGuest: boolean,
): Promise<UserProfile | null> {
  // Check if profile exists
  const { data: existing, error: checkErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (checkErr) {
    console.error("Profile check failed:", checkErr);
    return null;
  }

  if (existing) return existing as UserProfile;

  // Create new profile
  const displayName = isGuest ? getGuestName() : "New User";
  const insertData: Record<string, unknown> = {
    id: userId,
    display_name: displayName,
    is_guest: isGuest,
  };

  if (isGuest) {
    insertData.guest_device_id = getGuestId();
  }

  const { data: created, error: insertErr } = await supabase
    .from("profiles")
    .insert(insertData)
    .select()
    .maybeSingle();

  if (insertErr) {
    console.error("Profile creation failed:", insertErr);
    return null;
  }

  return created as UserProfile;
}

/**
 * Fetches a profile by user ID.
 */
export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Fetch profile failed:", error);
    return null;
  }

  return data as UserProfile | null;
}

/**
 * Updates the display name for the current user.
 */
export async function updateDisplayName(
  userId: string,
  displayName: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);

  if (error) return { error: "Could not update your name. Please try again." };
  return { error: null };
}

/**
 * Checks if a user's paid plan is still active (not expired).
 */
export function isPaidPlanActive(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.plan !== "paid") return false;
  if (!profile.plan_expires_at) return true; // no expiry = lifetime
  return new Date(profile.plan_expires_at) > new Date();
}

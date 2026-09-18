/*
# Auto-create profiles on signup + backfill + RLS/GRANT fixes

## Purpose
Fixes three issues preventing logged-in users from sending friend requests:
1. No trigger on auth.users — signing up creates an auth identity but no profiles row,
   so ensureProfile() fails (FK violation on friend_requests.sender_id → profiles.id),
   the app falls back to guest mode, and the user appears "logged out".
2. Existing auth.users who signed up before this fix have no profiles row.
3. Missing table-level GRANTs — RLS policies are additional checks on top of GRANTs;
   without GRANT INSERT/SELECT on friend_requests, authenticated users can't use the
   policies that are already defined.

## Changes
- handle_new_user(): SECURITY DEFINER trigger function that inserts a profiles row
  on every new auth.users insert, using display_name from raw_user_meta_data.
- on_auth_user_created: AFTER INSERT trigger on auth.users.
- Backfill: inserts profiles rows for all existing auth.users missing one.
- GRANTs: explicit table-level privileges for authenticated role on all three tables.
- RLS policies: re-applied with DROP IF EXISTS to ensure they're current.
*/

-- ========================
-- 1. TRIGGER: auto-create profile on signup
-- ========================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'New User'),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================
-- 2. BACKFILL: existing users missing a profile row
-- ========================

INSERT INTO public.profiles (id, display_name, is_guest)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', 'New User'),
  false
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- ========================
-- 3. GRANTs: ensure authenticated role can use RLS policies
-- ========================

-- profiles: SELECT + INSERT + DELETE at table level; UPDATE restricted to display_name
GRANT SELECT, INSERT, DELETE ON profiles TO authenticated;
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name) ON profiles TO authenticated;

-- friend_requests: full CRUD for authenticated (RLS policies scope the actual access)
GRANT SELECT, INSERT, UPDATE, DELETE ON friend_requests TO authenticated;

-- friends: full CRUD for authenticated (RLS policies scope the actual access)
GRANT SELECT, INSERT, UPDATE, DELETE ON friends TO authenticated;

-- ========================
-- 4. RLS POLICIES: re-apply to ensure they're current and correct
-- ========================

-- ---- profiles ----
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- friend_requests ----
DROP POLICY IF EXISTS "friend_requests_select_involved" ON friend_requests;
CREATE POLICY "friend_requests_select_involved"
  ON friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "friend_requests_insert_sender" ON friend_requests;
CREATE POLICY "friend_requests_insert_sender"
  ON friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "friend_requests_update_receiver" ON friend_requests;
CREATE POLICY "friend_requests_update_receiver"
  ON friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "friend_requests_delete_involved" ON friend_requests;
CREATE POLICY "friend_requests_delete_involved"
  ON friend_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ---- friends ----
DROP POLICY IF EXISTS "friends_select_own" ON friends;
CREATE POLICY "friends_select_own"
  ON friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "friends_insert_own" ON friends;
CREATE POLICY "friends_insert_own"
  ON friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "friends_delete_own" ON friends;
CREATE POLICY "friends_delete_own"
  ON friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

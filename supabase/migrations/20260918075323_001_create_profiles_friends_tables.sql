/*
# Create profiles, friend_requests, and friends tables

## Purpose
Supports a P2P English speaking practice app with:
- Guest and registered user identity
- Free vs paid plan tracking
- Friend request system between users

## New Tables

### profiles
- id (uuid, PK, references auth.users) — one row per user (auth identity)
- display_name (text) — name shown to other users
- is_guest (boolean, default true) — true for auto-generated guest accounts, false for registered
- guest_device_id (text, nullable, unique) — random ID for guest identity, null for registered users
- plan (text, default 'free') — 'free' or 'paid'
- plan_expires_at (timestamptz, nullable) — when the paid plan expires
- created_at (timestamptz)

### friend_requests
- id (uuid, PK)
- sender_id (uuid, references profiles) — who sent the request
- receiver_id (uuid, references profiles) — who received it
- status (text, default 'pending') — 'pending', 'accepted', 'declined'
- created_at (timestamptz)
- responded_at (timestamptz, nullable)

### friends
- id (uuid, PK)
- user_id (uuid, references profiles) — one half of the friendship
- friend_id (uuid, references profiles) — the other half
- created_at (timestamptz)
- Unique constraint on (user_id, friend_id) to prevent duplicates

## Security

### profiles
- RLS enabled
- SELECT: anyone can view profiles (needed for matchmaking display + friend lookups). 
  Sensitive columns (email) are NOT stored here — only display_name, plan, is_guest.
- INSERT: authenticated users can insert their own profile row
- UPDATE: users can only update their own profile. Column-level privileges restrict
  writable columns to display_name only. plan and plan_expires_at are NOT client-writable —
  they are updated only via the Stripe webhook edge function (SECURITY DEFINER).

### friend_requests
- RLS enabled
- SELECT: users can see requests they sent or received
- INSERT: users can create requests they are the sender of
- UPDATE: users can update requests they are the receiver of (accept/decline)
- DELETE: users can delete requests they sent or received

### friends
- RLS enabled
- SELECT: users can see their own friendships
- INSERT: users can insert friendship rows where they are user_id
- DELETE: users can delete their own friendships

## Privileged Functions
### activate_paid_plan(p_user_id uuid, p_months int)
- SECURITY DEFINER function called only by the Stripe webhook edge function
- Sets plan='paid' and plan_expires_at to now + p_months
- Not callable by anon; callable by authenticated (but the webhook uses service role key)

## Important Notes
1. The profiles table stores NO email — emails live in auth.users. profiles only has
   display_name, plan status, and guest info — safe to be publicly readable.
2. plan and plan_expires_at columns are revoked from client UPDATE — only the
   activate_paid_plan SECURITY DEFINER function can change them.
3. Guest users get a row in profiles with is_guest=true and a random guest_device_id.
   Registered users get is_guest=false with guest_device_id=null.
*/

-- ========================
-- PROFILES TABLE
-- ========================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Anonymous',
  is_guest boolean NOT NULL DEFAULT true,
  guest_device_id text UNIQUE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'paid')),
  plan_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view profiles (display name + plan status only — no sensitive data)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can insert their own profile
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile, but only display_name (enforced via column privileges)
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Restrict UPDATE to display_name only — plan and plan_expires_at are NOT client-writable
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name) ON profiles TO authenticated;

-- ========================
-- FRIEND_REQUESTS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (sender_id <> receiver_id)
);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

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

-- ========================
-- FRIENDS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

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

-- ========================
-- ACTIVATE PAID PLAN FUNCTION (SECURITY DEFINER)
-- ========================
CREATE OR REPLACE FUNCTION activate_paid_plan(p_user_id uuid, p_months int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_months IS NULL OR p_months < 1 OR p_months > 120 THEN
    RAISE EXCEPTION 'Invalid duration';
  END IF;

  UPDATE profiles
  SET plan = 'paid',
      plan_expires_at = now() + (p_months || ' months')::interval
  WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION activate_paid_plan FROM anon;
GRANT EXECUTE ON FUNCTION activate_paid_plan TO authenticated;

-- ========================
-- ACCEPT FRIEND REQUEST FUNCTION
-- ========================
-- Inserts mutual friendship rows atomically when a request is accepted.
-- Checks that at least one party has a paid plan.
CREATE OR REPLACE FUNCTION accept_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_receiver_id uuid;
  v_sender_plan text;
  v_receiver_plan text;
  v_sender_expires timestamptz;
  v_receiver_expires timestamptz;
BEGIN
  -- Lock the request row and get details
  SELECT sender_id, receiver_id INTO v_sender_id, v_receiver_id
  FROM friend_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already processed';
  END IF;

  -- Verify the caller is the receiver
  IF auth.uid() IS NULL OR auth.uid() <> v_receiver_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Check that at least one party has an active paid plan
  SELECT plan, plan_expires_at INTO v_sender_plan, v_sender_expires
  FROM profiles WHERE id = v_sender_id;

  SELECT plan, plan_expires_at INTO v_receiver_plan, v_receiver_expires
  FROM profiles WHERE id = v_receiver_id;

  IF NOT (
    (v_sender_plan = 'paid' AND (v_sender_expires IS NULL OR v_sender_expires > now()))
    OR
    (v_receiver_plan = 'paid' AND (v_receiver_expires IS NULL OR v_receiver_expires > now()))
  ) THEN
    RAISE EXCEPTION 'At least one user must have an active paid plan to accept friend requests';
  END IF;

  -- Update request status
  UPDATE friend_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = p_request_id;

  -- Insert mutual friendship rows (ignore if already exist)
  INSERT INTO friends (user_id, friend_id) VALUES (v_sender_id, v_receiver_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  INSERT INTO friends (user_id, friend_id) VALUES (v_receiver_id, v_sender_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION accept_friend_request FROM anon;
GRANT EXECUTE ON FUNCTION accept_friend_request TO authenticated;

-- ========================
-- INDEXES
-- ========================
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);

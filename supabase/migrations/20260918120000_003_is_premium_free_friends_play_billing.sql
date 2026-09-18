/*
# is_premium column + unrestricted friend requests (Google Play Billing)

## Purpose
1. Adds profiles.is_premium — the premium flag granted after a verified Google Play
   purchase (₹115 one-time plan). It is updated ONLY by the `verify-play-purchase`
   Supabase Edge Function using the service role key; clients cannot write it
   (REVOKE UPDATE on profiles from authenticated already covers the whole table).
2. Removes the paid-plan restriction from accept_friend_request — ALL users (free
   and paid) can send, accept, and view friend requests without restriction.
3. Direct (friend-to-friend) calling is gated on profiles.is_premium = true in the
   client; free users get an upgrade modal instead of a call.

## Cleanup policy
No cleanup job touches profiles, friends, or friend_requests. Temporary signaling /
call state lives only in the signaling server's memory (cleared on disconnect) —
nothing is deleted from the database.

## Notes
- Existing users with an active paid plan are backfilled to is_premium = true.
*/

-- ========================
-- 1. IS_PREMIUM COLUMN
-- ========================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Backfill: users with an active paid plan are premium
UPDATE profiles
SET is_premium = true
WHERE plan = 'paid' AND (plan_expires_at IS NULL OR plan_expires_at > now());

-- ========================
-- 2. ACCEPT FRIEND REQUEST (restriction removed)
-- ========================
-- Inserts mutual friendship rows atomically when a request is accepted.
-- Friend requests are free for ALL users — no paid-plan check.
CREATE OR REPLACE FUNCTION accept_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_receiver_id uuid;
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

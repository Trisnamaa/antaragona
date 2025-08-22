/*
  # Create Complete User Activity System for Friend Online Status

  1. New Tables
    - `user_activity`
      - `id` (uuid, primary key)
      - `profile_id` (uuid): Reference to player's profile
      - `last_seen` (timestamp): Last activity timestamp
      - `is_online` (boolean): Current online status
      - `activity_type` (text): Type of activity (login, chat, game, etc)
      - `updated_at` (timestamp)

  2. Functions
    - `update_user_activity()`: Update user's last seen and online status
    - `get_friend_list()`: Get friends with their online status
    - `mark_user_offline()`: Mark user as offline
    - `cleanup_offline_users()`: Auto-cleanup offline users

  3. Security
    - Enable RLS on user_activity table
    - Add policies for authenticated users
*/

-- Drop existing functions and tables if they exist
DROP FUNCTION IF EXISTS update_user_activity(uuid, text);
DROP FUNCTION IF EXISTS update_user_activity(text, uuid);
DROP FUNCTION IF EXISTS get_friend_list(uuid);
DROP FUNCTION IF EXISTS mark_user_offline(uuid);
DROP FUNCTION IF EXISTS cleanup_offline_users();
DROP TABLE IF EXISTS user_activity CASCADE;

-- Create user_activity table for tracking online status
CREATE TABLE user_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_seen timestamptz DEFAULT now(),
  is_online boolean DEFAULT true,
  activity_type text DEFAULT 'general',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (profile_id)
);

-- Enable RLS
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Policies for user_activity
CREATE POLICY "Users can view all user activity"
  ON user_activity FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own activity"
  ON user_activity FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Function to update user activity
CREATE OR REPLACE FUNCTION update_user_activity(
  p_profile_id uuid,
  p_activity_type text DEFAULT 'general'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_activity (profile_id, last_seen, is_online, activity_type, updated_at)
  VALUES (p_profile_id, now(), true, p_activity_type, now())
  ON CONFLICT (profile_id)
  DO UPDATE SET
    last_seen = now(),
    is_online = true,
    activity_type = p_activity_type,
    updated_at = now();
END;
$$;

-- Function to mark user as offline
CREATE OR REPLACE FUNCTION mark_user_offline(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_activity
  SET is_online = false, updated_at = now()
  WHERE profile_id = p_profile_id;
END;
$$;

-- Updated get_friend_list function with online status
CREATE OR REPLACE FUNCTION get_friend_list(p_player_profile_id uuid)
RETURNS TABLE (
  friend_id uuid,
  friend_username text,
  friend_profile_image_url text,
  friend_character_type text,
  friend_level integer,
  can_send_clover boolean,
  friendship_created_at timestamptz,
  is_online boolean,
  last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN f.requester_id = p_player_profile_id THEN f.addressee_id
      ELSE f.requester_id
    END as friend_id,
    p.username as friend_username,
    p.profile_image_url as friend_profile_image_url,
    p.character_type as friend_character_type,
    p.level as friend_level,
    NOT EXISTS(
      SELECT 1 FROM clover_transactions ct
      WHERE ct.sender_id = p_player_profile_id
      AND ct.receiver_id = CASE 
        WHEN f.requester_id = p_player_profile_id THEN f.addressee_id
        ELSE f.requester_id
      END
      AND ct.transaction_date = CURRENT_DATE
    ) as can_send_clover,
    f.created_at as friendship_created_at,
    COALESCE(
      CASE 
        WHEN ua.is_online = true AND ua.last_seen > (now() - interval '5 minutes') THEN true
        ELSE false
      END, 
      false
    ) as is_online,
    COALESCE(ua.last_seen, p.created_at) as last_seen
  FROM friendships f
  JOIN profiles p ON p.id = CASE 
    WHEN f.requester_id = p_player_profile_id THEN f.addressee_id
    ELSE f.requester_id
  END
  LEFT JOIN user_activity ua ON ua.profile_id = p.id
  WHERE (f.requester_id = p_player_profile_id OR f.addressee_id = p_player_profile_id)
  AND f.status = 'accepted'
  AND (p.banned_until IS NULL OR p.banned_until < now())
  ORDER BY 
    COALESCE(
      CASE 
        WHEN ua.is_online = true AND ua.last_seen > (now() - interval '5 minutes') THEN true
        ELSE false
      END, 
      false
    ) DESC, -- Online friends first
    f.created_at DESC;
END;
$$;

-- Auto-cleanup function for offline users (mark as offline if inactive for 5+ minutes)
CREATE OR REPLACE FUNCTION cleanup_offline_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_activity
  SET is_online = false, updated_at = now()
  WHERE is_online = true 
  AND last_seen < (now() - interval '5 minutes');
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_activity(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_user_offline(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_offline_users() TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS user_activity_profile_id_idx ON user_activity(profile_id);
CREATE INDEX IF NOT EXISTS user_activity_online_idx ON user_activity(is_online, last_seen);
CREATE INDEX IF NOT EXISTS user_activity_last_seen_idx ON user_activity(last_seen DESC);

-- Initialize user_activity for existing profiles
INSERT INTO user_activity (profile_id, last_seen, is_online, activity_type)
SELECT id, created_at, false, 'initial'
FROM profiles
ON CONFLICT (profile_id) DO NOTHING;
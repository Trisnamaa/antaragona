/*
  # Fix Function Signatures and Conflicts

  1. Functions
    - Drop and recreate `get_friend_list()` with correct return type
    - Drop and recreate `update_user_activity()` with correct parameter order
    - Ensure all functions match frontend expectations

  2. Security
    - Maintain RLS policies
    - Grant proper permissions
*/

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS get_friend_list(uuid);
DROP FUNCTION IF EXISTS update_user_activity(uuid, text);
DROP FUNCTION IF EXISTS update_user_activity(text, uuid);

-- Recreate update_user_activity with correct parameter order (activity_type first, profile_id second)
CREATE OR REPLACE FUNCTION update_user_activity(
  p_activity_type text DEFAULT 'general',
  p_profile_id uuid
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

-- Recreate get_friend_list function with correct return type
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
    ) AND NOT EXISTS(
      SELECT 1 FROM clover_transactions ct2
      WHERE ct2.receiver_id = CASE 
        WHEN f.requester_id = p_player_profile_id THEN f.addressee_id
        ELSE f.requester_id
      END
      AND ct2.transaction_date = CURRENT_DATE
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_activity(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_list(uuid) TO authenticated;
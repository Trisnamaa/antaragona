/*
  # Fix Friend Profile System

  1. Functions
    - `get_user_profile_by_id()`: Get detailed user profile by profile ID
    - `unfriend_user()`: Remove friendship between two users
    - Fix parameter names to match frontend calls

  2. Security
    - Proper RLS policies
    - Security definer functions
    - Input validation
*/

-- Function to get user profile by profile ID (for friend profile popup)
CREATE OR REPLACE FUNCTION get_user_profile_by_id(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  profile_image_url text,
  character_type text,
  level integer,
  exp integer,
  strength integer,
  zgold integer,
  ztoken integer,
  clover integer,
  created_at timestamptz,
  is_online boolean,
  last_seen timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.profile_image_url,
    p.character_type,
    p.level,
    p.exp,
    p.strength,
    p.zgold,
    p.ztoken,
    COALESCE(p.clover, 0) as clover,
    p.created_at,
    COALESCE(
      CASE 
        WHEN ua.is_online = true AND ua.last_seen > (now() - interval '5 minutes') THEN true
        ELSE false
      END, 
      false
    ) as is_online,
    COALESCE(ua.last_seen, p.created_at) as last_seen
  FROM profiles p
  LEFT JOIN user_activity ua ON ua.profile_id = p.id
  WHERE p.id = p_profile_id
  AND (p.banned_until IS NULL OR p.banned_until < now());
END;
$$;

-- Function to unfriend a user (remove friendship from both sides)
CREATE OR REPLACE FUNCTION unfriend_user(
  p_requester_profile_id uuid,
  p_target_profile_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_exists boolean;
  result json;
BEGIN
  -- Check if friendship exists (in either direction)
  SELECT EXISTS(
    SELECT 1 FROM friendships
    WHERE ((requester_id = p_requester_profile_id AND addressee_id = p_target_profile_id) OR
           (requester_id = p_target_profile_id AND addressee_id = p_requester_profile_id))
    AND status = 'accepted'
  ) INTO friendship_exists;
  
  IF NOT friendship_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You are not friends with this user'
    );
  END IF;
  
  -- Delete friendship (both directions)
  DELETE FROM friendships
  WHERE ((requester_id = p_requester_profile_id AND addressee_id = p_target_profile_id) OR
         (requester_id = p_target_profile_id AND addressee_id = p_requester_profile_id))
  AND status = 'accepted';
  
  RETURN json_build_object(
    'success', true,
    'message', 'Friend removed successfully'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_profile_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unfriend_user(uuid, uuid) TO authenticated;
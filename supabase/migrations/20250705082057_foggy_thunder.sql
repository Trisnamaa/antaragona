/*
  # Fix User Profile System and Add Public Profile Access

  1. Security Updates
    - Add RLS policy to allow reading public profile information
    - Ensure users can view other users' basic profile data
    - Add unique constraints and better indexing

  2. Data Consistency
    - Add function to ensure username consistency
    - Add triggers for data validation
    - Improve profile lookup performance

  3. Debugging and Logging
    - Add function for profile debugging
    - Better error handling in policies
*/

-- Add policy to allow reading public profile information
DROP POLICY IF EXISTS "Users can view public profiles" ON profiles;
CREATE POLICY "Users can view public profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true); -- Allow all authenticated users to read basic profile info

-- Add function to normalize usernames for consistent lookup
CREATE OR REPLACE FUNCTION normalize_username(input_username text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Trim whitespace and convert to lowercase for consistent matching
  RETURN LOWER(TRIM(input_username));
END;
$$;

-- Add function to find user profile with better error handling
CREATE OR REPLACE FUNCTION find_user_profile(search_username text)
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
  created_at timestamptz
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
    p.created_at
  FROM profiles p
  WHERE normalize_username(p.username) = normalize_username(search_username)
  AND p.username IS NOT NULL
  AND p.banned_until IS NULL OR p.banned_until < NOW();
END;
$$;

-- Add function for profile debugging
CREATE OR REPLACE FUNCTION debug_profile_lookup(search_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  profile_count integer;
  exact_match_count integer;
  normalized_search text;
BEGIN
  normalized_search := normalize_username(search_username);
  
  -- Count total profiles
  SELECT COUNT(*) INTO profile_count FROM profiles WHERE username IS NOT NULL;
  
  -- Count exact matches
  SELECT COUNT(*) INTO exact_match_count 
  FROM profiles 
  WHERE normalize_username(username) = normalized_search;
  
  -- Build debug info
  SELECT json_build_object(
    'search_username', search_username,
    'normalized_search', normalized_search,
    'total_profiles', profile_count,
    'exact_matches', exact_match_count,
    'matching_profiles', (
      SELECT json_agg(
        json_build_object(
          'id', id,
          'username', username,
          'normalized', normalize_username(username),
          'created_at', created_at
        )
      )
      FROM profiles 
      WHERE normalize_username(username) = normalized_search
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Add trigger to ensure username consistency
CREATE OR REPLACE FUNCTION ensure_username_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Trim whitespace from username
  IF NEW.username IS NOT NULL THEN
    NEW.username := TRIM(NEW.username);
    
    -- Ensure username is not empty after trimming
    IF LENGTH(NEW.username) = 0 THEN
      RAISE EXCEPTION 'Username cannot be empty';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for username consistency
DROP TRIGGER IF EXISTS ensure_username_consistency_trigger ON profiles;
CREATE TRIGGER ensure_username_consistency_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_username_consistency();

-- Add better indexing for profile lookups
CREATE INDEX IF NOT EXISTS profiles_username_normalized_idx 
ON profiles (normalize_username(username)) 
WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_user_id_username_idx 
ON profiles (user_id, username) 
WHERE username IS NOT NULL;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION normalize_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION find_user_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_profile_lookup(text) TO authenticated;

-- Add function to get user UUID by username (for unique identification)
CREATE OR REPLACE FUNCTION get_user_uuid_by_username(search_username text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_uuid uuid;
BEGIN
  SELECT user_id INTO user_uuid
  FROM profiles
  WHERE normalize_username(username) = normalize_username(search_username)
  AND username IS NOT NULL
  AND (banned_until IS NULL OR banned_until < NOW())
  LIMIT 1;
  
  RETURN user_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_uuid_by_username(text) TO authenticated;

-- Add constraint to global_chat table (safe method)
DO $$ 
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'global_chat_username_not_empty' 
    AND table_name = 'global_chat'
  ) THEN
    -- Add constraint if it doesn't exist
    ALTER TABLE global_chat 
    ADD CONSTRAINT global_chat_username_not_empty 
    CHECK (LENGTH(TRIM(username)) > 0);
  END IF;
END $$;

-- Add index for better chat performance
CREATE INDEX IF NOT EXISTS global_chat_username_idx ON global_chat(username);
CREATE INDEX IF NOT EXISTS global_chat_user_id_idx ON global_chat(user_id);

-- Add function to validate chat message consistency
CREATE OR REPLACE FUNCTION validate_chat_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  profile_username text;
BEGIN
  -- Get username from profiles table
  SELECT username INTO profile_username
  FROM profiles
  WHERE user_id = NEW.user_id;
  
  -- Ensure username matches
  IF profile_username IS NULL THEN
    RAISE EXCEPTION 'User profile not found for user_id: %', NEW.user_id;
  END IF;
  
  IF normalize_username(profile_username) != normalize_username(NEW.username) THEN
    RAISE EXCEPTION 'Username mismatch: profile has %, chat has %', profile_username, NEW.username;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for chat message validation
DROP TRIGGER IF EXISTS validate_chat_user_trigger ON global_chat;
CREATE TRIGGER validate_chat_user_trigger
  BEFORE INSERT ON global_chat
  FOR EACH ROW
  EXECUTE FUNCTION validate_chat_user();
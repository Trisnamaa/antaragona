/*
  # Fix Function Default Parameter Error

  1. Function Updates
    - Fix update_user_activity function parameter defaults
    - Ensure all parameters after one with default also have defaults
    - Recreate functions with proper parameter order

  2. Security
    - Maintain existing function security and permissions
*/

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS update_user_activity(text, uuid);
DROP FUNCTION IF EXISTS update_user_activity(uuid, text);

-- Create update_user_activity function with proper parameter defaults
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_user_activity(uuid, text) TO authenticated;
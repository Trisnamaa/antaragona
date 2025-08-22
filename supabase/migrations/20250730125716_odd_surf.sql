/*
  # Add profile_id to global_chat table

  1. Changes
    - Add profile_id column to global_chat table to link messages to profiles
    - This enables title display in chat messages
    - Add foreign key constraint to profiles table
    - Update existing messages to populate profile_id

  2. Security
    - Maintain existing RLS policies
    - Add index for better performance
*/

-- Add profile_id column to global_chat table
ALTER TABLE global_chat 
ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id);

-- Update existing messages to populate profile_id
UPDATE global_chat 
SET profile_id = (
  SELECT p.id 
  FROM profiles p 
  WHERE p.user_id = global_chat.user_id 
  LIMIT 1
)
WHERE profile_id IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS global_chat_profile_id_idx ON global_chat(profile_id);

-- Update the chat insert policy to include profile_id
CREATE OR REPLACE FUNCTION get_user_profile_id(user_uuid uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_uuid uuid;
BEGIN
  SELECT id INTO profile_uuid
  FROM profiles
  WHERE user_id = user_uuid
  LIMIT 1;
  
  RETURN profile_uuid;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_profile_id(uuid) TO authenticated;
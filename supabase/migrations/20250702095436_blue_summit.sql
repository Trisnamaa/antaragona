/*
  # Fix player_ranks RLS policies

  1. Security Updates
    - Drop existing INSERT policy that may be causing issues
    - Create new INSERT policy that allows users to create ranks for their own profiles
    - Ensure proper relationship between auth.uid() and profile ownership
*/

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert their own rank" ON player_ranks;

-- Create new INSERT policy that properly handles the relationship
CREATE POLICY "Users can insert their own rank"
  ON player_ranks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Also ensure the UPDATE policy is correct
DROP POLICY IF EXISTS "Players can update their own rank" ON player_ranks;

CREATE POLICY "Players can update their own rank"
  ON player_ranks
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );
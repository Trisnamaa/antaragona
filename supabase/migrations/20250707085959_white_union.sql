/*
  # Dungeon System Implementation

  1. New Tables
    - `dungeon_types`: Available dungeon types
    - `dungeon_progress`: Track player's dungeon completion count
    - `dungeon_history`: Record of dungeon runs

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for authenticated users

  3. Initial Data
    - Insert 4 dungeon types with their rewards
    - Insert dungeon master titles
*/

-- Create dungeon_types table
CREATE TABLE IF NOT EXISTS dungeon_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  image_url text NOT NULL,
  cost_ztoken integer NOT NULL DEFAULT 5,
  reward_exp integer NOT NULL,
  reward_zgold integer NOT NULL,
  reward_ztoken integer NOT NULL,
  master_title_name text NOT NULL,
  master_title_requirement integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create dungeon_progress table
CREATE TABLE IF NOT EXISTS dungeon_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dungeon_type_id uuid NOT NULL REFERENCES dungeon_types(id) ON DELETE CASCADE,
  completion_count integer NOT NULL DEFAULT 0,
  last_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, dungeon_type_id)
);

-- Create dungeon_history table
CREATE TABLE IF NOT EXISTS dungeon_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dungeon_type_id uuid NOT NULL REFERENCES dungeon_types(id) ON DELETE CASCADE,
  rounds_completed integer NOT NULL,
  is_victory boolean NOT NULL,
  exp_gained integer NOT NULL DEFAULT 0,
  zgold_gained integer NOT NULL DEFAULT 0,
  ztoken_gained integer NOT NULL DEFAULT 0,
  title_awarded text,
  completed_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE dungeon_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE dungeon_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE dungeon_history ENABLE ROW LEVEL SECURITY;

-- Policies for dungeon_types
CREATE POLICY "Anyone can view dungeon types"
  ON dungeon_types FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies for dungeon_progress
CREATE POLICY "Players can view their own dungeon progress"
  ON dungeon_progress FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Players can update their own dungeon progress"
  ON dungeon_progress FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Policies for dungeon_history
CREATE POLICY "Players can view their own dungeon history"
  ON dungeon_history FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Players can insert their own dungeon history"
  ON dungeon_history FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Function to complete dungeon and award rewards
CREATE OR REPLACE FUNCTION complete_dungeon(
  player_profile_id uuid,
  dungeon_type_id uuid,
  rounds_completed integer,
  is_victory boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dungeon_info record;
  current_progress record;
  new_completion_count integer;
  title_awarded text := null;
  exp_gained integer := 0;
  zgold_gained integer := 0;
  ztoken_gained integer := 0;
  result json;
BEGIN
  -- Get dungeon information
  SELECT * INTO dungeon_info
  FROM dungeon_types
  WHERE id = dungeon_type_id AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dungeon type not found or inactive';
  END IF;
  
  -- Only award rewards if victory
  IF is_victory THEN
    exp_gained := dungeon_info.reward_exp;
    zgold_gained := dungeon_info.reward_zgold;
    ztoken_gained := dungeon_info.reward_ztoken;
    
    -- Update player's resources
    UPDATE profiles
    SET 
      exp = exp + exp_gained,
      zgold = zgold + zgold_gained,
      ztoken = ztoken + ztoken_gained
    WHERE id = player_profile_id;
  END IF;
  
  -- Get or create progress record
  SELECT * INTO current_progress
  FROM dungeon_progress
  WHERE profile_id = player_profile_id AND dungeon_type_id = dungeon_type_id;
  
  IF FOUND THEN
    new_completion_count := current_progress.completion_count + 1;
    
    UPDATE dungeon_progress
    SET 
      completion_count = new_completion_count,
      last_completed_at = NOW()
    WHERE id = current_progress.id;
  ELSE
    new_completion_count := 1;
    
    INSERT INTO dungeon_progress (profile_id, dungeon_type_id, completion_count, last_completed_at)
    VALUES (player_profile_id, dungeon_type_id, new_completion_count, NOW());
  END IF;
  
  -- Check if player earned master title
  IF is_victory AND new_completion_count >= dungeon_info.master_title_requirement THEN
    -- Check if player already has this title
    IF NOT EXISTS (
      SELECT 1 FROM player_titles pt
      JOIN titles t ON pt.title_id = t.id
      WHERE pt.profile_id = player_profile_id 
      AND t.name = dungeon_info.master_title_name
    ) THEN
      -- Award the master title
      DECLARE
        title_id uuid;
      BEGIN
        SELECT id INTO title_id
        FROM titles
        WHERE name = dungeon_info.master_title_name;
        
        IF FOUND THEN
          INSERT INTO player_titles (profile_id, title_id)
          VALUES (player_profile_id, title_id);
          
          title_awarded := dungeon_info.master_title_name;
        END IF;
      END;
    END IF;
  END IF;
  
  -- Record dungeon history
  INSERT INTO dungeon_history (
    profile_id, 
    dungeon_type_id, 
    rounds_completed, 
    is_victory,
    exp_gained,
    zgold_gained,
    ztoken_gained,
    title_awarded
  ) VALUES (
    player_profile_id, 
    dungeon_type_id, 
    rounds_completed, 
    is_victory,
    exp_gained,
    zgold_gained,
    ztoken_gained,
    title_awarded
  );
  
  -- Return result
  SELECT json_build_object(
    'success', true,
    'exp_gained', exp_gained,
    'zgold_gained', zgold_gained,
    'ztoken_gained', ztoken_gained,
    'title_awarded', title_awarded,
    'completion_count', new_completion_count,
    'master_title_unlocked', (title_awarded IS NOT NULL)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION complete_dungeon(uuid, uuid, integer, boolean) TO authenticated;

-- Insert dungeon types
INSERT INTO dungeon_types (name, description, image_url, cost_ztoken, reward_exp, reward_zgold, reward_ztoken, master_title_name, master_title_requirement) VALUES
  ('Leafy Gate', 'A mystical forest dungeon filled with nature spirits', 'https://i.pinimg.com/736x/81/c9/76/81c976d54a8c3f67cf606465dba75c24.jpg', 5, 150, 2000, 3, 'Leafy Master', 100),
  ('Crystal Gate', 'A crystalline cavern with magical crystal guardians', 'https://i.pinimg.com/736x/58/79/d2/5879d2a798dc55fcb233d837f600eb3e.jpg', 5, 150, 2000, 3, 'Crystal Master', 100),
  ('Inferno Gate', 'A blazing hellscape with fire demons and lava monsters', 'https://i.pinimg.com/736x/2c/10/7a/2c107a41015db945b056d928c0e18c56.jpg', 5, 150, 2000, 3, 'Inferno Master', 100),
  ('Machine Gate', 'A mechanical fortress with robotic enemies and steam-powered traps', 'https://i.pinimg.com/736x/21/7c/8d/217c8d31db747b4b5bfb7b5b281191da.jpg', 5, 150, 2000, 3, 'Machine Master', 100)
ON CONFLICT (name) DO NOTHING;

-- Insert dungeon master titles
INSERT INTO titles (name, description, color, rarity, unlock_condition) VALUES
  ('Leafy Master', 'Master of the mystical forest dungeons', 'emerald', 'epic', 'Complete Leafy Gate dungeon 100 times'),
  ('Crystal Master', 'Master of the crystalline caverns', 'diamond', 'epic', 'Complete Crystal Gate dungeon 100 times'),
  ('Inferno Master', 'Master of the blazing hellscape', 'ruby', 'epic', 'Complete Inferno Gate dungeon 100 times'),
  ('Machine Master', 'Master of the mechanical fortress', 'silver', 'epic', 'Complete Machine Gate dungeon 100 times')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS dungeon_progress_profile_id_idx ON dungeon_progress(profile_id);
CREATE INDEX IF NOT EXISTS dungeon_history_profile_id_idx ON dungeon_history(profile_id);
CREATE INDEX IF NOT EXISTS dungeon_history_completed_at_idx ON dungeon_history(completed_at DESC);
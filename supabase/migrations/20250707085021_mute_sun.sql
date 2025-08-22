/*
  # Title System Implementation

  1. New Tables
    - `titles`
      - `id` (uuid, primary key)
      - `name` (text): Title name
      - `description` (text): Title description
      - `color` (text): Title color theme
      - `rarity` (text): Title rarity (common, rare, epic, legendary)
      - `unlock_condition` (text): How to unlock this title
      - `is_active` (boolean): Whether title is available
      - `created_at` (timestamp)
    
    - `player_titles`
      - `id` (uuid, primary key)
      - `profile_id` (uuid): Reference to player's profile
      - `title_id` (uuid): Reference to titles
      - `unlocked_at` (timestamp): When title was unlocked
      - `is_equipped` (boolean): Whether title is currently equipped
    
    - Add `equipped_title_id` to profiles table

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create titles table
CREATE TABLE IF NOT EXISTS titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  color text NOT NULL DEFAULT 'gold',
  rarity text NOT NULL DEFAULT 'common',
  unlock_condition text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_rarity CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  CONSTRAINT valid_color CHECK (color IN ('gold', 'silver', 'bronze', 'diamond', 'ruby', 'emerald', 'purple'))
);

-- Create player_titles table
CREATE TABLE IF NOT EXISTS player_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  unlocked_at timestamptz DEFAULT now(),
  is_equipped boolean DEFAULT false,
  UNIQUE (profile_id, title_id)
);

-- Add equipped_title_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS equipped_title_id uuid REFERENCES titles(id);

-- Enable RLS
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_titles ENABLE ROW LEVEL SECURITY;

-- Policies for titles
CREATE POLICY "Anyone can view titles"
  ON titles FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies for player_titles
CREATE POLICY "Players can view their own titles"
  ON player_titles FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Players can view others' equipped titles"
  ON player_titles FOR SELECT
  TO authenticated
  USING (is_equipped = true);

CREATE POLICY "Players can update their own titles"
  ON player_titles FOR UPDATE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert player titles"
  ON player_titles FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Function to equip a title
CREATE OR REPLACE FUNCTION equip_title(player_profile_id uuid, new_title_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  title_exists boolean;
  player_owns_title boolean;
BEGIN
  -- Check if title exists and is active
  SELECT EXISTS(
    SELECT 1 FROM titles 
    WHERE id = new_title_id AND is_active = true
  ) INTO title_exists;
  
  IF NOT title_exists THEN
    RAISE EXCEPTION 'Title does not exist or is not active';
  END IF;
  
  -- Check if player owns this title
  SELECT EXISTS(
    SELECT 1 FROM player_titles 
    WHERE profile_id = player_profile_id AND title_id = new_title_id
  ) INTO player_owns_title;
  
  IF NOT player_owns_title THEN
    RAISE EXCEPTION 'Player does not own this title';
  END IF;
  
  -- Unequip all current titles for this player
  UPDATE player_titles 
  SET is_equipped = false 
  WHERE profile_id = player_profile_id;
  
  -- Equip the new title
  UPDATE player_titles 
  SET is_equipped = true 
  WHERE profile_id = player_profile_id AND title_id = new_title_id;
  
  -- Update profile with equipped title
  UPDATE profiles 
  SET equipped_title_id = new_title_id 
  WHERE id = player_profile_id;
  
  RETURN true;
END;
$$;

-- Function to unequip title
CREATE OR REPLACE FUNCTION unequip_title(player_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Unequip all titles for this player
  UPDATE player_titles 
  SET is_equipped = false 
  WHERE profile_id = player_profile_id;
  
  -- Remove equipped title from profile
  UPDATE profiles 
  SET equipped_title_id = NULL 
  WHERE id = player_profile_id;
  
  RETURN true;
END;
$$;

-- Function to award title to player
CREATE OR REPLACE FUNCTION award_title(player_profile_id uuid, new_title_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  title_exists boolean;
  already_has_title boolean;
BEGIN
  -- Check if title exists and is active
  SELECT EXISTS(
    SELECT 1 FROM titles 
    WHERE id = new_title_id AND is_active = true
  ) INTO title_exists;
  
  IF NOT title_exists THEN
    RAISE EXCEPTION 'Title does not exist or is not active';
  END IF;
  
  -- Check if player already has this title
  SELECT EXISTS(
    SELECT 1 FROM player_titles 
    WHERE profile_id = player_profile_id AND title_id = new_title_id
  ) INTO already_has_title;
  
  IF already_has_title THEN
    RETURN false; -- Player already has this title
  END IF;
  
  -- Award the title
  INSERT INTO player_titles (profile_id, title_id, is_equipped)
  VALUES (player_profile_id, new_title_id, false);
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION equip_title(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unequip_title(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION award_title(uuid, uuid) TO authenticated;

-- Insert initial titles
INSERT INTO titles (name, description, color, rarity, unlock_condition) VALUES
  ('Newbie', 'Welcome to the game!', 'bronze', 'common', 'Complete registration'),
  ('Adventurer', 'Started your journey', 'silver', 'common', 'Complete first adventure level'),
  ('Dungeon Master', 'Master of dungeons', 'gold', 'rare', 'Complete 10 adventure levels'),
  ('Fisher King', 'Master of the waters', 'emerald', 'rare', 'Catch 50 fish'),
  ('Green Thumb', 'Master farmer', 'emerald', 'rare', 'Harvest 100 crops'),
  ('Battle Lord', 'Warrior supreme', 'ruby', 'epic', 'Win 25 battles'),
  ('Legendary Hero', 'True legend', 'diamond', 'legendary', 'Reach level 50'),
  ('Chat Master', 'Social butterfly', 'purple', 'rare', 'Send 500 chat messages'),
  ('Wealthy', 'Rich player', 'gold', 'epic', 'Accumulate 100,000 ZGold'),
  ('Collector', 'Item collector', 'silver', 'rare', 'Own 50 different items')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS player_titles_profile_id_idx ON player_titles(profile_id);
CREATE INDEX IF NOT EXISTS player_titles_equipped_idx ON player_titles(is_equipped) WHERE is_equipped = true;
CREATE INDEX IF NOT EXISTS profiles_equipped_title_idx ON profiles(equipped_title_id) WHERE equipped_title_id IS NOT NULL;
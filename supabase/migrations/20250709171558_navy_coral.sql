/*
  # Custom Costume System

  1. New Tables
    - `costumes`
      - `id` (uuid, primary key)
      - `name` (text): Costume name
      - `icon_url` (text): Costume icon image
      - `male_image_url` (text): Male character costume image
      - `female_image_url` (text): Female character costume image
      - `price` (integer): Cost in ZGold
      - `is_active` (boolean): Whether costume is available
      - `created_at` (timestamp)
    
    - `player_costumes`
      - `id` (uuid, primary key)
      - `profile_id` (uuid): Reference to player's profile
      - `costume_id` (uuid): Reference to costumes
      - `is_equipped` (boolean): Whether costume is currently equipped
      - `obtained_at` (timestamp)

    - Add `equipped_costume_id` to profiles table

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users

  3. Initial Data
    - Insert Dark School Costume
*/

-- Create costumes table
CREATE TABLE IF NOT EXISTS costumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon_url text NOT NULL,
  male_image_url text NOT NULL,
  female_image_url text NOT NULL,
  price integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create player_costumes table
CREATE TABLE IF NOT EXISTS player_costumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  costume_id uuid NOT NULL REFERENCES costumes(id) ON DELETE CASCADE,
  is_equipped boolean NOT NULL DEFAULT false,
  obtained_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, costume_id)
);

-- Add equipped_costume_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS equipped_costume_id uuid REFERENCES costumes(id);

-- Enable RLS
ALTER TABLE costumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_costumes ENABLE ROW LEVEL SECURITY;

-- Policies for costumes
CREATE POLICY "Anyone can view costumes"
  ON costumes FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies for player_costumes
CREATE POLICY "Players can view their own costumes"
  ON player_costumes FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Players can update their own costumes"
  ON player_costumes FOR UPDATE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "System can insert player costumes"
  ON player_costumes FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Function to equip costume
CREATE OR REPLACE FUNCTION equip_costume(player_profile_id uuid, costume_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  costume_exists boolean;
  player_owns_costume boolean;
BEGIN
  -- Check if costume exists and is active
  SELECT EXISTS(
    SELECT 1 FROM costumes 
    WHERE id = costume_id AND is_active = true
  ) INTO costume_exists;
  
  IF NOT costume_exists THEN
    RAISE EXCEPTION 'Costume does not exist or is not active';
  END IF;
  
  -- Check if player owns this costume
  SELECT EXISTS(
    SELECT 1 FROM player_costumes 
    WHERE profile_id = player_profile_id AND costume_id = equip_costume.costume_id
  ) INTO player_owns_costume;
  
  IF NOT player_owns_costume THEN
    RAISE EXCEPTION 'Player does not own this costume';
  END IF;
  
  -- Unequip all current costumes for this player
  UPDATE player_costumes 
  SET is_equipped = false 
  WHERE profile_id = player_profile_id;
  
  -- Equip the new costume
  UPDATE player_costumes 
  SET is_equipped = true 
  WHERE profile_id = player_profile_id AND costume_id = equip_costume.costume_id;
  
  -- Update profile with equipped costume
  UPDATE profiles 
  SET equipped_costume_id = costume_id 
  WHERE id = player_profile_id;
  
  RETURN true;
END;
$$;

-- Function to unequip costume
CREATE OR REPLACE FUNCTION unequip_costume(player_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Unequip all costumes for this player
  UPDATE player_costumes 
  SET is_equipped = false 
  WHERE profile_id = player_profile_id;
  
  -- Remove equipped costume from profile
  UPDATE profiles 
  SET equipped_costume_id = NULL 
  WHERE id = player_profile_id;
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION equip_costume(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unequip_costume(uuid) TO authenticated;

-- Insert Dark School Costume
INSERT INTO costumes (name, icon_url, male_image_url, female_image_url, price) VALUES
  (
    'Dark School Costume', 
    'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752080421048-3aoazf.png',
    'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752081083503-okyqmx.png',
    'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752081093599-qy183p.png',
    10000
  )
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS player_costumes_profile_id_idx ON player_costumes(profile_id);
CREATE INDEX IF NOT EXISTS player_costumes_equipped_idx ON player_costumes(is_equipped) WHERE is_equipped = true;
CREATE INDEX IF NOT EXISTS profiles_equipped_costume_idx ON profiles(equipped_costume_id) WHERE equipped_costume_id IS NOT NULL;
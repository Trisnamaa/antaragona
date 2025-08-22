/*
  # Progressive Adventure World System

  1. New Tables
    - `adventure_worlds`
      - `id` (uuid, primary key)
      - `name` (text): World name
      - `stage_start` (integer): Starting stage number
      - `stage_end` (integer): Ending stage number
      - `background_url` (text): World background image
      - `unlock_requirement` (integer): Stage needed to unlock
      - `is_active` (boolean): Whether world is available
      - `created_at` (timestamp)
    
    - `adventure_stages`
      - `id` (uuid, primary key)
      - `world_id` (uuid): Reference to adventure_worlds
      - `stage_number` (integer): Stage number (1-100)
      - `stage_type` (text): normal, boss, final
      - `rounds_count` (integer): Number of rounds in stage
      - `reward_zgold` (integer): ZGold reward
      - `reward_ztoken` (integer): ZToken reward
      - `reward_exp` (integer): EXP reward
      - `special_reward` (text): Special reward for final stages
      - `created_at` (timestamp)
    
    - `player_adventure_progress`
      - `id` (uuid, primary key)
      - `profile_id` (uuid): Reference to player's profile
      - `current_stage` (integer): Current stage (1-100)
      - `unlocked_worlds` (text[]): Array of unlocked world names
      - `completed_stages` (integer[]): Array of completed stage numbers
      - `last_played_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Initial Data
    - Insert 10 worlds with their stage ranges
    - Insert all 100 stages with appropriate rewards
*/

-- Create adventure_worlds table
CREATE TABLE IF NOT EXISTS adventure_worlds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  stage_start integer NOT NULL,
  stage_end integer NOT NULL,
  background_url text NOT NULL,
  unlock_requirement integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create adventure_stages table
CREATE TABLE IF NOT EXISTS adventure_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES adventure_worlds(id) ON DELETE CASCADE,
  stage_number integer NOT NULL UNIQUE,
  stage_type text NOT NULL CHECK (stage_type IN ('normal', 'boss', 'final')),
  rounds_count integer NOT NULL,
  reward_zgold integer NOT NULL,
  reward_ztoken integer NOT NULL,
  reward_exp integer NOT NULL,
  special_reward text,
  created_at timestamptz DEFAULT now()
);

-- Create player_adventure_progress table
CREATE TABLE IF NOT EXISTS player_adventure_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_stage integer NOT NULL DEFAULT 1,
  unlocked_worlds text[] NOT NULL DEFAULT ARRAY['AETHERION'],
  completed_stages integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  last_played_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id)
);

-- Enable RLS
ALTER TABLE adventure_worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE adventure_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_adventure_progress ENABLE ROW LEVEL SECURITY;

-- Policies for adventure_worlds
CREATE POLICY "Anyone can view adventure worlds"
  ON adventure_worlds FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies for adventure_stages
CREATE POLICY "Anyone can view adventure stages"
  ON adventure_stages FOR SELECT
  TO authenticated
  USING (true);

-- Policies for player_adventure_progress
CREATE POLICY "Players can view their own adventure progress"
  ON player_adventure_progress FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Players can update their own adventure progress"
  ON player_adventure_progress FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Insert adventure worlds
INSERT INTO adventure_worlds (name, stage_start, stage_end, background_url, unlock_requirement) VALUES
  ('AETHERION', 1, 10, 'https://i.pinimg.com/1200x/a1/b2/c3/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.jpg', 0),
  ('THALASSIA', 11, 20, 'https://i.pinimg.com/1200x/b2/c3/d4/b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7.jpg', 10),
  ('EMBERWASTE', 21, 30, 'https://i.pinimg.com/1200x/c3/d4/e5/c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8.jpg', 20),
  ('CRYNTAR', 31, 40, 'https://i.pinimg.com/1200x/d4/e5/f6/d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9.jpg', 30),
  ('SYLVARAN', 41, 50, 'https://i.pinimg.com/1200x/e5/f6/g7/e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0.jpg', 40),
  ('MECHAVELL', 51, 60, 'https://i.pinimg.com/1200x/f6/g7/h8/f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1.jpg', 50),
  ('DRAK''ARHIM', 61, 70, 'https://i.pinimg.com/1200x/g7/h8/i9/g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2.jpg', 60),
  ('NOCTHERRA', 71, 80, 'https://i.pinimg.com/1200x/h8/i9/j0/h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3.jpg', 70),
  ('NECROSALEM', 81, 90, 'https://i.pinimg.com/1200x/i9/j0/k1/i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4.jpg', 80),
  ('ASTRALUNE', 91, 100, 'https://i.pinimg.com/1200x/j0/k1/l2/j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5.jpg', 90)
ON CONFLICT (name) DO NOTHING;

-- Function to generate stages for all worlds
CREATE OR REPLACE FUNCTION generate_adventure_stages()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  world_record record;
  stage_num integer;
  stage_type text;
  rounds integer;
  zgold_reward integer;
  ztoken_reward integer;
  exp_reward integer;
  special_reward text;
BEGIN
  -- Loop through each world
  FOR world_record IN SELECT * FROM adventure_worlds ORDER BY stage_start LOOP
    -- Generate stages for this world
    FOR stage_num IN world_record.stage_start..world_record.stage_end LOOP
      -- Determine stage type
      IF stage_num % 10 = 0 THEN
        stage_type := 'final';
        rounds := 5; -- 4 NPC + 1 boss
        zgold_reward := 5000 + (stage_num * 100);
        ztoken_reward := 10 + (stage_num / 10);
        exp_reward := 500 + (stage_num * 25);
        special_reward := 'Key Item + Exclusive Costume';
      ELSIF stage_num % 5 = 0 THEN
        stage_type := 'boss';
        rounds := 5; -- 4 NPC + 1 boss
        zgold_reward := (2000 + (stage_num * 50)) * 2; -- 2x reward
        ztoken_reward := 5 + (stage_num / 10);
        exp_reward := (200 + (stage_num * 15)) * 2; -- 2x reward
        special_reward := null;
      ELSE
        stage_type := 'normal';
        rounds := 3; -- 3 NPC
        zgold_reward := 1000 + (stage_num * 25);
        ztoken_reward := 2 + (stage_num / 20);
        exp_reward := 100 + (stage_num * 10);
        special_reward := null;
      END IF;
      
      -- Insert stage
      INSERT INTO adventure_stages (
        world_id, 
        stage_number, 
        stage_type, 
        rounds_count, 
        reward_zgold, 
        reward_ztoken, 
        reward_exp, 
        special_reward
      ) VALUES (
        world_record.id,
        stage_num,
        stage_type,
        rounds,
        zgold_reward,
        ztoken_reward,
        exp_reward,
        special_reward
      ) ON CONFLICT (stage_number) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

-- Execute the function to generate all stages
SELECT generate_adventure_stages();

-- Function to complete adventure stage
CREATE OR REPLACE FUNCTION complete_adventure_stage(
  player_profile_id uuid,
  stage_number integer,
  is_victory boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stage_info record;
  world_info record;
  player_progress record;
  new_unlocked_worlds text[];
  new_completed_stages integer[];
  next_world_name text;
  result json;
BEGIN
  -- Get stage information
  SELECT s.*, w.name as world_name
  INTO stage_info
  FROM adventure_stages s
  JOIN adventure_worlds w ON s.world_id = w.id
  WHERE s.stage_number = stage_number;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found: %', stage_number;
  END IF;
  
  -- Get player progress
  SELECT * INTO player_progress
  FROM player_adventure_progress
  WHERE profile_id = player_profile_id;
  
  -- Create progress if doesn't exist
  IF NOT FOUND THEN
    INSERT INTO player_adventure_progress (profile_id, current_stage, unlocked_worlds, completed_stages)
    VALUES (player_profile_id, 1, ARRAY['AETHERION'], ARRAY[]::integer[])
    RETURNING * INTO player_progress;
  END IF;
  
  -- Only process if victory
  IF is_victory THEN
    -- Update player resources
    UPDATE profiles
    SET 
      exp = exp + stage_info.reward_exp,
      zgold = zgold + stage_info.reward_zgold,
      ztoken = ztoken + stage_info.reward_ztoken
    WHERE id = player_profile_id;
    
    -- Update completed stages
    new_completed_stages := player_progress.completed_stages;
    IF NOT (stage_number = ANY(new_completed_stages)) THEN
      new_completed_stages := array_append(new_completed_stages, stage_number);
    END IF;
    
    -- Check if new world should be unlocked (final stage completed)
    new_unlocked_worlds := player_progress.unlocked_worlds;
    IF stage_info.stage_type = 'final' THEN
      SELECT name INTO next_world_name
      FROM adventure_worlds
      WHERE unlock_requirement = stage_number
      AND NOT (name = ANY(new_unlocked_worlds));
      
      IF next_world_name IS NOT NULL THEN
        new_unlocked_worlds := array_append(new_unlocked_worlds, next_world_name);
      END IF;
    END IF;
    
    -- Update player progress
    UPDATE player_adventure_progress
    SET 
      current_stage = GREATEST(current_stage, stage_number + 1),
      unlocked_worlds = new_unlocked_worlds,
      completed_stages = new_completed_stages,
      last_played_at = now()
    WHERE profile_id = player_profile_id;
  END IF;
  
  -- Return result
  result := json_build_object(
    'success', is_victory,
    'stage_completed', stage_number,
    'stage_type', stage_info.stage_type,
    'world_name', stage_info.world_name,
    'rewards', json_build_object(
      'zgold', CASE WHEN is_victory THEN stage_info.reward_zgold ELSE 0 END,
      'ztoken', CASE WHEN is_victory THEN stage_info.reward_ztoken ELSE 0 END,
      'exp', CASE WHEN is_victory THEN stage_info.reward_exp ELSE 0 END,
      'special_reward', CASE WHEN is_victory THEN stage_info.special_reward ELSE null END
    ),
    'world_unlocked', CASE WHEN is_victory AND stage_info.stage_type = 'final' THEN next_world_name ELSE null END
  );
  
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_adventure_stages() TO authenticated;
GRANT EXECUTE ON FUNCTION complete_adventure_stage(uuid, integer, boolean) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS adventure_stages_stage_number_idx ON adventure_stages(stage_number);
CREATE INDEX IF NOT EXISTS adventure_stages_world_id_idx ON adventure_stages(world_id);
CREATE INDEX IF NOT EXISTS player_adventure_progress_profile_id_idx ON player_adventure_progress(profile_id);
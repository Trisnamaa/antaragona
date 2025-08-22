/*
  # Fix complete_dungeon function syntax error

  1. Changes
    - Fix ambiguous column reference in complete_dungeon function
    - Correct ON CONFLICT syntax
    - Properly handle dungeon progress tracking
    - Award master titles when requirements are met

  2. Security
    - Maintain existing function security
*/

-- Drop the existing function with correct signature
DROP FUNCTION IF EXISTS complete_dungeon(uuid, uuid, integer, boolean);

-- Recreate the function with proper syntax
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
  title_id uuid;
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
  
  -- Get current progress
  SELECT * INTO current_progress
  FROM dungeon_progress
  WHERE profile_id = player_profile_id AND dungeon_progress.dungeon_type_id = complete_dungeon.dungeon_type_id;
  
  IF FOUND THEN
    new_completion_count := current_progress.completion_count + 1;
    
    UPDATE dungeon_progress
    SET 
      completion_count = new_completion_count,
      last_completed_at = NOW()
    WHERE profile_id = player_profile_id AND dungeon_progress.dungeon_type_id = complete_dungeon.dungeon_type_id;
  ELSE
    new_completion_count := 1;
    
    INSERT INTO dungeon_progress (profile_id, dungeon_type_id, completion_count, last_completed_at)
    VALUES (player_profile_id, complete_dungeon.dungeon_type_id, new_completion_count, NOW());
  END IF;
  
  -- Check if player earned master title
  IF is_victory AND new_completion_count >= dungeon_info.master_title_requirement THEN
    -- Check if player already has this title
    SELECT t.id INTO title_id
    FROM titles t
    LEFT JOIN player_titles pt ON pt.title_id = t.id AND pt.profile_id = player_profile_id
    WHERE t.name = dungeon_info.master_title_name AND pt.id IS NULL;
    
    IF FOUND THEN
      -- Award the master title
      INSERT INTO player_titles (profile_id, title_id)
      VALUES (player_profile_id, title_id);
      
      title_awarded := dungeon_info.master_title_name;
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
    complete_dungeon.dungeon_type_id, 
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
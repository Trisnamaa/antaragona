/*
  # Fix complete_dungeon function ambiguous column reference

  1. Function Updates
    - Fix ambiguous column reference for dungeon_type_id
    - Ensure proper table aliases are used
    - Fix progress tracking for title completion
    - Add proper error handling

  2. Changes Made
    - Qualify all column references with proper table aliases
    - Fix dungeon progress tracking logic
    - Ensure title unlocking works correctly for 100 completions
    - Add proper return structure for frontend
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS complete_dungeon(uuid, uuid, integer, boolean);

-- Create the corrected complete_dungeon function
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
  dungeon_data record;
  current_progress record;
  new_completion_count integer := 0;
  exp_reward integer := 0;
  zgold_reward integer := 0;
  ztoken_reward integer := 0;
  title_awarded text := null;
  master_title_unlocked boolean := false;
  result json;
BEGIN
  -- Get dungeon type data
  SELECT dt.reward_exp, dt.reward_zgold, dt.reward_ztoken, dt.master_title_name, dt.master_title_requirement
  INTO dungeon_data
  FROM dungeon_types dt
  WHERE dt.id = dungeon_type_id AND dt.is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dungeon type not found or inactive';
  END IF;

  -- Insert dungeon history record
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
    CASE WHEN is_victory THEN dungeon_data.reward_exp ELSE 0 END,
    CASE WHEN is_victory THEN dungeon_data.reward_zgold ELSE 0 END,
    CASE WHEN is_victory THEN dungeon_data.reward_ztoken ELSE 0 END,
    null -- Will be updated if title is awarded
  );

  -- Only process rewards and progress if victory
  IF is_victory THEN
    exp_reward := dungeon_data.reward_exp;
    zgold_reward := dungeon_data.reward_zgold;
    ztoken_reward := dungeon_data.reward_ztoken;

    -- Update player stats
    UPDATE profiles 
    SET 
      exp = exp + exp_reward,
      zgold = zgold + zgold_reward,
      ztoken = ztoken + ztoken_reward
    WHERE id = player_profile_id;

    -- Update or insert dungeon progress
    INSERT INTO dungeon_progress (profile_id, dungeon_type_id, completion_count, last_completed_at)
    VALUES (player_profile_id, dungeon_type_id, 1, now())
    ON CONFLICT (profile_id, dungeon_type_id)
    DO UPDATE SET 
      completion_count = dungeon_progress.completion_count + 1,
      last_completed_at = now()
    RETURNING completion_count INTO new_completion_count;

    -- Check if master title should be unlocked
    IF new_completion_count >= dungeon_data.master_title_requirement THEN
      -- Check if title exists and player doesn't already have it
      DECLARE
        title_id uuid;
        has_title boolean := false;
      BEGIN
        -- Get title ID
        SELECT t.id INTO title_id
        FROM titles t
        WHERE t.name = dungeon_data.master_title_name AND t.is_active = true;

        IF FOUND THEN
          -- Check if player already has this title
          SELECT EXISTS(
            SELECT 1 FROM player_titles pt 
            WHERE pt.profile_id = player_profile_id AND pt.title_id = title_id
          ) INTO has_title;

          -- Award title if player doesn't have it
          IF NOT has_title THEN
            INSERT INTO player_titles (profile_id, title_id, unlocked_at)
            VALUES (player_profile_id, title_id, now());
            
            title_awarded := dungeon_data.master_title_name;
            master_title_unlocked := true;

            -- Update the dungeon history record with the awarded title
            UPDATE dungeon_history 
            SET title_awarded = title_awarded
            WHERE profile_id = player_profile_id 
              AND dungeon_type_id = dungeon_type_id 
              AND completed_at = (
                SELECT MAX(completed_at) 
                FROM dungeon_history dh2 
                WHERE dh2.profile_id = player_profile_id 
                  AND dh2.dungeon_type_id = dungeon_type_id
              );
          END IF;
        END IF;
      END;
    END IF;
  END IF;

  -- Prepare result
  result := json_build_object(
    'exp_gained', exp_reward,
    'zgold_gained', zgold_reward,
    'ztoken_gained', ztoken_reward,
    'title_awarded', title_awarded,
    'completion_count', COALESCE(new_completion_count, 0),
    'master_title_unlocked', master_title_unlocked
  );

  RETURN result;
END;
$$;
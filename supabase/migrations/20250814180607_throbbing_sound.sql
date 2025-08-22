/*
  # Fix RAID Attack Function Conflict

  1. Problem
    - Multiple handle_raid_attack functions with different signatures exist
    - Database cannot choose between text and uuid parameter types
    - This causes "Could not choose the best candidate function" error

  2. Solution
    - Drop all existing handle_raid_attack functions
    - Create single definitive function with correct signature
    - Ensure proper turn-based combat logic

  3. Function Features
    - Real-time turn validation
    - Proper boss HP management
    - Turn rotation for 2 and 3 players
    - Round progression (1-3 rounds)
    - Victory/defeat detection
*/

-- Drop all existing handle_raid_attack functions to resolve conflict
DROP FUNCTION IF EXISTS handle_raid_attack(text, uuid);
DROP FUNCTION IF EXISTS handle_raid_attack(uuid, uuid);
DROP FUNCTION IF EXISTS raid_attack_boss(uuid, uuid, integer);

-- Create the definitive handle_raid_attack function
CREATE OR REPLACE FUNCTION handle_raid_attack(
  p_room_uuid text,
  p_profile_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_record record;
  attacker_record record;
  alive_count integer;
  current_turn_player_id uuid;
  boss_hp_before integer;
  boss_hp_after integer;
  boss_max_hp integer;
  boss_damage integer;
  player_damage integer;
  new_player_hp integer;
  next_turn_index integer;
  round_completed boolean := false;
  raid_completed boolean := false;
BEGIN
  -- Get room information with map details
  SELECT 
    rr.id, rr.room_uuid, rr.status, rr.current_round, rr.current_turn,
    rr.boss_hp, rr.boss_max_hp, rr.map_id,
    rm.boss_name, rm.difficulty_level, rm.boss_image_url
  INTO room_record
  FROM raid_rooms rr
  JOIN raid_maps rm ON rr.map_id = rm.id
  WHERE rr.room_uuid = p_room_uuid AND rr.status = 'in_progress';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Room not found or not in progress'
    );
  END IF;
  
  -- Get attacker information
  SELECT rp.id, rp.profile_id, rp.current_hp, rp.max_hp, rp.is_alive, rp.slot_number,
         p.username, p.strength
  INTO attacker_record
  FROM raid_participants rp
  JOIN profiles p ON rp.profile_id = p.id
  WHERE rp.room_id = room_record.id 
  AND rp.profile_id = p_profile_id
  AND rp.is_alive = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Player not found, not in room, or already defeated'
    );
  END IF;
  
  -- Get count of alive participants
  SELECT COUNT(*) INTO alive_count
    FROM raid_participants rp
  WHERE rp.room_id = room_record.id AND rp.is_alive = true;
  
  IF alive_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No alive players found'
    );
  END IF;
  
  -- Validate turn: get current turn player ID using current_turn as index
  SELECT rp.profile_id INTO current_turn_player_id
  FROM raid_participants rp
  WHERE rp.room_id = room_record.id 
  AND rp.is_alive = true
  ORDER BY rp.slot_number
  LIMIT 1 OFFSET (room_record.current_turn % alive_count);
  
  IF current_turn_player_id != p_profile_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Not your turn to attack'
    );
  END IF;
  
  -- Initialize boss HP if not set (first attack of the round)
  IF room_record.boss_hp IS NULL OR room_record.boss_max_hp IS NULL THEN
    CASE room_record.current_round
      WHEN 1 THEN 
        boss_hp_before := 150;
        boss_max_hp := 150;
      WHEN 2 THEN 
        boss_hp_before := 200;
        boss_max_hp := 200;
      WHEN 3 THEN 
        boss_hp_before := 300;
        boss_max_hp := 300;
      ELSE
        boss_hp_before := 150;
        boss_max_hp := 150;
    END CASE;
    
    UPDATE raid_rooms
    SET boss_hp = boss_hp_before, boss_max_hp = boss_max_hp
    WHERE id = room_record.id;
  ELSE
    boss_hp_before := room_record.boss_hp;
    boss_max_hp := room_record.boss_max_hp;
  END IF;
  
  -- Calculate player damage (use player's strength)
  player_damage := attacker_record.strength;
  boss_hp_after := GREATEST(0, boss_hp_before - player_damage);
  
  -- Update boss HP
  UPDATE raid_rooms
  SET boss_hp = boss_hp_after
  WHERE id = room_record.id;
  
  -- Check if boss is defeated (round completed)
  IF boss_hp_after <= 0 THEN
    round_completed := true;
    
    IF room_record.current_round >= 3 THEN
      -- RAID completed successfully
      raid_completed := true;
      
      UPDATE raid_rooms
      SET status = 'completed', completed_at = now()
      WHERE id = room_record.id;
      
      RETURN json_build_object(
        'success', true,
        'message', 'Final boss defeated! RAID completed!',
        'player_damage', player_damage,
        'boss_hp_before', boss_hp_before,
        'boss_hp_after', boss_hp_after,
        'round_completed', true,
        'raid_completed', true,
        'current_round', room_record.current_round
      );
    ELSE
      -- Advance to next round
      DECLARE
        next_round integer := room_record.current_round + 1;
        next_boss_hp integer;
        next_boss_max_hp integer;
      BEGIN
        -- Set HP for next round
        CASE next_round
          WHEN 2 THEN 
            next_boss_hp := 200;
            next_boss_max_hp := 200;
          WHEN 3 THEN 
            next_boss_hp := 300;
            next_boss_max_hp := 300;
          ELSE
            next_boss_hp := 150;
            next_boss_max_hp := 150;
        END CASE;
        
        -- Update room for next round, reset turn to 0
        UPDATE raid_rooms
        SET 
          current_round = next_round,
          current_turn = 0,
          boss_hp = next_boss_hp,
          boss_max_hp = next_boss_max_hp
        WHERE id = room_record.id;
        
        RETURN json_build_object(
          'success', true,
          'message', 'Boss defeated! Advancing to round ' || next_round,
          'player_damage', player_damage,
          'boss_hp_before', boss_hp_before,
          'boss_hp_after', 0,
          'round_completed', true,
          'next_round', next_round,
          'next_boss_hp', next_boss_hp,
          'current_round', next_round
        );
      END;
    END IF;
  END IF;
  
  -- Boss counter-attack (if boss is still alive)
  CASE room_record.current_round
    WHEN 1 THEN boss_damage := 25;
    WHEN 2 THEN boss_damage := 35;
    WHEN 3 THEN boss_damage := 50;
    ELSE boss_damage := 25;
  END CASE;
  
  new_player_hp := GREATEST(0, attacker_record.current_hp - boss_damage);
  
  -- Update attacker's HP
  UPDATE raid_participants
  SET 
    current_hp = new_player_hp,
    is_alive = (new_player_hp > 0)
  WHERE room_id = room_record.id AND profile_id = p_profile_id;
  
  -- Check if all players are defeated after boss counter-attack
  SELECT COUNT(*) INTO alive_count
  FROM raid_participants
  WHERE room_id = room_record.id AND is_alive = true;
  
  IF alive_count = 0 THEN
    -- All players defeated - RAID failure
    UPDATE raid_rooms
    SET status = 'completed', completed_at = now()
    WHERE id = room_record.id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'All players defeated! RAID failed!',
      'player_damage', player_damage,
      'boss_damage', boss_damage,
      'boss_hp_before', boss_hp_before,
      'boss_hp_after', boss_hp_after,
      'new_player_hp', new_player_hp,
      'player_defeated', (new_player_hp <= 0),
      'all_players_defeated', true,
      'raid_failed', true
    );
  END IF;
  
  -- Calculate next turn (move to next alive player)
  next_turn_index := (room_record.current_turn + 1) % alive_count;
  
  -- Update room with next turn
  UPDATE raid_rooms
  SET current_turn = next_turn_index
  WHERE id = room_record.id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Attack successful!',
    'player_damage', player_damage,
    'boss_damage', boss_damage,
    'boss_hp_before', boss_hp_before,
    'boss_hp_after', boss_hp_after,
    'new_player_hp', new_player_hp,
    'player_defeated', (new_player_hp <= 0),
    'next_turn', next_turn_index,
    'alive_players', alive_count,
    'current_round', room_record.current_round,
    'round_completed', false,
    'raid_completed', false
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION handle_raid_attack(text, uuid) TO authenticated;

-- Add reward system tables and functions
-- Create raid_rewards table for storing card rewards
CREATE TABLE IF NOT EXISTS raid_rewards (
  id SERIAL PRIMARY KEY,
  room_id UUID REFERENCES raid_rooms(id) ON DELETE CASCADE,
  reward_type VARCHAR(50) NOT NULL, -- 'raid_ticket', 'ztoken', 'exp', 'zgold'
  reward_value INTEGER NOT NULL,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_by UUID REFERENCES profiles(id),
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_raid_rewards_room_id ON raid_rewards(room_id);
CREATE INDEX IF NOT EXISTS idx_raid_rewards_claimed_by ON raid_rewards(claimed_by);

-- Grant permissions
GRANT ALL ON raid_rewards TO authenticated;
GRANT USAGE ON SEQUENCE raid_rewards_id_seq TO authenticated;

-- Function to generate rewards for a completed raid
CREATE OR REPLACE FUNCTION generate_raid_rewards(p_room_uuid text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_record record;
  reward_types text[] := ARRAY['raid_ticket', 'ztoken', 'exp', 'zgold'];
  reward_values integer[] := ARRAY[1, 100, 500, 1000];
  i integer;
  j integer;
  random_type text;
  random_value integer;
  reward_id integer;
BEGIN
  -- Get room information
  SELECT id, map_id, current_round INTO room_record
  FROM raid_rooms
  WHERE room_uuid = p_room_uuid AND status = 'completed';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Room not found or not completed'
    );
  END IF;
  
  -- Generate 6 random rewards (2 per player for 3 players)
  FOR i IN 1..6 LOOP
    -- Random reward type and value
    random_type := reward_types[1 + floor(random() * array_length(reward_types, 1))];
    
    CASE random_type
      WHEN 'raid_ticket' THEN random_value := 1;
      WHEN 'ztoken' THEN random_value := 50 + floor(random() * 100);
      WHEN 'exp' THEN random_value := 200 + floor(random() * 300);
      WHEN 'zgold' THEN random_value := 500 + floor(random() * 1000);
      ELSE random_value := 100;
    END CASE;
    
    -- Insert reward
    INSERT INTO raid_rewards (room_id, reward_type, reward_value)
    VALUES (room_record.id, random_type, random_value)
    RETURNING id INTO reward_id;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Rewards generated successfully',
    'rewards_count', 6
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION generate_raid_rewards(text) TO authenticated;

-- Function to claim a reward
CREATE OR REPLACE FUNCTION claim_raid_reward(
  p_room_uuid text,
  p_profile_id uuid,
  p_reward_ids integer[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_record record;
  claimed_count integer;
  reward_record record;
BEGIN
  -- Get room information
  SELECT id INTO room_record
  FROM raid_rooms
  WHERE room_uuid = p_room_uuid;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Room not found'
    );
  END IF;
  
  -- Validate reward selection (must be exactly 2)
  IF array_length(p_reward_ids, 1) != 2 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Must select exactly 2 rewards'
    );
  END IF;
  
  -- Check if rewards are available and not claimed
  FOR i IN 1..array_length(p_reward_ids, 1) LOOP
    SELECT * INTO reward_record
    FROM raid_rewards
    WHERE id = p_reward_ids[i] AND room_id = room_record.id;
    
    IF NOT FOUND THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Reward not found'
      );
    END IF;
    
    IF reward_record.is_claimed THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Reward already claimed'
      );
    END IF;
  END LOOP;
  
  -- Claim the rewards
  UPDATE raid_rewards
  SET 
    is_claimed = TRUE,
    claimed_by = p_profile_id,
    claimed_at = NOW()
  WHERE id = ANY(p_reward_ids) AND room_id = room_record.id;
  
  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  
  IF claimed_count = 2 THEN
    -- Mark participant as claimed rewards
    UPDATE raid_participants
    SET claimed_rewards_at = NOW()
    WHERE room_id = room_record.id AND profile_id = p_profile_id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Rewards claimed successfully',
      'claimed_rewards', claimed_count
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to claim rewards'
    );
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION claim_raid_reward(text, uuid, integer[]) TO authenticated;
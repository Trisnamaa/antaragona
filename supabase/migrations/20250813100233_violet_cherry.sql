/*
  # Fix RAID Attack System for Real-time Turn-based Combat

  1. New Function
    - `handle_raid_attack()`: Comprehensive attack handler with proper turn management
    - Fixes round progression bugs
    - Fixes turn rotation for 2 and 3 players
    - Ensures real-time synchronization across all players

  2. Features
    - Proper turn validation and rotation
    - Real-time boss HP updates
    - Automatic round progression when boss is defeated
    - Boss counter-attack system
    - Player defeat detection
    - Victory/defeat conditions

  3. Bug Fixes
    - Fixed stuck round progression
    - Fixed turn rotation for 2 players
    - Fixed turn rotation for 3 players
    - Added proper boss state management
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS handle_raid_attack(text, uuid);
DROP FUNCTION IF EXISTS raid_attack_boss(uuid, uuid, integer);

-- Create comprehensive raid attack handler
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
  alive_participants record[];
  current_turn_player record;
  boss_hp_before integer;
  boss_hp_after integer;
  boss_max_hp integer;
  boss_damage integer;
  player_damage integer;
  new_player_hp integer;
  next_turn_index integer;
  alive_count integer;
  round_completed boolean := false;
  raid_completed boolean := false;
  all_players_dead boolean := false;
  result json;
BEGIN
  -- Get room information
  SELECT rr.*, rm.boss_name, rm.difficulty_level
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
  SELECT rp.*, p.username, p.strength
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
  
  -- Get all alive participants for turn validation
  SELECT array_agg(
    ROW(rp.profile_id, rp.slot_number, p.username, p.strength, rp.current_hp, rp.max_hp)::record
    ORDER BY rp.slot_number
  ) INTO alive_participants
  FROM raid_participants rp
  JOIN profiles p ON rp.profile_id = p.id
  WHERE rp.room_id = room_record.id AND rp.is_alive = true;
  
  alive_count := array_length(alive_participants, 1);
  
  -- Validate turn (current_turn is 0-based index)
  IF alive_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No alive players found'
    );
  END IF;
  
  -- Get current turn player based on turn index
  current_turn_player := alive_participants[(room_record.current_turn % alive_count) + 1];
  
  IF (current_turn_player).f1::uuid != p_profile_id THEN
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
  
  -- Calculate player damage
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
  
  -- Check if all players are defeated
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
  -- Get updated alive participants after potential player death
  SELECT array_agg(
    ROW(rp.profile_id, rp.slot_number)::record
    ORDER BY rp.slot_number
  ) INTO alive_participants
  FROM raid_participants rp
  WHERE rp.room_id = room_record.id AND rp.is_alive = true;
  
  alive_count := array_length(alive_participants, 1);
  
  -- Calculate next turn index
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
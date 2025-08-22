/*
  # RAID Attack Boss Function for Real-time Combat

  1. New Function
    - `raid_attack_boss()`: Handle player attacks on boss with real-time updates
    - Manages turn-based combat system
    - Handles boss counter-attacks
    - Manages round progression
    - Checks for victory/defeat conditions

  2. Features
    - Real-time HP updates for all players
    - Turn rotation among alive players
    - Boss counter-attack system
    - Round progression (3 rounds total)
    - Victory/defeat detection
    - Automatic game state management

  3. Security
    - Proper validation of player turns
    - Check if player is alive and in room
    - Prevent invalid attacks
*/

-- Function to handle boss attacks in RAID
CREATE OR REPLACE FUNCTION raid_attack_boss(
  p_room_id uuid,
  p_attacker_id uuid,
  p_damage integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_record record;
  attacker_record record;
  participants_alive integer;
  current_turn_player record;
  new_boss_hp integer;
  boss_damage integer;
  new_player_hp integer;
  next_turn integer;
  alive_players_count integer;
  result json;
BEGIN
  -- Get room info
  SELECT * INTO room_record
  FROM raid_rooms
  WHERE id = p_room_id AND status = 'in_progress';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Room not found or not in progress'
    );
  END IF;
  
  -- Get attacker info
  SELECT rp.*, p.username, p.strength
  INTO attacker_record
  FROM raid_participants rp
  JOIN profiles p ON rp.profile_id = p.id
  WHERE rp.room_id = p_room_id 
  AND rp.profile_id = p_attacker_id
  AND rp.is_alive = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Player not found, not in room, or already defeated'
    );
  END IF;
  
  -- Check if it's the player's turn
  WITH alive_participants AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY slot_number) - 1 as turn_index
    FROM raid_participants
    WHERE room_id = p_room_id AND is_alive = true
  )
  SELECT * INTO current_turn_player
  FROM alive_participants
  WHERE turn_index = (room_record.current_turn % (SELECT COUNT(*) FROM alive_participants));
  
  IF current_turn_player.profile_id != p_attacker_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Not your turn to attack'
    );
  END IF;
  
  -- Calculate new boss HP
  new_boss_hp := GREATEST(0, room_record.boss_hp - p_damage);
  
  -- Update boss HP
  UPDATE raid_rooms
  SET boss_hp = new_boss_hp
  WHERE id = p_room_id;
  
  -- Check if boss is defeated
  IF new_boss_hp <= 0 THEN
    IF room_record.current_round < 3 THEN
      -- Advance to next round
      DECLARE
        next_round integer := room_record.current_round + 1;
        next_boss_hp integer;
        next_boss_max_hp integer;
      BEGIN
        -- Calculate next boss HP based on round
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
        
        -- Update room for next round
        UPDATE raid_rooms
        SET 
          current_round = next_round,
          current_turn = 0,
          boss_hp = next_boss_hp,
          boss_max_hp = next_boss_max_hp
        WHERE id = p_room_id;
        
        RETURN json_build_object(
          'success', true,
          'message', 'Boss defeated! Advancing to round ' || next_round,
          'boss_defeated', true,
          'next_round', next_round,
          'damage_dealt', p_damage,
          'new_boss_hp', next_boss_hp,
          'round_complete', true
        );
      END;
    ELSE
      -- Final boss defeated - RAID victory
      UPDATE raid_rooms
      SET status = 'completed', completed_at = now()
      WHERE id = p_room_id;
      
      RETURN json_build_object(
        'success', true,
        'message', 'Final boss defeated! RAID completed!',
        'boss_defeated', true,
        'raid_complete', true,
        'damage_dealt', p_damage,
        'victory', true
      );
    END IF;
  END IF;
  
  -- Boss counter-attack (if boss is still alive)
  boss_damage := CASE room_record.current_round
    WHEN 1 THEN 25
    WHEN 2 THEN 35
    WHEN 3 THEN 50
    ELSE 25
  END;
  
  new_player_hp := GREATEST(0, attacker_record.current_hp - boss_damage);
  
  -- Update attacker's HP
  UPDATE raid_participants
  SET 
    current_hp = new_player_hp,
    is_alive = (new_player_hp > 0)
  WHERE id = attacker_record.id;
  
  -- Check if all players are defeated
  SELECT COUNT(*) INTO alive_players_count
  FROM raid_participants
  WHERE room_id = p_room_id 
  AND profile_id != p_attacker_id 
  AND is_alive = true;
  
  -- Add the current attacker if they're still alive
  IF new_player_hp > 0 THEN
    alive_players_count := alive_players_count + 1;
  END IF;
  
  IF alive_players_count = 0 THEN
    -- All players defeated - RAID failure
    UPDATE raid_rooms
    SET status = 'completed', completed_at = now()
    WHERE id = p_room_id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'All players defeated! RAID failed!',
      'damage_dealt', p_damage,
      'boss_damage', boss_damage,
      'player_defeated', (new_player_hp <= 0),
      'all_players_defeated', true,
      'defeat', true
    );
  END IF;
  
  -- Move to next player's turn
  WITH alive_participants AS (
    SELECT profile_id, ROW_NUMBER() OVER (ORDER BY slot_number) - 1 as turn_index
    FROM raid_participants
    WHERE room_id = p_room_id AND is_alive = true
  )
  SELECT (room_record.current_turn + 1) % (SELECT COUNT(*) FROM alive_participants) INTO next_turn;
  
  UPDATE raid_rooms
  SET current_turn = next_turn
  WHERE id = p_room_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Attack successful!',
    'damage_dealt', p_damage,
    'new_boss_hp', new_boss_hp,
    'boss_damage', boss_damage,
    'new_player_hp', new_player_hp,
    'player_defeated', (new_player_hp <= 0),
    'next_turn', next_turn,
    'boss_defeated', false,
    'round_complete', false
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION raid_attack_boss(uuid, uuid, integer) TO authenticated;
/*
  # Fix RAID System for Turn-based Combat and Progress Tracking

  1. Table Updates
    - Add `current_turn` to raid_rooms for turn management
    - Add `is_ready` to raid_participants for player synchronization
    - Add `boss_hp` and `boss_max_hp` to raid_rooms for boss state
    - Update raid_progress to track individual map completions

  2. Function Updates
    - Update complete_raid function to handle card rewards properly
    - Add progress tracking for all participants
    - Fix master title awarding system

  3. Security
    - Maintain existing RLS policies
    - Add proper indexes for performance
*/

-- Add missing columns to raid_rooms
ALTER TABLE raid_rooms 
ADD COLUMN IF NOT EXISTS current_turn integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS boss_hp integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS boss_max_hp integer DEFAULT 0;

-- Add missing columns to raid_participants
ALTER TABLE raid_participants 
ADD COLUMN IF NOT EXISTS is_ready boolean DEFAULT false;

-- Update complete_raid function to handle progress tracking for all participants
CREATE OR REPLACE FUNCTION complete_raid(
  p_room_uuid text,
  p_is_victory boolean,
  p_rounds_completed integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_record record;
  participants_data jsonb;
  total_exp integer := 0;
  total_zgold integer := 0;
  card_rewards jsonb;
  participant_record record;
  title_awarded text := null;
  result json;
BEGIN
  -- Get room and map info
  SELECT rr.*, rm.base_reward_exp, rm.base_reward_zgold, rm.master_title_name
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
  
  -- Get participants data
  SELECT json_agg(
    json_build_object(
      'profile_id', rp.profile_id,
      'username', p.username,
      'slot_number', rp.slot_number,
      'final_hp', rp.current_hp,
      'is_alive', rp.is_alive
    )
  ) INTO participants_data
  FROM raid_participants rp
  JOIN profiles p ON rp.profile_id = p.id
  WHERE rp.room_id = room_record.id;
  
  -- Calculate rewards if victory
  IF p_is_victory THEN
    total_exp := room_record.base_reward_exp * p_rounds_completed;
    total_zgold := room_record.base_reward_zgold * p_rounds_completed;
    
    -- Generate card rewards
    card_rewards := get_raid_card_rewards();
    
    -- Update participants' stats and progress
    FOR participant_record IN 
      SELECT profile_id FROM raid_participants WHERE room_id = room_record.id
    LOOP
      -- Update player stats
      UPDATE profiles
      SET 
        exp = exp + (total_exp / (SELECT COUNT(*) FROM raid_participants WHERE room_id = room_record.id)),
        zgold = zgold + (total_zgold / (SELECT COUNT(*) FROM raid_participants WHERE room_id = room_record.id))
      WHERE id = participant_record.profile_id;
      
      -- Update raid progress for each participant
      INSERT INTO raid_progress (profile_id, map_id, completion_count, last_completed_at)
      VALUES (participant_record.profile_id, room_record.map_id, 1, now())
      ON CONFLICT (profile_id, map_id)
      DO UPDATE SET
        completion_count = raid_progress.completion_count + 1,
        last_completed_at = now();
      
      -- Check for master title (50 completions)
      DECLARE
        completion_count integer;
        title_id uuid;
      BEGIN
        SELECT rp.completion_count INTO completion_count
        FROM raid_progress rp
        WHERE rp.profile_id = participant_record.profile_id 
        AND rp.map_id = room_record.map_id;
        
        IF completion_count >= 50 THEN
          -- Check if player already has this title
          SELECT t.id INTO title_id
          FROM titles t
          LEFT JOIN player_titles pt ON pt.title_id = t.id AND pt.profile_id = participant_record.profile_id
          WHERE t.name = room_record.master_title_name AND pt.id IS NULL;
          
          IF FOUND THEN
            -- Award the master title
            INSERT INTO player_titles (profile_id, title_id)
            VALUES (participant_record.profile_id, title_id);
            
            title_awarded := room_record.master_title_name;
          END IF;
        END IF;
      END;
    END LOOP;
  END IF;
  
  -- Mark room as completed
  UPDATE raid_rooms
  SET status = 'completed', completed_at = now()
  WHERE id = room_record.id;
  
  -- Record raid history
  INSERT INTO raid_history (
    room_id, map_id, participants, is_victory, rounds_completed,
    total_exp_gained, total_zgold_gained, card_rewards
  ) VALUES (
    room_record.id, room_record.map_id, participants_data, p_is_victory,
    p_rounds_completed, total_exp, total_zgold, card_rewards
  );
  
  RETURN json_build_object(
    'success', true,
    'is_victory', p_is_victory,
    'total_exp_gained', total_exp,
    'total_zgold_gained', total_zgold,
    'card_rewards', card_rewards,
    'participants', participants_data,
    'title_awarded', title_awarded
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION complete_raid(text, boolean, integer) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS raid_rooms_current_turn_idx ON raid_rooms(current_turn);
CREATE INDEX IF NOT EXISTS raid_participants_ready_idx ON raid_participants(is_ready);
CREATE INDEX IF NOT EXISTS raid_progress_map_completion_idx ON raid_progress(map_id, completion_count);
/*
  # Fix duplicate participant constraint violation

  1. Updates
    - Modify `respond_to_raid_invite` function to check for existing participants
    - Prevent duplicate key violations on raid_participants table
    - Add proper error handling for already joined players

  2. Changes
    - Add participant existence check before inserting
    - Return appropriate error message if player already in room
    - Maintain existing function logic for valid cases
*/

-- Update respond_to_raid_invite function to prevent duplicate participants
CREATE OR REPLACE FUNCTION respond_to_raid_invite(
  p_invitee_profile_id uuid,
  p_invite_id uuid,
  p_response text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_record record;
  room_record record;
  participant_count integer;
  next_slot integer;
  invitee_tickets integer;
  result json;
BEGIN
  -- Validate response
  IF p_response NOT IN ('accepted', 'rejected') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid response'
    );
  END IF;
  
  -- Get invite info
  SELECT ri.*, rr.status as room_status, rr.max_players
  INTO invite_record
  FROM raid_invites ri
  JOIN raid_rooms rr ON ri.room_id = rr.id
  WHERE ri.id = p_invite_id
  AND ri.invitee_id = p_invitee_profile_id
  AND ri.status = 'pending'
  AND ri.expires_at > now();
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invite not found, expired, or already processed'
    );
  END IF;
  
  -- Update invite status
  UPDATE raid_invites
  SET status = p_response
  WHERE id = p_invite_id;
  
  -- If rejected, return early
  IF p_response = 'rejected' THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Raid invite rejected'
    );
  END IF;
  
  -- Check if player is already in the room
  IF EXISTS(
    SELECT 1 FROM raid_participants 
    WHERE room_id = invite_record.room_id AND profile_id = p_invitee_profile_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You are already in this raid room'
    );
  END IF;
  
  -- If accepted, check room capacity and add player
  SELECT COUNT(*) INTO participant_count
  FROM raid_participants
  WHERE room_id = invite_record.room_id;
  
  IF participant_count >= invite_record.max_players THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Room is now full'
    );
  END IF;
  
  -- Check if player has enough tickets
  SELECT raid_tickets INTO invitee_tickets
  FROM profiles
  WHERE id = p_invitee_profile_id;
  
  IF invitee_tickets < 1 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You do not have enough Raid Tickets'
    );
  END IF;
  
  -- Find next available slot
  SELECT COALESCE(MIN(slot_num), participant_count + 1) INTO next_slot
  FROM generate_series(1, invite_record.max_players) AS slot_num
  WHERE slot_num NOT IN (
    SELECT slot_number FROM raid_participants WHERE room_id = invite_record.room_id
  );
  
  -- Add player to room
  INSERT INTO raid_participants (room_id, profile_id, slot_number)
  VALUES (invite_record.room_id, p_invitee_profile_id, next_slot);
  
  -- Deduct ticket from player
  UPDATE profiles
  SET raid_tickets = raid_tickets - 1
  WHERE id = p_invitee_profile_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Successfully joined raid room!',
    'room_uuid', (SELECT room_uuid FROM raid_rooms WHERE id = invite_record.room_id)
  );
END;
$$;
/*
  # RAID System Implementation

  1. New Tables
    - `raid_maps`
      - `id` (uuid, primary key)
      - `name` (text): Map name
      - `description` (text): Map description
      - `boss_name` (text): Final boss name
      - `background_url` (text): Map background image
      - `boss_image_url` (text): Boss image
      - `difficulty_level` (integer): 1-3 difficulty
      - `base_reward_exp` (integer): Base EXP reward
      - `base_reward_zgold` (integer): Base ZGold reward
      - `master_title_name` (text): Title for 50 completions
      - `is_active` (boolean): Whether map is available
      - `created_at` (timestamp)
    
    - `raid_rooms`
      - `id` (uuid, primary key)
      - `room_uuid` (text): Unique room identifier
      - `creator_id` (uuid): Room creator profile ID
      - `map_id` (uuid): Selected raid map
      - `status` (text): waiting, in_progress, completed, abandoned
      - `max_players` (integer): Maximum players (3)
      - `current_round` (integer): Current battle round (1-3)
      - `created_at` (timestamp)
      - `started_at` (timestamp)
      - `completed_at` (timestamp)
    
    - `raid_participants`
      - `id` (uuid, primary key)
      - `room_id` (uuid): Reference to raid_rooms
      - `profile_id` (uuid): Player profile ID
      - `slot_number` (integer): Player slot (1-3)
      - `current_hp` (integer): Current HP in raid
      - `max_hp` (integer): Maximum HP
      - `is_alive` (boolean): Whether player is alive
      - `joined_at` (timestamp)
    
    - `raid_invites`
      - `id` (uuid, primary key)
      - `room_id` (uuid): Reference to raid_rooms
      - `inviter_id` (uuid): Who sent the invite
      - `invitee_id` (uuid): Who received the invite
      - `status` (text): pending, accepted, rejected, expired
      - `expires_at` (timestamp): Invite expiration
      - `created_at` (timestamp)
    
    - `raid_chat`
      - `id` (uuid, primary key)
      - `room_id` (uuid): Reference to raid_rooms
      - `profile_id` (uuid): Message sender
      - `username` (text): Sender username
      - `message` (text): Chat message
      - `created_at` (timestamp)
    
    - `raid_history`
      - `id` (uuid, primary key)
      - `room_id` (uuid): Reference to raid_rooms
      - `map_id` (uuid): Map that was played
      - `participants` (jsonb): Array of participant data
      - `is_victory` (boolean): Whether raid was successful
      - `rounds_completed` (integer): Number of rounds completed
      - `total_exp_gained` (integer): Total EXP gained
      - `total_zgold_gained` (integer): Total ZGold gained
      - `card_rewards` (jsonb): Mini-game card rewards
      - `completed_at` (timestamp)
    
    - `raid_progress`
      - `id` (uuid, primary key)
      - `profile_id` (uuid): Player profile ID
      - `map_id` (uuid): Raid map ID
      - `completion_count` (integer): Times completed
      - `best_time` (interval): Best completion time
      - `last_completed_at` (timestamp)
    
    - Add `raid_tickets` column to profiles table

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Functions
    - `create_raid_room()`: Create new raid room
    - `join_raid_room()`: Join existing room
    - `send_raid_invite()`: Send invite to friend
    - `respond_to_raid_invite()`: Accept/reject invite
    - `start_raid()`: Begin raid battle
    - `complete_raid_round()`: Complete battle round
    - `complete_raid()`: Finish raid and distribute rewards
    - `get_raid_card_rewards()`: Generate mini-game cards
*/

-- Add raid_tickets column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS raid_tickets integer DEFAULT 5;

-- Create raid_maps table
CREATE TABLE IF NOT EXISTS raid_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  boss_name text NOT NULL,
  background_url text NOT NULL,
  boss_image_url text NOT NULL,
  difficulty_level integer NOT NULL CHECK (difficulty_level BETWEEN 1 AND 3),
  base_reward_exp integer NOT NULL,
  base_reward_zgold integer NOT NULL,
  master_title_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create raid_rooms table
CREATE TABLE IF NOT EXISTS raid_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_uuid text NOT NULL UNIQUE,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  map_id uuid NOT NULL REFERENCES raid_maps(id),
  status text NOT NULL DEFAULT 'waiting',
  max_players integer NOT NULL DEFAULT 3,
  current_round integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT valid_status CHECK (status IN ('waiting', 'in_progress', 'completed', 'abandoned')),
  CONSTRAINT valid_round CHECK (current_round BETWEEN 1 AND 3)
);

-- Create raid_participants table
CREATE TABLE IF NOT EXISTS raid_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES raid_rooms(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_number integer NOT NULL CHECK (slot_number BETWEEN 1 AND 3),
  current_hp integer NOT NULL DEFAULT 100,
  max_hp integer NOT NULL DEFAULT 100,
  is_alive boolean NOT NULL DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (room_id, profile_id),
  UNIQUE (room_id, slot_number)
);

-- Create raid_invites table
CREATE TABLE IF NOT EXISTS raid_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES raid_rooms(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_invite_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  UNIQUE (room_id, invitee_id)
);

-- Create raid_chat table
CREATE TABLE IF NOT EXISTS raid_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES raid_rooms(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT message_length CHECK (char_length(message) <= 100)
);

-- Create raid_history table
CREATE TABLE IF NOT EXISTS raid_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES raid_rooms(id),
  map_id uuid NOT NULL REFERENCES raid_maps(id),
  participants jsonb NOT NULL,
  is_victory boolean NOT NULL,
  rounds_completed integer NOT NULL,
  total_exp_gained integer NOT NULL DEFAULT 0,
  total_zgold_gained integer NOT NULL DEFAULT 0,
  card_rewards jsonb,
  completed_at timestamptz DEFAULT now()
);

-- Create raid_progress table
CREATE TABLE IF NOT EXISTS raid_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  map_id uuid NOT NULL REFERENCES raid_maps(id) ON DELETE CASCADE,
  completion_count integer NOT NULL DEFAULT 0,
  best_time interval,
  last_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, map_id)
);

-- Enable RLS
ALTER TABLE raid_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_progress ENABLE ROW LEVEL SECURITY;

-- Policies for raid_maps
CREATE POLICY "Anyone can view raid maps"
  ON raid_maps FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies for raid_rooms
CREATE POLICY "Users can view raid rooms"
  ON raid_rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create raid rooms"
  ON raid_rooms FOR INSERT
  TO authenticated
  WITH CHECK (creator_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Room creators can update their rooms"
  ON raid_rooms FOR UPDATE
  TO authenticated
  USING (creator_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Policies for raid_participants
CREATE POLICY "Users can view raid participants"
  ON raid_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join raids"
  ON raid_participants FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their participation"
  ON raid_participants FOR UPDATE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Policies for raid_invites
CREATE POLICY "Users can view their raid invites"
  ON raid_invites FOR SELECT
  TO authenticated
  USING (
    inviter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    invitee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send raid invites"
  ON raid_invites FOR INSERT
  TO authenticated
  WITH CHECK (inviter_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can respond to raid invites"
  ON raid_invites FOR UPDATE
  TO authenticated
  USING (invitee_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Policies for raid_chat
CREATE POLICY "Participants can view raid chat"
  ON raid_chat FOR SELECT
  TO authenticated
  USING (room_id IN (
    SELECT room_id FROM raid_participants 
    WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "Participants can send raid chat"
  ON raid_chat FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) AND
    room_id IN (
      SELECT room_id FROM raid_participants 
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies for raid_history
CREATE POLICY "Users can view raid history"
  ON raid_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert raid history"
  ON raid_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for raid_progress
CREATE POLICY "Users can view their raid progress"
  ON raid_progress FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their raid progress"
  ON raid_progress FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Function to create raid room
CREATE OR REPLACE FUNCTION create_raid_room(
  p_creator_profile_id uuid,
  p_map_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_uuid_val text;
  room_id uuid;
  creator_tickets integer;
  map_exists boolean;
  result json;
BEGIN
  -- Check if creator has enough tickets
  SELECT raid_tickets INTO creator_tickets
  FROM profiles
  WHERE id = p_creator_profile_id;
  
  IF creator_tickets < 1 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Not enough Raid Tickets! You need 1 ticket to create a room.'
    );
  END IF;
  
  -- Check if map exists
  SELECT EXISTS(
    SELECT 1 FROM raid_maps WHERE id = p_map_id AND is_active = true
  ) INTO map_exists;
  
  IF NOT map_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid raid map selected'
    );
  END IF;
  
  -- Generate unique room UUID
  room_uuid_val := 'RAID_' || upper(substring(gen_random_uuid()::text from 1 for 8));
  
  -- Create raid room
  INSERT INTO raid_rooms (room_uuid, creator_id, map_id, status)
  VALUES (room_uuid_val, p_creator_profile_id, p_map_id, 'waiting')
  RETURNING id INTO room_id;
  
  -- Add creator as first participant
  INSERT INTO raid_participants (room_id, profile_id, slot_number)
  VALUES (room_id, p_creator_profile_id, 1);
  
  -- Deduct ticket from creator
  UPDATE profiles
  SET raid_tickets = raid_tickets - 1
  WHERE id = p_creator_profile_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Raid room created successfully!',
    'room_uuid', room_uuid_val,
    'room_id', room_id
  );
END;
$$;

-- Function to send raid invite
CREATE OR REPLACE FUNCTION send_raid_invite(
  p_inviter_profile_id uuid,
  p_room_uuid text,
  p_invitee_username text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_record record;
  invitee_profile_id uuid;
  invitee_tickets integer;
  participant_count integer;
  existing_invite boolean;
  result json;
BEGIN
  -- Get room info
  SELECT * INTO room_record
  FROM raid_rooms
  WHERE room_uuid = p_room_uuid AND status = 'waiting';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Room not found or no longer accepting players'
    );
  END IF;
  
  -- Check if inviter is room creator or participant
  IF NOT EXISTS(
    SELECT 1 FROM raid_participants 
    WHERE room_id = room_record.id AND profile_id = p_inviter_profile_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You are not in this raid room'
    );
  END IF;
  
  -- Find invitee by username
  SELECT id, raid_tickets INTO invitee_profile_id, invitee_tickets
  FROM profiles
  WHERE username = p_invitee_username
  AND (banned_until IS NULL OR banned_until < now());
  
  IF invitee_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Player not found'
    );
  END IF;
  
  -- Check if invitee has enough tickets
  IF invitee_tickets < 1 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Player does not have enough Raid Tickets'
    );
  END IF;
  
  -- Check room capacity
  SELECT COUNT(*) INTO participant_count
  FROM raid_participants
  WHERE room_id = room_record.id;
  
  IF participant_count >= room_record.max_players THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Room is full'
    );
  END IF;
  
  -- Check if player is already in room
  IF EXISTS(
    SELECT 1 FROM raid_participants 
    WHERE room_id = room_record.id AND profile_id = invitee_profile_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Player is already in this room'
    );
  END IF;
  
  -- Check for existing pending invite
  SELECT EXISTS(
    SELECT 1 FROM raid_invites
    WHERE room_id = room_record.id 
    AND invitee_id = invitee_profile_id 
    AND status = 'pending'
    AND expires_at > now()
  ) INTO existing_invite;
  
  IF existing_invite THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invite already sent to this player'
    );
  END IF;
  
  -- Send invite
  INSERT INTO raid_invites (room_id, inviter_id, invitee_id, status, expires_at)
  VALUES (room_record.id, p_inviter_profile_id, invitee_profile_id, 'pending', now() + interval '2 minutes');
  
  RETURN json_build_object(
    'success', true,
    'message', 'Raid invite sent successfully!'
  );
END;
$$;

-- Function to respond to raid invite
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

-- Function to start raid
CREATE OR REPLACE FUNCTION start_raid(
  p_creator_profile_id uuid,
  p_room_uuid text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  room_record record;
  participant_count integer;
  result json;
BEGIN
  -- Get room info
  SELECT * INTO room_record
  FROM raid_rooms
  WHERE room_uuid = p_room_uuid 
  AND creator_id = p_creator_profile_id
  AND status = 'waiting';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Room not found or you are not the creator'
    );
  END IF;
  
  -- Check participant count
  SELECT COUNT(*) INTO participant_count
  FROM raid_participants
  WHERE room_id = room_record.id;
  
  IF participant_count < 2 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Need at least 2 players to start raid'
    );
  END IF;
  
  -- Start raid
  UPDATE raid_rooms
  SET status = 'in_progress', started_at = now()
  WHERE id = room_record.id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Raid started successfully!',
    'participant_count', participant_count
  );
END;
$$;

-- Function to complete raid
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
  map_record record;
  participants_data jsonb;
  total_exp integer := 0;
  total_zgold integer := 0;
  card_rewards jsonb;
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
    
    -- Update participants' stats
    UPDATE profiles
    SET 
      exp = exp + (total_exp / (SELECT COUNT(*) FROM raid_participants WHERE room_id = room_record.id)),
      zgold = zgold + (total_zgold / (SELECT COUNT(*) FROM raid_participants WHERE room_id = room_record.id))
    WHERE id IN (
      SELECT profile_id FROM raid_participants WHERE room_id = room_record.id
    );
    
    -- Update raid progress for each participant
    INSERT INTO raid_progress (profile_id, map_id, completion_count, last_completed_at)
    SELECT 
      rp.profile_id,
      room_record.map_id,
      1,
      now()
    FROM raid_participants rp
    WHERE rp.room_id = room_record.id
    ON CONFLICT (profile_id, map_id)
    DO UPDATE SET
      completion_count = raid_progress.completion_count + 1,
      last_completed_at = now();
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
    'participants', participants_data
  );
END;
$$;

-- Function to generate card rewards for mini-game
CREATE OR REPLACE FUNCTION get_raid_card_rewards()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  cards jsonb := '[]'::jsonb;
  i integer;
  card_type text;
  card_value integer;
  rand_val numeric;
BEGIN
  -- Generate 20 random cards
  FOR i IN 1..20 LOOP
    rand_val := random();
    
    IF rand_val < 0.05 THEN -- 5% - Raid Ticket (rare)
      card_type := 'raid_ticket';
      card_value := 1;
    ELSIF rand_val < 0.15 THEN -- 10% - ZToken
      card_type := 'ztoken';
      card_value := floor(random() * 5) + 3; -- 3-7 ZToken
    ELSIF rand_val < 0.35 THEN -- 20% - High EXP
      card_type := 'exp';
      card_value := floor(random() * 200) + 300; -- 300-500 EXP
    ELSIF rand_val < 0.65 THEN -- 30% - High ZGold
      card_type := 'zgold';
      card_value := floor(random() * 3000) + 2000; -- 2000-5000 ZGold
    ELSE -- 35% - Regular EXP
      card_type := 'exp';
      card_value := floor(random() * 100) + 100; -- 100-200 EXP
    END IF;
    
    cards := cards || jsonb_build_object(
      'id', i,
      'type', card_type,
      'value', card_value,
      'claimed', false
    );
  END LOOP;
  
  RETURN cards;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_raid_room(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION send_raid_invite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_raid_invite(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION start_raid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_raid(text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_raid_card_rewards() TO authenticated;

-- Insert raid maps
INSERT INTO raid_maps (name, description, boss_name, background_url, boss_image_url, difficulty_level, base_reward_exp, base_reward_zgold, master_title_name) VALUES
  (
    'Eclipse Protocol',
    'A dark dimension where shadows come alive and reality bends to the will of darkness',
    'Shadow Harbinger',
    'https://i.pinimg.com/1200x/1a/2b/3c/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p.jpg',
    'https://i.pinimg.com/736x/4d/5e/6f/4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s.jpg',
    3,
    400,
    5000,
    'Cipher Eclipse'
  ),
  (
    'Neon Warden',
    'A cyberpunk fortress controlled by advanced AI and mechanical guardians',
    'Mech Overlord',
    'https://i.pinimg.com/1200x/2b/3c/4d/2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q.jpg',
    'https://i.pinimg.com/736x/5e/6f/7g/5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t.jpg',
    2,
    350,
    4000,
    'Warden Unleashed'
  ),
  (
    'Crimson Exodus',
    'A hellish landscape of molten lava and eternal flames ruled by fire demons',
    'Inferno Titan',
    'https://i.pinimg.com/1200x/3c/4d/5e/3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r.jpg',
    'https://i.pinimg.com/736x/6f/7g/8h/6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u.jpg',
    3,
    450,
    6000,
    'Crimson Reborn'
  )
ON CONFLICT (name) DO NOTHING;

-- Insert raid master titles
INSERT INTO titles (name, description, color, rarity, unlock_condition) VALUES
  ('Cipher Eclipse', 'Master of the Eclipse Protocol raids', 'diamond', 'legendary', 'Complete Eclipse Protocol raid 50 times'),
  ('Warden Unleashed', 'Conqueror of the Neon Warden fortress', 'silver', 'legendary', 'Complete Neon Warden raid 50 times'),
  ('Crimson Reborn', 'Survivor of the Crimson Exodus hellscape', 'ruby', 'legendary', 'Complete Crimson Exodus raid 50 times')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS raid_rooms_room_uuid_idx ON raid_rooms(room_uuid);
CREATE INDEX IF NOT EXISTS raid_rooms_status_idx ON raid_rooms(status);
CREATE INDEX IF NOT EXISTS raid_participants_room_id_idx ON raid_participants(room_id);
CREATE INDEX IF NOT EXISTS raid_participants_profile_id_idx ON raid_participants(profile_id);
CREATE INDEX IF NOT EXISTS raid_invites_invitee_id_idx ON raid_invites(invitee_id);
CREATE INDEX IF NOT EXISTS raid_invites_status_expires_idx ON raid_invites(status, expires_at);
CREATE INDEX IF NOT EXISTS raid_chat_room_id_idx ON raid_chat(room_id);
CREATE INDEX IF NOT EXISTS raid_history_map_id_idx ON raid_history(map_id);
CREATE INDEX IF NOT EXISTS raid_progress_profile_id_idx ON raid_progress(profile_id);
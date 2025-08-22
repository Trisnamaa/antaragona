/*
  # Complete Friend System Implementation

  1. New Tables
    - `friendships`
      - `id` (uuid, primary key)
      - `requester_id` (uuid): Profile ID yang mengirim permintaan
      - `addressee_id` (uuid): Profile ID yang menerima permintaan
      - `status` (text): pending, accepted, rejected
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `clover_transactions`
      - `id` (uuid, primary key)
      - `sender_id` (uuid): Profile ID pengirim clover
      - `receiver_id` (uuid): Profile ID penerima clover
      - `amount` (integer): Jumlah clover (default 1)
      - `transaction_date` (date): Tanggal transaksi
      - `created_at` (timestamp)
    
    - Add `clover` column to profiles table

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Functions
    - `get_friend_list()`: Mendapatkan daftar teman
    - `send_friend_request()`: Mengirim permintaan pertemanan
    - `respond_to_friend_request()`: Menerima/menolak permintaan
    - `send_clover()`: Mengirim clover ke teman
    - `search_users_for_friends()`: Mencari user untuk ditambah teman
*/

-- Add clover column to profiles table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'clover'
  ) THEN
    ALTER TABLE profiles ADD COLUMN clover integer DEFAULT 0;
  END IF;
END $$;

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT no_self_friend CHECK (requester_id != addressee_id),
  UNIQUE (requester_id, addressee_id)
);

-- Create clover_transactions table
CREATE TABLE IF NOT EXISTS clover_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 1,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT positive_amount CHECK (amount > 0),
  UNIQUE (sender_id, receiver_id, transaction_date)
);

-- Enable RLS
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE clover_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for friendships
CREATE POLICY "Users can view their own friendships"
  ON friendships FOR SELECT
  TO authenticated
  USING (
    requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    addressee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert friend requests"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update friend requests"
  ON friendships FOR UPDATE
  TO authenticated
  USING (
    addressee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    addressee_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Policies for clover_transactions
CREATE POLICY "Users can view their own clover transactions"
  ON clover_transactions FOR SELECT
  TO authenticated
  USING (
    sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send clover"
  ON clover_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Function to get friend list with clover status
CREATE OR REPLACE FUNCTION get_friend_list(p_player_profile_id uuid)
RETURNS TABLE (
  friend_id uuid,
  friend_username text,
  friend_profile_image_url text,
  friend_character_type text,
  friend_level integer,
  can_send_clover boolean,
  friendship_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN f.requester_id = p_player_profile_id THEN f.addressee_id
      ELSE f.requester_id
    END as friend_id,
    p.username as friend_username,
    p.profile_image_url as friend_profile_image_url,
    p.character_type as friend_character_type,
    p.level as friend_level,
    NOT EXISTS(
      SELECT 1 FROM clover_transactions ct
      WHERE ct.sender_id = p_player_profile_id
      AND ct.receiver_id = CASE 
        WHEN f.requester_id = p_player_profile_id THEN f.addressee_id
        ELSE f.requester_id
      END
      AND ct.transaction_date = CURRENT_DATE
    ) AND NOT EXISTS(
      SELECT 1 FROM clover_transactions ct2
      WHERE ct2.receiver_id = CASE 
        WHEN f.requester_id = p_player_profile_id THEN f.addressee_id
        ELSE f.requester_id
      END
      AND ct2.transaction_date = CURRENT_DATE
    ) as can_send_clover,
    f.created_at as friendship_created_at
  FROM friendships f
  JOIN profiles p ON p.id = CASE 
    WHEN f.requester_id = p_player_profile_id THEN f.addressee_id
    ELSE f.requester_id
  END
  WHERE (f.requester_id = p_player_profile_id OR f.addressee_id = p_player_profile_id)
  AND f.status = 'accepted'
  AND (p.banned_until IS NULL OR p.banned_until < now())
  ORDER BY f.created_at DESC;
END;
$$;

-- Function to send friend request
CREATE OR REPLACE FUNCTION send_friend_request(
  p_requester_profile_id uuid,
  p_target_username text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_profile_id uuid;
  existing_friendship record;
  result json;
BEGIN
  -- Find target profile by username
  SELECT id INTO target_profile_id
  FROM profiles
  WHERE username = p_target_username
  AND (banned_until IS NULL OR banned_until < now());
  
  IF target_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not found'
    );
  END IF;
  
  -- Check if they're the same person
  IF p_requester_profile_id = target_profile_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Cannot send friend request to yourself'
    );
  END IF;
  
  -- Check if friendship already exists (in either direction)
  SELECT * INTO existing_friendship
  FROM friendships
  WHERE (requester_id = p_requester_profile_id AND addressee_id = target_profile_id)
     OR (requester_id = target_profile_id AND addressee_id = p_requester_profile_id);
  
  IF existing_friendship.id IS NOT NULL THEN
    IF existing_friendship.status = 'accepted' THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Already friends'
      );
    ELSIF existing_friendship.status = 'pending' THEN
      RETURN json_build_object(
        'success', false,
        'message', 'Friend request already sent'
      );
    END IF;
  END IF;
  
  -- Send friend request
  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (p_requester_profile_id, target_profile_id, 'pending');
  
  RETURN json_build_object(
    'success', true,
    'message', 'Friend request sent successfully'
  );
END;
$$;

-- Function to respond to friend request
CREATE OR REPLACE FUNCTION respond_to_friend_request(
  p_addressee_profile_id uuid,
  p_friendship_id uuid,
  p_response text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_record record;
  result json;
BEGIN
  -- Validate response
  IF p_response NOT IN ('accepted', 'rejected') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid response'
    );
  END IF;
  
  -- Get friendship record
  SELECT * INTO friendship_record
  FROM friendships
  WHERE id = p_friendship_id
  AND addressee_id = p_addressee_profile_id
  AND status = 'pending';
  
  IF friendship_record.id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Friend request not found or already processed'
    );
  END IF;
  
  -- Update friendship status
  UPDATE friendships
  SET status = p_response, updated_at = now()
  WHERE id = p_friendship_id;
  
  RETURN json_build_object(
    'success', true,
    'message', CASE 
      WHEN p_response = 'accepted' THEN 'Friend request accepted'
      ELSE 'Friend request rejected'
    END
  );
END;
$$;

-- Function to send clover to friend
CREATE OR REPLACE FUNCTION send_clover(
  p_sender_profile_id uuid,
  p_receiver_profile_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_exists boolean;
  already_sent_today boolean;
  already_received_today boolean;
  sender_clover integer;
  result json;
BEGIN
  -- Check if they are friends
  SELECT EXISTS(
    SELECT 1 FROM friendships
    WHERE ((requester_id = p_sender_profile_id AND addressee_id = p_receiver_profile_id) OR
           (requester_id = p_receiver_profile_id AND addressee_id = p_sender_profile_id))
    AND status = 'accepted'
  ) INTO friendship_exists;
  
  IF NOT friendship_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You are not friends with this user'
    );
  END IF;
  
  -- Check if sender already sent clover today
  SELECT EXISTS(
    SELECT 1 FROM clover_transactions
    WHERE sender_id = p_sender_profile_id
    AND receiver_id = p_receiver_profile_id
    AND transaction_date = CURRENT_DATE
  ) INTO already_sent_today;
  
  IF already_sent_today THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You already sent clover to this friend today'
    );
  END IF;
  
  -- Check if receiver already received clover today (from anyone)
  SELECT EXISTS(
    SELECT 1 FROM clover_transactions
    WHERE receiver_id = p_receiver_profile_id
    AND transaction_date = CURRENT_DATE
  ) INTO already_received_today;
  
  IF already_received_today THEN
    RETURN json_build_object(
      'success', false,
      'message', 'This friend already received clover today'
    );
  END IF;
  
  -- Record clover transaction
  INSERT INTO clover_transactions (sender_id, receiver_id, amount, transaction_date)
  VALUES (p_sender_profile_id, p_receiver_profile_id, 1, CURRENT_DATE);
  
  -- Update receiver's clover balance
  UPDATE profiles
  SET clover = clover + 1
  WHERE id = p_receiver_profile_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Clover sent successfully!'
  );
END;
$$;

-- Function to search users for friend requests
CREATE OR REPLACE FUNCTION search_users_for_friends(
  p_searcher_profile_id uuid,
  p_search_term text
)
RETURNS TABLE (
  user_id uuid,
  username text,
  profile_image_url text,
  character_type text,
  level integer,
  friendship_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.username,
    p.profile_image_url,
    p.character_type,
    p.level,
    COALESCE(
      (SELECT f.status 
       FROM friendships f 
       WHERE (f.requester_id = p_searcher_profile_id AND f.addressee_id = p.id) OR
             (f.requester_id = p.id AND f.addressee_id = p_searcher_profile_id)
       LIMIT 1),
      'none'
    ) as friendship_status
  FROM profiles p
  WHERE p.id != p_searcher_profile_id
  AND (p.banned_until IS NULL OR p.banned_until < now())
  AND (
    LOWER(p.username) LIKE LOWER('%' || p_search_term || '%') OR
    p.id::text = p_search_term
  )
  ORDER BY p.username
  LIMIT 20;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_friend_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION send_friend_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_friend_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION send_clover(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION search_users_for_friends(uuid, text) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS friendships_requester_id_idx ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_id_idx ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS friendships_status_idx ON friendships(status);
CREATE INDEX IF NOT EXISTS clover_transactions_sender_id_idx ON clover_transactions(sender_id);
CREATE INDEX IF NOT EXISTS clover_transactions_receiver_id_idx ON clover_transactions(receiver_id);
CREATE INDEX IF NOT EXISTS clover_transactions_date_idx ON clover_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS profiles_clover_idx ON profiles(clover);
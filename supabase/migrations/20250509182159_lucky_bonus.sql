/*
  # Battle System Implementation

  1. New Tables
    - `battle_ranks`
      - `id` (uuid, primary key)
      - `name` (text): Rank name
      - `level` (integer): Rank level (1-8)
      - `image_url` (text): Rank badge image
    
    - `player_ranks`
      - `id` (uuid, primary key)
      - `profile_id` (uuid): Reference to player's profile
      - `rank_id` (uuid): Reference to battle_ranks
      - `stars` (integer): Current stars (0-5)
      - `battles_won` (integer): Total battles won
      - `battles_lost` (integer): Total battles lost
      - `updated_at` (timestamp)

    - `battle_history`
      - `id` (uuid, primary key)
      - `winner_id` (uuid): Winner's profile ID
      - `loser_id` (uuid): Loser's profile ID
      - `winner_strength` (integer)
      - `loser_strength` (integer)
      - `is_bot` (boolean): Whether opponent was a bot
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for authenticated users
*/

-- Create battle_ranks table
CREATE TABLE IF NOT EXISTS battle_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  level integer NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create player_ranks table
CREATE TABLE IF NOT EXISTS player_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  rank_id uuid REFERENCES battle_ranks(id),
  stars integer DEFAULT 0,
  battles_won integer DEFAULT 0,
  battles_lost integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT stars_range CHECK (stars >= 0 AND stars <= 5),
  UNIQUE (profile_id)
);

-- Create battle_history table
CREATE TABLE IF NOT EXISTS battle_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id uuid REFERENCES profiles(id),
  loser_id uuid REFERENCES profiles(id),
  winner_strength integer NOT NULL,
  loser_strength integer NOT NULL,
  is_bot boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE battle_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_history ENABLE ROW LEVEL SECURITY;

-- Policies for battle_ranks
CREATE POLICY "Anyone can view battle ranks"
  ON battle_ranks FOR SELECT
  TO authenticated
  USING (true);

-- Policies for player_ranks
CREATE POLICY "Players can view any player's rank"
  ON player_ranks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Players can update their own rank"
  ON player_ranks FOR UPDATE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Policies for battle_history
CREATE POLICY "Players can view battle history"
  ON battle_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert battle history"
  ON battle_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert initial ranks
INSERT INTO battle_ranks (name, level, image_url) VALUES
  ('Trainee', 1, 'https://example.com/ranks/trainee.png'),
  ('Challenger', 2, 'https://example.com/ranks/challenger.png'),
  ('Fighter', 3, 'https://example.com/ranks/fighter.png'),
  ('Conqueror', 4, 'https://example.com/ranks/conqueror.png'),
  ('Rival', 5, 'https://example.com/ranks/rival.png'),
  ('Duelist', 6, 'https://example.com/ranks/duelist.png'),
  ('Gladiator', 7, 'https://example.com/ranks/gladiator.png'),
  ('Master', 8, 'https://example.com/ranks/master.png')
ON CONFLICT (name) DO NOTHING;
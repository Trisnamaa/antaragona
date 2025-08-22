/*
  # Game Items and Inventory System

  1. New Tables
    - `game_items`: Stores all available game items
      - `id` (uuid, primary key)
      - `name` (text): Item name
      - `type` (text): Item category (fishing, farming, mining, hunting)
      - `sell_price` (integer): Item's selling price
      - `image_url` (text): Item's image URL
      - `created_at` (timestamp)
    
    - `player_inventory`: Tracks items owned by players
      - `id` (uuid, primary key)
      - `profile_id` (uuid): Reference to player's profile
      - `item_id` (uuid): Reference to game item
      - `quantity` (integer): Number of items owned
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to:
      - Read game items (all users)
      - Read their own inventory
      - Update their own inventory
*/

-- Create game_items table
CREATE TABLE IF NOT EXISTS game_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  sell_price integer NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_item_type CHECK (type IN ('fishing', 'farming', 'mining', 'hunting'))
);

-- Create player_inventory table
CREATE TABLE IF NOT EXISTS player_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES game_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  UNIQUE (profile_id, item_id)
);

-- Enable RLS
ALTER TABLE game_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;

-- Policies for game_items
CREATE POLICY "Anyone can view game items"
  ON game_items
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for player_inventory
CREATE POLICY "Players can view their own inventory"
  ON player_inventory
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = profile_id
  ));

CREATE POLICY "Players can update their own inventory"
  ON player_inventory
  FOR ALL
  TO authenticated
  USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = profile_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = profile_id
  ));

-- Insert game items
INSERT INTO game_items (name, type, sell_price, image_url) VALUES
  -- Fishing Items
  ('Ikan Emas', 'fishing', 5500, 'https://pomf2.lain.la/f/92i7wgsz.PNG'),
  ('Ikan Lele', 'fishing', 2500, 'https://pomf2.lain.la/f/7ycg37d8.PNG'),
  ('Ikan Arwana', 'fishing', 2500, 'https://pomf2.lain.la/f/yvi11i3d.PNG'),
  ('Ikan Nila', 'fishing', 2500, 'https://pomf2.lain.la/f/piib5hyy.PNG'),
  ('Umpan', 'fishing', 500, 'https://pomf2.lain.la/f/b7c1ein1.PNG'),
  ('Pancingan', 'fishing', 4000, 'https://pomf2.lain.la/f/2pdbcofh.PNG'),

  -- Farming Items
  ('Apel', 'farming', 2500, 'https://pomf2.lain.la/f/9ysml6i1.PNG'),
  ('Anggur', 'farming', 3000, 'https://pomf2.lain.la/f/snvlrk.PNG'),
  ('Semangka', 'farming', 2500, 'https://pomf2.lain.la/f/5uh40x2e.PNG'),
  ('Nanas', 'farming', 2000, 'https://pomf2.lain.la/f/r1lqd3ej.PNG'),
  ('Pisang', 'farming', 2000, 'https://pomf2.lain.la/f/9bkk7v0.PNG'),
  ('Bibit Apel', 'farming', 2500, 'https://pomf2.lain.la/f/wd9ntn4a.PNG'),
  ('Bibit Anggur', 'farming', 3000, 'https://pomf2.lain.la/f/wd9ntn4a.PNG'),
  ('Bibit Semangka', 'farming', 2500, 'https://pomf2.lain.la/f/ztmldyf.PNG'),
  ('Bibit Nanas', 'farming', 2000, 'https://pomf2.lain.la/f/42agnv.PNG'),
  ('Bibit Pisang', 'farming', 2000, 'https://pomf2.lain.la/f/rj9is3q.PNG'),

  -- Mining Items
  ('Kayu', 'mining', 700, 'https://pomf2.lain.la/f/ondcxoy4.PNG'),
  ('Batu', 'mining', 850, 'https://pomf2.lain.la/f/krka5cn.PNG'),
  ('PickAxe', 'mining', 6000, 'https://pomf2.lain.la/f/c8ezyznx.PNG'),

  -- Hunting Items
  ('Monyet', 'hunting', 4500, 'https://pomf2.lain.la/f/2iy51ag7.PNG'),
  ('Beruang', 'hunting', 6000, 'https://pomf2.lain.la/f/z5qddbtq.PNG'),
  ('Babi', 'hunting', 5500, 'https://pomf2.lain.la/f/32y4467.PNG'),
  ('Burung', 'hunting', 6000, 'https://pomf2.lain.la/f/joaw8vh.PNG'),
  ('Ayam', 'hunting', 2500, 'https://pomf2.lain.la/f/shvsv36s.PNG'),
  ('Panah', 'hunting', 5000, 'https://pomf2.lain.la/f/0k4h2j8v.PNG');
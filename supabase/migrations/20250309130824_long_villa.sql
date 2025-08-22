/*
  # Create items and user_items tables

  1. New Tables
    - `items`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `type` (text) - Category of item (fishing, farming, mining, etc)
      - `sell_price` (integer) - Price in Rupiah
      - `image_url` (text)
      - `created_at` (timestamp)
    
    - `user_items`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `item_id` (uuid, references items)
      - `quantity` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to:
      - Read items table (everyone can see items)
      - Read/Write their own user_items
*/

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  type text NOT NULL,
  sell_price integer NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Create user_items table
CREATE TABLE IF NOT EXISTS user_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  item_id uuid REFERENCES items(id) NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- Enable RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view items" ON items;
  DROP POLICY IF EXISTS "Users can view their own items" ON user_items;
  DROP POLICY IF EXISTS "Users can insert their own items" ON user_items;
  DROP POLICY IF EXISTS "Users can update their own items" ON user_items;
END $$;

-- Policies for items table
CREATE POLICY "Anyone can view items"
  ON items
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for user_items table
CREATE POLICY "Users can view their own items"
  ON user_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = user_items.user_id
  ));

CREATE POLICY "Users can insert their own items"
  ON user_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = user_items.user_id
  ));

CREATE POLICY "Users can update their own items"
  ON user_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = user_items.user_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM profiles WHERE id = user_items.user_id
  ));

-- Insert all items
INSERT INTO items (name, type, sell_price, image_url) VALUES
  -- Fishing Items
  ('Ikan Emas', 'fishing', 5500, 'https://pomf2.lain.la/f/92i7wgsz.PNG'),
  ('Ikan Lele', 'fishing', 2500, 'https://pomf2.lain.la/f/7ycg37d8.PNG'),
  ('Ikan Arwana', 'fishing', 2500, 'https://pomf2.lain.la/f/yvi11i3d.PNG'),
  ('Ikan Nila', 'fishing', 2500, 'https://pomf2.lain.la/f/piib5hyy.PNG'),
  ('Umpan', 'fishing', 500, 'https://pomf2.lain.la/f/2pdbcofh.PNG'),
  ('Pancingan', 'fishing', 4000, 'https://pomf2.lain.la/f/2pdbcofh.PNG'),
  
  -- Farming Items
  ('Apel', 'farming', 2500, 'https://pomf2.lain.la/f/9ysml6i1.PNG'),
  ('Anggur', 'farming', 3000, 'https://pomf2.lain.la/f/snvlrk.PNG'),
  ('Semangka', 'farming', 2500, 'https://pomf2.lain.la/f/5uh40x2e.PNG'),
  ('Nanas', 'farming', 2000, 'https://pomf2.lain.la/f/r1lqd3ej.PNG'),
  ('Pisang', 'farming', 2000, 'https://pomf2.lain.la/f/9bkk7v0.PNG'),
  ('Bibit Apel', 'farming', 2500, 'https://pomf2.lain.la/f/hwpsk201.PNG'),
  ('Bibit Anggur', 'farming', 3000, 'https://pomf2.lain.la/f/wd9ntn4a.PNG'),
  ('Bibit Semangka', 'farming', 2500, 'https://pomf2.lain.la/f/ztmldyf.PNG'),
  ('Bibit Nanas', 'farming', 2000, 'https://pomf2.lain.la/f/42agnv.PNG'),
  ('Bibit Pisang', 'farming', 2000, 'https://pomf2.lain.la/f/rj9is3q.PNG'),
  
  -- Building Items
  ('Kayu', 'building', 700, 'https://pomf2.lain.la/f/ondcxoy4.PNG'),
  ('Batu', 'building', 850, 'https://pomf2.lain.la/f/krka5cn.PNG'),
  
  -- Mining Items
  ('Diamond', 'mining', 7500, 'https://pomf2.lain.la/f/h53dcc8z.png'),
  ('Iron', 'mining', 3000, 'https://pomf2.lain.la/f/h53dcc8z.png'),
  ('Gold', 'mining', 3500, 'https://pomf2.lain.la/f/h53dcc8z.png'),
  ('PickAxe', 'mining', 6000, 'https://pomf2.lain.la/f/h53dcc8z.png'),
  
  -- Hunting Items
  ('Anjing', 'hunting', 4500, 'https://pomf2.lain.la/f/76tj5lxa.png'),
  ('Beruang', 'hunting', 6000, 'https://pomf2.lain.la/f/76tj5lxa.png'),
  ('Babi', 'hunting', 5500, 'https://pomf2.lain.la/f/76tj5lxa.png'),
  ('Sapi', 'hunting', 6000, 'https://pomf2.lain.la/f/76tj5lxa.png'),
  ('Ayam', 'hunting', 2500, 'https://pomf2.lain.la/f/76tj5lxa.png'),
  ('Panah', 'hunting', 5000, 'https://pomf2.lain.la/f/76tj5lxa.png')
ON CONFLICT (name) DO NOTHING;
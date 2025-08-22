/*
  # Create redeem codes table and initial code

  1. New Tables
    - `redeem_codes`
      - `id` (uuid, primary key)
      - `code` (text, unique)
      - `zgold` (integer)
      - `ztoken` (integer)
      - `exp` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamp)

    - `claimed_codes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `code_id` (uuid, references redeem_codes)
      - `claimed_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create redeem_codes table
CREATE TABLE IF NOT EXISTS redeem_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  zgold integer NOT NULL DEFAULT 0,
  ztoken integer NOT NULL DEFAULT 0,
  exp integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create claimed_codes table
CREATE TABLE IF NOT EXISTS claimed_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  code_id uuid REFERENCES redeem_codes NOT NULL,
  claimed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, code_id)
);

-- Enable RLS
ALTER TABLE redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE claimed_codes ENABLE ROW LEVEL SECURITY;

-- Policies for redeem_codes
CREATE POLICY "Anyone can view active redeem codes"
  ON redeem_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policies for claimed_codes
CREATE POLICY "Users can view their own claimed codes"
  ON claimed_codes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own claimed codes"
  ON claimed_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Insert initial redeem code
INSERT INTO redeem_codes (code, zgold, ztoken, exp)
VALUES ('SATARUZ2025', 25000, 25, 250);
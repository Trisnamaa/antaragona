/*
  # Initial Schema Setup for RPG Game

  1. New Tables
    - profiles
      - id (uuid, primary key)
      - user_id (references auth.users)
      - username (text)
      - character_type (text)
      - dana_number (text)
      - profile_image_url (text)
      - zgold (integer)
      - ztoken (integer)
      - level (integer)
      - exp (integer)
      - strength (integer)
      - created_at (timestamp)
      - banned_until (timestamp)

  2. Security
    - Enable RLS on profiles table
    - Add policies for authenticated users
*/

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  username text UNIQUE,
  character_type text CHECK (character_type IN ('male', 'female')),
  dana_number text,
  profile_image_url text,
  zgold integer DEFAULT 10000,
  ztoken integer DEFAULT 10,
  level integer DEFAULT 1,
  exp integer DEFAULT 0,
  strength integer DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  banned_until timestamptz,
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
/*
  # Global Chat System

  1. New Tables
    - `global_chat`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `username` (text)
      - `message` (text, max 25 words)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on global_chat table
    - Add policies for authenticated users to:
      - Read all messages
      - Insert their own messages
*/

-- Create global_chat table
CREATE TABLE IF NOT EXISTS global_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  username text NOT NULL,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT message_length CHECK (char_length(message) <= 200)
);

-- Enable RLS
ALTER TABLE global_chat ENABLE ROW LEVEL SECURITY;

-- Policies for global_chat
CREATE POLICY "Anyone can view chat messages"
  ON global_chat
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own messages"
  ON global_chat
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS global_chat_created_at_idx ON global_chat(created_at DESC);
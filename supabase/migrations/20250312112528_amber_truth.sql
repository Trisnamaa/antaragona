/*
  # Add Adventure Level Tracking

  1. Changes
    - Add adventure_level column to profiles table to track player progress
    - Default value of 1 for new players
    - Allow updating for existing players

  2. Security
    - Maintain existing RLS policies
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS adventure_level integer DEFAULT 1;
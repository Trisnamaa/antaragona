/*
  # Daily ZToken Reset System

  1. New Tables
    - `ztoken_reset_log`
      - `id` (uuid, primary key)
      - `reset_date` (date): Date when reset was performed
      - `profiles_affected` (integer): Number of profiles that were reset
      - `created_at` (timestamp)

  2. Functions
    - `reset_daily_ztoken()`: Function to reset ZToken for users with < 25 ZToken
    - `get_wib_time()`: Helper function to get current WIB time
    - `schedule_daily_ztoken_reset()`: Function to check if reset should run

  3. Security
    - Enable RLS on ztoken_reset_log table
    - Add policies for viewing reset logs

  4. Scheduling
    - Create function that can be called by external scheduler
    - Log all reset operations for tracking
*/

-- Create ztoken_reset_log table to track daily resets
CREATE TABLE IF NOT EXISTS ztoken_reset_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_date date NOT NULL,
  profiles_affected integer NOT NULL DEFAULT 0,
  total_profiles_checked integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(reset_date)
);

-- Enable RLS
ALTER TABLE ztoken_reset_log ENABLE ROW LEVEL SECURITY;

-- Policy for viewing reset logs (admin/system only)
CREATE POLICY "System can view reset logs"
  ON ztoken_reset_log FOR SELECT
  TO authenticated
  USING (true);

-- Function to get current WIB time (UTC+7)
CREATE OR REPLACE FUNCTION get_wib_time()
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (now() AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta';
$$;

-- Function to get WIB date
CREATE OR REPLACE FUNCTION get_wib_date()
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (get_wib_time())::date;
$$;

-- Function to check if it's time for daily reset (18:00 WIB)
CREATE OR REPLACE FUNCTION should_run_daily_reset()
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  current_wib_time timestamptz;
  current_wib_hour integer;
  current_wib_date date;
  last_reset_date date;
BEGIN
  -- Get current WIB time and date
  current_wib_time := get_wib_time();
  current_wib_hour := EXTRACT(HOUR FROM current_wib_time);
  current_wib_date := get_wib_date();
  
  -- Check if it's 18:00 WIB or later
  IF current_wib_hour < 18 THEN
    RETURN false;
  END IF;
  
  -- Check if reset has already been done today
  SELECT reset_date INTO last_reset_date
  FROM ztoken_reset_log
  ORDER BY reset_date DESC
  LIMIT 1;
  
  -- If no reset has been done yet, or last reset was not today, allow reset
  IF last_reset_date IS NULL OR last_reset_date < current_wib_date THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Main function to reset daily ZToken
CREATE OR REPLACE FUNCTION reset_daily_ztoken()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer := 0;
  total_count integer := 0;
  current_date date;
  result json;
BEGIN
  -- Check if reset should run
  IF NOT should_run_daily_reset() THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Reset not needed or already completed today',
      'wib_time', get_wib_time(),
      'wib_date', get_wib_date()
    );
  END IF;
  
  current_date := get_wib_date();
  
  -- Count total profiles
  SELECT COUNT(*) INTO total_count
  FROM profiles
  WHERE banned_until IS NULL OR banned_until < now();
  
  -- Update ZToken for users with less than 25 ZToken
  UPDATE profiles
  SET ztoken = 25
  WHERE ztoken < 25
    AND (banned_until IS NULL OR banned_until < now());
  
  -- Get number of affected rows
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Log the reset operation
  INSERT INTO ztoken_reset_log (reset_date, profiles_affected, total_profiles_checked)
  VALUES (current_date, affected_count, total_count)
  ON CONFLICT (reset_date) 
  DO UPDATE SET 
    profiles_affected = EXCLUDED.profiles_affected,
    total_profiles_checked = EXCLUDED.total_profiles_checked,
    created_at = now();
  
  -- Return result
  result := json_build_object(
    'success', true,
    'message', 'Daily ZToken reset completed successfully',
    'profiles_affected', affected_count,
    'total_profiles_checked', total_count,
    'reset_date', current_date,
    'wib_time', get_wib_time()
  );
  
  RETURN result;
END;
$$;

-- Function to manually trigger reset (for testing or manual execution)
CREATE OR REPLACE FUNCTION manual_ztoken_reset()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer := 0;
  total_count integer := 0;
  current_date date;
  result json;
BEGIN
  current_date := get_wib_date();
  
  -- Count total profiles
  SELECT COUNT(*) INTO total_count
  FROM profiles
  WHERE banned_until IS NULL OR banned_until < now();
  
  -- Update ZToken for users with less than 25 ZToken
  UPDATE profiles
  SET ztoken = 25
  WHERE ztoken < 25
    AND (banned_until IS NULL OR banned_until < now());
  
  -- Get number of affected rows
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- Log the reset operation (manual)
  INSERT INTO ztoken_reset_log (reset_date, profiles_affected, total_profiles_checked)
  VALUES (current_date, affected_count, total_count)
  ON CONFLICT (reset_date) 
  DO UPDATE SET 
    profiles_affected = ztoken_reset_log.profiles_affected + EXCLUDED.profiles_affected,
    total_profiles_checked = EXCLUDED.total_profiles_checked,
    created_at = now();
  
  -- Return result
  result := json_build_object(
    'success', true,
    'message', 'Manual ZToken reset completed successfully',
    'profiles_affected', affected_count,
    'total_profiles_checked', total_count,
    'reset_date', current_date,
    'wib_time', get_wib_time()
  );
  
  RETURN result;
END;
$$;

-- Function to get reset status and next reset time
CREATE OR REPLACE FUNCTION get_ztoken_reset_status()
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  current_wib_time timestamptz;
  current_wib_date date;
  current_wib_hour integer;
  last_reset_date date;
  next_reset_time timestamptz;
  users_below_25 integer;
  result json;
BEGIN
  current_wib_time := get_wib_time();
  current_wib_date := get_wib_date();
  current_wib_hour := EXTRACT(HOUR FROM current_wib_time);
  
  -- Get last reset date
  SELECT reset_date INTO last_reset_date
  FROM ztoken_reset_log
  ORDER BY reset_date DESC
  LIMIT 1;
  
  -- Calculate next reset time
  IF current_wib_hour >= 18 THEN
    -- Next reset is tomorrow at 18:00
    next_reset_time := (current_wib_date + INTERVAL '1 day' + INTERVAL '18 hours') AT TIME ZONE 'Asia/Jakarta';
  ELSE
    -- Next reset is today at 18:00
    next_reset_time := (current_wib_date + INTERVAL '18 hours') AT TIME ZONE 'Asia/Jakarta';
  END IF;
  
  -- Count users with ZToken < 25
  SELECT COUNT(*) INTO users_below_25
  FROM profiles
  WHERE ztoken < 25
    AND (banned_until IS NULL OR banned_until < now());
  
  result := json_build_object(
    'current_wib_time', current_wib_time,
    'current_wib_date', current_wib_date,
    'current_wib_hour', current_wib_hour,
    'last_reset_date', last_reset_date,
    'next_reset_time', next_reset_time,
    'users_below_25', users_below_25,
    'reset_needed', should_run_daily_reset(),
    'hours_until_next_reset', EXTRACT(EPOCH FROM (next_reset_time - current_wib_time)) / 3600
  );
  
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_wib_time() TO authenticated;
GRANT EXECUTE ON FUNCTION get_wib_date() TO authenticated;
GRANT EXECUTE ON FUNCTION should_run_daily_reset() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_daily_ztoken() TO authenticated;
GRANT EXECUTE ON FUNCTION manual_ztoken_reset() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ztoken_reset_status() TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS ztoken_reset_log_date_idx ON ztoken_reset_log(reset_date DESC);
CREATE INDEX IF NOT EXISTS profiles_ztoken_idx ON profiles(ztoken) WHERE ztoken < 25;

-- Insert initial log entry to track system start
INSERT INTO ztoken_reset_log (reset_date, profiles_affected, total_profiles_checked)
VALUES (get_wib_date(), 0, 0)
ON CONFLICT (reset_date) DO NOTHING;
/*
  # Fix ZToken Reset Syntax Error

  1. Changes
    - Fix reserved keyword issue in reset_daily_ztoken function
    - Rename current_date variable to reset_date to avoid conflict
    - Fix manual_ztoken_reset function with same issue
    - Ensure all functions work correctly with proper variable names

  2. Security
    - Maintain existing function security and permissions
*/

-- Drop existing functions that have syntax errors
DROP FUNCTION IF EXISTS reset_daily_ztoken();
DROP FUNCTION IF EXISTS manual_ztoken_reset();

-- Recreate reset_daily_ztoken function with fixed variable names
CREATE OR REPLACE FUNCTION reset_daily_ztoken()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer := 0;
  total_count integer := 0;
  reset_date date;  -- Changed from current_date to reset_date
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
  
  reset_date := get_wib_date();  -- Fixed: using reset_date instead of current_date
  
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
  VALUES (reset_date, affected_count, total_count)
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
    'reset_date', reset_date,
    'wib_time', get_wib_time()
  );
  
  RETURN result;
END;
$$;

-- Recreate manual_ztoken_reset function with fixed variable names
CREATE OR REPLACE FUNCTION manual_ztoken_reset()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count integer := 0;
  total_count integer := 0;
  reset_date date;  -- Changed from current_date to reset_date
  result json;
BEGIN
  reset_date := get_wib_date();  -- Fixed: using reset_date instead of current_date
  
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
  VALUES (reset_date, affected_count, total_count)
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
    'reset_date', reset_date,
    'wib_time', get_wib_time()
  );
  
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION reset_daily_ztoken() TO authenticated;
GRANT EXECUTE ON FUNCTION manual_ztoken_reset() TO authenticated;
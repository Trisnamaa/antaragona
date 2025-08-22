/*
  # Daily ZToken Reset System

  1. New Functions
    - `reset_daily_ztoken()`: Function to reset ZToken for users with less than 25 ZToken
    - `schedule_daily_ztoken_reset()`: Function to set up the daily schedule

  2. Features
    - Automatic reset every day at 18:00 WIB (11:00 UTC)
    - Only resets ZToken if current amount is less than 25
    - Maintains ZToken above 25 unchanged
    - Logs reset activity for monitoring

  3. Scheduling
    - Uses pg_cron extension if available
    - Fallback to manual execution if pg_cron is not available
*/

-- Function to reset ZToken for users with less than 25
CREATE OR REPLACE FUNCTION reset_daily_ztoken()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reset_count integer := 0;
  total_users integer := 0;
  result json;
  system_user_id uuid;
  system_username text := 'SYSTEM';
BEGIN
  -- Count total active users (not banned)
  SELECT COUNT(*) INTO total_users
  FROM profiles
  WHERE banned_until IS NULL OR banned_until < NOW();
  
  -- Reset ZToken for users with less than 25 ZToken
  UPDATE profiles
  SET ztoken = 25
  WHERE ztoken < 25
    AND (banned_until IS NULL OR banned_until < NOW());
  
  -- Get the number of affected rows
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  -- Try to find an existing admin/system user, or use the first available user
  SELECT user_id INTO system_user_id
  FROM profiles
  WHERE username ILIKE '%admin%' OR username ILIKE '%system%'
  LIMIT 1;
  
  -- If no admin user found, use any available user for system messages
  IF system_user_id IS NULL THEN
    SELECT user_id INTO system_user_id
    FROM profiles
    WHERE banned_until IS NULL OR banned_until < NOW()
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  -- Only log if we have a valid user and there were resets
  IF system_user_id IS NOT NULL AND reset_count > 0 THEN
    INSERT INTO global_chat (user_id, username, message)
    VALUES (
      system_user_id,
      system_username,
      'Daily ZToken reset completed: ' || reset_count || ' players received 25 ZToken'
    );
  END IF;
  
  -- Prepare result
  result := json_build_object(
    'success', true,
    'reset_count', reset_count,
    'total_users', total_users,
    'reset_time', NOW(),
    'timezone', 'Asia/Jakarta'
  );
  
  RETURN result;
END;
$$;

-- Function to manually trigger the reset (for testing or manual execution)
CREATE OR REPLACE FUNCTION manual_ztoken_reset()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN reset_daily_ztoken();
END;
$$;

-- Function to check next reset time
CREATE OR REPLACE FUNCTION get_next_ztoken_reset()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_time_wib timestamptz;
  next_reset_time timestamptz;
  time_until_reset interval;
  result json;
BEGIN
  -- Get current time in WIB (UTC+7)
  current_time_wib := NOW() AT TIME ZONE 'Asia/Jakarta';
  
  -- Calculate next reset time (18:00 WIB today or tomorrow)
  next_reset_time := date_trunc('day', current_time_wib) + interval '18 hours';
  
  -- If current time is past 18:00 today, set to 18:00 tomorrow
  IF current_time_wib > next_reset_time THEN
    next_reset_time := next_reset_time + interval '1 day';
  END IF;
  
  -- Calculate time until next reset
  time_until_reset := next_reset_time - current_time_wib;
  
  result := json_build_object(
    'current_time_wib', current_time_wib,
    'next_reset_time', next_reset_time,
    'time_until_reset_hours', EXTRACT(EPOCH FROM time_until_reset) / 3600,
    'time_until_reset_formatted', 
      EXTRACT(HOURS FROM time_until_reset) || 'h ' ||
      EXTRACT(MINUTES FROM time_until_reset) || 'm'
  );
  
  RETURN result;
END;
$$;

-- Function to get ZToken reset statistics
CREATE OR REPLACE FUNCTION get_ztoken_reset_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  users_below_25 integer;
  users_at_25 integer;
  users_above_25 integer;
  total_users integer;
  result json;
BEGIN
  -- Count users by ZToken ranges
  SELECT 
    COUNT(*) FILTER (WHERE ztoken < 25) as below_25,
    COUNT(*) FILTER (WHERE ztoken = 25) as at_25,
    COUNT(*) FILTER (WHERE ztoken > 25) as above_25,
    COUNT(*) as total
  INTO users_below_25, users_at_25, users_above_25, total_users
  FROM profiles
  WHERE banned_until IS NULL OR banned_until < NOW();
  
  result := json_build_object(
    'users_below_25', users_below_25,
    'users_at_25', users_at_25,
    'users_above_25', users_above_25,
    'total_active_users', total_users,
    'will_be_reset', users_below_25
  );
  
  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION reset_daily_ztoken() TO authenticated;
GRANT EXECUTE ON FUNCTION manual_ztoken_reset() TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_ztoken_reset() TO authenticated;
GRANT EXECUTE ON FUNCTION get_ztoken_reset_stats() TO authenticated;

-- Try to set up pg_cron job if the extension is available
-- Note: This will only work if pg_cron extension is installed and enabled
DO $$
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule daily ZToken reset at 11:00 UTC (18:00 WIB)
    PERFORM cron.schedule(
      'daily-ztoken-reset',
      '0 11 * * *',  -- Every day at 11:00 UTC (18:00 WIB)
      'SELECT reset_daily_ztoken();'
    );
    
    RAISE NOTICE 'Daily ZToken reset scheduled successfully at 18:00 WIB (11:00 UTC)';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Manual execution required.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule automatic reset. Manual execution required.';
END $$;
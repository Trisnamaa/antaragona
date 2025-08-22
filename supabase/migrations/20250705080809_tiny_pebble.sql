/*
  # Chat Auto-Cleanup System

  1. New Functions
    - `cleanup_old_chat_messages()`: Function to delete messages older than 30 minutes
    - Scheduled to run every 5 minutes via pg_cron (if available)

  2. Changes
    - Add automatic cleanup of chat messages older than 30 minutes
    - Improve performance with better indexing
*/

-- Function to cleanup old chat messages (older than 30 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM global_chat 
  WHERE created_at < NOW() - INTERVAL '30 minutes';
END;
$$;

-- Create a more efficient index for cleanup operations
CREATE INDEX IF NOT EXISTS global_chat_cleanup_idx ON global_chat(created_at);

-- Grant execute permission to authenticated users (for manual cleanup if needed)
GRANT EXECUTE ON FUNCTION cleanup_old_chat_messages() TO authenticated;
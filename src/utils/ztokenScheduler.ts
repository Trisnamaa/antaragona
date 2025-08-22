// ZToken Reset Scheduler Utility
// This file provides utilities for managing ZToken reset scheduling

import { supabase } from '../lib/supabase';

export interface ZTokenResetResult {
  success: boolean;
  message: string;
  profiles_affected?: number;
  total_profiles_checked?: number;
  reset_date?: string;
  wib_time?: string;
}

export interface ZTokenResetStatus {
  current_wib_time: string;
  current_wib_date: string;
  current_wib_hour: number;
  last_reset_date: string | null;
  next_reset_time: string;
  users_below_25: number;
  reset_needed: boolean;
  hours_until_next_reset: number;
}

/**
 * Get current ZToken reset status
 */
export async function getZTokenResetStatus(): Promise<ZTokenResetStatus | null> {
  try {
    const { data, error } = await supabase.rpc('get_ztoken_reset_status');
    
    if (error) {
      console.error('Error getting ZToken reset status:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getZTokenResetStatus:', error);
    return null;
  }
}

/**
 * Perform daily ZToken reset (automatic)
 */
export async function performDailyZTokenReset(): Promise<ZTokenResetResult> {
  try {
    const { data, error } = await supabase.rpc('reset_daily_ztoken');
    
    if (error) {
      console.error('Error performing daily ZToken reset:', error);
      return {
        success: false,
        message: `Database error: ${error.message}`
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error in performDailyZTokenReset:', error);
    return {
      success: false,
      message: `Network error: ${error}`
    };
  }
}

/**
 * Perform manual ZToken reset (for testing/admin)
 */
export async function performManualZTokenReset(): Promise<ZTokenResetResult> {
  try {
    const { data, error } = await supabase.rpc('manual_ztoken_reset');
    
    if (error) {
      console.error('Error performing manual ZToken reset:', error);
      return {
        success: false,
        message: `Database error: ${error.message}`
      };
    }
    
    return data;
  } catch (error) {
    console.error('Error in performManualZTokenReset:', error);
    return {
      success: false,
      message: `Network error: ${error}`
    };
  }
}

/**
 * Check if ZToken reset should run based on WIB time
 */
export async function shouldRunZTokenReset(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('should_run_daily_reset');
    
    if (error) {
      console.error('Error checking if reset should run:', error);
      return false;
    }
    
    return data;
  } catch (error) {
    console.error('Error in shouldRunZTokenReset:', error);
    return false;
  }
}

/**
 * Format WIB time for display
 */
export function formatWIBTime(timeString: string): string {
  const date = new Date(timeString);
  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format hours until next reset
 */
export function formatHoursUntilReset(hours: number): string {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes} menit`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.floor((hours - wholeHours) * 60);
  return `${wholeHours} jam ${minutes} menit`;
}

/**
 * Get next reset time in WIB
 */
export function getNextResetTime(): Date {
  const now = new Date();
  const wibNow = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
  
  // Set to 18:00 WIB today
  const resetTime = new Date(wibNow);
  resetTime.setHours(18, 0, 0, 0);
  
  // If it's already past 18:00 WIB today, set to tomorrow
  if (wibNow.getHours() >= 18) {
    resetTime.setDate(resetTime.getDate() + 1);
  }
  
  return resetTime;
}

/**
 * Calculate time until next reset in milliseconds
 */
export function getTimeUntilNextReset(): number {
  const now = new Date();
  const nextReset = getNextResetTime();
  return nextReset.getTime() - now.getTime();
}

/**
 * Start a client-side timer to check for reset time
 * This is for demonstration purposes - in production, use server-side scheduling
 */
export function startZTokenResetTimer(onResetTime: () => void): () => void {
  const checkInterval = setInterval(async () => {
    const status = await getZTokenResetStatus();
    if (status && status.reset_needed) {
      onResetTime();
    }
  }, 60000); // Check every minute
  
  return () => clearInterval(checkInterval);
}

// Export types for use in other files
export type { ZTokenResetResult, ZTokenResetStatus };
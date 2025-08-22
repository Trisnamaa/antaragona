import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface DungeonType {
  id: string;
  name: string;
  description: string;
  image_url: string;
  cost_ztoken: number;
  reward_exp: number;
  reward_zgold: number;
  reward_ztoken: number;
  master_title_name: string;
  master_title_requirement: number;
}

interface DungeonProgress {
  dungeon_type_id: string;
  completion_count: number;
  last_completed_at: string;
}

interface DungeonHistory {
  id: string;
  dungeon_type_id: string;
  rounds_completed: number;
  is_victory: boolean;
  exp_gained: number;
  zgold_gained: number;
  ztoken_gained: number;
  title_awarded: string | null;
  completed_at: string;
  dungeon_types: DungeonType;
}

interface UseDungeonReturn {
  dungeonTypes: DungeonType[];
  dungeonProgress: DungeonProgress[];
  dungeonHistory: DungeonHistory[];
  loading: boolean;
  loadDungeonData: () => Promise<void>;
  getDungeonProgress: (dungeonTypeId: string) => DungeonProgress | null;
  getTotalCompletions: (dungeonTypeId: string) => number;
  getProgressToMaster: (dungeonTypeId: string, requirement: number) => { current: number; required: number; percentage: number };
}

export function useDungeon(profileId: string | null): UseDungeonReturn {
  const [dungeonTypes, setDungeonTypes] = useState<DungeonType[]>([]);
  const [dungeonProgress, setDungeonProgress] = useState<DungeonProgress[]>([]);
  const [dungeonHistory, setDungeonHistory] = useState<DungeonHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDungeonData = async () => {
    if (!profileId) return;

    try {
      setLoading(true);

      // Load dungeon types
      const { data: typesData, error: typesError } = await supabase
        .from('dungeon_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (typesError) throw typesError;
      setDungeonTypes(typesData || []);

      // Load player's dungeon progress
      const { data: progressData, error: progressError } = await supabase
        .from('dungeon_progress')
        .select('*')
        .eq('profile_id', profileId);

      if (progressError) throw progressError;
      setDungeonProgress(progressData || []);

      // Load player's dungeon history (last 20 entries)
      const { data: historyData, error: historyError } = await supabase
        .from('dungeon_history')
        .select(`
          *,
          dungeon_types (
            name,
            image_url
          )
        `)
        .eq('profile_id', profileId)
        .order('completed_at', { ascending: false })
        .limit(20);

      if (historyError) throw historyError;
      setDungeonHistory(historyData || []);
    } catch (error) {
      console.error('Error loading dungeon data:', error);
      toast.error('Failed to load dungeon data');
    } finally {
      setLoading(false);
    }
  };

  const getDungeonProgress = (dungeonTypeId: string): DungeonProgress | null => {
    return dungeonProgress.find(p => p.dungeon_type_id === dungeonTypeId) || null;
  };

  const getTotalCompletions = (dungeonTypeId: string): number => {
    const progress = getDungeonProgress(dungeonTypeId);
    return progress?.completion_count || 0;
  };

  const getProgressToMaster = (dungeonTypeId: string, requirement: number) => {
    const current = getTotalCompletions(dungeonTypeId);
    const percentage = Math.min((current / requirement) * 100, 100);
    return { current, required: requirement, percentage };
  };

  useEffect(() => {
    if (profileId) {
      loadDungeonData();
    }
  }, [profileId]);

  return {
    dungeonTypes,
    dungeonProgress,
    dungeonHistory,
    loading,
    loadDungeonData,
    getDungeonProgress,
    getTotalCompletions,
    getProgressToMaster
  };
}

// Utility functions for dungeon management
export const DungeonUtils = {
  // Check if player can enter dungeon
  canEnterDungeon: (playerZToken: number, dungeonCost: number): boolean => {
    return playerZToken >= dungeonCost;
  },

  // Calculate total rewards earned from dungeons
  calculateTotalRewards: (history: DungeonHistory[]) => {
    return history.reduce((totals, entry) => ({
      exp: totals.exp + entry.exp_gained,
      zgold: totals.zgold + entry.zgold_gained,
      ztoken: totals.ztoken + entry.ztoken_gained,
      victories: totals.victories + (entry.is_victory ? 1 : 0),
      defeats: totals.defeats + (entry.is_victory ? 0 : 1)
    }), { exp: 0, zgold: 0, ztoken: 0, victories: 0, defeats: 0 });
  },

  // Get dungeon statistics
  getDungeonStats: (history: DungeonHistory[], dungeonTypeId: string) => {
    const dungeonHistory = history.filter(h => h.dungeon_type_id === dungeonTypeId);
    const victories = dungeonHistory.filter(h => h.is_victory).length;
    const defeats = dungeonHistory.filter(h => !h.is_victory).length;
    const total = dungeonHistory.length;
    const winRate = total > 0 ? (victories / total) * 100 : 0;

    return {
      total,
      victories,
      defeats,
      winRate: Math.round(winRate)
    };
  },

  // Format dungeon completion time
  formatCompletionTime: (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};
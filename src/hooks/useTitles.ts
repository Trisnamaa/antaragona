import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Title {
  id: string;
  name: string;
  description: string;
  color: string;
  rarity: string;
  unlock_condition: string;
}

interface PlayerTitle {
  id: string;
  title_id: string;
  unlocked_at: string;
  is_equipped: boolean;
  titles: Title;
}

interface UseTitlesReturn {
  availableTitles: Title[];
  equippedTitle: Title | null;
  loading: boolean;
  equipTitle: (titleId: string) => Promise<void>;
  unequipTitle: () => Promise<void>;
  awardTitle: (titleId: string) => Promise<boolean>;
  loadTitles: () => Promise<void>;
}

export function useTitles(profileId: string | null): UseTitlesReturn {
  const [availableTitles, setAvailableTitles] = useState<Title[]>([]);
  const [equippedTitle, setEquippedTitle] = useState<Title | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTitles = async () => {
    if (!profileId) return;

    try {
      setLoading(true);

      // Load player's titles
      const { data: playerTitles, error: playerError } = await supabase
        .from('player_titles')
        .select(`
          id,
          title_id,
          unlocked_at,
          is_equipped,
          titles (
            id,
            name,
            description,
            color,
            rarity,
            unlock_condition
          )
        `)
        .eq('profile_id', profileId);

      if (playerError) throw playerError;

      const titles = playerTitles?.map(pt => pt.titles as Title) || [];
      const equipped = playerTitles?.find(pt => pt.is_equipped)?.titles as Title || null;

      setAvailableTitles(titles);
      setEquippedTitle(equipped);
    } catch (error) {
      console.error('Error loading titles:', error);
      toast.error('Failed to load titles');
    } finally {
      setLoading(false);
    }
  };

  const equipTitle = async (titleId: string) => {
    if (!profileId) return;

    try {
      setLoading(true);

      const { error } = await supabase.rpc('equip_title', {
        player_profile_id: profileId,
        new_title_id: titleId
      });

      if (error) throw error;

      toast.success('Title equipped successfully!');
      await loadTitles();
    } catch (error: any) {
      console.error('Error equipping title:', error);
      toast.error(error.message || 'Failed to equip title');
    } finally {
      setLoading(false);
    }
  };

  const unequipTitle = async () => {
    if (!profileId) return;

    try {
      setLoading(true);

      const { error } = await supabase.rpc('unequip_title', {
        player_profile_id: profileId
      });

      if (error) throw error;

      toast.success('Title unequipped successfully!');
      await loadTitles();
    } catch (error: any) {
      console.error('Error unequipping title:', error);
      toast.error(error.message || 'Failed to unequip title');
    } finally {
      setLoading(false);
    }
  };

  const awardTitle = async (titleId: string): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const { data, error } = await supabase.rpc('award_title', {
        player_profile_id: profileId,
        new_title_id: titleId
      });

      if (error) throw error;

      if (data) {
        toast.success('New title unlocked!');
        await loadTitles();
        return true;
      }

      return false; // Player already has this title
    } catch (error: any) {
      console.error('Error awarding title:', error);
      return false;
    }
  };

  useEffect(() => {
    if (profileId) {
      loadTitles();
    }
  }, [profileId]);

  // Reload titles when profile changes (for equipped title updates)
  useEffect(() => {
    if (profileId) {
      loadTitles();
    }
  }, [profileId]);

  return {
    availableTitles,
    equippedTitle,
    loading,
    equipTitle,
    unequipTitle,
    awardTitle,
    loadTitles
  };
}

// Hook for getting user's equipped title by profile ID (for displaying other users' titles)
export function useUserTitle(profileId: string | null) {
  const [title, setTitle] = useState<Title | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;

    const loadUserTitle = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('profiles')
          .select(`
            equipped_title_id,
            titles:equipped_title_id (
              id,
              name,
              description,
              color,
              rarity
            )
          `)
          .eq('id', profileId)
          .single();

        if (error) throw error;

        setTitle(data?.titles || null);
      } catch (error) {
        console.error('Error loading user title:', error);
        setTitle(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserTitle();
  }, [profileId]);

  return { title, loading };
}

// Utility functions for title management
export const TitleUtils = {
  // Check if player should get a title based on achievements
  checkTitleEligibility: async (profileId: string, condition: string): Promise<boolean> => {
    // This would contain logic to check various conditions
    // For now, return false - implement based on your game logic
    return false;
  },

  // Get title by name
  getTitleByName: async (titleName: string): Promise<Title | null> => {
    try {
      const { data, error } = await supabase
        .from('titles')
        .select('*')
        .eq('name', titleName)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting title by name:', error);
      return null;
    }
  },

  // Award title by name (convenience function)
  awardTitleByName: async (profileId: string, titleName: string): Promise<boolean> => {
    try {
      const title = await TitleUtils.getTitleByName(titleName);
      if (!title) return false;

      const { data, error } = await supabase.rpc('award_title', {
        player_profile_id: profileId,
        new_title_id: title.id
      });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error awarding title by name:', error);
      return false;
    }
  }
};
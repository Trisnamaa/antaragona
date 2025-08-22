import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Costume {
  id: string;
  name: string;
  icon_url: string;
  male_image_url: string;
  female_image_url: string;
  price: number;
}

interface PlayerCostume {
  id: string;
  costume_id: string;
  is_equipped: boolean;
  obtained_at: string;
  costumes: Costume;
}

interface UseCostumesReturn {
  availableCostumes: Costume[];
  playerCostumes: PlayerCostume[];
  equippedCostume: Costume | null;
  loading: boolean;
  equipCostume: (costumeId: string) => Promise<void>;
  unequipCostume: () => Promise<void>;
  loadCostumes: () => Promise<void>;
  purchaseCostume: (costume: Costume, profileId: string, currentZGold: number) => Promise<boolean>;
}

export function useCostumes(profileId: string | null): UseCostumesReturn {
  const [availableCostumes, setAvailableCostumes] = useState<Costume[]>([]);
  const [playerCostumes, setPlayerCostumes] = useState<PlayerCostume[]>([]);
  const [equippedCostume, setEquippedCostume] = useState<Costume | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCostumes = async () => {
    if (!profileId) return;

    try {
      setLoading(true);

      // Load available costumes
      const { data: costumesData, error: costumesError } = await supabase
        .from('costumes')
        .select('*')
        .eq('is_active', true);

      if (costumesError) throw costumesError;
      setAvailableCostumes(costumesData || []);

      // Load player's costumes
      const { data: playerCostumesData, error: playerError } = await supabase
        .from('player_costumes')
        .select(`
          id,
          costume_id,
          is_equipped,
          obtained_at,
          costumes (
            id,
            name,
            icon_url,
            male_image_url,
            female_image_url,
            price
          )
        `)
        .eq('profile_id', profileId);

      if (playerError) throw playerError;

      const costumes = playerCostumesData || [];
      const equipped = costumes.find(pc => pc.is_equipped)?.costumes as Costume || null;

      setPlayerCostumes(costumes);
      setEquippedCostume(equipped);
    } catch (error) {
      console.error('Error loading costumes:', error);
      toast.error('Failed to load costumes');
    } finally {
      setLoading(false);
    }
  };

  const equipCostume = async (costumeId: string) => {
    if (!profileId) return;

    try {
      setLoading(true);

      // FIXED: Menggunakan parameter yang sesuai dengan database function
      const { error } = await supabase.rpc('equip_costume', {
        p_costume_id: costumeId,
        p_player_profile_id: profileId
      });

      if (error) throw error;

      toast.success('Costume equipped successfully!');
      await loadCostumes();
    } catch (error: any) {
      console.error('Error equipping costume:', error);
      toast.error(error.message || 'Failed to equip costume');
    } finally {
      setLoading(false);
    }
  };

  const unequipCostume = async () => {
    if (!profileId) return;

    try {
      setLoading(true);

      // FIXED: Menggunakan parameter yang sesuai dengan database function
      const { error } = await supabase.rpc('unequip_costume', {
        p_player_profile_id: profileId
      });

      if (error) throw error;

      toast.success('Costume unequipped successfully!');
      await loadCostumes();
    } catch (error: any) {
      console.error('Error unequipping costume:', error);
      toast.error(error.message || 'Failed to unequip costume');
    } finally {
      setLoading(false);
    }
  };

  const purchaseCostume = async (costume: Costume, profileId: string, currentZGold: number): Promise<boolean> => {
    if (currentZGold < costume.price) {
      toast.error(`Not enough ZGold! You need ${costume.price} ZGold.`);
      return false;
    }

    try {
      setLoading(true);

      // Check if player already owns this costume
      const { data: existingCostume } = await supabase
        .from('player_costumes')
        .select('id')
        .eq('profile_id', profileId)
        .eq('costume_id', costume.id)
        .maybeSingle();

      if (existingCostume) {
        toast.error('You already own this costume!');
        return false;
      }

      // Deduct ZGold from profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ zgold: currentZGold - costume.price })
        .eq('id', profileId);

      if (updateError) throw updateError;

      // Add costume to player's collection
      const { error: insertError } = await supabase
        .from('player_costumes')
        .insert({
          profile_id: profileId,
          costume_id: costume.id,
          is_equipped: false
        });

      if (insertError) throw insertError;

      toast.success('Costume purchased successfully!');
      await loadCostumes();
      return true;
    } catch (error) {
      console.error('Error purchasing costume:', error);
      toast.error('Failed to purchase costume');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileId) {
      loadCostumes();
    }
  }, [profileId]);

  return {
    availableCostumes,
    playerCostumes,
    equippedCostume,
    loading,
    equipCostume,
    unequipCostume,
    loadCostumes,
    purchaseCostume
  };
}
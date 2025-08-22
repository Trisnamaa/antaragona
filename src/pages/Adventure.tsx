import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Sword, Shield, Heart, Zap, ArrowLeft, Lock, Crown, Star, 
  Map, Trophy, Key, Sparkles, Target, ChevronRight, X  // Tambahkan X di sini
} from 'lucide-react';
import toast from 'react-hot-toast';
import RewardPopup from '../components/RewardPopup'; 
import { motion } from 'framer-motion';
import { GAME_ASSETS } from '../assets/gameAssets';
import { useCostumes } from '../hooks/useCostumes';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  level: number;
  zgold: number;
  ztoken: number;
  exp: number;
  strength: number;
}

interface AdventureProgress {
  id: string;
  profile_id: string;
  completed_stages: number[];
  current_stage: number;
  unlocked_worlds: string[];
}

interface InventoryItem {
  id: string;
  item_id: string;
  quantity: number;
  game_items: {
    name: string;
    image_url: string;
    type: string;
  } | null;
}

interface Enemy {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  image: string;
}

interface World {
  id: number;
  name: string;
  color: string;
  stageRange: { start: number; end: number };
  background: string;
  description: string;
}

// 10 Dunia dengan sistem progresif 1-100
const WORLDS: World[] = [
  { 
    id: 1, 
    name: 'AETHERION', 
    color: 'from-blue-500 to-purple-600', 
    stageRange: { start: 1, end: 10 },
    background: 'https://i.pinimg.com/1200x/0e/90/7b/0e907b5878565080d7e224b60ff71d81.jpg',
    description: 'Langit yang kita pijak adalah puing dari dunia yang kita hancurkan sendiri.'
  },
  { 
    id: 2, 
    name: 'THALASSIA', 
    color: 'from-cyan-500 to-blue-600', 
    stageRange: { start: 11, end: 20 },
    background: 'https://i.pinimg.com/736x/5e/57/c5/5e57c5eaab0526ba7ee6b78dfd7ee068.jpg',
    description: 'Lautan bukan hanya rumah, tapi memori yang terus bergelombang.'
  },
  { 
    id: 3, 
    name: 'EMBERWASTE', 
    color: 'from-green-500 to-blue-600', 
    stageRange: { start: 21, end: 30 },
    background: 'https://i.pinimg.com/736x/00/cc/a9/00cca9ae2f6dba205c4f4137218b53e4.jpg',
    description: 'Di tanah yang terbakar, dosa tak pernah hilang—ia hanya meleleh, mengalir, lalu jatuh lagi bersama hujan abu.'
  },
  { 
    id: 4, 
    name: 'CRYNTAR', 
    color: 'from-orange-500 to-purple-600', 
    stageRange: { start: 31, end: 40 },
    background: 'https://i.pinimg.com/736x/c6/02/34/c602347e967919e0d25056ff58a79740.jpg',
    description: 'Di dunia yang tak pernah mencair, waktu membeku bersama harapan.'
  },
  { 
    id: 5, 
    name: 'SYLVARAN', 
    color: 'from-emerald-400 to-green-600', 
    stageRange: { start: 41, end: 50 },
    background: 'https://i.pinimg.com/1200x/d0/81/20/d08120c23350d318eedb3e9b2c8762f1.jpg',
    description: 'Hutan ini tidak dilalui waktu. Ia mengingat setiap langkah, luka, dan kebohongan.'
  },
  { 
    id: 6, 
    name: 'MECHAVELL', 
    color: 'from-gray-500 to-blue-600', 
    stageRange: { start: 51, end: 60 },
    background: 'https://i.pinimg.com/1200x/f1/06/fd/f106fde3d90023109abe164523d8b01e.jpg',
    description: ''
  },
  { 
    id: 7, 
    name: 'DRAKARHIM', 
    color: 'from-purple-600 to-indigo-800', 
    stageRange: { start: 61, end: 70 },
    background: 'https://i.pinimg.com/1200x/3f/89/ca/3f89ca6dd6f0038cfe565fc82ff7e297.jpg',
    description: ''
  },
  { 
    id: 8, 
    name: 'NOCTHERRA', 
    color: 'from-purple-400 to-blue-400', 
    stageRange: { start: 71, end: 80 },
    background: 'https://i.pinimg.com/736x/b6/5f/18/b65f183a1db8acffa8d31441ab99f641.jpg',
    description: ''
  },
  { 
    id: 9, 
    name: 'NECROSALEM', 
    color: 'from-yellow-600 to-orange-700', 
    stageRange: { start: 81, end: 90 },
    background: 'https://i.pinimg.com/1200x/5b/8d/84/5b8d8470cc700f04f600fe50a2dd531e.jpg',
    description: ''
  },
  { 
    id: 10, 
    name: 'ASTRALUNE', 
    color: 'from-purple-400 to-pink-600', 
    stageRange: { start: 91, end: 100 },
    background: 'https://i.pinimg.com/1200x/0d/87/7e/0d877ec22454b0e5d9e6ddad1430f15b.jpg',
    description: ''
  }
];

// Enemy placeholders untuk setiap dunia
const WORLD_ENEMIES = {
  AETHERION: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753958220777-gh3omj.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753958228008-jloonu.png", 
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753958238825-056u6o.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753958246632-iev7xs.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753958392303-b5glsc.png"
  },
  THALASSIA: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753960948915-oiijj6.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753960940043-al0twb.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753960933612-a5ivvz.png", 
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753960955211-gayvwn.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753960960851-j6fphw.png"
  },
  EMBERWASTE: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961033419-6ylqvf.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961041619-m8sd5y.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961048923-axgxiu.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961056683-rzij4n.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961062371-omhdtr.png"
  },
  CRYNTAR: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961170428-whwtek.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961176268-y98z0s.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961181804-vqwyf9.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961187419-9cp481.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753961192971-9oa29r.png"
  },
  SYLVARAN: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985672711-gprpwu.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985678628-5oi4y6.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985685980-scenoc.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985691996-hydpcu.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985697980-ggqb5w.png"
  },
  MECHAVELL: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985783372-ykljv4.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985789436-el4cd4.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985795756-0b84x7.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985801612-ah3x9n.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985807484-32dof2.png"
  },
  DRAKARHIM: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985828524-ug36ae.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985834196-7ledmr.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985840317-f9k47g.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985845724-wvi3we.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985852076-hu1tp7.png"
  },
  NOCTHERRA: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985865876-1ls6zh.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985871532-h1ge44.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985877108-q7zsti.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985882476-b1qswl.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753985888181-4dwbzl.png"
  },
  NECROSALEM: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986679029-2qgikl.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986684493-6uxw7i.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986690054-76ubrq.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986695453-saz8mm.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986700885-fft15m.png"
  },
  ASTRALUNE: {
    npc1: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986710109-qwtudx.png",
    npc2: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986715493-oasyfa.png",
    npc3: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986721149-t00vuq.png",
    npc4: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986726653-jmtoyu.png",
    boss: "https://raw.githubusercontent.com/AquaCasaster/db_image/main/1753986731885-tzrpfy.png"
  }
};

// Add this constant for enemy stats
const WORLD_STATS = {
  AETHERION: { normal: { hp: 100, attack: 5 }, boss: { hp: 100, attack: 10 } },
  THALASSIA: { normal: { hp: 100, attack: 10 }, boss: { hp: 100, attack: 20 } },
  EMBERWASTE: { normal: { hp: 100, attack: 20 }, boss: { hp: 100, attack: 30 } },
  CRYNTAR: { normal: { hp: 100, attack: 30 }, boss: { hp: 100, attack: 40 } },
  SYLVARAN: { normal: { hp: 100, attack: 40 }, boss: { hp: 100, attack: 50 } },
  MECHAVELL: { normal: { hp: 100, attack: 50 }, boss: { hp: 100, attack: 60 } },
  DRAKARHIM: { normal: { hp: 100, attack: 60 }, boss: { hp: 100, attack: 70 } },
  NOCTHERRA: { normal: { hp: 100, attack: 70 }, boss: { hp: 100, attack: 80 } },
  NECROSALEM: { normal: { hp: 100, attack: 80 }, boss: { hp: 100, attack: 90 } },
  ASTRALUNE: { normal: { hp: 100, attack: 90 }, boss: { hp: 100, attack: 95 } }
};

// Add rewards constant
const STAGE_REWARDS = {
  AETHERION: {
    normal: { gold: 100, zgold: 10, exp: 50 },
    boss: { gold: 150, zgold: 20, exp: 80 },
    post_boss: { gold: 120, zgold: 12, exp: 60 },
    final: { gold: 500, zgold: 40, exp: 100 },
    title: "Guardian of Aetherion"
  },
  THALASSIA: {
    normal: { gold: 140, zgold: 14, exp: 70 },
    boss: { gold: 200, zgold: 25, exp: 100 },
    post_boss: { gold: 160, zgold: 16, exp: 80 },
    final: { gold: 550, zgold: 45, exp: 120 },
    title: "Tidebreaker"
  },
  EMBERWASTE: {
    normal: { gold: 180, zgold: 18, exp: 90 },
    boss: { gold: 250, zgold: 30, exp: 120 },
    post_boss: { gold: 200, zgold: 20, exp: 100 },
    final: { gold: 600, zgold: 50, exp: 150 },
    title: "Emberwaste Master"
  },
  CRYNTAR: {
    normal: { gold: 220, zgold: 22, exp: 110 },
    boss: { gold: 300, zgold: 35, exp: 140 },
    post_boss: { gold: 240, zgold: 24, exp: 120 },
    final: { gold: 650, zgold: 55, exp: 160 },
    title: "Frostborn Slayer"
  },
  SYLVARAN: {
    normal: { gold: 260, zgold: 26, exp: 130 },
    boss: { gold: 350, zgold: 40, exp: 160 },
    post_boss: { gold: 280, zgold: 28, exp: 140 },
    final: { gold: 700, zgold: 60, exp: 170 },
    title: "Verdant Warden"
  },
  MECHAVELL: {
    normal: { gold: 300, zgold: 30, exp: 150 },
    boss: { gold: 400, zgold: 50, exp: 180 },
    post_boss: { gold: 320, zgold: 32, exp: 160 },
    final: { gold: 750, zgold: 65, exp: 180 },
    title: "Clockwork Strategist"
  },
  DRAKARHIM: {
    normal: { gold: 340, zgold: 34, exp: 170 },
    boss: { gold: 450, zgold: 55, exp: 200 },
    post_boss: { gold: 360, zgold: 36, exp: 180 },
    final: { gold: 800, zgold: 70, exp: 200 },
    title: "Drakebane"
  },
  NOCTHERRA: {
    normal: { gold: 380, zgold: 38, exp: 190 },
    boss: { gold: 500, zgold: 60, exp: 220 },
    post_boss: { gold: 400, zgold: 40, exp: 200 },
    final: { gold: 850, zgold: 75, exp: 220 },
    title: "Shadowrender"
  },
  NECROSALEM: {
    normal: { gold: 420, zgold: 42, exp: 210 },
    boss: { gold: 550, zgold: 65, exp: 250 },
    post_boss: { gold: 440, zgold: 44, exp: 240 },
    final: { gold: 900, zgold: 80, exp: 250 },
    title: "Soul Reaper"
  },
  ASTRALUNE: {
    normal: { gold: 460, zgold: 46, exp: 230 },
    boss: { gold: 520, zgold: 65, exp: 250 },
    post_boss: { gold: 500, zgold: 50, exp: 240 },
    final: { gold: 1000, zgold: 100, exp: 300 },
    title: "Eclipse Ascendant"
  }
};

// Add interface for Adventure Session
interface AdventureSession {
  id: string;          // UUID for this adventure session
  profile_id: string;  // Reference to player's profile
  room_code: string;   // Unique room code for this player's adventure
  current_rewards?: {  // Current pending rewards
    gold: number;
    zgold: number;
    exp: number;
    title?: string;
  };
  last_completed_stage?: number;
  created_at: string;
}

const Adventure: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<AdventureProgress | null>(null);
  const [potions, setPotions] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorld, setSelectedWorld] = useState<number>(1);
  const [selectedWorldForStages, setSelectedWorldForStages] = useState<World | null>(null);
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
  const [inBattle, setInBattle] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [playerHp, setPlayerHp] = useState(100);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'stages'>('map');
  const [showRewards, setShowRewards] = useState(false);
  const [currentRewards, setCurrentRewards] = useState<any>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [enemyAttacking, setEnemyAttacking] = useState(false);
  const { equippedCostume } = useCostumes(profile?.id || null);
  // Letakkan handleClaimRewards di dalam komponen
// Letakkan handleClaimRewards di dalam komponen
  const handleClaimRewards = async () => {
    if (!currentRewards || !profile) return;

    try {
      let additionalZGold = 0;
      let titleMessage = '';

      // Handle title if present
      if (currentRewards.title) {
        try {
          // Get title ID
          const { data: titleData, error: titleError } = await supabase
            .from('titles')
            .select('id')
            .eq('name', currentRewards.title)
            .single();

          if (titleError) {
            console.warn('Title not found:', currentRewards.title);
          } else if (titleData) {
            // Check if player already has this title
            const { data: existingTitle } = await supabase
              .from('player_titles')
              .select('id')
              .match({ profile_id: profile.id, title_id: titleData.id })
              .maybeSingle();

            if (existingTitle) {
              // Title already owned - convert to ZGold
              additionalZGold = 2000;
              titleMessage = 'Duplicate title converted to 2000 ZGold!';
            } else {
              // Add new title
              const { error: insertError } = await supabase
                .from('player_titles')
                .insert({
                  profile_id: profile.id,
                  title_id: titleData.id,
                  is_equipped: false
                });

              if (insertError) {
                console.error('Error inserting title:', insertError);
                // If insert fails, convert to ZGold as fallback
                additionalZGold = 2000;
                titleMessage = 'Title converted to 2000 ZGold!';
              } else {
                titleMessage = `Title "${currentRewards.title}" obtained!`;
              }
            }
          }
        } catch (titleError) {
          console.error('Title processing error:', titleError);
          // Convert to ZGold as fallback
          additionalZGold = 2000;
          titleMessage = 'Title converted to 2000 ZGold!';
        }
      }

      // Update player stats including potential bonus ZGold
      const { error: statsError } = await supabase
        .from('profiles')
        .update({
          zgold: profile.zgold + currentRewards.zgold + additionalZGold,
          exp: profile.exp + currentRewards.exp
        })
        .eq('id', profile.id);

      if (statsError) throw statsError;

      // Show appropriate success message
      if (titleMessage) {
        toast.success(titleMessage);
      }
      toast.success('Rewards claimed!');
      
      setShowRewards(false);
      setInBattle(false);
      await loadData();

    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error('Failed to claim rewards');
    }
  };

const handleWorldClick = (world: World) => {
  if (isWorldUnlocked(world.id)) {
    setSelectedWorld(world.id); // Set selectedWorld dengan world.id
    setSelectedWorldForStages(world); // Ini bisa dihapus karena kita tidak menggunakan modal lagi
  }
};
  const handleCloseStageList = () => {
    setSelectedWorldForStages(null);
  };

  const handleStageSelect = (stage: number) => {
    startBattle(stage); // Mulai battle dengan stage yang dipilih
  };
  // Add new state for adventure session
  const [adventureSession, setAdventureSession] = useState<AdventureSession | null>(null);

  // Add these computed values using useMemo
  const totalCompleted = useMemo(() => {
    return progress?.completed_stages.length || 0;
  }, [progress?.completed_stages]);

  const globalProgress = useMemo(() => {
    return (totalCompleted / 100) * 100;
  }, [totalCompleted]);

  useEffect(() => {
    loadData();
  }, []);

  // Update loadData function
  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setPlayerHp(100);

      // Load or create adventure progress
      let { data: progressData, error: progressError } = await supabase
        .from('player_adventure_progress')
        .select('*')
        .eq('profile_id', profileData.id)
        .maybeSingle(); // Use maybeSingle instead of single

      if (!progressData) {
        // Create initial progress
        const { data: newProgress, error: createError } = await supabase
          .from('player_adventure_progress')
          .upsert({ // Use upsert instead of insert
            profile_id: profileData.id,
            completed_stages: [],
            current_stage: 1,
            unlocked_worlds: ['AETHERION']
          })
          .select()
          .single();

        if (createError) throw createError;
        progressData = newProgress;
      } else if (progressError && progressError.code !== 'PGRST116') {
        throw progressError;
      }

      setProgress(progressData);

      // Load potions
      const { data: potionData, error: potionError } = await supabase
        .from('player_inventory')
        .select(`
          id,
          item_id,
          quantity,
          game_items (
            name,
            image_url,
            type
          )
        `)
        .eq('profile_id', profileData.id)
        .eq('game_items.type', 'potion');

      if (potionError) throw potionError;
      setPotions(potionData || []);

      // Load or create adventure session
      let { data: sessionData, error: sessionError } = await supabase
        .from('adventure_sessions')
        .select('*')
        .eq('profile_id', profileData.id)
        .maybeSingle(); // Use maybeSingle

      if (!sessionData) {
        // Create new session
        const roomCode = `ADV-${profileData.id.substring(0, 6)}`;
        const { data: newSession, error: createError } = await supabase
          .from('adventure_sessions')
          .upsert({ // Use upsert
            profile_id: profileData.id,
            room_code: roomCode
          })
          .select()
          .single();

        if (createError) throw createError;
        sessionData = newSession;
      } else if (sessionError && sessionError.code !== 'PGRST116') {
        throw sessionError;
      }

      setAdventureSession(sessionData);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load adventure data');
    } finally {
      setLoading(false);
    }
  };

  const loadPotions = async (profileId: string) => {
    try {
      const { data: inventoryData, error } = await supabase
        .from('player_inventory')
        .select(`
          id,
          item_id,
          quantity,
          game_items (
            name,
            image_url,
            type
          )
        `)
        .eq('profile_id', profileId)
        .eq('game_items.type', 'potion');

      if (error) throw error;
      setPotions(inventoryData || []);
    } catch (error) {
      console.error('Error loading potions:', error);
      toast.error('Failed to load potions');
    }
  };

  // Helper functions
  const getWorldByStage = (stage: number): World | null => {
    return WORLDS.find(world => 
      stage >= world.stageRange.start && stage <= world.stageRange.end
    ) || null;
  };

  const isWorldUnlocked = (worldId: number): boolean => {
    if (worldId === 1) return true;
    if (!progress) return false;
    
    const previousWorld = WORLDS.find(w => w.id === worldId - 1);
    if (!previousWorld) return false;
    
    return progress.completed_stages.includes(previousWorld.stageRange.end);
  };

  const isStageCompleted = (stage: number): boolean => {
    return progress?.completed_stages.includes(stage) || false;
  };

  const isStageAvailable = (stage: number): boolean => {
    if (stage === 1) return true;
    if (!progress) return false;
    return progress.completed_stages.includes(stage - 1) || progress.current_stage >= stage;
  };

  const getStageType = (stage: number): 'normal' | 'boss' | 'final' => {
    if (stage % 10 === 0) return 'final'; // 10, 20, 30, etc.
    if (stage % 5 === 0) return 'boss';   // 5, 15, 25, etc.
    return 'normal';
  };

  const getRoundsForStage = (stage: number): number => {
    const type = getStageType(stage);
    switch (type) {
      case 'final': return 5; // 4 NPC + 1 Boss
      case 'boss': return 5;  // 4 NPC + 1 Boss  
      default: return 3;      // 3 NPC
    }
  };

  // Tambahkan fungsi generateEnemy sebelum fungsi startBattle
  const generateEnemy = (stage: number, round: number) => {
    const world = getWorldByStage(stage);
    if (!world) {
      console.error('Invalid world for stage:', stage);
      return null;
    }

    const stageType = getStageType(stage);
    const isBoss = round === getRoundsForStage(stage);

    const worldStats = WORLD_STATS[world.name as keyof typeof WORLD_STATS];
    const stats = isBoss ? worldStats.boss : worldStats.normal;

    // Get enemy image berdasarkan world
    const worldEnemies = WORLD_ENEMIES[world.name as keyof typeof WORLD_ENEMIES];
    if (!worldEnemies) {
      console.error('No enemies defined for world:', world.name);
      return null;
    }

    const enemyImage = isBoss ? worldEnemies.boss : worldEnemies[`npc${Math.min(round, 4)}` as keyof typeof worldEnemies];
    const enemyName = isBoss 
      ? `${world.name} ${stageType === 'final' ? 'Final Boss' : 'Boss'}`
      : `${world.name} Guardian ${round}`;

    const enemy: Enemy = {
      name: enemyName,
      hp: stats.hp,
      maxHp: stats.hp,
      attack: stats.attack,
      defense: 0,
      image: enemyImage || ''
    };

    setEnemy(enemy);
    return enemy;
  };

  // Update fungsi startBattle
  const startBattle = async (stage: number) => {
    if (!profile || !isStageAvailable(stage)) {
      toast.error('Stage not available');
      return;
    }
    
    try {
      setSelectedStage(stage);
      setInBattle(true);
      setCurrentRound(1);
      setPlayerHp(100);
      setBattleLog([]);
      
      // Generate enemy
      const generatedEnemy = generateEnemy(stage, 1);
      if (!generatedEnemy) {
        throw new Error('Failed to generate enemy');
      }
      
      // Add initial battle log
      setBattleLog([`Battle started against ${generatedEnemy.name}!`]);
      
    } catch (error) {
      console.error('Battle initialization error:', error);
      toast.error('Failed to start battle');
      setInBattle(false);
      setSelectedStage(null);
      setEnemy(null);
    }
  };

  const getStageRewards = (stage: number, isLastRound: boolean) => {
    const world = getWorldByStage(stage);
    if (!world) return null;

    const worldRewards = STAGE_REWARDS[world.name as keyof typeof STAGE_REWARDS];
    const stageType = getStageType(stage);
    
    if (stageType === 'final' && isLastRound) {
      return { ...worldRewards.final, title: worldRewards.title };
    } else if (stageType === 'boss' && isLastRound) {
      return worldRewards.boss;
    } else if (stage % 5 > 0) {
      return stage % 5 === 1 ? worldRewards.post_boss : worldRewards.normal;
    }
    return worldRewards.normal;
  };

  // Add handleRoundComplete function
  const handleRoundComplete = async () => {
    if (!selectedStage || !profile) return;
    
    const totalRounds = getRoundsForStage(selectedStage);
    const isLastRound = currentRound === totalRounds;
    
    try {
      if (currentRound < totalRounds) {
        // Move to next round
        const nextRound = currentRound + 1;
        setCurrentRound(nextRound);
        
        const newEnemy = generateEnemy(selectedStage, nextRound);
        if (!newEnemy) {
          toast.error('Failed to generate enemy for next round');
          setInBattle(false);
          return;
        }
        
        setBattleLog(prev => [...prev, `Round ${nextRound} begins!`]);
        
      } else {
        // Stage complete
        setBattleLog(prev => [...prev, 'Stage complete!']);
        
        // Update progress first
        const updatedStages = progress?.completed_stages.includes(selectedStage)
          ? progress.completed_stages
          : [...(progress?.completed_stages || []), selectedStage];
        
        const { error: progressError } = await supabase
          .from('player_adventure_progress')
          .update({
            completed_stages: updatedStages,
            current_stage: Math.max(selectedStage + 1, progress?.current_stage || 1)
          })
          .eq('profile_id', profile.id);
        
        if (progressError) throw progressError;

        // Get rewards
        const rewards = getStageRewards(selectedStage, true);
        if (!rewards) return;

        // Update player stats
        const { error: statsError } = await supabase
          .from('profiles')
          .update({
            zgold: profile.zgold + rewards.zgold,
            exp: profile.exp + rewards.exp
          })
          .eq('id', profile.id);

        if (statsError) throw statsError;

        // Handle title if this is a world completion
        const world = getWorldByStage(selectedStage);
        if (world && selectedStage === world.stageRange.end && rewards.title) {
          try {
            // Get title ID
            const { data: titleData } = await supabase
              .from('titles')
              .select('id')
              .eq('name', rewards.title)
              .single();

            if (titleData) {
              // Check if player already has this title
              const { data: existingTitle } = await supabase
                .from('player_titles')
                .select('id')
                .match({ profile_id: profile.id, title_id: titleData.id })
                .maybeSingle();

              // Only insert if player doesn't have the title
              if (!existingTitle) {
                await supabase
                  .from('player_titles')
                  .upsert({
                    profile_id: profile.id,
                    title_id: titleData.id,
                    is_equipped: false
                  })
                  .select()
                  .single();
              }
            }
          } catch (titleError) {
            // Log title error but don't throw - allow rewards to still be claimed
            console.warn('Title award error:', titleError);
          }
        }

        // Show rewards popup
        setCurrentRewards(rewards);
        setShowRewards(true);
        setInBattle(false);

        // Update local state
        setProgress(prev => prev ? {
          ...prev,
          completed_stages: updatedStages,
          current_stage: Math.max(selectedStage + 1, prev.current_stage)
        } : null);

        toast.success('Stage completed!');
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      toast.error('Failed to save progress');
      setInBattle(false);
    }
  };

  // Update attack function
  const attack = async () => {
    if (!enemy || !profile || playerHp <= 0) return;

    try {
      // Player attack animation
      setIsAttacking(true);
      const playerDamage = Math.max(profile.strength, 0);
      const newEnemyHp = Math.max(0, enemy.hp - playerDamage);
      
      setBattleLog(prev => [...prev, `You dealt ${playerDamage} damage to ${enemy.name}!`]);
      setEnemy({ ...enemy, hp: newEnemyHp });

      await new Promise(resolve => setTimeout(resolve, 500));
      setIsAttacking(false);

      // Check if enemy is defeated
      if (newEnemyHp <= 0) {
        setBattleLog(prev => [...prev, `${enemy.name} has been defeated!`]);
        await handleRoundComplete();
        return;
      }

      // Enemy attack animation
      setEnemyAttacking(true);
      const enemyDamage = Math.max(enemy.attack, 0);
      const newPlayerHp = Math.max(0, playerHp - enemyDamage);
      
      setBattleLog(prev => [...prev, `${enemy.name} dealt ${enemyDamage} damage to you!`]);
      setPlayerHp(newPlayerHp);

      await new Promise(resolve => setTimeout(resolve, 500));
      setEnemyAttacking(false);

      // Check if player is defeated
      if (newPlayerHp <= 0) {
        setBattleLog(prev => [...prev, 'You have been defeated!']);
        toast.error('Battle lost!');
        setInBattle(false);
      }

    } catch (error) {
      console.error('Attack error:', error);
      toast.error('Error during attack');
    }
  };

  // Update usePotion function
  const usePotion = async (potion: InventoryItem) => {
    if (!profile || playerHp >= 100 || !potion.game_items) return;

    try {
      // Update potion in database first
      const newQuantity = potion.quantity - 1;
      
      if (newQuantity >= 0) {
        const { error: updateError } = await supabase
          .from('player_inventory')
          .update({ quantity: newQuantity })
          .eq('id', potion.id);

        if (updateError) throw updateError;

        // If quantity becomes 0, delete the inventory item
        if (newQuantity === 0) {
          const { error: deleteError } = await supabase
            .from('player_inventory')
            .delete()
            .eq('id', potion.id);

          if (deleteError) throw deleteError;
        }

        // Update local state
        const healAmount = potion.game_items.name.includes('Big') ? 50 : 15;
        const newHp = Math.min(100, playerHp + healAmount);
        
        setPlayerHp(newHp);
        setBattleLog(prev => [...prev, `Used ${potion.game_items!.name} and recovered ${healAmount} HP!`]);
        
        // Update potions state
        setPotions(prev => 
          prev.map(p => 
            p.id === potion.id 
              ? { ...p, quantity: newQuantity }
              : p
          ).filter(p => p.quantity > 0)
        );

        // Refresh potions data
        await loadPotions(profile.id);

      } else {
        toast.error('Not enough potions');
      }
    } catch (error) {
      console.error('Error using potion:', error);
      toast.error('Failed to use potion');
    }
  };

  // Add renderPotions function
  const renderPotions = () => {
    if (potions.length === 0) {
      return <p className="text-gray-400 text-xs">No potions available</p>;
    }

    return potions
      .filter(potion => potion.game_items !== null)
      .map((potion) => (
        <button
  key={potion.id}
  onClick={() => usePotion(potion)}
  disabled={playerHp >= 100 || loading}
  className="flex-shrink-0 bg-green-900/30..."
>
          <img
            src={potion.game_items!.image_url}
            alt={potion.game_items!.name}
            className="w-6 h-6 mx-auto mb-1"
          />
          <p className="text-xs font-medium text-white text-center">
            {potion.game_items!.name.includes('Big') ? 'Big' : 'Small'}
          </p>
          <p className="text-xs text-gray-300 text-center">
            x{potion.quantity}
          </p>
        </button>
      ));
  };


  if (inBattle) {

    if (!enemy || !selectedStage || !profile) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-red-900/30 backdrop-blur-sm border border-red-700 rounded-lg p-6">
              <h3 className="text-white text-lg font-bold">Error Starting Battle</h3>
              <p className="text-gray-300 mt-2">Failed to initialize battle data.</p>
              <button
                onClick={() => {
                  setInBattle(false);
                  setSelectedStage(null);
                  setEnemy(null);
                }}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
              >
                Return to Map
              </button>
            </div>
          </div>
        </div>
      );
    }

    const world = getWorldByStage(selectedStage);
    if (!world) {
      setInBattle(false);
      setSelectedStage(null);
      setEnemy(null);
      return null;
    }
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Battle Header */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center text-white">
              <div>
                <h2 className="text-xl font-bold">{world?.name || 'Unknown World'}</h2>
                <p>Stage {selectedStage} - Round {currentRound}/{getRoundsForStage(selectedStage)}</p>
              </div>
              <button
                onClick={() => setInBattle(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retreat
              </button>
            </div>
          </div>

          {/* Battle Arena */}
          <div
            className="relative w-full max-w-4xl mx-auto rounded-xl overflow-hidden mb-8 p-4"
            style={{
              backgroundImage: `url(${world.background})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="rpg-card-light w-full max-w-md mx-auto bg-black/60 backdrop-blur-sm rounded-xl p-4">
              {/* Characters */}
              <div className="flex justify-between items-center mb-4">
                {/* Player */}
                <div className="flex flex-col items-center w-1/2">
                  <motion.div
                                      animate={{ x: isAttacking ? [0, 20, 0] : 0 }}
                                      transition={{ duration: 0.5 }}
                                      className="mb-2"
                                    >
                                      <img
                                        src={GAME_ASSETS.getCharacterImage(profile.character_type as 'male' | 'female', equippedCostume)}
                                        alt="Player"
                                        className="w-20 h-20 object-contain"
                                      />
                                    </motion.div>
                  <p className="text-white text-sm font-bold">{profile.username}</p>
                </div>

                {/* Enemy */}
                <div className="flex flex-col items-center w-1/2">
                  <motion.div
                    animate={{
                      x: enemy.hp === 0 ? 0 : -20,
                      opacity: enemy.hp === 0 ? 0 : 1,
                    }}
                    transition={{ duration: 0.5 }}
                    className="mb-2"
                  >
                    <img
                      src={enemy.image}
                      alt={enemy.name}
                      className="w-20 h-20 object-contain rounded-lg"
                    />
                  </motion.div>
                  <p className="text-white text-sm font-bold">{enemy.name}</p>
                </div>
              </div>

              {/* Status Bars */}
              <div className="flex justify-between">
                {/* Player Status */}
                <div className="w-1/2 pr-2">
                  <div className="flex justify-between text-xs text-white mb-1">
                    <span>HP: {playerHp}/100</span>
                    <span>⚔ {profile.strength}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded relative overflow-hidden">
                    <motion.div
                      className={`h-2 rounded ${
                        playerHp > 60 ? 'bg-green-500' :
                        playerHp > 30 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      animate={{ width: `${playerHp}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* Enemy Status */}
                <div className="w-1/2 pl-2">
                  <div className="flex justify-between text-xs text-white mb-1">
                    <span>HP: {enemy.hp}/{enemy.maxHp}</span>
                    <span>⚔ {enemy.attack}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded relative overflow-hidden">
                    <motion.div
                      className="h-2 bg-red-500 rounded"
                      animate={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Attack Button */}
          <div className="w-full px-4 pb-4 flex justify-center">
            <button
              onClick={attack}
              disabled={playerHp <= 0}
              className="btn-danger w-full max-w-xs transition-all duration-300"
            >
              <Sword className="w-5 h-5 inline-block mr-2" />
              ATTACK
            </button>
          </div>

          {/* Potion Bar */}
          {potions.length > 0 && (
            <div className="max-w-4xl mx-auto mb-4">
              <div className="rpg-card-light p-3">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
                  <Heart className="w-4 h-4 mr-2 text-green-400" />
                  Potions
                </h3>
                <div className="flex gap-2 overflow-x-auto">
                  {renderPotions()}
                </div>
              </div>
            </div>
          )}

          {/* Battle Log */}
          <div className="rpg-card-light p-4 max-w-4xl mx-auto">
            <h4 className="text-white font-bold mb-3">Battle Log</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {battleLog.map((log, index) => (
                <p key={index} className="text-gray-300 text-sm">{log}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Map className="w-8 h-8" />
              Adventure
            </h1>
          </div>
          <button
            onClick={() => navigate('/lobby')}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              viewMode === 'map' 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            <Map className="w-4 h-4" />
            World Map
          </button>
          <button
            onClick={() => setViewMode('stages')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              viewMode === 'stages' 
                ? 'bg-purple-600 text-white' 
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            <Target className="w-4 h-4" />
            Stage List
          </button>
        </div>

{/* Main Content */}
{viewMode === 'map' ? (
  /* World Map View with Detail Frame */
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
    {/* Left Side - World Selection Grid */}
    <div className="lg:col-span-1 grid grid-cols-1 lg:grid-cols-1">
{WORLDS.map((world, index) => {
  const unlocked = isWorldUnlocked(world.id);
  const completedInWorld = progress?.completed_stages.filter(
    stage => stage >= world.stageRange.start && stage <= world.stageRange.end
  ).length || 0;
  const isCompleted = completedInWorld === 10;         
  return (
    <div
      key={world.id}
      className={`relative group cursor-pointer transition-all duration-300 ${
        unlocked ? 'hover:scale-105' : 'opacity-50'
      }`}
      onClick={() => handleWorldClick(world)} 
    >
      <div className={`
        relative overflow-hidden rounded-xl border-2 transition-all duration-300
        ${unlocked 
          ? `border-transparent bg-gradient-to-br ${world.color} ${
              selectedWorld === world.id ? 'ring-4 ring-yellow-400 shadow-2xl' : ''
            }`
          : 'border-gray-600 bg-gray-800'
        }
      `}>
              {/* Single Background with Overlay Content */}
              <div 
                className="h-20 lg:h-20 bg-cover bg-center relative"
                style={{ 
                  backgroundImage: unlocked ? `url(${world.background})` : 'none',
                  backgroundColor: unlocked ? 'transparent' : '#374151'
                }}
              >
                {/* Overlay */}
                <div className={`absolute inset-0 ${
                  unlocked ? 'bg-black/60' : 'bg-gray-700/80'
                }`} />
                
                {/* Lock Icon */}
                {!unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                
                {/* Crown for completed worlds */}
                {isCompleted && (
                  <div className="absolute top-2 right-2">
                    <img src={GAME_ASSETS.complate_adventure} alt="Global Chat" className="w-5 h-5" />
                  </div>
                )}
                
                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-sm lg:text-base font-bold text-white mb-2 drop-shadow-lg">
                    {world.name}
                  </h3>
                  
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className="text-gray-200 drop-shadow">Progress</span>
                    <span className="text-white font-semibold drop-shadow">{completedInWorld}/10</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-black/40 rounded-full h-1.5 backdrop-blur-sm">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        isCompleted ? 'bg-yellow-400' : 'bg-blue-500'
                      }`}
                      style={{ width: `${(completedInWorld / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* World connection line - only on desktop */}
              {index < WORLDS.length - 1 && (
                <div className="absolute -bottom-2 left-1/2 w-0.5 h-4 bg-gradient-to-b from-purple-400 to-transparent transform -translate-x-1/2 hidden lg:block" />
              )}
            </div>
          </div>
        );
      })}
    </div>

    {/* Right Side - Detail Frame */}
    <div className="lg:col-span-2">
      <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-xl p-6 h-full min-h-[600px]">
        {selectedWorld ? (
          <div className="space-y-6">
            {/* Large Image Map */}
            <div className="relative">
              <div 
                className="h-20 bg-cover bg-center rounded-lg relative overflow-hidden"
                style={{ 
                  backgroundImage: `url(${WORLDS.find(w => w.id === selectedWorld)?.background})` || 'none',
                  backgroundColor: '#374151'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                {/* World completion status overlay */}
                {(() => {
                  const world = WORLDS.find(w => w.id === selectedWorld);
                  const completedInWorld = progress?.completed_stages.filter(
                    stage => stage >= world?.stageRange.start && stage <= world?.stageRange.end
                  ).length || 0;
                  const isCompleted = completedInWorld === 10;
                  
                  return isCompleted && (
                    <div className="absolute top-4 right-4">
                      <img src={GAME_ASSETS.complate_adventure} alt="Global Chat" className="w-10 h-10" />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* World Title */}
            <div>
              <h2 className="text-1xl font-bold text-white mb-2">
                {WORLDS.find(w => w.id === selectedWorld)?.name}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-300">
                <span>Stages {WORLDS.find(w => w.id === selectedWorld)?.stageRange.start}-{WORLDS.find(w => w.id === selectedWorld)?.stageRange.end}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${WORLDS.find(w => w.id === selectedWorld)?.color}`} />
                  <span>
                    {(() => {
                      const world = WORLDS.find(w => w.id === selectedWorld);
                      const completedInWorld = progress?.completed_stages.filter(
                        stage => stage >= world?.stageRange.start && stage <= world?.stageRange.end
                      ).length || 0;
                      const isCompleted = completedInWorld === 10;
                      
                      return isCompleted ? '' : `${completedInWorld}/10`;
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* World Description */}
            <div className="bg-slate-700/50 rounded-lg p-2">
              <p className="text-gray-300 text-[8px] leading-relaxed">
                {WORLDS.find(w => w.id === selectedWorld)?.description}
              </p>
            </div>

            {/* Stages Grid */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Stages</h3>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 10 }, (_, i) => {
                  const world = WORLDS.find(w => w.id === selectedWorld);
                  const stageNum = world.stageRange.start + i;
                  const available = isStageAvailable(stageNum);
                  const completed = isStageCompleted(stageNum);
                  const stageType = getStageType(stageNum);
                  
                  return (
                    <button
                      key={stageNum}
                      onClick={() => available && startBattle(stageNum)}
                      disabled={!available}
                      className={`
                        relative p-4 rounded-lg font-bold transition-all duration-300 group hover:scale-105
                        ${completed 
                          ? 'bg-green-600 text-white shadow-lg shadow-green-600/25' 
                          : available 
                            ? stageType === 'final'
                              ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/25'
                              : stageType === 'boss' 
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25'
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }
                      `}
                    >
                      
                      
                      <div className="text-center">
                        <div className="text-xl font-bold">{stageNum}</div>
                        <div className="text-xs opacity-75 mt-1">
                          {stageType === 'final' ? 'Final' : stageType === 'boss' ? 'Boss' : 'Stage'}
                        </div>
                      </div>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {getRoundsForStage(stageNum)} Rounds
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  const world = WORLDS.find(w => w.id === selectedWorld);
                  const nextAvailableStage = Array.from({ length: 10 }, (_, i) => world.stageRange.start + i)
                    .find(stage => isStageAvailable(stage) && !isStageCompleted(stage));
                  if (nextAvailableStage) startBattle(nextAvailableStage);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          /* No World Selected */
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto">
                <Map className="w-10 h-10 text-gray-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Select a World</h3>
                <p className="text-gray-400">Choose a world from the left to view details and stages</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
) : (
  /* Stage List View */
  <div className="grid gap-4">
    {WORLDS.map((world) => {
      const unlocked = isWorldUnlocked(world.id);
      if (!unlocked) return null;
      
      return (
        <div key={world.id} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${world.color}`} />
            <h3 className="text-xl font-bold text-white">{world.name}</h3>
            <span className="text-gray-400">Stages {world.stageRange.start}-{world.stageRange.end}</span>
          </div>
          
          <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
            {Array.from({ length: 10 }, (_, i) => {
              const stageNum = world.stageRange.start + i;
              const available = isStageAvailable(stageNum);
              const completed = isStageCompleted(stageNum);
              const stageType = getStageType(stageNum);
              
              return (
                <button
                  key={stageNum}
                  onClick={() => available && startBattle(stageNum)}
                  disabled={!available}
                  className={`
                    relative p-3 rounded-lg font-bold transition-all duration-300 group
                    ${completed 
                      ? 'bg-green-600 text-white shadow-lg' 
                      : available 
                        ? stageType === 'final'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg'
                          : stageType === 'boss' 
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {/* Stage indicators */}
                  {completed && (
                    <Star className="w-3 h-3 absolute top-0.5 right-0.5 text-yellow-400" />
                  )}
                  {stageType === 'final' && (
                    <Key className="w-3 h-3 absolute top-0.5 left-0.5 text-yellow-400" />
                  )}
                  {stageType === 'boss' && (
                    <Crown className="w-3 h-3 absolute top-0.5 left-0.5 text-yellow-400" />
                  )}
                  
                  <div className="text-center">
                    <div className="text-lg font-bold">{stageNum}</div>
                    <div className="text-xs opacity-75">
                      {stageType === 'final' ? 'Final' : stageType === 'boss' ? 'Boss' : 'Stage'}
                    </div>
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {getRoundsForStage(stageNum)} Rounds
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
)}

{/* Battle View */}
{inBattle && (
  <div className="battle-container">
    {/* ...existing battle code... */}
  </div>
)}

{/* Reward Popup */}
{showRewards && currentRewards && (
  <RewardPopup
    rewards={currentRewards}
    onClose={() => {
      setShowRewards(false);
      setInBattle(false);
      loadData();
    }}
    onClaim={handleClaimRewards}
  />
)}
      </div>
    </div>
  );
};

export default Adventure;
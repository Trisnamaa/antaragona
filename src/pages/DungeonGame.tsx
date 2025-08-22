import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Swords, Heart, Zap, Crown, Star, Trophy, Shield, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';
import { useCostumes } from '../hooks/useCostumes';

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
}

interface Profile {
  id: string;
  username: string;
  character_type: string;
  strength: number;
  ztoken: number;
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
  isBoss: boolean;
  imageUrl: string; 
}

interface DungeonRewards {
  exp_gained: number;
  zgold_gained: number;
  ztoken_gained: number;
  title_awarded: string | null;
  completion_count: number;
  master_title_unlocked: boolean;
}

// Helper function untuk mendapatkan asset NPC berdasarkan dungeon type dan round
const getDungeonAssets = (dungeonName: string, round: number, isBoss: boolean) => {
  // Normalisasi nama dungeon - hapus spasi, ubah ke lowercase, dan cek berbagai kemungkinan nama
  const normalizedName = dungeonName.toLowerCase().trim();
  
  // Debug log untuk melihat nama dungeon yang diterima
  console.log('Dungeon Name:', dungeonName, 'Normalized:', normalizedName);
  
  // Fungsi untuk mendeteksi tipe dungeon berdasarkan nama
  const detectDungeonType = (name: string) => {
    if (name.includes('inferno') || name.includes('fire') || name.includes('flame')) {
      return 'inferno';
    } else if (name.includes('crystal') || name.includes('ice') || name.includes('frozen')) {
      return 'crystal';
    } else if (name.includes('leafy') || name.includes('forest') || name.includes('nature') || name.includes('green')) {
      return 'leafy';
    } else if (name.includes('machine') || name.includes('tech') || name.includes('robot') || name.includes('cyber')) {
      return 'machine';
    }
    return 'inferno'; // default fallback
  };

  const dungeonType = detectDungeonType(normalizedName);
  console.log('Detected Dungeon Type:', dungeonType);
  
  if (isBoss) {
    switch (dungeonType) {
      case 'inferno':
        return {
          npcImage: GAME_ASSETS.npc_infernoBoss,
          background: GAME_ASSETS.inferno_bg1
        };
      case 'crystal':
        return {
          npcImage: GAME_ASSETS.npc_crystalBoss,
          background: GAME_ASSETS.crystal_bg1
        };
      case 'leafy':
        return {
          npcImage: GAME_ASSETS.npc_leafyBoss,
          background: GAME_ASSETS.leafy_bg1
        };
      case 'machine':
        return {
          npcImage: GAME_ASSETS.npc_machineBoss,
          background: GAME_ASSETS.machine_bg1
        };
      default:
        return {
          npcImage: GAME_ASSETS.npc_infernoBoss,
          background: GAME_ASSETS.inferno_bg1
        };
    }
  } else {
    // Regular monsters berdasarkan round (1-4)
    switch (dungeonType) {
      case 'inferno':
        const infernoAssets = [
          GAME_ASSETS.npc_inferno1,
          GAME_ASSETS.npc_inferno2,
          GAME_ASSETS.npc_inferno3,
          GAME_ASSETS.npc_inferno4
        ];
        return {
          npcImage: infernoAssets[round - 1] || GAME_ASSETS.npc_inferno1,
          background: GAME_ASSETS.inferno_bg1
        };
      case 'crystal':
        const crystalAssets = [
          GAME_ASSETS.npc_crystal1,
          GAME_ASSETS.npc_crystal2,
          GAME_ASSETS.npc_crystal3,
          GAME_ASSETS.npc_crystal4
        ];
        return {
          npcImage: crystalAssets[round - 1] || GAME_ASSETS.npc_crystal1,
          background: GAME_ASSETS.crystal_bg1
        };
      case 'leafy':
        const leafyAssets = [
          GAME_ASSETS.npc_leafy1,
          GAME_ASSETS.npc_leafy2,
          GAME_ASSETS.npc_leafy3,
          GAME_ASSETS.npc_leafy4
        ];
        return {
          npcImage: leafyAssets[round - 1] || GAME_ASSETS.npc_leafy1,
          background: GAME_ASSETS.leafy_bg1
        };
      case 'machine':
        const machineAssets = [
          GAME_ASSETS.npc_machine1,
          GAME_ASSETS.npc_machine2,
          GAME_ASSETS.npc_machine3,
          GAME_ASSETS.npc_machine4
        ];
        return {
          npcImage: machineAssets[round - 1] || GAME_ASSETS.npc_machine1,
          background: GAME_ASSETS.machine_bg1
        };
      default:
        return {
          npcImage: GAME_ASSETS.npc_inferno1,
          background: GAME_ASSETS.inferno_bg1
        };
    }
  }
};

export default function DungeonGame() {
  const { dungeonId } = useParams<{ dungeonId: string }>();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [potions, setPotions] = useState<InventoryItem[]>([]);
  const [dungeonType, setDungeonType] = useState<DungeonType | null>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [playerHp, setPlayerHp] = useState(100);
  const [maxPlayerHp] = useState(100);
  const [currentEnemy, setCurrentEnemy] = useState<Enemy | null>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [enemyAttacking, setEnemyAttacking] = useState(false);
  const [gameState, setGameState] = useState<'playing' | 'victory' | 'defeat'>('playing');
  const [showRewards, setShowRewards] = useState(false);
  const [rewards, setRewards] = useState<DungeonRewards | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentBackground, setCurrentBackground] = useState<string>(''); // State untuk background

  const { equippedCostume } = useCostumes(profile?.id || null);

  const TOTAL_ROUNDS = 5;
  const ENEMY_HP = 50;
  const ENEMY_ATTACK = 10;
  const BOSS_HP = 100;
  const BOSS_ATTACK = 35;

  useEffect(() => {
    loadGameData();
    loadPotions();
  }, [dungeonId]);

  useEffect(() => {
    if (currentRound <= TOTAL_ROUNDS && gameState === 'playing' && dungeonType) {
      generateEnemy();
    }
  }, [currentRound, gameState, dungeonType]);

  const loadGameData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, character_type, strength, ztoken')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: dungeonData, error: dungeonError } = await supabase
        .from('dungeon_types')
        .select('*')
        .eq('id', dungeonId)
        .eq('is_active', true)
        .single();

      if (dungeonError) throw dungeonError;
      setDungeonType(dungeonData);

      if (profileData.ztoken < dungeonData.cost_ztoken) {
        toast.error('Not enough ZToken to enter this dungeon!');
        navigate('/lobby');
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ ztoken: profileData.ztoken - dungeonData.cost_ztoken })
        .eq('id', profileData.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, ztoken: prev.ztoken - dungeonData.cost_ztoken } : null);
    } catch (error) {
      console.error('Error loading game data:', error);
      toast.error('Failed to load dungeon data');
      navigate('/lobby');
    } finally {
      setLoading(false);
    }
  };

  const loadPotions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profileData) return;

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
        .eq('profile_id', profileData.id)
        .eq('game_items.type', 'potion');

      if (error) throw error;
      setPotions(inventoryData || []);
    } catch (error) {
      console.error('Error loading potions:', error);
    }
  };

  const usePotion = async (potion: InventoryItem) => {
    if (!profile || playerHp >= maxPlayerHp || gameState !== 'playing') return;

    const healAmount = potion.game_items?.name === 'Big Potion' ? 50 : 15;
    const newHealth = Math.min(maxPlayerHp, playerHp + healAmount);

    try {
      // Update inventory
      if (potion.quantity <= 1) {
        const { error } = await supabase
          .from('player_inventory')
          .delete()
          .eq('id', potion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('player_inventory')
          .update({ quantity: potion.quantity - 1 })
          .eq('id', potion.id);
        if (error) throw error;
      }

      setPlayerHp(newHealth);
      toast.success(`Used ${potion.game_items?.name}! Healed ${healAmount} HP`);
      loadPotions(); // Reload potions
    } catch (error) {
      toast.error('Failed to use potion');
    }
  };

  const generateEnemy = () => {
    if (!dungeonType) return;
    
    const isBoss = currentRound === TOTAL_ROUNDS;
    const assets = getDungeonAssets(dungeonType.name, currentRound, isBoss);
    
    const enemy: Enemy = {
      name: isBoss ? `${dungeonType.name} Boss` : `${dungeonType.name} Guardian`,
      hp: isBoss ? BOSS_HP : ENEMY_HP,
      maxHp: isBoss ? BOSS_HP : ENEMY_HP,
      attack: isBoss ? BOSS_ATTACK : ENEMY_ATTACK,
      isBoss,
      imageUrl: assets.npcImage
    };
    
    setCurrentEnemy(enemy);
    setCurrentBackground(assets.background);
  };

  const handleAttack = async () => {
    if (!profile || !currentEnemy || isAttacking || enemyAttacking || gameState !== 'playing') return;

    // Set both attacking simultaneously
    setIsAttacking(true);
    setEnemyAttacking(true);

    // Calculate damage for both
    const playerDamage = profile.strength;
    const enemyDamage = currentEnemy.attack;
    
    // Calculate new HP values
    const newEnemyHp = Math.max(0, currentEnemy.hp - playerDamage);
    const newPlayerHp = Math.max(0, playerHp - enemyDamage);

    // Show simultaneous attack animation
    await new Promise(resolve => setTimeout(resolve, 800));

    // Apply damage simultaneously
    setCurrentEnemy(prev => prev ? { ...prev, hp: newEnemyHp } : null);
    setPlayerHp(newPlayerHp);

    // Reset attacking states
    setIsAttacking(false);
    setEnemyAttacking(false);

    // Small delay to show the damage applied
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check victory/defeat conditions
    const enemyDefeated = newEnemyHp <= 0;
    const playerDefeated = newPlayerHp <= 0;

    // Handle simultaneous defeat (player wins if both die - player gets the kill)
    if (enemyDefeated && playerDefeated) {
      toast.success('Victory! You defeated the enemy with your final strike!');
      if (currentRound < TOTAL_ROUNDS) {
        setCurrentRound(prev => prev + 1);
        setPlayerHp(maxPlayerHp); // Heal player for next round
        toast.success(`Round ${currentRound} completed! HP restored!`);
      } else {
        setGameState('victory');
        await completeDungeon(true);
      }
      return;
    }

    // Handle enemy defeated only
    if (enemyDefeated) {
      if (currentRound < TOTAL_ROUNDS) {
        setCurrentRound(prev => prev + 1);
        toast.success(`Round ${currentRound} completed!`);
      } else {
        setGameState('victory');
        await completeDungeon(true);
      }
      return;
    }

    // Handle player defeated only
    if (playerDefeated) {
      setGameState('defeat');
      await completeDungeon(false);
      return;
    }

    // Continue battle if both are still alive
  };

  const completeDungeon = async (isVictory: boolean) => {
    if (!profile || !dungeonType) return;

    try {
      const { data, error } = await supabase.rpc('complete_dungeon', {
        player_profile_id: profile.id,
        dungeon_type_id: dungeonType.id,
        rounds_completed: currentRound,
        is_victory: isVictory
      });

      if (error) throw error;

      if (isVictory) {
        setRewards(data);
        setShowRewards(true);
        
        if (data.title_awarded) {
          toast.success(`New title unlocked: ${data.title_awarded}!`);
        }
      }
    } catch (error) {
      console.error('Error completing dungeon:', error);
      toast.error('Failed to save dungeon results');
    }
  };

  const handleReturnToLobby = () => {
    navigate('/lobby');
  };

  if (loading) {
    return (
      <div className="min-h-screen rpg-bg flex items-center justify-center">
        <div className="rpg-card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-white">Loading Dungeon...</div>
        </div>
      </div>
    );
  }

  if (!profile || !dungeonType) return null;

  return (
    <div className="min-h-screen rpg-bg">
      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
  {/* Tombol kembali */}
  <button onClick={handleReturnToLobby} className="btn-secondary w-10 h-10 flex items-center justify-center">
    <ArrowLeft className="w-5 h-5" />
  </button>

  {/* Judul Dungeon */}
  <h2 className="flex-1 text-center font-bold text-white text-sm whitespace-nowrap overflow-hidden text-ellipsis px-2">
    {dungeonType.name} - Round {currentRound}/{TOTAL_ROUNDS}
  </h2>

  <div className="w-10 h-10"></div>
</div>

        {/* Battle Arena */}
        <div className="max-w-4xl mx-auto">
          <div
            className="relative w-full max-w-4xl mx-auto rounded-xl overflow-hidden mb-8 p-4"
            style={{
              backgroundImage: `url(${currentBackground})`, // Gunakan background dinamis
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {/* Konten dibungkus rpg-card-light dan tidak full */}
            <div className="rpg-card-light w-full max-w-md mx-auto bg-black/60 backdrop-blur-sm rounded-xl p-4">
              {/* Karakter */}
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
                </div>

                {/* NPC */}
                <div className="flex flex-col items-center w-1/2">
                  <motion.div
                    animate={{
                      x: enemyAttacking ? [0, -20, 0] : 0,
                      opacity: currentEnemy?.hp === 0 ? 0 : 1,
                    }}
                    transition={{ duration: 0.5 }}
                    className={`mb-2 ${currentEnemy?.isBoss ? 'scale-110 border-red-300 rpg-glow-red' : ''}`}
                  >
                    <img
                      src={currentEnemy?.imageUrl || dungeonType.image_url} // Gunakan imageUrl dari enemy
                      alt="Enemy"
                      className="w-20 h-20 object-contain rounded-lg" // Ubah ke object-contain untuk asset NPC
                    />
                  </motion.div>
                </div>
              </div>

              {/* Status */}
              <div className="flex justify-between">
                {/* Player Status */}
                <div className="w-1/2 pr-2">
                  <div className="flex justify-between text-xs text-white mb-1">
                    <span>HP: {playerHp}/{maxPlayerHp}</span>
                    <span>⚔ {profile.strength}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded relative overflow-hidden">
                    <motion.div
                      className={`h-2 rounded ${
                        playerHp > 60 ? 'bg-green-500' :
                        playerHp > 30 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      animate={{ width: `${(playerHp / maxPlayerHp) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                    {/* Damage flash effect */}
                    {enemyAttacking && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.8, 0] }}
                        transition={{ duration: 0.8 }}
                        className="absolute inset-0 bg-red-500 rounded"
                      />
                    )}
                  </div>
                </div>

                {/* Enemy Status */}
                <div className="w-1/2 pl-2">
                  <div className="flex justify-between text-xs text-white mb-1">
                    <span>HP: {currentEnemy?.hp}/{currentEnemy?.maxHp}</span>
                    <span>⚔ {currentEnemy?.attack}</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded relative overflow-hidden">
                    <motion.div
                      className="h-2 bg-red-500 rounded"
                      animate={{ width: `${(currentEnemy?.hp || 0) / (currentEnemy?.maxHp || 1) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                    {/* Damage flash effect */}
                    {isAttacking && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.8, 0] }}
                        transition={{ duration: 0.8 }}
                        className="absolute inset-0 bg-blue-500 rounded"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tombol ATTACK */}
          <div className="w-full px-4 pb-4 flex justify-center">
            {gameState === 'playing' ? (
              <button
                onClick={handleAttack}
                disabled={isAttacking || enemyAttacking || playerHp <= 0}
                className={`btn-danger w-full max-w-xs transition-all duration-300 ${
                  (isAttacking && enemyAttacking) ? 'scale-110 shadow-lg' : ''
                }`}
              >
                {(isAttacking && enemyAttacking) ? 'CLASHING...' : 'ATTACK'}
              </button>
            ) : (
              <button
                onClick={handleReturnToLobby}
                className="btn-primary w-full max-w-xs"
              >
                Return to Lobby
              </button>
            )}
          </div>
        </div>

        {/* Potion Bar */}
        <div className="max-w-4xl mx-auto mb-4">
          <div className="rpg-card-light p-3">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center">
              <Plus className="w-4 h-4 mr-2 text-green-400" />
              Potions
            </h3>
            <div className="flex gap-2 overflow-x-auto">
              {potions.length > 0 ? (
                potions.filter(potion => potion.game_items !== null).map((potion) => (
                  <button
                    key={potion.id}
                    onClick={() => usePotion(potion)}
                    disabled={playerHp >= maxPlayerHp || gameState !== 'playing'}
                    className="flex-shrink-0 rpg-card-light p-2 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <img
                      src={potion.game_items!.image_url}
                      alt={potion.game_items!.name}
                      className="w-6 h-6 mx-auto mb-1"
                    />
                    <p className="text-xs font-medium text-white text-center">
                      {potion.game_items!.name === 'Big Potion' ? 'Big' : 'Small'}
                    </p>
                    <p className="text-xs text-gray-300 text-center">
                      x{potion.quantity}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-gray-400 text-xs">No potions available</p>
              )}
            </div>
          </div>
        </div>

        {/* Victory/Defeat Modal */}
        <AnimatePresence>
          {gameState !== 'playing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="rpg-card max-w-md w-full mx-4 text-center"
              >
                <div className={`text-4xl font-bold mb-6 ${
                  gameState === 'victory' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {gameState === 'victory' ? 'Victory!' : 'Defeat!'}
                </div>
                
                 {gameState === 'victory' && rewards && (
                  <div className="space-y-4 mb-4 w-full max-w-sm mx-auto">
  {/* Judul */}
  <div className="rpg-card-accent px-4 py-3 text-center">
    <Trophy className="w-12 h-12 mx-auto mb-1 text-yellow-500" />
    <div className="font-semibold text-white text-base">Dungeon Completed!</div>
  </div>

  {/* Reward Grid */}
  <div className="grid grid-cols-2 gap-3">
    <div className="rpg-card-light flex items-center justify-center p-2 text-sm">
      <img src={GAME_ASSETS.EXP} alt="EXP" className="w-6 h-5" />
      <span className="font-semibold">+{rewards.exp_gained} EXP</span>
    </div>
    <div className="rpg-card-light flex items-center justify-center p-2 text-sm">
      <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-5 h-5 mr-1" />
      <span className="font-semibold">
        +{rewards.zgold_gained.toLocaleString()}
      </span>
    </div>
    <div className="rpg-card-light col-span-2 flex items-center justify-center p-2 text-sm">
      <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-5 h-5 mr-1" />
      <span className="font-semibold">+{rewards.ztoken_gained}</span>
    </div>
  </div>

  {/* Title Unlocked */}
  {rewards.title_awarded && (
    <div className="rpg-card-accent text-center px-4 py-3">
      <Crown className="w-10 h-10 mx-auto mb-1 text-yellow-400" />
      <div className="text-yellow-400 font-bold text-sm mb-1">
        New Title Unlocked!
      </div>
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 px-3 py-1 rounded-lg font-bold text-sm">
        {rewards.title_awarded}
      </div>
    </div>
  )}

  {/* Total Completion Progress Bar */}
<div className="rpg-card-light p-2 text-sm">
  <div className="flex items-center justify-between mb-1">
    <span className="font-semibold text-white">
      Total Completions: {rewards.completion_count}
    </span>
    <span className="text-xs text-gray-300">
      {Math.min(rewards.completion_count, 100)}%
    </span>
  </div>
  <div className="w-full bg-gray-700 rounded-full h-2">
    <div 
      className="bg-blue-500 h-2 rounded-full" 
      style={{ width: `${Math.min(rewards.completion_count, 100)}%` }}
    ></div>
  </div>
</div>
</div>

                )}
                {gameState === 'defeat' && (
                  <div className="mb-6">
                    <div className="rpg-card-light p-6">
                      <Swords className="w-16 h-16 mx-auto mb-2 text-gray-500" />
                      <div className="font-bold text-white">No Rewards</div>
                      <div className="text-gray-300 text-sm mt-2">
                        You must complete all 5 rounds to earn rewards
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleReturnToLobby}
                  className="btn-primary w-full"
                >
                  Return to Lobby
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
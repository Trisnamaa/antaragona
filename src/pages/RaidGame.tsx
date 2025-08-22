import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Swords, 
  Heart, 
  Zap, 
  Crown, 
  Star, 
  Trophy, 
  Shield, 
  Plus,
  Users,
  Target,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';
import { useCostumes } from '../hooks/useCostumes';
import { RaidCardRewards } from '../components/RaidCardRewards';
import { useRaid, RaidRoom, RaidParticipant } from '../hooks/useRaid'; // Import hook and types

interface Profile {
  id: string;
  username: string;
  character_type: string;
  strength: number;
}

interface Boss {
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  round: number;
  imageUrl: string;
}

export default function RaidGame() {
  const { roomUuid } = useParams<{ roomUuid: string }>();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Centralized state management with useRaid hook
  const {
    currentRoom,
    participants,
    loadRoomData,
    markRewardsAsClaimed,
    generateCardRewards,
    getCardPool,
    checkPlayerSelections
  } = useRaid(profile?.id || null);

  const [currentBoss, setCurrentBoss] = useState<Boss | null>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isTransitioningRound, setIsTransitioningRound] = useState(false);
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'victory' | 'defeat'>('loading');
  const [cardRewards, setCardRewards] = useState<any>(null);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const { equippedCostume } = useCostumes(profile?.id || null);

  // Navigation handler - moved to top level
  const handleReturnToLobby = useCallback(() => {
    navigate('/lobby');
  }, [navigate]);

  // Memoized card rewards modal - moved to top level to follow Rules of Hooks
  const cardRewardsModal = useMemo(() => {
    const shouldShowRewards = gameState === 'victory' && cardRewards;
    
    if (shouldShowRewards) {
      return (
        <RaidCardRewards
          isOpen={true}
          profile={profile}
          cardRewards={cardRewards}
          participants={participants}
          onComplete={handleReturnToLobby}
          markRewardsAsClaimed={markRewardsAsClaimed}
          roomUuid={currentRoom?.room_uuid}
        />
      );
    }
    
    return null;
  }, [gameState, cardRewards, profile, participants, handleReturnToLobby, markRewardsAsClaimed, currentRoom?.room_uuid]);

  const BOSS_DATA = [
    { name: 'Shadow Minion', hp: 150, attack: 25 },
    { name: 'Dark Guardian', hp: 200, attack: 35 },
    { name: 'Shadow Harbinger', hp: 300, attack: 50 }
  ];

  // Initial data load for the current user
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, character_type, strength')
          .eq('user_id', user.id)
          .single();
        if (profileError) throw profileError;
        setProfile(profileData);
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load your profile.');
        navigate('/lobby');
      }
    };
    fetchProfile();
  }, [navigate]);

  // Once profile is loaded, load the room data via the hook
  useEffect(() => {
    if (profile && roomUuid) {
      console.log(`[Raid Room: ${roomUuid}] Profile loaded. Loading room data.`);
      loadRoomData(roomUuid).then(() => {
        setIsInitialLoading(false);
      });
    }
  }, [profile, roomUuid, loadRoomData]);

  // Cleanup function to reset state when component unmounts or room changes
  useEffect(() => {
    return () => {
      // Reset states when component unmounts
      setCardRewards(null);
      setGameState('loading');
      setIsAttacking(false);
      setIsTransitioningRound(false);
      setActionLog([]);
      setCurrentBoss(null);
    };
  }, [roomUuid]);

  // Reset states when room changes
  useEffect(() => {
    if (roomUuid) {
      setCardRewards(null);
      setGameState('loading');
      setIsAttacking(false);
      setIsTransitioningRound(false);
      setActionLog([]);
      setCurrentBoss(null);
    }
  }, [roomUuid]);

  // Game state machine based on the room status from the hook
  useEffect(() => {
    if (isInitialLoading) {
      setGameState('loading');
      return;
    }

    if (!currentRoom) {
      toast.error("Raid room not found.");
      navigate('/lobby');
      return;
    }
    
    // Only log once when status changes to prevent spam
    if (process.env.NODE_ENV === 'development') {
      console.log(`[RaidGame] Room Status: ${currentRoom.status}, Round: ${currentRoom.current_round}`);
    }

    switch (currentRoom.status) {
      case 'in_progress':
        setGameState('playing');
        // Always regenerate boss when round changes or boss doesn't exist
        if (!currentBoss || currentRoom.current_round !== currentBoss.round) {
          generateBoss(currentRoom);
          setIsTransitioningRound(false);
        }
        // Update existing boss HP if it exists
        if (currentBoss && currentRoom.current_round === currentBoss.round) {
          setCurrentBoss(prev => prev ? {
            ...prev,
            hp: currentRoom.boss_hp || prev.hp,
            maxHp: currentRoom.boss_max_hp || prev.maxHp
          } : null);
        }
        break;
      case 'completed':
        // Check if it's victory or defeat based on participants status
        const aliveParticipants = participants.filter(p => p.is_alive);
        
        if (aliveParticipants.length > 0 && gameState !== 'victory') {
          console.log(`[RaidGame] VICTORY! Setting game state to 'victory'`);
        setGameState('victory');
        completeRaid(true);
        } else if (aliveParticipants.length === 0 && gameState !== 'defeat') {
          console.log(`[RaidGame] DEFEAT! Setting game state to 'defeat'`);
          setGameState('defeat');
          completeRaid(false);
        }
        break;
      case 'waiting':
        toast.error("Raid has not started yet.");
        navigate('/lobby');
        break;
      default:
        setGameState('loading');
    }
  }, [currentRoom?.status, currentRoom?.current_round, currentRoom?.boss_hp, currentRoom?.boss_max_hp, participants, isInitialLoading, navigate, roomUuid, gameState]);

  const generateBoss = (roomData: RaidRoom) => {
    console.log(`[Raid Room: ${roomUuid}] Generating boss for round ${roomData.current_round}, HP: ${roomData.boss_hp}/${roomData.boss_max_hp}`);
    const bossData = BOSS_DATA[roomData.current_round - 1];
    const difficultyMultiplier = 1 + (roomData.raid_maps.difficulty_level - 1) * 0.5;
    
    // Use room's boss HP if available, otherwise calculate default
    const bossHp = roomData.boss_hp !== null ? roomData.boss_hp : Math.floor(bossData.hp * difficultyMultiplier);
    const bossMaxHp = roomData.boss_max_hp !== null ? roomData.boss_max_hp : Math.floor(bossData.hp * difficultyMultiplier);
    
    const boss: Boss = {
      name: bossData.name,
      hp: bossHp,
      maxHp: bossMaxHp,
      attack: Math.floor(bossData.attack * difficultyMultiplier),
      round: roomData.current_round,
      imageUrl: roomData.raid_maps.boss_image_url || 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752079455935-tzjifn.png' // Placeholder
    };
    
    setCurrentBoss(boss);
    addToActionLog(`Round ${roomData.current_round}: ${boss.name} appears! (${boss.hp}/${boss.maxHp} HP)`);
  };

  const addToActionLog = (message: string) => {
    setActionLog(prev => [...prev.slice(-4), message]); // Keep last 5 messages
  };

  const handleAttack = async () => {
    if (!profile || !currentRoom || isAttacking || !isMyTurn()) {
      return;
    }

    console.log(`[Raid Room: ${roomUuid}] ${profile.username} is attacking boss! Current turn: ${currentRoom.current_turn}`);
    setIsAttacking(true);

    try {
      const { data: attackResult, error } = await supabase.rpc('handle_raid_attack', {
        p_room_uuid: currentRoom.room_uuid,
        p_profile_id: profile.id
      });

      if (error) {
        console.error('Attack error:', error);
        throw error;
      }

      if (attackResult && !attackResult.success) {
        toast.error(attackResult.message);
        return;
      }
      
      if (attackResult && attackResult.success) {
        console.log(`[Raid Room: ${roomUuid}] Attack result:`, attackResult);
        
        // Add to action log
        addToActionLog(`${profile.username} deals ${attackResult.player_damage} damage!`);
        
        if (attackResult.boss_damage) {
          addToActionLog(`Boss counter-attacks for ${attackResult.boss_damage} damage!`);
        }
        
        if (attackResult.round_completed) {
          addToActionLog(`Round ${attackResult.current_round} completed!`);
          if (attackResult.next_round) {
            addToActionLog(`Advancing to Round ${attackResult.next_round}...`);
            setIsTransitioningRound(true);
            // Reset transition state after a delay
            setTimeout(() => {
              setIsTransitioningRound(false);
            }, 2000);
          }
        }
        
        if (attackResult.raid_completed) {
          addToActionLog('RAID COMPLETED! Victory!');
        }
        
        if (attackResult.raid_failed) {
          addToActionLog('All players defeated! RAID failed!');
        }
        
        if (attackResult.player_defeated) {
          addToActionLog(`${profile.username} was defeated!`);
        }
      }
      
      // Real-time subscription will handle UI updates
    } catch (error) {
      console.error('Error during attack:', error);
      toast.error('An error occurred during the attack.');
    } finally {
      setIsAttacking(false);
    }
  };

  const completeRaid = useCallback(async (isVictory: boolean) => {
    if (!currentRoom) {
      console.error(`[RaidGame] completeRaid: currentRoom is null`);
      return;
    }


    console.log(`[RaidGame] completeRaid called - Victory: ${isVictory}, Room: ${currentRoom.room_uuid}`);

    try {
      if (isVictory) {
        // Generate card rewards using the new system
        console.log(`[RaidGame] Generating card rewards for victory...`);
        
        const rewardData = await generateCardRewards(currentRoom.room_uuid);
        
        if (rewardData && rewardData.success) {
          console.log(`[RaidGame] Card rewards generated successfully:`, rewardData);
          setCardRewards(rewardData.rewards);
          
          // Show success message with completion info
          if (rewardData.master_title_unlocked) {
            toast.success(`🎉 Master Title Unlocked: ${rewardData.title_name}! 🎉`);
          } else {
            toast.success(`Raid completed! Progress: ${rewardData.completion_count}/50`);
          }
        } else {
          console.error(`[RaidGame] Failed to generate card rewards`);
          toast.error('Failed to generate rewards');
        }
      } else {
        // For defeat, just show defeat message and auto-return to lobby
        console.log(`[RaidGame] Defeat! Auto-returning to lobby in 3 seconds...`);
        
        // Auto-return to lobby after 3 seconds for defeat
        setTimeout(() => {
          navigate('/lobby');
        }, 3000);
      }
    } catch (error) {
      console.error('Error in completeRaid:', error);
      toast.error('Failed to complete raid');
      
      // Fallback: return to lobby on error
      setTimeout(() => {
        navigate('/lobby');
      }, 2000);
    }
  }, [currentRoom, cardRewards, navigate, profile?.id]);

  // Fallback function to generate rewards if RPC fails
  const generateFallbackRewards = () => {
    console.log(`[RaidGame] Generating fallback rewards...`);
    
    const rewardTypes = ['raid_ticket', 'ztoken', 'exp', 'zgold'];
    const rewards = [];
    
    for (let i = 1; i <= 6; i++) {
      const randomType = rewardTypes[Math.floor(Math.random() * rewardTypes.length)];
      let value = 100;
      
      switch (randomType) {
        case 'raid_ticket':
          value = 1;
          break;
        case 'ztoken':
          value = 50 + Math.floor(Math.random() * 100);
          break;
        case 'exp':
          value = 200 + Math.floor(Math.random() * 300);
          break;
        case 'zgold':
          value = 500 + Math.floor(Math.random() * 1000);
          break;
      }
      
      rewards.push({
        id: i,
        type: randomType,
        value: value,
        claimed: false
      });
    }
    
    console.log(`[RaidGame] Fallback rewards generated:`, rewards);
    return rewards;
  };

  const getCurrentTurnPlayer = () => {
    if (!currentRoom || !participants.length) return null;
    
    // Filter only alive participants and sort by slot_number
    const aliveParticipants = participants
      .filter(p => p.is_alive)
      .sort((a, b) => a.slot_number - b.slot_number);
    
    if (aliveParticipants.length === 0) return null;
    
    // Get current turn player based on turn index
    const turnIndex = currentRoom.current_turn % aliveParticipants.length;
    return aliveParticipants[turnIndex];
  };

  const isMyTurn = () => {
    const currentTurnPlayer = getCurrentTurnPlayer();
    return currentTurnPlayer?.profile_id === profile?.id;
  };

  if (gameState === 'loading' || !profile || !currentRoom) {
    return (
      <div className="min-h-screen rpg-bg flex items-center justify-center">
        <div className="rpg-card p-8 text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white">Loading Battlefield...</h2>
          <p className="text-gray-300 mt-2">Synchronizing with the team...</p>
        </div>
      </div>
    );
  }

  const currentTurnPlayer = getCurrentTurnPlayer();

  return (
    <div className="min-h-screen rpg-bg">
      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleReturnToLobby} className="btn-secondary">
            <ArrowLeft className="w-5 h-5 mr-2" />
          </button>
          <h2 className="text-xl font-bold text-white text-center">
            {currentRoom.raid_maps.name}
          </h2>
          <div className="w-32"></div>
        </div>

        {/* Turn Indicator */}
        {gameState === 'playing' && currentTurnPlayer && (
          <div className="mb-4">
            <div className={`rpg-card-accent p-3 text-center ${
              isMyTurn() ? 'rpg-glow border-2 border-yellow-400' : ''
            }`}>
              <h3 className="font-bold text-white">
                {isMyTurn() ? '🎯 YOUR TURN!' : `${currentTurnPlayer.profiles.username}'s Turn`}
              </h3>
              <p className="text-gray-300 text-sm">
                {isMyTurn() ? 'Click ATTACK to strike the boss!' : 'Wait for your turn...'}
              </p>
              <p className="text-purple-300 text-xs mt-1">
                Round {currentRoom.current_round}/3 • Turn {currentRoom.current_turn + 1}
              </p>
            </div>
          </div>
        )}

        {/* Battle Arena */}
        <div className="max-w-6xl mx-auto">
          <div
            className="relative w-full rounded-xl overflow-hidden mb-6 p-6"
            style={{
              backgroundImage: `url(${currentRoom.raid_maps.background_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
           <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 sm:p-6">
  {/* Team vs Boss - Tetap horizontal di semua ukuran layar */}
  <div className="grid grid-cols-2 gap-4 sm:gap-8 items-center">
    {/* Team Side */}
    <div>
      <h3 className="text-sm sm:text-lg font-bold text-white mb-2 sm:mb-4 flex items-center">
        <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-blue-400" />
        Team
      </h3>
      <div className="space-y-2 sm:space-y-3">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-all ${
              participant.is_alive 
                ? currentTurnPlayer?.profile_id === participant.profile_id
                  ? 'bg-yellow-900/30 border border-yellow-500/50 shadow-md'
                  : 'bg-green-900/30 border border-green-500/30'
                : 'bg-red-900/30 border border-red-500/30 opacity-50'
            }`}
          >
            <img
              src={GAME_ASSETS.getCharacterImage(
                participant.profiles.character_type as 'male' | 'female',
                participant.profile_id === profile.id ? equippedCostume : null
              )}
              alt={participant.profiles.username}
              className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-xs sm:text-sm flex items-center gap-1 sm:gap-2 truncate">
                {participant.profiles.username}
                {participant.profile_id === profile.id && (
                  <span className="text-purple-400 whitespace-nowrap">(You)</span>
                )}
                {currentTurnPlayer?.profile_id === participant.profile_id && (
                  <span className="text-yellow-400">⚡</span>
                )}
              </div>
              <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs">
                <div className="flex items-center gap-1">
                  <Heart className="w-2 h-2 sm:w-3 sm:h-3 text-red-400" />
                  <span>{participant.current_hp}/{participant.max_hp}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-2 h-2 sm:w-3 sm:h-3 text-orange-400" />
                  <span>{participant.profiles.strength}</span>
                </div>
              </div>
              {/* HP Bar */}
              <div className="w-full bg-gray-700 rounded-full h-1.5 sm:h-2 mt-1">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    participant.current_hp > 60 ? 'bg-green-500' :
                    participant.current_hp > 30 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${(participant.current_hp / participant.max_hp) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Boss Side */}
    <div className="text-center">
      <h3 className="text-sm sm:text-lg font-bold text-white mb-2 sm:mb-4 flex items-center justify-center">
        {currentBoss?.name}
      </h3>
      {currentBoss && (
        <div>
          <motion.img
            src={currentBoss.imageUrl}
            alt={currentBoss.name}
            className="w-20 h-20 sm:w-32 sm:h-32 object-contain mx-auto mb-2 sm:mb-4 rounded-lg border-2 border-red-900/50"
            animate={{
              scale: isAttacking ? [1, 1.1, 1] : 1,
            }}
            transition={{ duration: 0.5 }}
          />
          <div className="p-2 sm:p-3 bg-gray-900/50 rounded-lg">
            <div className="flex justify-between text-xs sm:text-sm mb-1 sm:mb-2">
              <span>HP: {currentBoss.hp}/{currentBoss.maxHp}</span>
              <span>⚔ {currentBoss.attack}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 sm:h-3">
              <motion.div
                className="h-full bg-red-500 rounded-full"
                animate={{ width: `${(currentBoss.hp / currentBoss.maxHp) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
</div>
          </div>

                  {/* Attack Button */}
          <div className="text-center">
            {gameState === 'playing' ? (
              <button
                onClick={handleAttack}
                disabled={
                  isAttacking ||
                  isTransitioningRound || // Tambahkan pengecekan state transisi
                  !participants.find(p => p.profile_id === profile.id)?.is_alive ||
                  !isMyTurn()
                }
                className={`btn-danger btn-lg ${
                  isMyTurn() && !isTransitioningRound ? 'rpg-glow animate-pulse' : 'opacity-50'
                }`}
              >
                {isTransitioningRound ? 'Next Round...' : isAttacking ? 'Attacking...' : isMyTurn() ? 'ATTACK!' : 'Wait Your Turn...'}
              </button>
            ) : (
              <button
                onClick={handleReturnToLobby}
                className="btn-primary btn-lg"
              >
                Return to Lobby
              </button>
            )}
          </div>

          {/* Action Log */}
          <div className="rpg-card-light mb-6">
            <h3 className="text-lg font-bold text-white mb-3">Battle Log</h3>
            <div className="bg-gray-800/50 rounded-lg p-3 h-24 overflow-y-auto">
              {actionLog.map((log, index) => (
                <div key={index} className="text-sm text-gray-300 mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>

          
        </div>

        {/* Victory/Defeat Modal */}
        <AnimatePresence>
          {(gameState === 'victory' || gameState === 'defeat') && (
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
                  {gameState === 'victory' ? 'RAID SUCCESS!' : 'RAID FAILED!'}
                </div>
                
                {gameState === 'victory' ? (
                  <div className="mb-6">
                    <div className="rpg-card-accent p-6">
                      <Trophy className="w-16 h-16 mx-auto mb-2 text-yellow-500" />
                      <div className="font-bold text-white">Team Victory!</div>
                      <div className="text-gray-300 text-sm mt-2">
                        All 3 rounds completed successfully
                      </div>
                      <div className="text-yellow-400 text-sm mt-2">
                        🎉 Claim your rewards! 🎉
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="rpg-card-light p-6">
                      <Swords className="w-16 h-16 mx-auto mb-2 text-gray-500" />
                      <div className="font-bold text-white">Team Defeated</div>
                      <div className="text-gray-300 text-sm mt-2">
                        Better luck next time!
                      </div>
                      <div className="text-red-400 text-sm mt-2 animate-pulse">
                        ⏰ Returning to lobby in 3 seconds...
                      </div>
                    </div>
                  </div>
                )}
                
                {gameState === 'victory' ? (
                <button
                  onClick={handleReturnToLobby}
                  className="btn-secondary w-full"
                >
                  Return to Lobby
                </button>
                ) : (
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-2">
                      Auto-returning to lobby...
                    </div>
                    <button
                      onClick={handleReturnToLobby}
                      className="btn-primary w-full"
                    >
                      Return Now
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Rewards Modal - Muncul otomatis saat `cardRewards` ada */}
        {cardRewardsModal}
      </div>
    </div>
  );
}

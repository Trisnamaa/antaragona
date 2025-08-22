import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Swords, Star, Trophy, Zap, Shield, Crown, TrendingUp, Search, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';
import { useCostumes } from '../hooks/useCostumes';
import { RankBadge, RankProgress, getRankInfo } from '../components/RankingSystem';

interface Profile {
  id: string;
  username: string;
  level: number;
  strength: number;
  character_type: string;
}

interface PlayerRank {
  id: string;
  stars: number;
  battles_won: number;
  battles_lost: number;
  battle_ranks: {
    name: string;
    level: number;
    image_url: string;
  }
  leaderboard_position?: number;
}

interface Opponent {
  id: string;
  username: string;
  level: number;
  strength: number;
  is_bot: boolean;
  character_type?: string;
}

const BOT_NAMES = [
  'WarriorBot', 'KnightBot', 'ShadowBot', 'DragonBot', 'PhoenixBot',
  'ThunderBot', 'IceBot', 'FireBot', 'WindBot', 'EarthBot',
  'SteelBot', 'MysticBot', 'ChaosBot', 'OrderBot', 'VoidBot'
];

export default function Battle() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [playerRank, setPlayerRank] = useState<PlayerRank | null>(null);
  const [searching, setSearching] = useState(false);
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [battleResult, setBattleResult] = useState<'win' | 'lose' | null>(null);
  const [searchTimer, setSearchTimer] = useState(60);
  const [showRankAnimation, setShowRankAnimation] = useState(false);
  const [rankChange, setRankChange] = useState<{ from: number; to: number } | null>(null);
  const navigate = useNavigate();

  const { equippedCostume } = useCostumes(profile?.id || null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, level, strength, character_type')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: rankData, error: rankError } = await supabase
        .from('player_ranks')
        .select(`
          id,
          stars,
          battles_won,
          battles_lost,
          battle_ranks (
            name,
            level,
            image_url
          )
        `)
        .eq('profile_id', profileData.id)
        .maybeSingle();

      if (rankError) {
        throw rankError;
      }

      if (!rankData) {
        const { data: initialRank } = await supabase
          .from('battle_ranks')
          .select('id')
          .eq('name', 'Trainee')
          .single();

        if (initialRank) {
          const { error: upsertError } = await supabase
            .from('player_ranks')
            .upsert({
              profile_id: profileData.id,
              rank_id: initialRank.id,
              stars: 0,
              battles_won: 0,
              battles_lost: 0
            }, {
              onConflict: 'profile_id',
              ignoreDuplicates: false
            });

          if (upsertError) throw upsertError;

          const { data: newRankData, error: fetchError } = await supabase
            .from('player_ranks')
            .select(`
              id,
              stars,
              battles_won,
              battles_lost,
              battle_ranks (
                name,
                level,
                image_url
              )
            `)
            .eq('profile_id', profileData.id)
            .single();

          if (fetchError) throw fetchError;
          setPlayerRank(newRankData);
        }
      } else {
        setPlayerRank(rankData);
      }

      if (rankData || profileData) {
        await loadLeaderboardPosition(profileData.id);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    }
  };

  const loadLeaderboardPosition = async (profileId: string) => {
    try {
      const { data, error } = await supabase
        .from('player_ranks')
        .select('profile_id, battles_won, stars')
        .order('battles_won', { ascending: false })
        .order('stars', { ascending: false });

      if (error) throw error;

      const position = data?.findIndex(p => p.profile_id === profileId) + 1;
      if (position && position > 0) {
        setPlayerRank(prev => prev ? { ...prev, leaderboard_position: position } : null);
      }
    } catch (error) {
      console.error('Error loading leaderboard position:', error);
    }
  };

  const startSearch = () => {
    setSearching(true);
    setSearchTimer(30);

    const timer = setInterval(() => {
      setSearchTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          findOpponentFinal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    findRealOpponent();
  };

  const findRealOpponent = async () => {
    if (!profile) return;

    const searchInterval = setInterval(async () => {
      if (!searching) {
        clearInterval(searchInterval);
        return;
      }

      try {
        const { data: potentialOpponents, error } = await supabase
          .from('profiles')
          .select('id, username, level, strength, character_type, user_id')
          .neq('id', profile.id)
          .gte('level', Math.max(1, profile.level - 3))
          .lte('level', profile.level + 3)
          .limit(10);

        if (error) throw error;

        const suitableOpponents = potentialOpponents?.filter((opponent: any) => {
          const strengthDifference = Math.abs(opponent.strength - profile.strength);
          const maxStrengthDifference = profile.strength * 0.4;
          return strengthDifference <= maxStrengthDifference;
        }) || [];

        if (suitableOpponents.length > 0) {
          const randomOpponent = suitableOpponents[Math.floor(Math.random() * suitableOpponents.length)];
          
          const isAvailable = await checkOpponentAvailability(randomOpponent.user_id);
          
          if (isAvailable) {
            setOpponent({
              ...randomOpponent,
              is_bot: false
            });
            setSearching(false);
            clearInterval(searchInterval);
            toast.success(`Found opponent: ${randomOpponent.username}!`);
            return;
          }
        }
      } catch (error) {
        console.log('Search attempt failed:', error);
      }
    }, 3000);
  };

  const checkOpponentAvailability = async (opponentUserId: string): Promise<boolean> => {
    try {
      const { data: recentActivity, error } = await supabase
        .from('global_chat')
        .select('created_at')
        .eq('user_id', opponentUserId)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(1);

      if (error) return true;
      
      return recentActivity && recentActivity.length > 0;
    } catch (error) {
      return true;
    }
  };

  const findOpponentFinal = async () => {
    if (!profile) return;

    try {
      const { data: potentialOpponents, error } = await supabase
        .from('profiles')
        .select('id, username, level, strength, character_type, user_id')
        .neq('id', profile.id)
        .gte('level', Math.max(1, profile.level - 5))
        .lte('level', profile.level + 5)
        .limit(20);

      if (!error && potentialOpponents && potentialOpponents.length > 0) {
        const suitableOpponents = potentialOpponents.filter((opponent: any) => {
          const strengthDifference = Math.abs(opponent.strength - profile.strength);
          const maxStrengthDifference = profile.strength * 0.6;
          return strengthDifference <= maxStrengthDifference;
        });

        if (suitableOpponents.length > 0) {
          const randomOpponent = suitableOpponents[Math.floor(Math.random() * suitableOpponents.length)];
          setOpponent({
            ...randomOpponent,
            is_bot: false
          });
          setSearching(false);
          toast.success(`Found opponent: ${randomOpponent.username}!`);
          return;
        }
      }
    } catch (error) {
      console.log('Final search failed:', error);
    }

    const botOpponent = createBotOpponent(profile);
    setOpponent(botOpponent);
    setSearching(false);
    toast(`No players available. Fighting ${botOpponent.username}!`);
  };

  const createBotOpponent = (playerProfile: Profile): Opponent => {
    const strengthVariation = 0.2;
    const minStrength = Math.floor(playerProfile.strength * (1 - strengthVariation));
    const maxStrength = Math.floor(playerProfile.strength * (1 + strengthVariation));
    const botStrength = Math.floor(Math.random() * (maxStrength - minStrength + 1)) + minStrength;
    
    const levelVariation = 2;
    const minLevel = Math.max(1, playerProfile.level - levelVariation);
    const maxLevel = playerProfile.level + levelVariation;
    const botLevel = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
    
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const characterTypes = ['male', 'female'];
    const botCharacterType = characterTypes[Math.floor(Math.random() * characterTypes.length)];

    return {
      id: `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: `${botName}${Math.floor(Math.random() * 999) + 1}`,
      level: botLevel,
      strength: botStrength,
      is_bot: true,
      character_type: botCharacterType
    };
  };

  const handleBattle = async () => {
    if (!profile || !opponent || !playerRank) return;

    const oldPosition = playerRank.leaderboard_position || 999;
    const playerWins = profile.strength > opponent.strength;
    setBattleResult(playerWins ? 'win' : 'lose');

    try {
      await supabase
        .from('battle_history')
        .insert({
          winner_id: playerWins ? profile.id : (opponent.is_bot ? null : opponent.id),
          loser_id: playerWins ? (opponent.is_bot ? null : opponent.id) : profile.id,
          winner_strength: playerWins ? profile.strength : opponent.strength,
          loser_strength: playerWins ? opponent.strength : profile.strength,
          is_bot: opponent.is_bot
        });

      let newStars = playerRank.stars + (playerWins ? 1 : -1);
      let rankChanged = false;

      if (newStars >= 5) {
        const { data: nextRank } = await supabase
          .from('battle_ranks')
          .select('id')
          .gt('level', playerRank.battle_ranks.level)
          .order('level', { ascending: true })
          .limit(1)
          .single();

        if (nextRank) {
          await supabase
            .from('player_ranks')
            .update({
              rank_id: nextRank.id,
              stars: 0,
              battles_won: playerRank.battles_won + (playerWins ? 1 : 0),
              battles_lost: playerRank.battles_lost + (playerWins ? 0 : 1)
            })
            .eq('id', playerRank.id);
          rankChanged = true;
          toast.success('Rank Up! 🎉');
        }
      } else if (newStars < 0 && playerRank.battle_ranks.level > 1) {
        const { data: prevRank } = await supabase
          .from('battle_ranks')
          .select('id')
          .lt('level', playerRank.battle_ranks.level)
          .order('level', { ascending: false })
          .limit(1)
          .single();

        if (prevRank) {
          await supabase
            .from('player_ranks')
            .update({
              rank_id: prevRank.id,
              stars: 4,
              battles_won: playerRank.battles_won + (playerWins ? 1 : 0),
              battles_lost: playerRank.battles_lost + (playerWins ? 0 : 1)
            })
            .eq('id', playerRank.id);
          rankChanged = true;
          toast.error('Rank Down 📉');
        }
      }

      if (!rankChanged) {
        await supabase
          .from('player_ranks')
          .update({
            stars: Math.max(0, newStars),
            battles_won: playerRank.battles_won + (playerWins ? 1 : 0),
            battles_lost: playerRank.battles_lost + (playerWins ? 0 : 1)
          })
          .eq('id', playerRank.id);
      }

      loadProfile();

      if (playerWins) {
        setTimeout(async () => {
          await loadLeaderboardPosition(profile.id);
          const newPosition = playerRank.leaderboard_position || 999;
          
          if (newPosition < oldPosition) {
            setRankChange({ from: oldPosition, to: newPosition });
            setShowRankAnimation(true);
            setTimeout(() => {
              setShowRankAnimation(false);
              setRankChange(null);
            }, 3000);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error updating battle results:', error);
      toast.error('Failed to update battle results');
    }
  };

  const resetBattle = () => {
    setOpponent(null);
    setBattleResult(null);
    setSearching(false);
  };

  return (
    <div className="min-h-screen rpg-bg">
      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate('/lobby')}
            className="btn-secondary"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
          </button>
          <h2 className="text-2xl font-bold text-white flex items-center">
              <img src={GAME_ASSETS.BATTLE} alt="Battle" className="w-8 h-8" />
            Battle
          </h2>
          <div className="w-32"></div>
        </div>

{/* Battle Arena */}
        <div className="max-w-4xl mx-auto">
          <div className="rpg-card p-3 mb-2">
            {!searching && !opponent && (
              <div className="text-center py-9">
                <h2 className="text-2xl font-bold text-white mb-8 flex items-center justify-center">
                  <Trophy className="w-8 h-8 mr-2 text-yellow-500" />
                  Ready for Battle?
                </h2>
                <button
                  onClick={startSearch}
                  className="btn-primary btn-lg"
                >
                  Start Battle
                </button>
              </div>
            )}

            {searching && !opponent && (
              <div className="text-center py-12">
                <div className="rpg-card-accent p-8 mb-6">
                  <div className="text-2xl font-bold mb-4 text-white">
                    {searchTimer > 30 ? 'Searching for Players...' : 
                     searchTimer > 10 ? 'Expanding Search...' : 
                     'Ready...'}
                  </div>
                  <div className="text-4xl font-bold text-purple-400">{searchTimer}s</div>
                </div>
                <div className="rpg-card-light p-4">
                  <p className="text-white">
                    {searchTimer > 30 ? 'Searching for online players in your level range...' : 
                     searchTimer > 10 ? 'Waitting for players to join...' : 
                     'Ready...'}
                  </p>
                </div>
              </div>
            )}

            {opponent && (
              <div className="py-8">
                <h2 className="text-2xl font-bold text-white text-center mb-8">Battle Ready!</h2>
                
                <div className="rpg-card-light p-4 sm:p-6 mb-8" style={{backgroundImage: `url(${GAME_ASSETS.battle_bg})`, backgroundSize: 'cover', backgroundPosition: 'center'}}>
  <div className="bg-black bg-opacity-50 rounded-lg backdrop-blur-sm p-4 sm:p-6">
    <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-8 items-center">
      {/* Player */}
      <div className="text-center">
        <motion.div
          animate={{
            x: battleResult === 'win' ? [0, 50, 0] : 0
          }}
          transition={{ duration: 0.5 }}
        >
          <img
            src={GAME_ASSETS.getCharacterImage(profile?.character_type as 'male' | 'female', equippedCostume)}
            alt="Player"
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain mx-auto mb-3"
          />
          <div className="font-semibold text-white text-sm sm:text-base md:text-lg truncate mb-2">{profile?.username}</div>
          <div className="flex items-center justify-center mb-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-purple-400" />
            <span className="font-medium text-sm sm:text-base">LV.{profile?.level}</span>
          </div>
          <div className="flex items-center justify-center">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-orange-500" />
            <span className="font-medium text-sm sm:text-base">{profile?.strength}</span>
          </div>
        </motion.div>
      </div>

      {/* Opponent */}
      <div className="text-center">
        <motion.div
          animate={{
            x: battleResult === 'lose' ? [0, -50, 0] : 0
          }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative">
            <img
              src={opponent.is_bot 
                ? GAME_ASSETS.getCharacterImage(opponent.character_type as 'male' | 'female')
                : GAME_ASSETS.getCharacterImage(opponent.character_type as 'male' | 'female')}
              alt="Opponent"
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain mx-auto mb-3"
            />
            {opponent.is_bot && (
              <div className="absolute -top-2 -right-2 badge badge-danger text-xs">
                BOT
              </div>
            )}
          </div>
          <div className="font-semibold text-white text-sm sm:text-base md:text-lg truncate mb-2">{opponent.username}</div>
          <div className="flex items-center justify-center mb-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-purple-400" />
            <span className="font-medium text-sm sm:text-base">LV.{opponent.level}</span>
          </div>
          <div className="flex items-center justify-center">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-1 text-orange-500" />
            <span className="font-medium text-sm sm:text-base">{opponent.strength}</span>
          </div>
        </motion.div>
      </div>
    </div>
  </div>
</div>
                {!battleResult && (
                  <div className="text-center">
                    <button
                      onClick={handleBattle}
                      className="btn-danger btn-lg w-full max-w-xs"
                    >
                      Fight!
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>


        {/* Rank Display */}
        {playerRank && (
          <div className="mb-8">
            <div className="rpg-card mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {playerRank.leaderboard_position && (
                    <RankBadge position={playerRank.leaderboard_position} size="large" />
                  )}
                  <div>
                   
                    {playerRank.leaderboard_position && (
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-purple-400">
                          Leaderboard: #{playerRank.leaderboard_position}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < playerRank.stars ? 'text-yellow-400 fill-current' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className=" p-2 mb-1">
                    <span className="font-semibold text-green-600">Win: {playerRank.battles_won}</span>
                  </div>
                  <div className=" p-2">
                    <span className="font-semibold text-red-600">Lose: {playerRank.battles_lost}</span>
                  </div>
                </div>
              </div>
            </div>

            {playerRank.leaderboard_position && (
              <RankProgress
                currentPosition={playerRank.leaderboard_position}
                wins={playerRank.battles_won}
                losses={playerRank.battles_lost}
              />
            )}
          </div>
        )}

        
        {/* Battle Result Modal */}
        <AnimatePresence>
          {battleResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                className="rpg-card max-w-md w-full mx-4 text-center"
              >
                <div className={`text-4xl font-bold mb-6 ${
                  battleResult === 'win' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {battleResult === 'win' ? 'Victory!' : 'Defeated!'}
                </div>
                <div className="mb-6">
                  {battleResult === 'win' ? (
                    <div className="rpg-card-accent p-6">
                      <Trophy className="w-16 h-16 mx-auto mb-2 text-yellow-500" />
                      <div className="font-bold text-white">+1 Star</div>
                    </div>
                  ) : (
                    <div className="rpg-card-light p-6">
                      <Swords className="w-16 h-16 mx-auto mb-2 text-gray-500" />
                      <div className="font-bold text-white">-1 Star</div>
                    </div>
                  )}
                </div>
                <button
                  onClick={resetBattle}
                  className="btn-primary w-full"
                >
                  Continue
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rank Up Animation */}
        <AnimatePresence>
          {showRankAnimation && rankChange && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ y: 50 }}
                animate={{ y: 0 }}
                className="rpg-card-accent p-8 text-center max-w-md"
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="mb-4"
                >
                  <Crown className="w-16 h-16 mx-auto text-yellow-500" />
                </motion.div>
                
                <h2 className="text-3xl font-bold mb-4 text-white">Rank Up!</h2>
                
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-center">
                    <RankBadge position={rankChange.from} size="medium" />
                    <div className="text-sm font-medium mt-1">#{rankChange.from}</div>
                  </div>
                  
                  <motion.div
                    animate={{ x: [0, 10, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </motion.div>
                  
                  <div className="text-center">
                    <RankBadge position={rankChange.to} size="medium" />
                    <div className="text-sm font-medium mt-1">#{rankChange.to}</div>
                  </div>
                </div>
                
                <p className="font-semibold text-lg text-white">
                  New Leaderboard Position!
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
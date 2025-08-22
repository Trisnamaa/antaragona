import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Crown, Star, RefreshCw, Users, Medal, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { RankBadge, getRankInfo } from '../components/RankingSystem';
import { GAME_ASSETS } from '../assets/gameAssets';
import { useCostumes } from '../hooks/useCostumes';
import { PlayerProfileModal } from '../components/PlayerProfileModal';
import toast from 'react-hot-toast';

interface LeaderboardEntry {
  id: string;
  username: string;
  character_type: string;
  battles_won: number;
  battles_lost: number;
  stars: number;
  position: number;
  profile_id: string;
  battle_ranks: {
    name: string;
    level: number;
  };
}

interface Profile {
  id: string;
  username: string;
  character_type: string;
  level: number;
  exp: number;
  strength: number;
  zgold: number;
  ztoken: number;
  created_at: string;
}

const PLAYERS_PER_PAGE = 5;

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<any>(null);
  const [showPlayerProfileModal, setShowPlayerProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const navigate = useNavigate();

  const totalPages = Math.ceil(leaderboard.length / PLAYERS_PER_PAGE);
  const currentPlayers = leaderboard.slice(
    (currentPage - 1) * PLAYERS_PER_PAGE,
    currentPage * PLAYERS_PER_PAGE
  );

  useEffect(() => {
    loadProfile();
    loadLeaderboard();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, character_type, level, exp, strength, zgold, ztoken, created_at')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const loadLeaderboard = async () => {
    try {
      setRefreshing(true);
      
      const { data, error } = await supabase
        .from('player_ranks')
        .select(`
          id,
          profile_id,
          stars,
          battles_won,
          battles_lost,
          profiles!inner (
            username,
            character_type
          ),
          battle_ranks (
            name,
            level
          )
        `)
        .order('battles_won', { ascending: false })
        .order('stars', { ascending: false })
        .limit(100);

      if (error) throw error;

      const transformedData: LeaderboardEntry[] = (data || []).map((entry, index) => ({
        id: entry.id,
        username: entry.profiles.username,
        character_type: entry.profiles.character_type,
        battles_won: entry.battles_won,
        battles_lost: entry.battles_lost,
        stars: entry.stars,
        position: index + 1,
        profile_id: entry.profile_id,
        battle_ranks: entry.battle_ranks
      }));

      setLeaderboard(transformedData);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadLeaderboard();
    toast.success('Leaderboard refreshed!');
  };

  const handlePlayerClick = async (username: string, profileId: string) => {
    if (profileLoading) return;
    
    setProfileLoading(true);
    try {
      const { data: profileData, error } = await supabase.rpc('get_user_profile_by_id', {
        p_profile_id: profileId
      });

      if (error) {
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile');
        return;
      }
      
      if (profileData && profileData.length > 0) {
        setSelectedPlayerProfile(profileData[0]);
        setShowPlayerProfileModal(true);
      } else {
        toast.error('Profile not found');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load player profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const getPlayerPosition = () => {
    if (!profile) return null;
    return leaderboard.find(entry => entry.profile_id === profile.id);
  };

  const playerEntry = getPlayerPosition();

  if (loading) {
    return (
      <div className="min-h-screen rpg-bg flex items-center justify-center">
        <div className="rpg-card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-white">Loading Leaderboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen rpg-bg">
      <div className="min-h-screen flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate('/lobby')}
            className="btn-secondary"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <img src={GAME_ASSETS.LB} alt="LB" className="w-8 h-8" />
            Leaderboard
          </h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-primary btn-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Player's Current Position */}
        {playerEntry && (
          <div className="mb-6">
            <div className="rpg-card-accent p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center">
                <Star className="w-5 h-5 mr-2 text-yellow-400" />
                Your Position
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">#{playerEntry.position}</div>
                    <div className="text-xs text-gray-400">Rank</div>
                  </div>
                  <RankBadge position={playerEntry.position} size="medium" showName />
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{playerEntry.battles_won} Wins</div>
                  <div className="text-gray-400 text-sm">{playerEntry.battles_lost} losses</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Leaderboard */}
        <div className="rpg-card flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <Users className="w-6 h-6 mr-2 text-purple-400" />
              Rankings
            </h2>
            <div className="text-sm text-gray-300">
              Page {currentPage}/{totalPages}
            </div>
          </div>
          
          {/* Leaderboard List */}
          <div className="flex-1 space-y-3 mb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {currentPlayers.map((entry, index) => {
                  const isCurrentPlayer = profile && entry.profile_id === profile.id;
                  const isTopThree = entry.position <= 3;
                  
                  return (
                    <motion.div
                      key={entry.id}
                      className={`
                        flex items-center justify-between p-4 rounded-xl cursor-pointer
                        transition-all duration-200 hover:shadow-md
                        ${isCurrentPlayer 
                          ? 'bg-gradient-to-r from-purple-900/50 to-purple-800/50 border-2 border-purple-500/50 rpg-glow' 
                          : isTopThree 
                            ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-2 border-yellow-500/30'
                            : 'bg-gray-700/50 border border-gray-600/50 hover:border-gray-500'
                        }
                      `}
                      onClick={() => handlePlayerClick(entry.username, entry.profile_id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Position */}
                        <div className="text-center min-w-[40px]">
                          <div className={`text-lg font-bold ${
                            isTopThree ? 'text-yellow-400' : isCurrentPlayer ? 'text-purple-400' : 'text-gray-300'
                          }`}>
                            #{entry.position}
                          </div>
                        </div>
                        
                        {/* Rank Badge */}
                        <RankBadge position={entry.position} size="medium" />
                        

                        
                        {/* Player Info */}
                        <div className="flex-1">
                          <div className={`font-semibold text-sm ${
                            isTopThree ? 'text-yellow-300' : isCurrentPlayer ? 'text-purple-300' : 'text-white'
                          }`}>
                            <UserWithTitle profileId={entry.profile_id} username={entry.username} />
                          </div>
                          <div className={`text-xs ${
                            isTopThree ? 'text-yellow-400' : isCurrentPlayer ? 'text-purple-400' : 'text-gray-300'
                          }`}>
                            {getRankInfo(entry.position).name}
                          </div>
                        </div>
                      </div>
                      
                      {/* Stats */}
                      <div className="text-right">
                        <div className={`font-semibold text-sm ${
                          isTopThree ? 'text-yellow-300' : isCurrentPlayer ? 'text-purple-300' : 'text-white'
                        }`}>
                          {entry.battles_won}W / {entry.battles_lost}L
                        </div>
                        <div className={`text-xs ${
                          isTopThree ? 'text-yellow-400' : isCurrentPlayer ? 'text-purple-400' : 'text-gray-300'
                        }`}>
                          {entry.stars} ⭐
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn-secondary btn-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="rpg-card-light px-4 py-2">
              <span className="font-semibold">{currentPage}/{totalPages}</span>
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary btn-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Player Profile Modal */}
        <PlayerProfileModal
          isOpen={showPlayerProfileModal}
          onClose={() => setShowPlayerProfileModal(false)}
          profile={selectedPlayerProfile}
          loading={profileLoading}
        />
      </div>
    </div>
  );
}

function UserWithTitle({ username }: { username: string }) {
  return (
    <span className="text-sm font-medium text-white">
      {username}
    </span>
  );
}

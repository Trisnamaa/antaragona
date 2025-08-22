import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Crown, ArrowLeft, User, Star, Zap, Award, X, Settings, Edit3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';
import { TitleDisplay, UsernameWithTitle } from '../components/TitleDisplay';
import { useTitles } from '../hooks/useTitles';
import { useCostumes } from '../hooks/useCostumes';
import { RankBadge, getRankInfo } from '../components/RankingSystem';

interface Profile {
  id: string;
  username: string;
  profile_image_url: string;
  character_type: string;
  zgold: number;
  ztoken: number;
  level: number;
  exp: number;
  strength: number;
  equipped_title_id: string | null;
  leaderboard_position?: number;
  highest_rank?: number;
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const {
    availableTitles,
    equippedTitle,
    loading: titlesLoading,
    equipTitle,
    unequipTitle,
    loadTitles
  } = useTitles(profile?.id || null);

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

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, profile_image_url, character_type, zgold, ztoken, level, exp, strength, equipped_title_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
      
      await loadLeaderboardPosition(data.id);
      await loadHighestRank(data.id);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
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
        setProfile(prev => prev ? { ...prev, leaderboard_position: position } : null);
      }
    } catch (error) {
      console.error('Error loading leaderboard position:', error);
    }
  };

  const loadHighestRank = async (profileId: string) => {
    try {
      if (profile?.leaderboard_position) {
        const simulatedHighest = Math.max(1, profile.leaderboard_position - 5);
        setProfile(prev => prev ? { ...prev, highest_rank: simulatedHighest } : null);
      }
    } catch (error) {
      console.error('Error loading highest rank:', error);
    }
  };

  const handleEquipTitle = async (titleId: string) => {
    await equipTitle(titleId);
    await loadProfile();
  };

  const handleUnequipTitle = async () => {
    await unequipTitle();
    await loadProfile();
  };

  const handleTitleClick = () => {
    setShowTitleModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen rpg-bg flex items-center justify-center">
        <div className="rpg-card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-white">Loading Profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const expProgress = (profile.exp / 1000) * 100;
  const strengthProgress = (profile.strength / 200) * 100;

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
          
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          
          <div className="w-32"></div>
        </div>

        {/* Main Profile Content */}
        <div className="max-w-4xl mx-auto">
          <div className="rpg-card mb-6">
            {/* Profile Header */}
            <div className="flex items-start gap-6 mb-6">
              {/* Avatar Section */}
              <div className="relative">
                <img
                  src={profile.profile_image_url}
                  alt={profile.username}
                  className="avatar avatar-lg"
                />
                <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white text-sm font-semibold px-3 py-1 rounded-full">
                  LV.{profile.level}
                </div>
              </div>

              {/* Username & Title */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-3">{profile.username}</h1>

                {/* Clickable Title */}
                <div 
                  onClick={handleTitleClick}
                  className="cursor-pointer inline-block mb-4"
                >
                  {equippedTitle ? (
                    <div className="hover:scale-105 transition-transform">
                      <TitleDisplay 
                        title={equippedTitle} 
                        size="medium" 
                        showIcon={true}
                      />
                    </div>
                  ) : (
                    <div className="rpg-card-light px-4 py-2 hover:scale-105 transition-transform">
                      <span className="text-gray-300 font-medium text-sm">
                        Click to set title
                      </span>
                    </div>
                  )}
                </div>

                {/* Ranking Badges */}
                <div className="flex items-center gap-4">
                  {profile.leaderboard_position && (
                    
                      <div className="flex items-center gap-2">
                        <RankBadge position={profile.leaderboard_position} size="large" />
                        <div>
                        </div>
                      </div>
                    
                  )}

                  {profile.highest_rank && (
                    
                      <div className="flex items-center gap-2">
                        <RankBadge position={profile.highest_rank} size="large" />
                        <div>
                        </div>
                      </div>
                    
                  )}
                </div>
              </div>
            </div>

            {/* Character & Stats Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Character Display */}
              <div className="text-center">
                <div className="rpg-card-accent p-6 mb-4">
                  <img
                    src={GAME_ASSETS.getCharacterImage(profile.character_type as 'male' | 'female', equippedCostume)}
                    alt="Character"
                    className="w-32 h-32 object-contain mx-auto mb-4"
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-6">
                {/* Experience */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center">
                      <img src={GAME_ASSETS.EXP} alt="EXP" className="w-6 h-5" />
                      <span className="font-medium text-white">Experience</span>
                    </div>
                    <span className="text-sm text-gray-300">{profile.exp}</span>
                  </div>
                  <div className="progress-modern">
                    <div 
                      className="progress-fill bg-gradient-to-r from-yellow-400 to-orange-500"
                      style={{ width: `${expProgress}%` }}
                    />
                  </div>
                </div>

                {/* Strength */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center">
                      <img src={GAME_ASSETS.kekuatan} alt="Strength" className="w-5 h-6"/>
                      <span className="font-medium text-white">Power Level</span>
                    </div>
                    <span className="text-sm text-gray-300">{profile.strength}</span>
                  </div>
                  <div className="progress-modern">
                    <div 
                      className="progress-fill bg-gradient-to-r from-orange-400 to-red-500"
                      style={{ width: `${strengthProgress}%` }}
                    />
                  </div>
                </div>

                {/* Currency */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rpg-card-light text-center">
                    <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-xl font-bold text-white">{profile.zgold.toLocaleString()}</div>
                    <div className="text-sm text-gray-300">ZGold</div>
                  </div>
                  <div className="rpg-card-light text-center">
                    <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-xl font-bold text-white">{profile.ztoken}</div>
                    <div className="text-sm text-gray-300">ZToken</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Title Management Modal */}
        <AnimatePresence>
          {showTitleModal && (
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
                className="rpg-card max-w-2xl max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    <Crown className="w-6 h-6 inline mr-2 text-yellow-500" />
                    Manage Titles
                  </h2>
                  <button 
                    onClick={() => setShowTitleModal(false)}
                    className="btn-secondary btn-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Currently Equipped Title */}
                <div className="rpg-card-accent mb-6">
                  <h3 className="font-semibold text-white mb-4 flex items-center">
                    <Star className="w-5 h-5 mr-2 text-yellow-400" />
                    Currently Equipped
                  </h3>
                  <div className="text-center">
                    {equippedTitle ? (
                      <div className="space-y-4">
                        <TitleDisplay 
                          title={equippedTitle} 
                          size="large" 
                          showIcon={true}
                        />
                        <p className="text-gray-200">{equippedTitle.description}</p>
                        <button
                          onClick={handleUnequipTitle}
                          disabled={titlesLoading}
                          className="btn-danger"
                        >
                          Unequip Title
                        </button>
                      </div>
                    ) : (
                      <div className="py-8">
                        <Award className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-300 text-lg">No title equipped</p>
                        <p className="text-gray-400 text-sm mt-2">Select a title below to equip it</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Available Titles */}
                <div className="rpg-card-light">
                  <h3 className="font-semibold text-white mb-4 flex items-center">
                    <Award className="w-5 h-5 mr-2 text-purple-400" />
                    Your Titles ({availableTitles.length})
                  </h3>
                  
                  {availableTitles.length > 0 ? (
                    <div className="space-y-4 max-h-60 overflow-y-auto">
                      {availableTitles.map((title) => (
                        <div key={title.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600/30">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <TitleDisplay title={title} size="medium" />
                              {equippedTitle?.id === title.id && (
                                <span className=""></span>
                              )}
                            </div>
                            <p className="text-xs text-gray-300">{title.description}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              Rarity: <span className="capitalize">{title.rarity}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => handleEquipTitle(title.id)}
                            disabled={titlesLoading || equippedTitle?.id === title.id}
                            className="btn-success btn-sm ml-4"
                          >
                            {equippedTitle?.id === title.id ? 'Equipped' : 'Equip'}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Award className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-300 text-lg">No titles unlocked</p>
                      <p className="text-gray-400 text-sm mt-2">Complete achievements to unlock titles!</p>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <div className="mt-6">
                  <button
                    onClick={() => setShowTitleModal(false)}
                    className="btn-primary w-full"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
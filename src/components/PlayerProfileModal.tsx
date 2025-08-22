import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User } from 'lucide-react';
import { GAME_ASSETS } from '../assets/gameAssets';
import { TitleDisplay } from './TitleDisplay';
import { useUserTitle } from '../hooks/useTitles';
import { useCostumes } from '../hooks/useCostumes';
import { supabase } from '../lib/supabase';

interface PlayerProfile {
  id: string;
  username: string;
  profile_image_url: string;
  character_type: string;
  level: number;
  exp: number;
  strength: number;
  zgold: number;
  ztoken: number;
  clover: number;
  created_at: string;
  is_online?: boolean;
  last_seen?: string;
}

interface PlayerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile | null;
  loading?: boolean;
}

export function PlayerProfileModal({ 
  isOpen, 
  onClose, 
  profile, 
  loading = false 
}: PlayerProfileModalProps) {
  // Only call hooks when profile is available
  const { title } = useUserTitle(profile?.id || null);
  const { equippedCostume, loading: costumeLoading } = useCostumes(profile?.id || null);
  
  // Extensive debugging
  console.log('=== DEBUG PLAYER PROFILE MODAL ===');
  console.log('Profile:', profile);
  console.log('Profile ID:', profile?.id);
  console.log('Equipped Costume Object:', equippedCostume);
  console.log('Costume Loading:', costumeLoading);
  console.log('Is profile available:', !!profile);
  console.log('================================');

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatLastSeen = (lastSeen: string) => {
    if (!lastSeen) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMs = now.getTime() - lastSeenDate.getTime();
    
    if (isNaN(diffInMs) || diffInMs < 0) return 'Unknown';
    
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="rpg-card max-w-md w-full mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Player Profile</h2>
            <button 
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading profile...</p>
            </div>
          ) : profile ? (
            <>
              {/* Profile Header */}
              <div className="text-center mb-6">
                <div className="relative inline-block mb-4">
                  <img
                    src={profile.profile_image_url}
                    alt={profile.username}
                    className={`avatar avatar-lg border-4 ${
                      profile.is_online 
                        ? 'border-green-400 shadow-md shadow-green-400/30' 
                        : 'border-gray-600'
                    }`}
                  />
                  {/* Online Status Indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-gray-800 flex items-center justify-center ${
                    profile.is_online ? 'bg-green-400' : 'bg-gray-500'
                  }`}>
                    <div className="text-white text-xs font-bold">{profile.level}</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-3 mb-2">
                  <h3 className="text-2xl font-bold text-white">{profile.username}</h3>
                  {title && (
                    <TitleDisplay 
                      title={title} 
                      size="medium" 
                      showIcon={true}
                    />
                  )}
                </div>
                
                {profile.is_online !== undefined && !profile.is_online && profile.last_seen && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last seen: {formatLastSeen(profile.last_seen)}
                  </p>
                )}
              </div>
              
              {/* Character Display */}
              <div className="text-center mb-6">
                <div className="rpg-card-accent p-4">
                  {costumeLoading ? (
                    <div className="w-24 h-24 mx-auto mb-2 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                    </div>
                  ) : (
                    <img
                      src={
                        equippedCostume 
                          ? (profile.character_type === 'male' 
                              ? equippedCostume.male_image_url 
                              : equippedCostume.female_image_url) 
                          : GAME_ASSETS.getCharacterImage(profile.character_type as 'male' | 'female')
                      }
                      alt="Character"
                      className="w-24 h-24 object-contain mx-auto mb-2"
                    />
                  )}
                  {/* Enhanced Debug info */}
                  {/*
<div className="text-xs text-yellow-400 mt-1 bg-black/50 p-2 rounded">
  <p><strong>Profile ID:</strong> {profile.id}</p>
  <p><strong>Has Costume:</strong> {equippedCostume ? 'Yes' : 'No'}</p>
  {equippedCostume && (
    <>
      <p><strong>Costume Name:</strong> {equippedCostume.name}</p>
      <p><strong>Costume ID:</strong> {equippedCostume.id}</p>
      <p><strong>Male URL:</strong> {equippedCostume.male_image_url || 'None'}</p>
      <p><strong>Female URL:</strong> {equippedCostume.female_image_url || 'None'}</p>
    </>
  )}
  <p><strong>Loading:</strong> {costumeLoading ? 'Yes' : 'No'}</p>
  <p><strong>Character Type:</strong> {profile.character_type}</p>
</div>
*/}

                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rpg-card-light text-center">
                  <div className="flex items-center justify-center mb-1">
                    <img src={GAME_ASSETS.EXP} alt="Exp" className="w-5 h-5 mr-1" />
                    <span className="text-sm font-semibold">{profile.exp}</span>
                  </div>
                  <p className="text-xs text-gray-300">Experience</p>
                </div>
                <div className="rpg-card-light text-center">
                  <div className="flex items-center justify-center mb-1">
                    <img src={GAME_ASSETS.kekuatan} alt="Strength" className="w-5 h-5 mr-1" />
                    <span className="text-sm font-semibold">{profile.strength}</span>
                  </div>
                  <p className="text-xs text-gray-300">Strength</p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-400">Profile not found</p>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="btn-primary w-full"
          >
            Close Profile
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
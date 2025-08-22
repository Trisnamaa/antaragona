import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, Star, Crown, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';


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
  completion_count: number;
}

interface Profile {
  id: string;
  ztoken: number;
}

interface DungeonModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileUpdate: () => void;
}

export function DungeonModal({ isOpen, onClose, profile, onProfileUpdate }: DungeonModalProps) {
  const [dungeonTypes, setDungeonTypes] = useState<DungeonType[]>([]);
  const [dungeonProgress, setDungeonProgress] = useState<Record<string, DungeonProgress>>({});
  const [selectedDungeon, setSelectedDungeon] = useState<DungeonType | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDungeonData();
    }
  }, [isOpen, profile]);

  const loadDungeonData = async () => {
    if (!profile) return;

    try {
      const { data: dungeonData, error: dungeonError } = await supabase
        .from('dungeon_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (dungeonError) throw dungeonError;
      setDungeonTypes(dungeonData || []);

      const { data: progressData, error: progressError } = await supabase
        .from('dungeon_progress')
        .select('dungeon_type_id, completion_count')
        .eq('profile_id', profile.id);

      if (progressError) throw progressError;

      const progressMap: Record<string, DungeonProgress> = {};
      progressData?.forEach(progress => {
        progressMap[progress.dungeon_type_id] = {
          completion_count: progress.completion_count
        };
      });
      setDungeonProgress(progressMap);

      if (dungeonData && dungeonData.length > 0) {
        setSelectedDungeon(dungeonData[0]);
      }
    } catch (error) {
      console.error('Error loading dungeon data:', error);
      toast.error('Failed to load dungeon data');
    }
  };

  const handleDungeonSelect = (dungeon: DungeonType) => {
    setSelectedDungeon(dungeon);
  };

  const handleStartDungeon = () => {
    if (!selectedDungeon || !profile) return;

    if (profile.ztoken < selectedDungeon.cost_ztoken) {
      toast.error(`You need ${selectedDungeon.cost_ztoken} ZToken to enter this dungeon!`);
      return;
    }

    onClose();
    window.location.href = `/dungeon/${selectedDungeon.id}`;
  };

  const getCompletionCount = (dungeonId: string): number => {
    return dungeonProgress[dungeonId]?.completion_count || 0;
  };

  const getProgressToMaster = (dungeon: DungeonType): { current: number; required: number; percentage: number } => {
    const current = getCompletionCount(dungeon.id);
    const required = dungeon.master_title_requirement;
    const percentage = Math.min((current / required) * 100, 100);
    return { current, required, percentage };
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          className="rpg-card w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center">
              <Swords className="w-8 h-8 mr-2 text-purple-500" />
              Portal Dungeon
            </h2>
            <button 
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side: Dungeon Selection */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-white">
                Select Portal
              </h3>
              <div className="space-y-3">
                {dungeonTypes.map((dungeon) => {
                  const progress = getProgressToMaster(dungeon);
                  const isSelected = selectedDungeon?.id === dungeon.id;
                  
                  return (
                    <motion.button
                      key={dungeon.id}
                      onClick={() => handleDungeonSelect(dungeon)}
                      className={`w-full text-left transition-all duration-200 rounded-xl p-4 ${
                        isSelected 
                          ? 'bg-purple-900/30 border-2 border-purple-500 shadow-md rpg-glow' 
                          : 'bg-gray-700/50 border border-gray-600/50 hover:border-gray-500 hover:shadow-sm'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img
                            src={dungeon.image_url}
                            alt={dungeon.name}
                            className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300"
                          />
                          <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            {dungeon.cost_ztoken}
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-lg text-gray-900">
                            {dungeon.name}
                          </h4>
                          <p className="text-sm text-gray-300 mb-2">
                            {dungeon.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-white">
                              Completed: {progress.current}/{progress.required}
                            </span>
                            {progress.current >= progress.required && (
                              <Crown className="w-4 h-4 text-yellow-500" />
                            )}
                          </div>
                          <div className="progress-modern mt-2">
                            <div 
                              className="progress-fill bg-gradient-to-r from-green-400 to-green-600"
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Right Side: Rewards & Info */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-white">
                Rewards
              </h3>
              
              {selectedDungeon ? (
                <div className="space-y-4">
                  {/* Selected Dungeon Image */}
                  <div className="rpg-card-accent p-4 text-center">
                    <img
                      src={selectedDungeon.image_url}
                      alt={selectedDungeon.name}
                      className="w-32 h-32 mx-auto object-cover rounded-lg border-4 border-yellow-400 mb-4"
                    />
                    <h4 className="text-2xl font-bold text-yellow-400">
                      {selectedDungeon.name}
                    </h4>
                    <p className="text-white font-medium mt-2">{selectedDungeon.description}</p>
                  </div>

                  {/* Rewards */}
                  <div className="rpg-card-light">
                    <h4 className="font-bold text-white mb-3">Victory Rewards</h4>
                    <div className="space-y-3">
                      <div className="rpg-card-light p-3 flex items-center justify-between">
                        <span className="font-medium text-white">EXP:</span>
                        <div className="flex items-center gap-2">
                          <Star className="w-5 h-5 text-yellow-500" />
                          <span className="font-bold text-lg">{selectedDungeon.reward_exp}</span>
                        </div>
                      </div>
                      
                      <div className="rpg-card-light p-3 flex items-center justify-between">
                        <span className="font-medium text-white">ZGold:</span>
                        <div className="flex items-center gap-2">
                          <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-5 h-5" />
                          <span className="font-bold text-lg">{selectedDungeon.reward_zgold.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div className="rpg-card-light p-3 flex items-center justify-between">
                        <span className="font-medium text-white">ZToken:</span>
                        <div className="flex items-center gap-2">
                          <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-5 h-5" />
                          <span className="font-bold text-lg">{selectedDungeon.reward_ztoken}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Master Title */}
                  <div className="rpg-card-accent p-4">
                    <h4 className="font-bold text-yellow-400 mb-3">Master Title</h4>
                    <div className="text-center">
                      <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 px-4 py-2 rounded-lg font-bold mb-3">
                        {selectedDungeon.master_title_name}
                      </div>
                      <p className="text-white font-medium text-sm">
                        Complete this dungeon {selectedDungeon.master_title_requirement} times to unlock
                      </p>
                      <div className="mt-2">
                        <span className="text-yellow-400 font-bold">
                          Progress: {getCompletionCount(selectedDungeon.id)}/{selectedDungeon.master_title_requirement}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cost & Start Button */}
                  <div className="rpg-card-accent p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="font-bold text-white">Cost:</span>
                      <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-6 h-6" />
                      <span className="font-bold text-xl">{selectedDungeon.cost_ztoken}</span>
                    </div>
                    
                    <button
                      onClick={handleStartDungeon}
                      disabled={loading || (profile?.ztoken || 0) < selectedDungeon.cost_ztoken}
                      className="btn-danger btn-lg w-full"
                    >
                      Enter Dungeon
                    </button>
                    
                    {(profile?.ztoken || 0) < selectedDungeon.cost_ztoken && (
                      <p className="text-red-600 font-medium text-sm mt-2">
                        Not enough ZToken! You have {profile?.ztoken || 0}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rpg-card-light p-8 text-center">
                  <Swords className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-white font-medium">Select a dungeon to view rewards</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
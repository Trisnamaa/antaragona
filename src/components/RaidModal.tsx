import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Users, 
  Swords, 
  Crown, 
  Star, 
  Clock,
  Send,
  UserPlus,
  Play,
  Shield,
  Zap,
  RefreshCw
} from 'lucide-react';
import { useRaid, RaidUtils } from '../hooks/useRaid';
import { GAME_ASSETS } from '../assets/gameAssets';
import { useCostumes } from '../hooks/useCostumes';
import { RaidInviteNotification } from './RaidInviteNotification';

interface Profile {
  id: string;
  username: string;
  raid_tickets: number;
}

interface RaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileUpdate: () => void;
}

export function RaidModal({ isOpen, onClose, profile, onProfileUpdate }: RaidModalProps) {
  const navigate = useNavigate();
  const [selectedMap, setSelectedMap] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'maps' | 'room'>('maps');
  const [roomUuid, setRoomUuid] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [currentInvite, setCurrentInvite] = useState<any>(null);
  const [completionCounts, setCompletionCounts] = useState<Record<string, number>>({});

  const {
    raidMaps,
    currentRoom,
    participants,
    raidInvites,
    chatMessages,
    loading,
    getTotalCompletions,
    createRoom,
    sendInvite,
    respondToInvite,
    startRaid,
    sendChatMessage,
    loadRaidData,
    loadRoomData,
    loadInvites,
    setCurrentRoom,
    leaveRoom
  } = useRaid(profile?.id || null);

  useEffect(() => {
    if (isOpen && profile) {
      loadRaidData();
      loadInvites();
      loadCompletionCounts();
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (roomUuid) {
      loadRoomData(roomUuid);
    }
  }, [roomUuid]);

  const loadCompletionCounts = async () => {
    if (!profile) return;
    
    try {
      const counts: Record<string, number> = {};
      
      for (const map of raidMaps) {
        const count = await getTotalCompletions(map.id);
        counts[map.id] = count;
      }
      
      setCompletionCounts(counts);
    } catch (error) {
      console.error('Error loading completion counts:', error);
    }
  };

  // Effect to automatically navigate all players to the game when the raid starts
  useEffect(() => {
    if (currentRoom?.status === 'in_progress' && currentRoom.room_uuid) {
      console.log(`[RaidModal] Room status is 'in_progress'. Navigating all players to /raid/${currentRoom.room_uuid}`);
      // A small delay can help ensure all clients have a moment to sync before navigation
      setTimeout(() => {
        navigate(`/raid/${currentRoom.room_uuid}`);
      }, 500);
    }
  }, [currentRoom?.status, currentRoom?.room_uuid, navigate]);

  useEffect(() => {
    // Auto-show invite notification
    if (raidInvites.length > 0 && !currentInvite) {
      setCurrentInvite(raidInvites[0]);
    }
  }, [raidInvites, currentInvite]);

  const handleCreateRoom = async (mapId: string) => {
    const result = await createRoom(mapId);
    if (result.success && result.room_uuid) {
      setRoomUuid(result.room_uuid);
      setCurrentView('room');
      onProfileUpdate(); // Update raid tickets
    }
  };

  const handleSendInvite = async () => {
    if (!roomUuid || !inviteUsername.trim()) return;
    
    const success = await sendInvite(roomUuid, inviteUsername.trim());
    if (success) {
      setInviteUsername('');
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    const result = await respondToInvite(inviteId, 'accepted');
    if (result.success && result.room_uuid) {
      // The hook will now load the room data and set up the subscription
      setRoomUuid(result.room_uuid);
      setCurrentView('room');
      onProfileUpdate();
      setCurrentInvite(null);
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    await respondToInvite(inviteId, 'rejected');
    setCurrentInvite(null);
  };

  const handleStartRaid = async () => {
    if (!roomUuid) return;
    
    // This will just update the status. The useEffect above will handle navigation.
    await startRaid(roomUuid);
  };

  const handleSendChat = async () => {
    if (!currentRoom || !chatMessage.trim()) return;
    
    const success = await sendChatMessage(currentRoom.id, chatMessage.trim());
    if (success) {
      setChatMessage('');
    }
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
            <div className="flex items-center gap-3">
              <Swords className="w-8 h-8 text-red-500" />
              <h3 className="text-3xl text-white">RAID</h3>
              <div className="flex items-center gap-2 bg-red-900/30 px-3 py-1 rounded-lg border border-red-500/30">
                <img src={GAME_ASSETS.ZTICKET} alt="ZTicket" className="w-8 h-8" />
                <span className="font-semibold text-red-300">{profile?.raid_tickets || 0}/5</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Map Selection View */}
          {currentView === 'maps' && (
            <div>
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Select Raid Map
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {raidMaps.map((map) => (
                  <motion.div
                    key={map.id}
                    className="rpg-card-accent cursor-pointer hover:shadow-lg transition-all"
                    onClick={() => handleCreateRoom(map.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="text-center">
                      <img
                        src={map.background_url}
                        alt={map.name}
                        className="w-full h-32 object-cover rounded-lg mb-4 border-2 border-gray-600"
                      />
                      <h4 className="text-xl font-bold text-white mb-2">{map.name}</h4>
{/*                       <p className="text-gray-300 text-sm mb-3">{map.description}</p>
 */}                      
                      <div className="rpg-card-light p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-300">Boss:</span>
                          <span className="font-bold text-red-400">{map.boss_name}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-300">Difficulty:</span>
                          <span className={`font-bold ${RaidUtils.getDifficultyColor(map.difficulty_level)}`}>
                            {RaidUtils.getDifficultyName(map.difficulty_level)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Rewards:</span>
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="font-bold">{map.base_reward_exp} EXP</span>
                          </div>
                        </div>
                        
                        {/* Progress Bar untuk 50x completion */}
                       <div className="mt-3 pt-3 border-t border-gray-600/30">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-300 text-sm">Master Progress:</span>
                            <span className="text-yellow-400 font-bold text-sm">
                              {completionCounts[map.id] || 0}/50
                            </span>
                          </div>
                          <div className="progress-modern">
                            <div 
                              className="progress-fill bg-gradient-to-r from-yellow-400 to-yellow-600"
                              style={{ width: `${Math.min(((completionCounts[map.id] || 0) / 50) * 100, 100)}%` }}
                            />
                          </div>
                          {(completionCounts[map.id] || 0) >= 50 && (
                            <div className="mt-2 text-center">
                              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 px-3 py-1 rounded-lg font-bold text-sm">
                                Master Title Unlocked!
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        disabled={!profile || profile.raid_tickets < 1}
                        className="btn-danger w-full"
                      >
                        {!profile || profile.raid_tickets < 1 ? 'Need 1 Ticket' : 'Create Room'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Room View */}
          {currentView === 'room' && currentRoom && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">{currentRoom.raid_maps.name}</h3>
                  <p className="text-gray-300">Room: {currentRoom.room_uuid}</p>
                </div>
                <button
                  onClick={() => {
                    leaveRoom();
                    setCurrentView('maps');
                    setRoomUuid(null);
                    setCurrentRoom(null);
                  }}
                  className="btn-secondary"
                >
                  Leave
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Side: Participants */}
                <div className="rpg-card-light">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold text-white flex items-center">
                      <Users className="w-5 h-5 mr-2" />
                      Team ({participants.length}/{currentRoom.max_players})
                    </h4>
                    <button
                      onClick={() => loadRoomData(currentRoom.room_uuid)}
                      disabled={loading}
                      className="btn-secondary btn-sm p-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    {[1, 2, 3].map((slotNum) => {
                      const participant = participants.find(p => p.slot_number === slotNum);
                      
                      return (
                        <div
                          key={slotNum}
                          className={`p-4 rounded-lg border-2 ${
                            participant 
                              ? 'bg-green-900/30 border-green-500/50' 
                              : 'bg-gray-700/30 border-gray-600/50 border-dashed'
                          }`}
                        >
                          {participant ? (
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <img
                                  src={participant.profiles.profile_image_url}
                                  alt={participant.profiles.username}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-green-400"
                                />
                                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-semibold px-1 rounded-full">
                                  {participant.profiles.level}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-white">{participant.profiles.username}</div>
                                <div className="text-sm text-gray-300 capitalize">
                                  {participant.profiles.character_type} • Level {participant.profiles.level}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Shield className="w-4 h-4 text-blue-400" />
                                  <span className="text-sm">{participant.current_hp}/{participant.max_hp} HP</span>
                                  <Zap className="w-4 h-4 text-orange-400" />
                                  <span className="text-sm">{participant.profiles.strength} STR</span>
                                </div>
                              </div>
                              {participant.profile_id === currentRoom.creator_id && (
                                <Crown className="w-1 h-1 text-yellow-500" aria-label="Room Creator" />
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p className="text-gray-400">Waiting for player...</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Invite System */}
                  {currentRoom.status === 'waiting' && participants.length < currentRoom.max_players && (
                    <div className="rpg-card-accent p-4">
                      <h5 className="font-bold text-white mb-3">Invite Friends</h5>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inviteUsername}
                          onChange={(e) => setInviteUsername(e.target.value)}
                          placeholder="Enter username"
                          className="input-modern flex-1 text-sm"
                          onKeyPress={(e) => e.key === 'Enter' && handleSendInvite()}
                        />
                        <button
                          onClick={handleSendInvite}
                          disabled={!inviteUsername.trim()}
                          className="btn-success btn-sm"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Start Button */}
                  {currentRoom.creator_id === profile?.id && currentRoom.status === 'waiting' && (
                    <button
                      onClick={handleStartRaid}
                      disabled={participants.length < 2}
                      className="btn-danger w-full btn-lg mt-4 rpg-glow"
                    >
                      {participants.length < 2 ? 'Need 2+ Players' : 'START BATTLE'}
                    </button>
                  )}

                  {/* Join/Waiting Message for Non-Creators */}
                  {currentRoom.creator_id !== profile?.id && currentRoom.status === 'waiting' && participants.length >= 2 && (
                    <button
                      onClick={handleStartRaid}
                      className="btn-success w-full btn-lg mt-4 rpg-glow"
                    >
                      <Swords className="w-5 h-5 mr-2" />
                      JOIN BATTLE
                    </button>
                  )}

                  {/* Battle Starting Message */}
                  {currentRoom.status === 'in_progress' && (
                    <div className="rpg-card-accent p-4 mt-4 text-center">
                      <Swords className="w-6 h-6 mx-auto mb-2 text-red-500 animate-pulse" />
                      <p className="text-white font-semibold">Battle Starting!</p>
                      <p className="text-gray-300 text-sm">Entering battlefield...</p>
                    </div>
                  )}
                </div>

                {/* Right Side: Map Info & Chat */}
                <div className="space-y-6">
                  {/* Map Info */}
                  <div className="rpg-card-light">
                    <h4 className="text-xl font-bold text-white mb-4">Map Details</h4>
                    <div className="text-center mb-4">
                      <img
                        src={currentRoom.raid_maps.background_url}
                        alt={currentRoom.raid_maps.name}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-600 mb-3"
                      />
                      <h5 className="text-lg font-bold text-white">{currentRoom.raid_maps.name}</h5>
                      <p className="text-gray-300 text-sm">{currentRoom.raid_maps.description}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Final Boss:</span>
                        <span className="font-bold text-red-400">{currentRoom.raid_maps.boss_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Difficulty:</span>
                        <span className={`font-bold ${RaidUtils.getDifficultyColor(currentRoom.raid_maps.difficulty_level)}`}>
                          {RaidUtils.getDifficultyName(currentRoom.raid_maps.difficulty_level)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Base Rewards:</span>
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span className="font-bold">{currentRoom.raid_maps.base_reward_exp} EXP</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="rpg-card-accent p-4">
              <h4 className="font-semibold text-white mb-2 flex items-center">
                <Star className="w-4 h-4 mr-2 text-yellow-400" />
                RAID Rules
              </h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>• 2-3 players cooperative mode</p>
                <p>• 1 Raid Ticket required per session</p>
                <p>• 3 rounds with progressive difficulty</p>
                <p>• Turn-based team combat system</p>
                <p>• Mini-game card rewards on victory</p>
                <p>• Master titles for 50 completions</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Raid Invite Notification */}
      {currentInvite && (
        <RaidInviteNotification
          invite={currentInvite}
          onAccept={() => handleAcceptInvite(currentInvite.id)}
          onReject={() => handleRejectInvite(currentInvite.id)}
          onTimeout={() => setCurrentInvite(null)}
          onNavigateToRoom={(roomUuid) => {
            setRoomUuid(roomUuid);
            setCurrentView('room');
            setCurrentInvite(null);
          }}
        />
      )}
    </AnimatePresence>
  );
}

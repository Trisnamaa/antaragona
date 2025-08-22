import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Gift, Crown, Zap, Trophy, CheckCircle, Clock, Users, X } from 'lucide-react';
import { GAME_ASSETS } from '../assets/gameAssets';
import { RaidParticipant } from '../hooks/useRaid'; // Import the interface
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface CardReward {
  id: number;
  type: string;
  value: number;
  claimed: boolean;
}

interface Profile {
  id: string;
  username: string;
}

interface RaidCardRewardsProps {
  isOpen: boolean;
  profile: Profile | null;
  cardRewards: CardReward[] | null;
  participants: RaidParticipant[];
  onComplete: () => void;
  markRewardsAsClaimed: (roomUuid: string, selectedCards: number[]) => Promise<boolean>;
  roomUuid?: string; // Add room UUID for broadcasting
}

export function RaidCardRewards({ 
  isOpen, 
  profile,
  cardRewards,
  participants, 
  onComplete,
  markRewardsAsClaimed,
  roomUuid
}: RaidCardRewardsProps) {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [isClaimed, setIsClaimed] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<any[]>([]);
  const [claimCountdown, setClaimCountdown] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const cardsPerPlayer = 2;

  // Check if all players have claimed their rewards
  useEffect(() => {
    if (!participants || participants.length === 0) return;

    const allClaimed = participants.every(p => p.claimed_rewards_at);

    if (allClaimed) {
      console.log('[RaidRewards] All players claimed rewards. Returning to lobby.');
      // Broadcast to all players that rewards are complete
      if (roomUuid) {
        supabase.channel(`raid-rewards:${roomUuid}`).send({
          type: 'broadcast',
          event: 'rewards-complete',
          payload: { message: 'All rewards claimed! Returning to lobby...' }
        });
      }
      
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  }, [participants, onComplete, roomUuid]);
  
  // Check if the current player has already claimed
  useEffect(() => {
    const me = participants.find(p => p.profile_id === profile?.id);
    if (me && me.claimed_rewards_at && !isClaimed) {
      setIsClaimed(true);
      console.log(`[RaidRewards] Player ${profile?.username} has already claimed rewards.`);
    }
  }, [participants, profile, isClaimed]);

  // Auto-show modal for all players when raid is completed
  useEffect(() => {
    if (isOpen && roomUuid) {
      console.log(`[RaidRewards] Modal opened for room ${roomUuid}. Broadcasting to all players...`);
      
      // Broadcast to all players in the room to show rewards modal
      supabase.channel(`raid-rewards:${roomUuid}`).send({
        type: 'broadcast',
        event: 'show-rewards',
        payload: { 
          message: 'Victory! Claim your rewards!',
          roomUuid: roomUuid
        }
      });
    }
  }, [isOpen, roomUuid]);

  const handleCardSelect = (cardId: number) => {
    if (isClaimed || selectedCards.length >= cardsPerPlayer) return;

    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleConfirmSelection = async () => {
    if (selectedCards.length !== cardsPerPlayer || isClaimed) return;

    if (!roomUuid || !profile) return;

    setLoading(true);
    console.log(`[RaidRewards] ${profile.username} confirming card selection:`, selectedCards);

    try {
      // Call the claim function with room UUID and selected cards
      const success = await markRewardsAsClaimed(roomUuid, selectedCards);

      if (success) {
        setIsClaimed(true);
        
        // Get the selected rewards for display
        const selectedRewards = cardRewards?.filter(card => selectedCards.includes(card.id)) || [];
        setClaimedRewards(selectedRewards);
        
        // Show reward summary
        const rewardSummary = selectedRewards.map(reward => 
          `${reward.value} ${reward.type.replace('_', ' ')}`
        ).join(', ');
        
        toast.success(`🎉 Rewards claimed: ${rewardSummary}`);
        
        // Broadcast to other players that this player has claimed rewards
        supabase.channel(`raid-rewards:${roomUuid}`).send({
          type: 'broadcast',
          event: 'player-claimed',
          payload: { 
            playerId: profile.id,
            playerName: profile.username,
            message: `${profile.username} has claimed their rewards!`
          }
        });
        
        addToActionLog(`${profile.username} claimed their rewards!`);
        
        // Start countdown for auto-return to lobby
        setClaimCountdown(5);
        const countdownInterval = setInterval(() => {
          setClaimCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast.error('Failed to claim rewards. Please try again.');
      }
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error('Failed to claim rewards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addToActionLog = (message: string) => {
    // This function can be expanded to show action log in the UI
    console.log(`[RaidRewards] ${message}`);
  };

  const getCardIcon = (type: string) => {
    switch (type) {
      case 'raid_ticket': return <Crown className="w-8 h-8 text-red-500" />;
      case 'ztoken': return <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-8 h-8" />;
      case 'exp': return <Star className="w-8 h-8 text-yellow-500" />;
      case 'zgold': return <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-8 h-8" />;
      default: return <Gift className="w-8 h-8 text-purple-500" />;
    }
  };

  const getCardColor = (type: string) => {
    switch (type) {
      case 'raid_ticket': return 'from-red-500 to-red-700';
      case 'ztoken': return 'from-blue-500 to-blue-700';
      case 'exp': return 'from-yellow-500 to-yellow-700';
      case 'zgold': return 'from-green-500 to-green-700';
      default: return 'from-purple-500 to-purple-700';
    }
  };

  const getRewardText = (card: CardReward) => {
    switch (card.type) {
      case 'raid_ticket': return `${card.value} Raid Ticket`;
      case 'ztoken': return `${card.value} ZToken`;
      case 'exp': return `${card.value} EXP`;
      case 'zgold': return `${card.value.toLocaleString()} ZGold`;
      default: return 'Mystery Reward';
    }
  };

  if (!isOpen) return null;

  // Don't render if no card rewards available
  if (!cardRewards || cardRewards.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="rpg-card w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">
              🎉 RAID REWARDS 🎉
            </h2>
            <button 
              onClick={onComplete}
              className="btn-secondary btn-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center mb-6">
            <p className="text-gray-300">Select {cardsPerPlayer} cards to claim your prize.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card Selection Area */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-6">
                {cardRewards.map((card) => (
                  <motion.div
                    key={card.id}
                    className={`aspect-square cursor-pointer transition-all rounded-lg border-2 flex items-center justify-center relative overflow-hidden ${
                      selectedCards.includes(card.id)
                        ? 'border-yellow-400 scale-105 shadow-lg'
                        : 'border-purple-400'
                    } ${isClaimed ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                    onClick={() => handleCardSelect(card.id)}
                  >
                    <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-800">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-purple-900/20"></div>
                      <Gift className="w-8 h-8 text-purple-200 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      <div className="absolute bottom-1 right-1 text-xs font-bold text-purple-200">
                        {card.id}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              {!isClaimed && (
                <div className="text-center">
                  <button
                    onClick={handleConfirmSelection}
                    disabled={selectedCards.length !== cardsPerPlayer || loading}
                    className="btn-primary btn-lg"
                  >
                    <Trophy className="w-5 h-5 mr-2" />
                    {loading ? 'Claiming...' : `Confirm Selection (${selectedCards.length}/${cardsPerPlayer})`}
                  </button>
                </div>
              )}

              {isClaimed && claimedRewards.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-xl font-bold text-white text-center mb-4">Your Claimed Rewards!</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {claimedRewards.map((card, index) => (
                        <motion.div
                          key={card.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.2 }}
                          className={`rpg-card-accent p-4 text-center bg-gradient-to-br ${getCardColor(card.type)}`}
                        >
                          <div className="mb-3">{getCardIcon(card.type)}</div>
                          <h4 className="font-bold text-white text-lg mb-1">{getRewardText(card)}</h4>
                          <p className="text-gray-200 text-sm capitalize">{card.type.replace('_', ' ')} Reward</p>
                        </motion.div>
                      ))}
                    </div>
                    
                    {/* Countdown for auto-return */}
                    {claimCountdown > 0 && (
                      <div className="mt-4 text-center">
                        <div className="rpg-card-light p-3">
                          <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-400 animate-pulse" />
                          <p className="text-white font-semibold">Returning to lobby in {claimCountdown} seconds...</p>
                          <button
                            onClick={onComplete}
                            className="btn-primary btn-sm mt-2"
                          >
                            Return Now
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Player Status Area */}
            <div className="rpg-card-light">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Team Status
              </h3>
              <div className="space-y-3">
                {participants.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex-1">
                    <span className={`font-semibold ${p.profile_id === profile?.id ? 'text-purple-400' : 'text-white'}`}>
                      {p.profiles.username}
                      {p.profile_id === profile?.id && ' (You)'}
                    </span>
                      <div className="text-xs text-gray-400 mt-1">
                        Slot {p.slot_number} • Level {p.profiles.level}
                      </div>
                    </div>
                    {p.claimed_rewards_at ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">Claimed</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-400 animate-pulse">
                        <Clock className="w-5 h-5" />
                        <span className="text-sm">Selecting...</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Progress indicator */}
              <div className="mt-4 pt-3 border-t border-gray-600">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-300">Progress:</span>
                  <span className="text-sm font-semibold text-yellow-400">
                    {participants.filter(p => p.claimed_rewards_at).length}/{participants.length} Claimed
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(participants.filter(p => p.claimed_rewards_at).length / participants.length) * 100}%` 
                    }}
                  />
                </div>
              </div>
              
              {isClaimed && (
                <div className="mt-6 text-center rpg-card-accent p-4">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  <h4 className="font-bold text-white mb-2">Rewards Claimed!</h4>
                  <p className="text-gray-300 text-sm">Waiting for teammates to finish selecting...</p>
                  {claimCountdown > 0 && (
                    <p className="text-yellow-400 text-sm mt-2 font-semibold">
                      Auto-return in {claimCountdown}s
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

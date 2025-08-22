import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Check, X, Clock, Crown } from 'lucide-react';

interface RaidInvite {
  id: string;
  inviter_username: string;
  room_uuid: string;
  map_name: string;
  expires_at: string;
}

interface RaidInviteNotificationProps {
  invite: RaidInvite | null;
  onAccept: (inviteId: string) => void;
  onReject: (inviteId: string) => void;
  onTimeout: () => void;
  onNavigateToRoom?: (roomUuid: string) => void;
}

export function RaidInviteNotification({ 
  invite, 
  onAccept, 
  onReject, 
  onTimeout,
  onNavigateToRoom
}: RaidInviteNotificationProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!invite) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(invite.expires_at).getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      return diff;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        onTimeout();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [invite, onTimeout]);

  if (!invite) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        className="fixed top-4 right-4 z-[60]"
      >
        <div className="rpg-card-accent max-w-sm border-2 border-red-500 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-400" />
              <span className="font-semibold text-white">RAID Invite</span>
            </div>
            <div className="flex items-center gap-1 text-yellow-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-bold">{timeLeft}s</span>
            </div>
          </div>

          {/* Invite Info */}
          <div className="mb-4">
            <div className="rpg-card-light p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span className="font-bold text-white">{invite.inviter_username}</span>
              </div>
              <div className="text-sm text-gray-300">
                invites you to join
              </div>
              <div className="font-bold text-red-400 mt-1">{invite.map_name}</div>
            </div>
            
            <div className="text-center">
              <p className="text-gray-300 text-sm">
                Room: <span className="font-mono text-purple-400">{invite.room_uuid}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-3">
            <button
              onClick={() => {
                onAccept(invite.id);
                if (onNavigateToRoom) {
                  onNavigateToRoom(invite.room_uuid);
                }
              }}
              className="btn-success flex-1 btn-sm"
            >
              <Check className="w-4 h-4 mr-1" />
              Accept
            </button>
            <button
              onClick={() => onReject(invite.id)}
              className="btn-danger flex-1 btn-sm"
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-1">
            <motion.div
              className="bg-red-400 h-1 rounded-full"
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / 120) * 100}%` }} // 2 minutes = 120 seconds
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
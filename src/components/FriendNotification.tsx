import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Check, X, Clock } from 'lucide-react';
import { TitleDisplay } from './TitleDisplay';
import { useUserTitle } from '../hooks/useTitles';

interface FriendRequest {
  id: string;
  requester_id: string;
  requester_username: string;
  requester_profile_image_url: string;
  requester_character_type: string;
  requester_level: number;
}

interface FriendNotificationProps {
  request: FriendRequest | null;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onTimeout: () => void;
}

export function FriendNotification({ 
  request, 
  onAccept, 
  onReject, 
  onTimeout 
}: FriendNotificationProps) {
  const [timeLeft, setTimeLeft] = useState(10);
  const { title } = useUserTitle(request?.requester_id || null);

  useEffect(() => {
    if (!request) return;

    setTimeLeft(10);
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [request, onTimeout]);

  if (!request) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-4 right-4 z-50"
      >
        <div className="rpg-card-accent max-w-sm border-2 border-purple-500 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="font-semibold text-white">Friend Request</span>
            </div>
            <div className="flex items-center gap-1 text-yellow-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-bold">{timeLeft}s</span>
            </div>
          </div>

          {/* Requester Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <img
                src={request.requester_profile_image_url}
                alt={request.requester_username}
                className="w-12 h-12 rounded-full object-cover border-2 border-purple-400"
              />
              <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-semibold px-1 rounded-full">
                {request.requester_level}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-white">{request.requester_username}</span>
                {title && (
                  <TitleDisplay 
                    title={title} 
                    size="small" 
                    showIcon={true}
                  />
                )}
              </div>
              <div className="text-xs text-gray-300 capitalize">
                {request.requester_character_type} • Level {request.requester_level}
              </div>
            </div>
          </div>

          <p className="text-center text-gray-300 mb-4">
            wants to be your friend!
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => onAccept(request.id)}
              className="btn-success flex-1 btn-sm"
            >
              <Check className="w-4 h-4 mr-1" />
              Accept
            </button>
            <button
              onClick={() => onReject(request.id)}
              className="btn-danger flex-1 btn-sm"
            >
              <X className="w-4 h-4 mr-1" />
              Reject
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="w-full bg-gray-700 rounded-full h-1">
              <motion.div
                className="bg-yellow-400 h-1 rounded-full"
                initial={{ width: '100%' }}
                animate={{ width: `${(timeLeft / 10) * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
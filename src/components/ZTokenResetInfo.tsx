import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, Clock } from 'lucide-react';

interface ZTokenResetInfoProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ZTokenResetInfo({ isOpen, onClose }: ZTokenResetInfoProps) {
  return (
    <AnimatePresence>
      {isOpen && (
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
            className="rpg-card max-w-md w-full mx-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Info className="w-6 h-6 mr-2 text-purple-400" />
                ZToken Reset
              </h2>
              <button 
                onClick={onClose}
                className="btn-secondary btn-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="text-center mb-6">
              <p className="text-gray-300 mb-4">
                Your ZToken balance is reset daily to 25 if it falls below this amount.
                This ensures all players have enough ZToken to participate in daily activities.
              </p>
              
              <div className="rpg-card-accent p-4">
                <div className="flex items-center justify-center mb-2">
                  <Clock className="w-5 h-5 mr-2 text-purple-500" />
                </div>
                <p className="text-lg font-bold text-white">18:00 WIB (11:00 UTC)</p>
                <p className="text-sm text-gray-300 mt-1">Every day</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="btn-primary w-full"
            >
              Got It!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
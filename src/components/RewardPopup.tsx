// Create new file: src/components/RewardPopup.tsx
import React from 'react';
import { X, Trophy } from 'lucide-react';

interface RewardPopupProps {
  rewards: {
    gold: number;
    zgold: number;
    exp: number;
    title?: string;
  };
  onClose: () => void;
  onClaim: () => void;
}

const RewardPopup: React.FC<RewardPopupProps> = ({ rewards, onClose, onClaim }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-purple-900 to-blue-900 p-6 rounded-xl max-w-md w-full mx-4 relative border-2 border-yellow-400">
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-center text-white mb-4">
          Stage Complete!
        </h2>

        <div className="space-y-4">
          {/* Regular Rewards */}
          <div className="bg-black/30 p-4 rounded-lg">
            <h3 className="text-xl text-center text-yellow-400 mb-4">Rewards</h3>
            <div className="space-y-2">
              <p className="text-white flex justify-between">
                <span>Gold</span>
                <span className="text-yellow-400">+{rewards.gold}</span>
              </p>
              <p className="text-white flex justify-between">
                <span>ZGold</span>
                <span className="text-blue-400">+{rewards.zgold}</span>
              </p>
              <p className="text-white flex justify-between">
                <span>Experience</span>
                <span className="text-green-400">+{rewards.exp}</span>
              </p>
            </div>
          </div>

          {/* Title Reward */}
          {rewards.title && (
            <div className="bg-yellow-500/20 p-4 rounded-lg animate-pulse">
              <h3 className="text-center text-yellow-400 mb-2">
                🎉 New Title Unlocked!
              </h3>
              <p className="text-white text-center font-bold">
                "{rewards.title}"
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onClaim}
          className="w-full mt-6 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2"
        >
          <Trophy className="w-5 h-5" />
          Claim Rewards
        </button>
      </div>
    </div>
  );
};

export default RewardPopup;
import React from 'react';
import { Star, Crown, Key, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface StageListModalProps {
  world: {
    id: number;
    name: string;
    color: string;
    stageRange: { start: number; end: number };
  };
  isOpen: boolean;
  onClose: () => void;
  onStageSelect: (stage: number) => void;
  isStageAvailable: (stage: number) => boolean;
  isStageCompleted: (stage: number) => boolean;
  getStageType: (stage: number) => 'normal' | 'boss' | 'final';
  getRoundsForStage: (stage: number) => number;
}

const StageListModal: React.FC<StageListModalProps> = ({
  world,
  isOpen,
  onClose,
  onStageSelect,
  isStageAvailable,
  isStageCompleted,
  getStageType,
  getRoundsForStage
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-slate-800 rounded-xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 ${world.color} relative`}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-white/80 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-white">{world.name}</h2>
          <p className="text-white/80">
            Stages {world.stageRange.start}-{world.stageRange.end}
          </p>
        </div>

        {/* Stage Grid */}
        <div className="p-4">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {Array.from({ length: 10 }, (_, i) => {
              const stageNum = world.stageRange.start + i;
              const available = isStageAvailable(stageNum);
              const completed = isStageCompleted(stageNum);
              const stageType = getStageType(stageNum);

              return (
                <button
                  key={stageNum}
                  onClick={() => available && onStageSelect(stageNum)}
                  disabled={!available}
                  className={`
                    relative p-3 rounded-lg font-bold transition-all duration-300 group
                    ${completed 
                      ? 'bg-green-600 text-white shadow-lg' 
                      : available 
                        ? stageType === 'final'
                          ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg'
                          : stageType === 'boss' 
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {/* Stage indicators */}
                  {completed && (
                    <Star className="w-3 h-3 absolute top-0.5 right-0.5 text-yellow-400" />
                  )}
                  {stageType === 'final' && (
                    <Key className="w-3 h-3 absolute top-0.5 left-0.5 text-yellow-400" />
                  )}
                  {stageType === 'boss' && (
                    <Crown className="w-3 h-3 absolute top-0.5 left-0.5 text-yellow-400" />
                  )}

                  <div className="text-center">
                    <div className="text-lg font-bold">{stageNum}</div>
                    <div className="text-xs opacity-75">
                      {stageType === 'final' ? 'Final' : stageType === 'boss' ? 'Boss' : 'Stage'}
                    </div>
                  </div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {getRoundsForStage(stageNum)} Rounds
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-white/80">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded" />
              <span>Normal Stage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded" />
              <span>Boss Stage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-600 rounded" />
              <span>Final Stage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded" />
              <span>Completed</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StageListModal;
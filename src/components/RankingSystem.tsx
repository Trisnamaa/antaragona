import React from 'react';
import { Crown, Trophy, Shield, Star, Award, Medal } from 'lucide-react';

export interface RankInfo {
  position: number;
  name: string;
  iconUrl: string;
  color: string;
  bgColor: string;
  textColor: string;
}

export const getRankInfo = (position: number): RankInfo => {
  if (position === 1) {
    return {
      position,
      name: 'Mythic Overload',
      iconUrl: 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752603535158-sml0di.png',
      color: 'from-purple-600 via-pink-600 to-red-600',
      bgColor: 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600',
      textColor: 'text-white'
    };
  } else if (position >= 2 && position <= 5) {
    return {
      position,
      name: 'Flame Champion',
      iconUrl: 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752603526365-fk61ub.png',
      color: 'from-red-500 via-orange-500 to-yellow-500',
      bgColor: 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500',
      textColor: 'text-white'
    };
  } else if (position >= 6 && position <= 15) {
    return {
      position,
      name: 'Crystal Paladin',
      iconUrl: 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752603517800-2qgkjt.png',
      color: 'from-blue-500 via-cyan-500 to-teal-500',
      bgColor: 'bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500',
      textColor: 'text-white'
    };
  } else if (position >= 16 && position <= 25) {
    return {
      position,
      name: 'Emerald Knight',
      iconUrl: 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752603510158-cm02oz.png',
      color: 'from-green-500 via-emerald-500 to-teal-500',
      bgColor: 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500',
      textColor: 'text-white'
    };
  } else if (position >= 26 && position <= 35) {
    return {
      position,
      name: 'Iron Sentinel',
      iconUrl: 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752603501669-flbtgl.png',
      color: 'from-gray-500 via-slate-500 to-zinc-500',
      bgColor: 'bg-gradient-to-r from-gray-500 via-slate-500 to-zinc-500',
      textColor: 'text-white'
    };
  } else {
    return {
      position,
      name: 'Bronze Defender',
      iconUrl: 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752603484789-e0mr89.png',
      color: 'from-orange-600 via-amber-600 to-yellow-600',
      bgColor: 'bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600',
      textColor: 'text-white'
    };
  }
};

interface RankBadgeProps {
  position: number;
  size?: 'small' | 'medium' | 'large';
  showName?: boolean;
  className?: string;
}

export function RankBadge({ position, size = 'medium', showName = false, className = '' }: RankBadgeProps) {
  const rankInfo = getRankInfo(position);
  
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const textSizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <img
          src={rankInfo.iconUrl}
          alt={rankInfo.name}
          className={`${sizeClasses[size]} object-contain rounded-lg `}
        />
        {position <= 3 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 border border-white rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-black">{position}</span>
          </div>
        )}
      </div>
      {showName && (
        <div className={`${rankInfo.bgColor} ${rankInfo.textColor} px-3 py-1 rounded-lg font-semibold ${textSizes[size]}`}>
          {rankInfo.name}
        </div>
      )}
    </div>
  );
}

interface RankProgressProps {
  currentPosition: number;
  wins: number;
  losses: number;
  className?: string;
}

export function RankProgress({ currentPosition, wins, losses, className = '' }: RankProgressProps) {
  const currentRank = getRankInfo(currentPosition);
  const nextPosition = Math.max(1, currentPosition - 1);
  const nextRank = getRankInfo(nextPosition);
  
  const totalBattles = wins + losses;
  const winRate = totalBattles > 0 ? (wins / totalBattles) * 100 : 0;

  return (
    <div className={`card-dark ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <RankBadge position={currentPosition} size="large" />
          <div>
            <h3 className="font-bold text-white">
              #{currentPosition} {currentRank.name}
            </h3>
            <p className="text-gray-300 font-medium text-sm">
              {wins}W / {losses}L ({winRate.toFixed(1)}% WR)
            </p>
          </div>
        </div>
        {currentPosition > 1 && (
          <div className="text-right">
            <p className="text-gray-400 font-medium text-xs">Next Rank:</p>
            <RankBadge position={nextPosition} size="small" showName />
          </div>
        )}
      </div>
      
      {/* Progress to next rank */}
      {currentPosition > 1 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-medium text-sm">Rank Progress</span>
            <span className="text-yellow-400 font-bold text-sm">
              {Math.min(wins, 10)}/10 wins needed
            </span>
          </div>
          <div className="progress-modern">
            <div 
              className="progress-fill bg-gradient-to-r from-yellow-400 to-yellow-600"
              style={{ width: `${Math.min((wins / 10) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default RankBadge;
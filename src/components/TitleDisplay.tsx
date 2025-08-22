import React from 'react';
import { Crown, Star, Gem, Award, Shield } from 'lucide-react';

interface Title {
  id: string;
  name: string;
  description: string;
  color: string;
  rarity: string;
}

interface TitleDisplayProps {
  title: Title | null;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  className?: string;
}

const TITLE_COLORS = {
  gold: {
    bg: 'bg-gradient-to-r from-yellow-400 to-yellow-600',
    border: 'border-yellow-500',
    text: 'text-yellow-900',
    shadow: 'shadow-yellow-500/30'
  },
  silver: {
    bg: 'bg-gradient-to-r from-gray-300 to-gray-500',
    border: 'border-gray-400',
    text: 'text-gray-900',
    shadow: 'shadow-gray-500/30'
  },
  bronze: {
    bg: 'bg-gradient-to-r from-orange-400 to-orange-600',
    border: 'border-orange-500',
    text: 'text-orange-900',
    shadow: 'shadow-orange-500/30'
  },
  diamond: {
    bg: 'bg-gradient-to-r from-cyan-300 to-purple-500',
    border: 'border-purple-400',
    text: 'text-white',
    shadow: 'shadow-purple-500/30'
  },
  ruby: {
    bg: 'bg-gradient-to-r from-red-500 to-red-700',
    border: 'border-red-600',
    text: 'text-white',
    shadow: 'shadow-red-500/30'
  },
  emerald: {
    bg: 'bg-gradient-to-r from-green-400 to-green-600',
    border: 'border-green-500',
    text: 'text-white',
    shadow: 'shadow-green-500/30'
  },
  purple: {
    bg: 'bg-gradient-to-r from-purple-500 to-purple-700',
    border: 'border-purple-600',
    text: 'text-white',
    shadow: 'shadow-purple-500/30'
  }
};

const RARITY_ICONS = {
  common: Star,
  rare: Award,
  epic: Shield,
  legendary: Crown
};

const SIZE_CLASSES = {
  small: {
    container: 'px-2 py-1 text-xs',
    icon: 'w-3 h-3',
    border: 'border-2'
  },
  medium: {
    container: 'px-3 py-1 text-sm',
    icon: 'w-4 h-4',
    border: 'border-2'
  },
  large: {
    container: 'px-4 py-2 text-lg',
    icon: 'w-5 h-5',
    border: 'border-2'
  }
};

export function TitleDisplay({ 
  title, 
  size = 'medium', 
  showIcon = true, 
  className = '' 
}: TitleDisplayProps) {
  if (!title) return null;

  const colorScheme = TITLE_COLORS[title.color as keyof typeof TITLE_COLORS] || TITLE_COLORS.gold;
  const sizeClasses = SIZE_CLASSES[size];
  const RarityIcon = RARITY_ICONS[title.rarity as keyof typeof RARITY_ICONS] || Star;

  return (
    <div 
      className={`
        inline-flex items-center gap-1 font-semibold rounded-lg
        ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}
        ${sizeClasses.container} ${sizeClasses.border}
        ${colorScheme.shadow} shadow-sm transform transition-all duration-200
        hover:scale-105 hover:shadow-md
        relative overflow-hidden
        ${className}
      `}
      title={title.description}
    >
      {showIcon && (
        <RarityIcon className={`${sizeClasses.icon} ${colorScheme.text}`} />
      )}
      <span className="font-semibold">{title.name}</span>
    </div>
  );
}

interface UsernameWithTitleProps {
  username: string;
  title?: Title | null;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function UsernameWithTitle({ 
  username, 
  title, 
  size = 'medium', 
  className = '' 
}: UsernameWithTitleProps) {
  const sizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-semibold ${sizeClasses[size]}`}>
        {username}
      </span>
      {title && (
        <TitleDisplay 
          title={title} 
          size={size} 
          showIcon={true}
        />
      )}
    </div>
  );
}

interface TitleSelectorProps {
  availableTitles: Title[];
  equippedTitle: Title | null;
  onEquipTitle: (titleId: string) => void;
  onUnequipTitle: () => void;
  loading?: boolean;
}

export function TitleSelector({ 
  availableTitles, 
  equippedTitle, 
  onEquipTitle, 
  onUnequipTitle,
  loading = false 
}: TitleSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white flex items-center">
        <Crown className="w-6 h-6 mr-2 text-yellow-500" />
        Manage Titles
      </h3>
      
      {/* Currently Equipped */}
      <div className="rpg-card-accent">
        <h4 className="font-semibold text-white mb-3">Equipped Title</h4>
        {equippedTitle ? (
          <div className="flex items-center justify-between">
            <TitleDisplay title={equippedTitle} size="medium" />
            <button
              onClick={onUnequipTitle}
              disabled={loading}
              className="btn-danger btn-sm"
            >
              Unequip
            </button>
          </div>
        ) : (
          <p className="text-gray-300 font-medium">No title equipped</p>
        )}
      </div>

      {/* Available Titles */}
      <div className="rpg-card-light">
        <h4 className="font-semibold text-white mb-3">
          Available Titles ({availableTitles.length})
        </h4>
        
        {availableTitles.length > 0 ? (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {availableTitles.map((title) => (
              <div key={title.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600/30">
                <div className="flex-1">
                  <TitleDisplay title={title} size="medium" />
                  <p className="text-xs text-gray-300 mt-1">{title.description}</p>
                </div>
                <button
                  onClick={() => onEquipTitle(title.id)}
                  disabled={loading || equippedTitle?.id === title.id}
                  className="btn-success btn-sm ml-4"
                >
                  {equippedTitle?.id === title.id ? 'Equipped' : 'Equip'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-300 font-medium">No titles available. Complete achievements to unlock titles!</p>
        )}
      </div>
    </div>
  );
}
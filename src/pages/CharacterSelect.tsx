import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, User, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';

const CharacterSelect: React.FC = () => {
  const [selectedCharacter, setSelectedCharacter] = useState<'male' | 'female' | null>(null);
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!selectedCharacter) {
      toast.error('Please select a character first');
      return;
    }
    if (!username) {
      toast.error('Please enter a username');
      return;
    }
    if (username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }

    navigate('/create-profile', { 
      state: { character: selectedCharacter, username } 
    });
  };

  return (
    <div className="min-h-screen rpg-bg p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-lg mb-4 rpg-glow">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 rpg-text-glow">Choose Your Character</h1>
          <p className="text-gray-300">Select your character type and create your identity</p>
        </div>

        <div className="rpg-card">
          {/* Character Selection */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <Users className="w-6 h-6 mr-2 text-purple-400" />
              Character Type
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Male Character */}
              <div
                className={`cursor-pointer transition-all duration-200 rounded-xl p-6 border-2 ${
                  selectedCharacter === 'male' 
                    ? 'border-purple-500 bg-purple-900/30 shadow-md rpg-glow' 
                    : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:shadow-sm'
                }`}
                onClick={() => setSelectedCharacter('male')}
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl mb-4 shadow-lg">
                    <img
                      src={GAME_ASSETS.CHARACTER_MALE}
                      alt="Male Character"
                      className="w-16 h-16 object-contain"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Male Warrior</h3>
                  <p className="text-sm text-gray-300">Strong and brave fighter</p>
                </div>
              </div>

              {/* Female Character */}
              <div
                className={`cursor-pointer transition-all duration-200 rounded-xl p-6 border-2 ${
                  selectedCharacter === 'female' 
                    ? 'border-purple-500 bg-purple-900/30 shadow-md rpg-glow' 
                    : 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:shadow-sm'
                }`}
                onClick={() => setSelectedCharacter('female')}
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl mb-4 shadow-lg">
                    <img
                      src={GAME_ASSETS.CHARACTER_FEMALE}
                      alt="Female Character"
                      className="w-16 h-16 object-contain"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Female Mage</h3>
                  <p className="text-sm text-gray-300">Wise and magical spellcaster</p>
                </div>
              </div>
            </div>
          </div>

          {/* Username Input */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-modern w-full"
              placeholder="Enter your username"
              minLength={3}
              required
            />
            <p className="text-sm text-gray-400 mt-2">Minimum 3 characters</p>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="btn-primary w-full btn-lg"
          >
            Continue
          </button>
        </div>

        {/* Decorative Elements */}
        <div className="mt-8 flex justify-center space-x-2">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  );
};

export default CharacterSelect;
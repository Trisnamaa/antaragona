import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Star, Award, Shield, Gem } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TitleSelector, TitleDisplay } from '../components/TitleDisplay';
import { useTitles } from '../hooks/useTitles';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  username: string;
  equipped_title_id: string | null;
}

export default function TitleManager() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const {
    availableTitles,
    equippedTitle,
    loading: titlesLoading,
    equipTitle,
    unequipTitle,
    loadTitles
  } = useTitles(profile?.id || null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, equipped_title_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEquipTitle = async (titleId: string) => {
    await equipTitle(titleId);
  };

  const handleUnequipTitle = async () => {
    await unequipTitle();
  };

  if (loading) {
    return (
      <div className="min-h-screen rpg-bg flex items-center justify-center">
        <div className="rpg-card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-white">Loading Titles...</div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen rpg-bg">
      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate('/lobby')}
            className="btn-secondary"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Lobby
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Crown className="w-6 h-6 mr-2 text-yellow-500" />
            Title Manager
          </h1>
          <div className="w-32"></div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Profile Preview */}
          <div className="rpg-card mb-8">
            <h2 className="text-2xl font-bold text-white text-center mb-6 flex items-center justify-center">
              <Star className="w-8 h-8 mr-2 text-yellow-500" />
              Title Preview
            </h2>
            
            <div className="text-center">
              <div className="rpg-card-accent p-6 inline-block">
                <h3 className="text-lg font-semibold text-white mb-4">
                  How you appear to others:
                </h3>
                <div className="flex items-center justify-center gap-3 text-white">
                  <span className="text-2xl font-bold">{profile.username}</span>
                  {equippedTitle && (
                    <TitleDisplay 
                      title={equippedTitle} 
                      size="large" 
                      showIcon={true}
                    />
                  )}
                </div>
                {!equippedTitle && (
                  <p className="text-gray-300 font-medium mt-2">No title equipped</p>
                )}
              </div>
            </div>
          </div>

          {/* Title Management */}
          <div className="rpg-card">
            <TitleSelector
              availableTitles={availableTitles}
              equippedTitle={equippedTitle}
              onEquipTitle={handleEquipTitle}
              onUnequipTitle={handleUnequipTitle}
              loading={titlesLoading}
            />
          </div>

          {/* Title Rarity Guide */}
          <div className="rpg-card mt-8">
            <h3 className="text-xl font-bold text-white mb-6 text-center flex items-center justify-center">
              <Gem className="w-6 h-6 mr-2 text-purple-500" />
              Title Rarity Guide
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="rpg-card-light p-4 mb-3">
                  <Star className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <h4 className="font-bold text-white">Common</h4>
                  <p className="text-xs text-gray-300">Easy to obtain</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className="rpg-card-light p-4 mb-3">
                  <Award className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  <h4 className="font-bold text-white">Rare</h4>
                  <p className="text-xs text-gray-300">Requires effort</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className="rpg-card-light p-4 mb-3">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-green-400" />
                  <h4 className="font-bold text-white">Epic</h4>
                  <p className="text-xs text-gray-300">Challenging</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className="rpg-card-light p-4 mb-3">
                  <Crown className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                  <h4 className="font-bold text-white">Legendary</h4>
                  <p className="text-xs text-gray-300">Ultimate achievement</p>
                </div>
              </div>
            </div>
          </div>
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
}
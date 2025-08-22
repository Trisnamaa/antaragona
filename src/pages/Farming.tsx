import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sprout, Wheat, Carrot, Apple, Coins, Clock, ArrowLeft } from 'lucide-react';

interface UserProfile {
  id: string;
  username: string;
  level: number;
  coins: number;
  farming_level: number;
  farming_exp: number;
}

interface Crop {
  id: string;
  name: string;
  icon: React.ReactNode;
  growTime: number; // in minutes
  sellPrice: number;
  expGain: number;
  cost: number;
}

interface PlantedCrop {
  id: string;
  crop: Crop;
  plantedAt: Date;
  readyAt: Date;
  isReady: boolean;
}

const crops: Crop[] = [
  {
    id: 'wheat',
    name: 'Wheat',
    icon: <Wheat className="w-8 h-8" />,
    growTime: 5,
    sellPrice: 10,
    expGain: 5,
    cost: 5
  },
  {
    id: 'carrot',
    name: 'Carrot',
    icon: <Carrot className="w-8 h-8" />,
    growTime: 10,
    sellPrice: 25,
    expGain: 12,
    cost: 15
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: <Apple className="w-8 h-8" />,
    growTime: 20,
    sellPrice: 50,
    expGain: 25,
    cost: 30
  }
];

export default function Farming() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [plantedCrops, setPlantedCrops] = useState<PlantedCrop[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
    loadPlantedCrops();
    
    const interval = setInterval(() => {
      updateCropStatus();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single();

      if (profile) {
        setUser({
          id: profile.user_id,
          username: profile.username,
          level: profile.level,
          coins: profile.coins,
          farming_level: profile.farming_level || 1,
          farming_exp: profile.farming_exp || 0
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlantedCrops = async () => {
    // In a real implementation, this would load from database
    // For now, using localStorage as a simple solution
    const saved = localStorage.getItem('plantedCrops');
    if (saved) {
      const parsed = JSON.parse(saved);
      const cropsWithDates = parsed.map((crop: any) => ({
        ...crop,
        plantedAt: new Date(crop.plantedAt),
        readyAt: new Date(crop.readyAt)
      }));
      setPlantedCrops(cropsWithDates);
    }
  };

  const savePlantedCrops = (crops: PlantedCrop[]) => {
    localStorage.setItem('plantedCrops', JSON.stringify(crops));
  };

  const updateCropStatus = () => {
    setPlantedCrops(prev => {
      const updated = prev.map(crop => ({
        ...crop,
        isReady: new Date() >= crop.readyAt
      }));
      return updated;
    });
  };

  const plantCrop = async (crop: Crop) => {
    if (!user || user.coins < crop.cost) return;

    const now = new Date();
    const readyAt = new Date(now.getTime() + crop.growTime * 60 * 1000);

    const newPlantedCrop: PlantedCrop = {
      id: Date.now().toString(),
      crop,
      plantedAt: now,
      readyAt,
      isReady: false
    };

    const updatedCrops = [...plantedCrops, newPlantedCrop];
    setPlantedCrops(updatedCrops);
    savePlantedCrops(updatedCrops);

    // Update user coins
    const updatedUser = { ...user, coins: user.coins - crop.cost };
    setUser(updatedUser);

    // Update database
    await supabase
      .from('user_profiles')
      .update({ coins: updatedUser.coins })
      .eq('user_id', user.id);

    setSelectedCrop(null);
  };

  const harvestCrop = async (cropId: string) => {
    const crop = plantedCrops.find(c => c.id === cropId);
    if (!crop || !crop.isReady || !user) return;

    const updatedCrops = plantedCrops.filter(c => c.id !== cropId);
    setPlantedCrops(updatedCrops);
    savePlantedCrops(updatedCrops);

    // Update user stats
    const newCoins = user.coins + crop.crop.sellPrice;
    const newExp = user.farming_exp + crop.crop.expGain;
    const newLevel = Math.floor(newExp / 100) + 1;

    const updatedUser = {
      ...user,
      coins: newCoins,
      farming_exp: newExp,
      farming_level: newLevel
    };
    setUser(updatedUser);

    // Update database
    await supabase
      .from('user_profiles')
      .update({
        coins: newCoins,
        farming_exp: newExp,
        farming_level: newLevel
      })
      .eq('user_id', user.id);
  };

  const getTimeRemaining = (readyAt: Date) => {
    const now = new Date();
    const diff = readyAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ready!';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold flex items-center gap-2 justify-center">
              <Sprout className="w-8 h-8 text-green-400" />
              Farming
            </h1>
            <p className="text-gray-400">Grow crops and earn coins!</p>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-5 h-5 text-yellow-400" />
              <span className="font-bold">{user?.coins || 0}</span>
            </div>
            <div className="text-sm text-gray-400">
              Farming Lv. {user?.farming_level || 1}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Farm Plot */}
          <div className="rpg-card p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sprout className="w-6 h-6 text-green-400" />
              Your Farm
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => {
                const plantedCrop = plantedCrops[index];
                
                return (
                  <div
                    key={index}
                    className="aspect-square bg-gray-800 rounded-lg border-2 border-gray-700 flex flex-col items-center justify-center p-4 hover:border-gray-600 transition-colors"
                  >
                    {plantedCrop ? (
                      <>
                        <div className="text-2xl mb-2">
                          {plantedCrop.crop.icon}
                        </div>
                        <div className="text-xs text-center">
                          <div className="font-semibold">{plantedCrop.crop.name}</div>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" />
                            <span className={plantedCrop.isReady ? 'text-green-400' : 'text-gray-400'}>
                              {getTimeRemaining(plantedCrop.readyAt)}
                            </span>
                          </div>
                          {plantedCrop.isReady && (
                            <button
                              onClick={() => harvestCrop(plantedCrop.id)}
                              className="mt-2 px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
                            >
                              Harvest
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setSelectedCrop(crops[0])}
                        className="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:text-gray-400 transition-colors"
                      >
                        <div className="text-3xl mb-2">+</div>
                        <div className="text-xs">Plant Crop</div>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Crop Shop */}
          <div className="rpg-card p-6">
            <h2 className="text-xl font-bold mb-4">Crop Shop</h2>
            
            <div className="space-y-3">
              {crops.map((crop) => (
                <div
                  key={crop.id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{crop.icon}</div>
                    <div>
                      <div className="font-semibold">{crop.name}</div>
                      <div className="text-sm text-gray-400">
                        {crop.growTime}min • +{crop.expGain} EXP
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-1 mb-1">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="font-bold">{crop.cost}</span>
                    </div>
                    <button
                      onClick={() => plantCrop(crop)}
                      disabled={!user || user.coins < crop.cost || plantedCrops.length >= 6}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm transition-colors"
                    >
                      Plant
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Farming Stats */}
        <div className="mt-6 rpg-card p-6">
          <h2 className="text-xl font-bold mb-4">Farming Progress</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{user?.farming_level || 1}</div>
              <div className="text-sm text-gray-400">Farming Level</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{user?.farming_exp || 0}</div>
              <div className="text-sm text-gray-400">Total EXP</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{plantedCrops.length}</div>
              <div className="text-sm text-gray-400">Active Crops</div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progress to Level {(user?.farming_level || 1) + 1}</span>
              <span>{((user?.farming_exp || 0) % 100)}/100</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((user?.farming_exp || 0) % 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
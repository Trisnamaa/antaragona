import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Fish, Star, Waves, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';

interface Profile {
  id: string;
  username: string;
  exp: number;
}

interface InventoryItem {
  id: string;
  item_id: string;
  quantity: number;
  game_items: {
    name: string;
    image_url: string;
    type: string;
  }
}

interface FishingResult {
  name: string;
  image: string;
  chance: number;
  exp?: number;
}

const FISHING_ITEMS = [
  { name: 'Ikan Emas', image: 'https://pomf2.lain.la/f/92i7wgsz.PNG', chance: 10 },
  { name: 'Ikan Arwana', image: 'https://pomf2.lain.la/f/yvi11i3d.PNG', chance: 15 },
  { name: 'Ikan Lele', image: 'https://pomf2.lain.la/f/7ycg37d8.PNG', chance: 35 },
  { name: 'Ikan Nila', image: 'https://pomf2.lain.la/f/piib5hyy.PNG', chance: 30 },
  { name: 'Zonk', image: '', chance: 10 }
];

export default function Fishing() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fishingInventory, setFishingInventory] = useState<InventoryItem[]>([]);
  const [hasFishingRod, setHasFishingRod] = useState(false);
  const [baitCount, setBaitCount] = useState(0);
  const [isFishing, setIsFishing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [currentResult, setCurrentResult] = useState<FishingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
    loadInventory();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showResult && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && showResult) {
      handleClaim();
    }
    return () => clearInterval(timer);
  }, [showResult, countdown]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, exp')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const loadInventory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profileData) return;

      const { data: inventoryData, error } = await supabase
        .from('player_inventory')
        .select(`
          id,
          item_id,
          quantity,
          game_items (
            name,
            image_url,
            type
          )
        `)
        .eq('profile_id', profileData.id);

      if (error) throw error;

      setFishingInventory(inventoryData || []);
      
      const rod = inventoryData?.find(item => item.game_items.name === 'Pancingan');
      const bait = inventoryData?.find(item => item.game_items.name === 'Umpan');
      
      setHasFishingRod(!!rod);
      setBaitCount(bait?.quantity || 0);
    } catch (error) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const startFishing = async () => {
    if (!hasFishingRod) {
      toast.error('You need a fishing rod to fish!');
      return;
    }
    if (baitCount <= 0) {
      toast.error('You need bait to fish!');
      return;
    }
    if (!profile) return;

    setIsFishing(true);
    
    const fishingTime = Math.floor(Math.random() * (30000 - 10000) + 10000);
    
    setTimeout(async () => {
      const rand = Math.random() * 100;
      let cumulative = 0;
      let result = FISHING_ITEMS[FISHING_ITEMS.length - 1];
      
      for (const item of FISHING_ITEMS) {
        cumulative += item.chance;
        if (rand <= cumulative) {
          result = item;
          break;
        }
      }

      const expReward = Math.floor(Math.random() * 5) + 1;
      result.exp = expReward;

      setCurrentResult(result);
      setShowResult(true);
      setIsFishing(false);
      setCountdown(5);
    }, fishingTime);
  };

  const handleClaim = async () => {
    if (!profile || !currentResult) return;

    try {
      const baitItem = fishingInventory.find(item => item.game_items.name === 'Umpan');
      if (baitItem) {
        const { error: updateError } = await supabase
          .from('player_inventory')
          .update({ quantity: baitItem.quantity - 1 })
          .eq('id', baitItem.id);

        if (updateError) throw updateError;

        const { error: expError } = await supabase
          .from('profiles')
          .update({ exp: profile.exp + (currentResult.exp || 0) })
          .eq('id', profile.id);

        if (expError) throw expError;

        setProfile(prev => {
          if (!prev) return null;
          return {
            ...prev,
            exp: prev.exp + (currentResult.exp || 0)
          };
        });

        if (currentResult.name !== 'Zonk') {
          const existingFish = fishingInventory.find(
            item => item.game_items.name === currentResult.name
          );

          if (existingFish) {
            const { error } = await supabase
              .from('player_inventory')
              .update({ quantity: existingFish.quantity + 1 })
              .eq('id', existingFish.id);

            if (error) throw error;
          } else {
            const { data: gameItem } = await supabase
              .from('game_items')
              .select('id')
              .eq('name', currentResult.name)
              .single();

            if (gameItem) {
              const { error } = await supabase
                .from('player_inventory')
                .insert({
                  profile_id: profile.id,
                  item_id: gameItem.id,
                  quantity: 1
                });

              if (error) throw error;
            }
          }
        }

        loadInventory();
        setShowResult(false);
        setCurrentResult(null);
      }
    } catch (error) {
      toast.error('Failed to update inventory');
    }
  };

  const moveToMainInventory = async (item: InventoryItem) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('player_inventory')
        .update({ quantity: item.quantity })
        .eq('id', item.id);

      if (error) throw error;
      
      toast.success('Item moved to main inventory');
      loadInventory();
    } catch (error) {
      toast.error('Failed to move item');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen rpg-bg flex items-center justify-center">
        <div className="rpg-card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-white">Loading Fishing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen rpg-bg">
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <button 
            onClick={() => navigate('/lobby')}
            className="btn-secondary"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Fish className="w-6 h-6 mr-2 text-purple-400" />
            Fishing
          </h1>
          <div className="w-20"></div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-between p-4">
          {/* Fishing Animation */}
          <div className="relative w-full max-w-md aspect-video mt-4">
            <div className="rpg-card h-full overflow-hidden">
              <img
                src="https://i.pinimg.com/originals/bb/7e/18/bb7e1847a42c9e0760b90c9577f7f586.gif"
                alt="Fishing"
                className="w-full h-full object-cover rounded-lg"
              />
              
              {(!hasFishingRod || baitCount <= 0) && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-lg">
                  <div className="rpg-card-light p-6 text-center">
                    <h3 className="font-bold text-white mb-4">Missing Equipment:</h3>
                    <ul className="space-y-2 mb-6">
                      {!hasFishingRod && <li className="text-red-400 font-medium">• Fishing Rod</li>}
                      {baitCount <= 0 && <li className="text-red-400 font-medium">• Bait</li>}
                    </ul>
                    <button
                      onClick={() => navigate('/shop')}
                      className="btn-primary"
                    >
                      Go to Shop
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fishing Button */}
          {hasFishingRod && baitCount > 0 && (
            <div className="my-6">
              <AnimatePresence>
                {!isFishing ? (
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    onClick={startFishing}
                    className="btn-primary btn-lg"
                  >
                    <Waves className="w-6 h-6 mr-2" />
                    Start Fishing
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rpg-card-accent p-6 text-center"
                  >
                    <Fish className="w-8 h-8 mx-auto mb-2 animate-pulse text-purple-400" />
                    <div className="text-xl font-bold text-white">Fishing...</div>
                    <p className="text-gray-300 text-sm mt-2">Wait for a bite!</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Inventory */}
          <div className="w-full rpg-card">
            <h2 className="text-lg font-semibold text-white mb-4 text-center flex items-center justify-center">
              <Fish className="w-5 h-5 mr-2 text-purple-400" />
              Fishing Inventory
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {fishingInventory
                .filter(item => ['Ikan Emas', 'Ikan Arwana', 'Ikan Lele', 'Ikan Nila', 'Pancingan', 'Umpan']
                  .includes(item.game_items.name))
                .map((item) => (
                  <div
                    key={item.id}
                    className="inventory-item text-center"
                  >
                    <div className="bg-gray-50 rounded-lg p-2 mb-2">
                      <img
                        src={item.game_items.image_url}
                        alt={item.game_items.name}
                        className="w-8 h-8 mx-auto object-contain"
                      />
                    </div>
                    <p className="text-xs font-medium mb-1 text-white">{item.game_items.name}</p>
                    <div className="badge badge-primary text-xs mb-2">
                      x{item.quantity}
                    </div>
                    {['Ikan Emas', 'Ikan Arwana', 'Ikan Lele', 'Ikan Nila'].includes(item.game_items.name) && (
                      <button
                        onClick={() => moveToMainInventory(item)}
                        className="btn-success btn-sm w-full text-xs"
                      >
                        Move
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Fishing Result Modal */}
        {showResult && currentResult && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rpg-card max-w-md w-full mx-4 text-center"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                {currentResult.name === 'Zonk' ? 'Nothing Caught!' : 'Fish Caught!'}
              </h2>
              <div className="mb-6">
                {currentResult.name !== 'Zonk' && (
                  <div className="rpg-card-accent p-4 mb-4">
                    <img
                      src={currentResult.image}
                      alt={currentResult.name}
                      className="w-24 h-24 mx-auto object-contain mb-2"
                    />
                    <p className="font-bold text-xl text-white">{currentResult.name}</p>
                  </div>
                )}
                <div className="rpg-card-light p-3 flex items-center justify-center">
                  <Star className="w-6 h-6 mr-2 text-yellow-500" />
                  <span className="text-lg font-bold">+{currentResult.exp} EXP</span>
                </div>
              </div>
              <button
                onClick={handleClaim}
                className="btn-primary w-full"
              >
                <Clock className="w-4 h-4 mr-2" />
                Claim ({countdown}s)
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Gift, Gamepad2, Swords, MessageCircle, Search, ArrowLeft, ShoppingCart, Star, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { GAME_ASSETS } from '../assets/gameAssets';
import { useCostumes } from '../hooks/useCostumes';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  zgold: number;
  ztoken: number;
}

interface GameItem {
  id: string;
  name: string;
  type: string;
  sell_price: number;
  image_url: string;
}

interface Costume {
  id: string;
  name: string;
  icon_url: string;
  male_image_url: string;
  female_image_url: string;
  price: number;
}

export default function Shop() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<GameItem[]>([]);
  const [costumes, setCostumes] = useState<Costume[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('items');
  const [purchasing, setPurchasing] = useState(false);
  const navigate = useNavigate();
  
  const { purchaseCostume, loadCostumes } = useCostumes(profile?.id || null);

  useEffect(() => {
    loadProfile();
    loadItems();
    loadCostumesData();
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
        .select('id, user_id, username, zgold, ztoken')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from('game_items')
        .select('*')
        .order('type', { ascending: true });

      if (error) throw error;
      setItems(data);
    } catch (error) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const loadCostumesData = async () => {
    try {
      const { data, error } = await supabase
        .from('costumes')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCostumes(data || []);
    } catch (error) {
      toast.error('Failed to load costumes');
    }
  };

  const handlePurchase = async (item: GameItem) => {
    if (!profile) return;
    if (purchasing) return;

    if (profile.zgold < item.sell_price) {
      toast.error('Not enough ZGold!');
      return;
    }

    setPurchasing(true);
    try {
      const { data: existingItem, error: queryError } = await supabase
        .from('player_inventory')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('item_id', item.id)
        .maybeSingle();

      if (queryError) throw queryError;

      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ zgold: profile.zgold - item.sell_price })
        .eq('id', profile.id);

      if (updateProfileError) throw updateProfileError;

      if (existingItem) {
        const { error: updateInventoryError } = await supabase
          .from('player_inventory')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);

        if (updateInventoryError) throw updateInventoryError;
      } else {
        const { error: insertError } = await supabase
          .from('player_inventory')
          .insert({
            profile_id: profile.id,
            item_id: item.id,
            quantity: 1
          });

        if (insertError) throw insertError;
      }

      setProfile(prev => prev ? {
        ...prev,
        zgold: prev.zgold - item.sell_price
      } : null);

      toast.success('Item purchased successfully!');
    } catch (error) {
      toast.error('Failed to purchase item');
      console.error('Purchase error:', error);
    } finally {
      setPurchasing(false);
    }
  };

  const handleCostumePurchase = async (costume: Costume) => {
    if (!profile) return;
    if (purchasing) return;

    setPurchasing(true);
    try {
      const success = await purchaseCostume(costume, profile.id, profile.zgold);
      if (success) {
        setProfile(prev => prev ? {
          ...prev,
          zgold: prev.zgold - costume.price
        } : null);
      }
    } catch (error) {
      console.error('Purchase error:', error);
    } finally {
      setPurchasing(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'items' || item.type === selectedType;
    return matchesSearch && matchesType;
  });

  const filteredCostumes = costumes.filter(costume => {
    const matchesSearch = costume.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && selectedType === 'costumes';
  });

  const itemTypes = ['items', 'costumes', 'fishing', 'farming', 'mining', 'hunting'];
  const allItemTypes = ['items', 'costumes', 'fishing', 'farming', 'mining', 'hunting', 'potion'];

  if (loading) return (
    <div className="min-h-screen rpg-bg flex items-center justify-center">
      <div className="rpg-card p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <div className="text-xl font-semibold text-white">Loading Shop...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen rpg-bg">
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-700/50 p-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => navigate('/lobby')}
              className="btn-secondary"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-white flex items-center">
    <img src={GAME_ASSETS.SHOP} alt="Shop" className="w-8 h-8" />
              Shop
            </h1>
            <div className="flex items-center space-x-3">
              <div className=" p-1 flex items-center">
                <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-6 h-6 mr-2" />
                <span className="font-semibold">{profile?.zgold?.toLocaleString() || 0}</span>
              </div>
              <div className=" p-1 flex items-center">
                <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-6 h-6 mr-2" />
                <span className="font-semibold">{profile?.ztoken || 0}</span>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-modern pl-10 w-full"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {allItemTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all duration-200 ${
                    selectedType === type
                      ? 'bg-purple-600 text-white shadow-md rpg-glow'
                      : 'bg-gray-700/80 text-gray-200 border border-gray-600/50 hover:border-gray-500 hover:shadow-sm'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Items Grid */}
        <div className="p-4">
          <div className="rpg-card">
            <h2 className="text-xl font-semibold text-white text-center mb-6 flex items-center justify-center">
              <Star className="w-6 h-6 mr-2 text-yellow-500" />
              Available Items
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {selectedType === 'costumes' ? (
                filteredCostumes.map((costume) => (
                  <motion.div
                    key={costume.id}
                    className="inventory-item text-center"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <img
                        src={costume.icon_url}
                        alt={costume.name}
                        className="w-12 h-12 mx-auto object-contain"
                      />
                    </div>
                    <h3 className="font-medium text-sm mb-2 text-white">{costume.name}</h3>
                    <div className="rpg-card-light p-2 mb-3 flex items-center justify-center">
                      <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-4 h-4 mr-1" />
                      <span className="font-semibold text-sm">{costume.price.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => handleCostumePurchase(costume)}
                      disabled={purchasing || (profile?.zgold || 0) < costume.price}
                      className="btn-success btn-sm w-full"
                    >
                      Buy
                    </button>
                  </motion.div>
                ))
              ) : (
                filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    className="inventory-item text-center"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-12 h-12 mx-auto object-contain"
                      />
                    </div>
                    <h3 className="font-medium text-sm mb-2 text-white">{item.name}</h3>
                    <div className="rpg-card-light p-2 mb-3 flex items-center justify-center">
                      <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-4 h-4 mr-1" />
                      <span className="font-semibold text-sm">{item.sell_price.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => handlePurchase(item)}
                      disabled={purchasing || (profile?.zgold || 0) < item.sell_price}
                      className="btn-success btn-sm w-full"
                    >
                      Buy
                    </button>
                  </motion.div>
                ))
              )}
            </div>
            
            {((selectedType === 'costumes' && filteredCostumes.length === 0) || 
              (selectedType !== 'costumes' && filteredItems.length === 0)) && (
              <div className="text-center py-12">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-white mb-2">
                  No {selectedType === 'costumes' ? 'costumes' : 'items'} found
                </p>
                <p className="text-gray-300">Try adjusting your search or filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 nav-modern p-4">
          <div className="flex justify-between max-w-md mx-auto">
            <button 
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate('/inventory')}
            >
              <img src={GAME_ASSETS.INVENTORY} alt="Inventory" className="w-8 h-8" />
              <span className="text-xs text-gray-300 mt-1">Inventory</span>
            </button>
            <button 
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate('/lobby')}
            >
              <img src={GAME_ASSETS.LOBBY} alt="Lobby" className="w-8 h-8" />
              <span className="text-xs text-gray-300 mt-1">Lobby</span>
            </button>
            <button 
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate('/lobby')}
            >
              <img src={GAME_ASSETS.GAME_MODE} alt="Game Mode" className="w-8 h-8" />
              <span className="text-xs text-gray-300 mt-1">Games</span>
            </button>
            <button 
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate('/battle')}
            >
              <img src={GAME_ASSETS.BATTLE} alt="Battle" className="w-8 h-8" />
              <span className="text-xs text-gray-300 mt-1">Battle</span>
            </button>
            
          </div>
        </div>
      </div>
    </div>
  );
}
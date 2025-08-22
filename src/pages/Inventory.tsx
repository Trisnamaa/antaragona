import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Gift, Gamepad2, Swords, MessageCircle, ArrowLeft, Box, Shirt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';
import { useCostumes } from '../hooks/useCostumes';
import { CostumeModal } from '../components/CostumeModal';
import { ItemDetailModal } from '../components/ItemDetailModal';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  zgold: number;
  ztoken: number;
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

interface PlayerCostume {
  id: string;
  costume_id: string;
  is_equipped: boolean;
  obtained_at: string;
  costumes: {
    id: string;
    name: string;
    icon_url: string;
    male_image_url: string;
    female_image_url: string;
    price: number;
  };
}

export default function Inventory() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedCostume, setSelectedCostume] = useState<PlayerCostume | null>(null);
  const [showCostumeModal, setShowCostumeModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [sellLoading, setSellLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const { 
    playerCostumes, 
    equipCostume, 
    unequipCostume, 
    loading: costumeLoading,
    loadCostumes 
  } = useCostumes(profile?.id || null);

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

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, username, zgold, ztoken')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: inventoryData, error: inventoryError } = await supabase
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

      if (inventoryError) throw inventoryError;
      setInventoryItems(inventoryData);
    } catch (error) {
      toast.error('Failed to load profile and inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleCostumeClick = (costume: PlayerCostume) => {
    setSelectedCostume(costume);
    setShowCostumeModal(true);
  };

  const handleEquipCostume = async () => {
    if (!selectedCostume) return;
    await equipCostume(selectedCostume.costume_id);
    setShowCostumeModal(false);
  };

  const handleUnequipCostume = async () => {
    await unequipCostume();
    setShowCostumeModal(false);
  };

  const handleItemClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowItemModal(true);
  };

  const handleSellItem = async (inventoryItemId: string, quantity: number) => {
    if (!profile || !selectedItem) return;

    setSellLoading(true);
    try {
      // Get sell price for the item
      const sellPrice = getSellPrice(selectedItem.game_items.name);
      const totalPrice = sellPrice * quantity;

      // Update player's ZGold
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ zgold: profile.zgold + totalPrice })
        .eq('id', profile.id);

      if (updateProfileError) throw updateProfileError;

      // Update inventory quantity
      const newQuantity = selectedItem.quantity - quantity;
      
      if (newQuantity <= 0) {
        // Remove item from inventory if quantity becomes 0
        const { error: deleteError } = await supabase
          .from('player_inventory')
          .delete()
          .eq('id', inventoryItemId);

        if (deleteError) throw deleteError;
      } else {
        // Update quantity
        const { error: updateError } = await supabase
          .from('player_inventory')
          .update({ quantity: newQuantity })
          .eq('id', inventoryItemId);

        if (updateError) throw updateError;
      }

      // Update local state
      setProfile(prev => prev ? {
        ...prev,
        zgold: prev.zgold + totalPrice
      } : null);

      // Reload inventory
      await loadProfile();
      
      toast.success(`Sold ${quantity} ${selectedItem.game_items.name} for ${totalPrice.toLocaleString()} ZGold!`);
    } catch (error) {
      console.error('Error selling item:', error);
      toast.error('Failed to sell item');
    } finally {
      setSellLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen rpg-bg flex items-center justify-center">
      <div className="rpg-card p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <div className="text-xl font-semibold text-white">Loading Inventory...</div>
      </div>
    </div>
  );

  if (!profile) return null;

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
              <ArrowLeft className="w-5 h-5 mr-2" />
            </button>
            
            <h1 className="text-2xl font-bold text-white">Inventory</h1>
            
            <div className="w-20"></div>
          </div>

          {/* Currency Display */}
          <div className="flex justify-center gap-2">
            <div className=" p-4 flex items-center">
              <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-8 h-8 mr-3" />
              <span className="text-xl font-semibold">{profile.zgold.toLocaleString()}</span>
            </div>
            <div className=" p-4 flex items-center">
              <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-8 h-8 mr-3" />
              <span className="text-xl font-semibold">{profile.ztoken}</span>
            </div>
          </div>
        </div>

        {/* Inventory Grid */}
        <div className="p-4">
          <div className="rpg-card">
            <h2 className="text-xl font-semibold text-white text-center mb-6 flex items-center justify-center">
              <Box className="w-6 h-6 mr-2 text-purple-400" />
              Your Items
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {/* Player Costumes */}
              {playerCostumes.map((costume) => (
                <div
                  key={costume.id}
                  className="inventory-item text-center cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => handleCostumeClick(costume)}
                >
                  <div className="bg-gray-50 rounded-lg p-3 mb-3 relative">
                    <img
                      src={costume.costumes.icon_url}
                      alt={costume.costumes.name}
                      className="w-12 h-12 mx-auto object-contain"
                    />
                    {costume.is_equipped && (
                      <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-semibold px-1 py-0.5 rounded-full">
                        E
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium text-xs mb-2 text-white">{costume.costumes.name}</h3>
                  <div className={`badge text-xs ${
                    costume.is_equipped ? 'badge-success' : 'badge-primary'
                  }`}>
                    {costume.is_equipped ? 'Equipped' : 'Costume'}
                  </div>
                </div>
              ))}
              
              {/* Regular Items */}
              {inventoryItems.map((item) => (
                <div
                  key={item.id}
                  className="inventory-item text-center cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <img
                      src={item.game_items.image_url}
                      alt={item.game_items.name}
                      className="w-12 h-12 mx-auto object-contain"
                    />
                  </div>
                  <h3 className="font-medium text-xs mb-2 text-white">{item.game_items.name}</h3>
                  <div className="badge badge-primary text-xs">
                    x{item.quantity}
                  </div>
                </div>
              ))}
              
              {/* Empty slots */}
              {[...Array(Math.max(0, 24 - inventoryItems.length - playerCostumes.length))].map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="inventory-item text-center opacity-50"
                >
                  <div className="bg-gray-100 rounded-lg p-3 mb-3 h-16 flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-400">Empty</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Costume Modal */}
        <CostumeModal
          isOpen={showCostumeModal}
          onClose={() => setShowCostumeModal(false)}
          costume={selectedCostume?.costumes || null}
          isEquipped={selectedCostume?.is_equipped || false}
          onEquip={handleEquipCostume}
          onUnequip={handleUnequipCostume}
          loading={costumeLoading}
        />

        {/* Item Detail Modal */}
        <ItemDetailModal
          isOpen={showItemModal}
          onClose={() => setShowItemModal(false)}
          item={selectedItem}
          onSell={handleSellItem}
          loading={sellLoading}
        />

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 nav-modern p-4">
          <div className="flex justify-between max-w-md mx-auto">
            <button 
              className="flex flex-col items-center p-3 rounded-lg bg-purple-900/30 text-purple-400 border border-purple-500/30"
              onClick={() => navigate('/inventory')}
            >
              <img src={GAME_ASSETS.INVENTORY} alt="Inventory" className="w-8 h-8" />
              <span className="text-xs mt-1">Inventory</span>
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

// Helper function to get sell price based on item name
function getSellPrice(itemName: string): number {
  const sellPrices: Record<string, number> = {
    // Fishing Items
    'Ikan Emas': 4400,
    'Ikan Lele': 2000,
    'Ikan Arwana': 2000,
    'Ikan Nila': 2000,
    'Umpan': 400,
    'Pancingan': 3200,
    
    // Farming Items
    'Apel': 2000,
    'Anggur': 2400,
    'Semangka': 2000,
    'Nanas': 1600,
    'Pisang': 1600,
    'Bibit Apel': 2000,
    'Bibit Anggur': 2400,
    'Bibit Semangka': 2000,
    'Bibit Nanas': 1600,
    'Bibit Pisang': 1600,
    
    // Mining Items
    'Kayu': 560,
    'Batu': 680,
    'PickAxe': 4800,
    
    // Hunting Items
    'Monyet': 3600,
    'Beruang': 4800,
    'Babi': 4400,
    'Burung': 4800,
    'Ayam': 2000,
    'Panah': 4000,
    
    // Potion Items
    'Big Potion': 2000,
    'Small Potion': 800
  };
  
  return sellPrices[itemName] || 100; // Default sell price if not found
}
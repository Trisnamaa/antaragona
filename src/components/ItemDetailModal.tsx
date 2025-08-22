import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Coins, Info, ShoppingCart } from 'lucide-react';
import { GAME_ASSETS } from '../assets/gameAssets';

interface GameItem {
  name: string;
  image_url: string;
  type: string;
}

interface InventoryItem {
  id: string;
  item_id: string;
  quantity: number;
  game_items: GameItem;
}

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSell: (itemId: string, quantity: number) => Promise<void>;
  loading: boolean;
}

export function ItemDetailModal({ 
  isOpen, 
  onClose, 
  item, 
  onSell, 
  loading 
}: ItemDetailModalProps) {
  const [sellQuantity, setSellQuantity] = React.useState(1);

  React.useEffect(() => {
    if (item) {
      setSellQuantity(1);
    }
  }, [item]);

  if (!item) return null;

  const handleSell = async () => {
    if (sellQuantity > 0 && sellQuantity <= item.quantity) {
      await onSell(item.id, sellQuantity);
      onClose();
    }
  };

  const getItemTypeColor = (type: string) => {
    switch (type) {
      case 'fishing': return 'text-blue-400';
      case 'farming': return 'text-green-400';
      case 'mining': return 'text-orange-400';
      case 'hunting': return 'text-red-400';
      case 'potion': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'fishing': return '🎣';
      case 'farming': return '🌱';
      case 'mining': return '⛏️';
      case 'hunting': return '🏹';
      case 'potion': return '🧪';
      default: return '📦';
    }
  };

  // Estimate sell price (assuming 80% of buy price)
  const estimatedSellPrice = Math.floor(getSellPrice(item.game_items.name) * sellQuantity);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="rpg-card w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Package className="w-5 h-5 mr-2 text-purple-400" />
                Item Details
              </h2>
              <button 
                onClick={onClose}
                className="btn-secondary btn-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Item Display */}
            <div className="text-center mb-6">
              <div className="rpg-card-accent p-6 mb-4">
                <div className="bg-gray-50 rounded-xl p-4 mb-4 inline-block">
                  <img
                    src={item.game_items.image_url}
                    alt={item.game_items.name}
                    className="w-20 h-20 object-contain mx-auto"
                  />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {item.game_items.name}
                </h3>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">{getItemTypeIcon(item.game_items.type)}</span>
                  <span className={`font-semibold capitalize ${getItemTypeColor(item.game_items.type)}`}>
                    {item.game_items.type}
                  </span>
                </div>
                <div className="badge badge-primary text-lg px-4 py-2">
                  Owned: {item.quantity}
                </div>
              </div>
            </div>

            {/* Item Info */}
            <div className="rpg-card-light mb-6">
              <h4 className="font-semibold text-white mb-3 flex items-center">
                <Info className="w-4 h-4 mr-2" />
                Item Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-300">Type:</span>
                  <span className={`font-medium capitalize ${getItemTypeColor(item.game_items.type)}`}>
                    {item.game_items.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Quantity:</span>
                  <span className="font-medium text-white">{item.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Sell Price (each):</span>
                  <div className="flex items-center gap-1">
                    <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-4 h-4" />
                    <span className="font-medium text-white">
                      {getSellPrice(item.game_items.name).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sell Section */}
            <div className="rpg-card-light mb-6">
              <h4 className="font-semibold text-white mb-4 flex items-center">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Sell Item
              </h4>
              
              {/* Quantity Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quantity to Sell
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSellQuantity(Math.max(1, sellQuantity - 1))}
                    disabled={sellQuantity <= 1}
                    className="btn-secondary btn-sm w-10 h-10 flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={sellQuantity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      setSellQuantity(Math.max(1, Math.min(item.quantity, value)));
                    }}
                    min="1"
                    max={item.quantity}
                    className="input-modern text-center w-20"
                  />
                  <button
                    onClick={() => setSellQuantity(Math.min(item.quantity, sellQuantity + 1))}
                    disabled={sellQuantity >= item.quantity}
                    className="btn-secondary btn-sm w-10 h-10 flex items-center justify-center"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setSellQuantity(item.quantity)}
                    className="btn-secondary btn-sm"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Total Price */}
              <div className="rpg-card-accent p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">Total Price:</span>
                  <div className="flex items-center gap-2">
                    <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-6 h-6" />
                    <span className="text-xl font-bold text-white">
                      {estimatedSellPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sell Button */}
              <button
                onClick={handleSell}
                disabled={loading || sellQuantity <= 0}
                className="btn-success w-full"
              >
                {loading ? 'Selling...' : `Sell ${sellQuantity} Item${sellQuantity > 1 ? 's' : ''}`}
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="btn-secondary w-full"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
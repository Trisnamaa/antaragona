import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shirt, User, Users } from 'lucide-react';

interface Costume {
  id: string;
  name: string;
  icon_url: string;
  male_image_url: string;
  female_image_url: string;
  price: number;
}

interface CostumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  costume: Costume | null;
  isEquipped: boolean;
  onEquip: () => void;
  onUnequip: () => void;
  loading: boolean;
}

export function CostumeModal({ 
  isOpen, 
  onClose, 
  costume, 
  isEquipped, 
  onEquip, 
  onUnequip, 
  loading 
}: CostumeModalProps) {
  if (!costume) return null;

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
            className="rpg-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <Shirt className="w-6 h-6 mr-2 text-purple-500" />
                Costume Details
              </h2>
              <button 
                onClick={onClose}
                className="btn-secondary btn-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Costume Info */}
            <div className="text-center mb-2">
              <div className="rpg-card-accent p-4 inline-block mb-2">
                <img
                  src={costume.icon_url}
                  alt={costume.name}
                  className="w-10 h-10 object-contain mx-auto mb-2"
                />
                <h2 className="text-sm font-bold text-white">{costume.name}</h2>
              </div>
            </div>

            {/* Character Previews */}
            <div className="mb-2">
              <h4 className="text-lg font-semibold text-white text-center mb-2 flex items-center justify-center">
                <Users className="w-5 h-5 mr-2" />
                Character Preview
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                {/* Male Preview */}
                <div className="text-center">
                  <div className="rpg-card-light p-4">
                    <div className="flex items-center justify-center mb-3">
                      <User className="w-5 h-5 text-purple-400 mr-2" />
                      <span className="font-semibold text-purple-400">Male</span>
                    </div>
                    <div className="bg-gray-900/80 border-4 border-purple-400 rounded-lg p-4 mb-3">
                      <img
                        src={costume.male_image_url}
                        alt="Male Costume"
                        className="w-32 h-32 mx-auto object-contain"
                      />
                    </div>
                  </div>
                </div>

                {/* Female Preview */}
                <div className="text-center">
                  <div className="rpg-card-light p-4">
                    <div className="flex items-center justify-center mb-3">
                      <User className="w-5 h-5 text-pink-400 mr-2" />
                      <span className="font-semibold text-pink-400">Female</span>
                    </div>
                    <div className="bg-gray-900/80 border-4 border-pink-400 rounded-lg p-4 mb-3">
                      <img
                        src={costume.female_image_url}
                        alt="Female Costume"
                        className="w-32 h-32 mx-auto object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="text-center mb-2">
              <div className={`rpg-card-light p-4 inline-block ${
                isEquipped ? 'bg-green-900/30 border-green-500/30' : ''
              }`}>
                <span className={`font-semibold ${
                  isEquipped ? 'text-green-300' : 'text-white'
                }`}>
                  Status: {isEquipped ? 'Equipped' : 'Not Equipped'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {isEquipped ? (
                <button
                  onClick={onUnequip}
                  disabled={loading}
                  className="btn-danger flex-1"
                >
                  {loading ? 'Unequipping...' : 'Unequip Costume'}
                </button>
              ) : (
                <button
                  onClick={onEquip}
                  disabled={loading}
                  className="btn-success flex-1"
                >
                  {loading ? 'Equipping...' : 'Equip Costume'}
                </button>
              )}
              
              <button
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
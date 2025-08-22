import React, { useState, useEffect } from 'react';
import { Clock, Coins, RefreshCw, Calendar, Users, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { GAME_ASSETS } from '../assets/gameAssets';

interface ZTokenResetStatus {
  current_wib_time: string;
  current_wib_date: string;
  current_wib_hour: number;
  last_reset_date: string | null;
  next_reset_time: string;
  users_below_25: number;
  reset_needed: boolean;
  hours_until_next_reset: number;
}

interface ZTokenResetStatusProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ZTokenResetStatus({ isOpen, onClose }: ZTokenResetStatusProps) {
  const [status, setStatus] = useState<ZTokenResetStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualResetLoading, setManualResetLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadResetStatus();
      // Refresh status every 30 seconds when modal is open
      const interval = setInterval(loadResetStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadResetStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_ztoken_reset_status');
      
      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error('Error loading reset status:', error);
      toast.error('Failed to load reset status');
    } finally {
      setLoading(false);
    }
  };

  const handleManualReset = async () => {
    try {
      setManualResetLoading(true);
      const { data, error } = await supabase.rpc('manual_ztoken_reset');
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Manual reset completed! ${data.profiles_affected} profiles affected.`);
        loadResetStatus(); // Refresh status
      } else {
        toast.error(data.message || 'Manual reset failed');
      }
    } catch (error) {
      console.error('Error performing manual reset:', error);
      toast.error('Failed to perform manual reset');
    } finally {
      setManualResetLoading(false);
    }
  };

  const formatWIBTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatHoursUntilReset = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} menit`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours - wholeHours) * 60);
    return `${wholeHours} jam ${minutes} menit`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className="modal-brutalist w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b-4 border-black">
            <h2 className="text-2xl font-black uppercase tracking-wide text-black">
              <Coins className="w-8 h-8 inline mr-2" />
              ZTOKEN RESET STATUS
            </h2>
            <button 
              onClick={onClose}
              className="btn-brutalist-danger p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {loading && !status ? (
            <div className="text-center py-8">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin text-gray-400" />
              <p className="font-black text-black">LOADING STATUS...</p>
            </div>
          ) : status ? (
            <div className="space-y-6">
              {/* Current Time Info */}
              <div className="card-brutalist-dark p-4">
                <h3 className="font-black text-yellow-400 mb-3 uppercase tracking-wide">
                  <Clock className="w-6 h-6 inline mr-2" />
                  WAKTU SAAT INI (WIB)
                </h3>
                <div className="text-white space-y-2">
                  <p className="font-bold">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    {formatWIBTime(status.current_wib_time)}
                  </p>
                  <p className="font-bold">
                    Jam: {status.current_wib_hour}:00 WIB
                  </p>
                </div>
              </div>

              {/* Reset Schedule Info */}
              <div className="card-brutalist-yellow p-4">
                <h3 className="font-black text-black mb-3 uppercase tracking-wide">
                  <RefreshCw className="w-6 h-6 inline mr-2" />
                  JADWAL RESET HARIAN
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white border-2 border-black">
                    <span className="font-black text-black">WAKTU RESET:</span>
                    <span className="font-black text-lg text-black">18:00 WIB</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white border-2 border-black">
                    <span className="font-black text-black">RESET BERIKUTNYA:</span>
                    <span className="font-black text-sm text-black">
                      {formatHoursUntilReset(status.hours_until_next_reset)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white border-2 border-black">
                    <span className="font-black text-black">RESET TERAKHIR:</span>
                    <span className="font-black text-sm text-black">
                      {status.last_reset_date || 'Belum pernah'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="card-brutalist p-4">
                <h3 className="font-black text-black mb-3 uppercase tracking-wide">
                  <Users className="w-6 h-6 inline mr-2" />
                  STATISTIK PEMAIN
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="card-brutalist-dark p-4 text-center">
                    <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-2xl font-black text-yellow-400">{status.users_below_25}</div>
                    <div className="text-sm font-bold text-white">PEMAIN &lt; 25 ZTOKEN</div>
                  </div>
                  
                  <div className={`p-4 text-center border-4 border-black ${
                    status.reset_needed ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                  }`}>
                    <RefreshCw className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-lg font-black">
                      {status.reset_needed ? 'RESET DIPERLUKAN' : 'RESET TIDAK DIPERLUKAN'}
                    </div>
                    <div className="text-xs font-bold">
                      {status.reset_needed ? 'Sistem siap melakukan reset' : 'Reset sudah dilakukan hari ini'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reset Rules */}
              <div className="card-brutalist-dark p-4">
                <h3 className="font-black text-yellow-400 mb-3 uppercase tracking-wide">
                  <Info className="w-6 h-6 inline mr-2" />
                  ATURAN RESET ZTOKEN
                </h3>
                <div className="space-y-2 text-white">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="font-bold text-sm">
                      <strong>ZToken &lt; 25:</strong> Akan direset menjadi 25
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="font-bold text-sm">
                      <strong>ZToken = 25:</strong> Tidak ada perubahan
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="font-bold text-sm">
                      <strong>ZToken &gt; 25:</strong> Tetap tidak berubah
                    </p>
                  </div>
                </div>
              </div>

              {/* Manual Reset Button (for testing/admin) */}
              <div className="card-brutalist-yellow p-4">
                <h3 className="font-black text-black mb-3 uppercase tracking-wide">
                  MANUAL RESET (TESTING)
                </h3>
                <p className="text-sm font-bold text-black mb-4">
                  Tombol ini untuk testing atau reset manual oleh admin.
                </p>
                <button
                  onClick={handleManualReset}
                  disabled={manualResetLoading}
                  className="btn-brutalist-danger w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {manualResetLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      MELAKUKAN RESET...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2" />
                      MANUAL RESET SEKARANG
                    </>
                  )}
                </button>
              </div>

              {/* Refresh Button */}
              <div className="flex gap-4">
                <button
                  onClick={loadResetStatus}
                  disabled={loading}
                  className="btn-brutalist-blue flex-1 py-3 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      REFRESHING...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2" />
                      REFRESH STATUS
                    </>
                  )}
                </button>
                
                <button
                  onClick={onClose}
                  className="btn-brutalist flex-1 py-3"
                >
                  TUTUP
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="font-black text-black">Failed to load status</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
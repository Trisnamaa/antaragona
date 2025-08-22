import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Crown, Mail, Lock, Eye, EyeOff, Sword, Shield, Star } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Entering the realm...');
  const navigate = useNavigate();

  // Loading messages yang akan ditampilkan secara berurutan
  const loadingMessages = [
    'Entering the realm...',
    'Loading your character...',
    'Preparing your inventory...',
    'Checking guild status...',
    'Loading world map...',
    'Finalizing your adventure...'
  ];

  useEffect(() => {
    if (showLoadingScreen) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 1;
          
          // Update loading text based on progress
          const messageIndex = Math.floor((newProgress / 100) * loadingMessages.length);
          if (messageIndex < loadingMessages.length) {
            setLoadingText(loadingMessages[messageIndex]);
          }
          
          if (newProgress >= 100) {
            clearInterval(interval);
            // Navigate setelah loading selesai
            setTimeout(() => {
              const profile = sessionStorage.getItem('userProfile');
              navigate(profile ? '/profile' : '/character-select');
            }, 500);
          }
          
          return newProgress;
        });
      }, 100); // Update setiap 100ms untuk 10 detik total

      return () => clearInterval(interval);
    }
  }, [showLoadingScreen, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (profile?.banned_until && new Date(profile.banned_until) > new Date()) {
          const banEndDate = new Date(profile.banned_until).toLocaleDateString();
          toast.error(`Account banned until ${banEndDate}`);
          await supabase.auth.signOut();
          return;
        }

        // Simpan profile data untuk navigasi nanti
        sessionStorage.setItem('userProfile', profile ? 'true' : 'false');
        
        // Show loading screen
        setShowLoadingScreen(true);
        setProgress(0);
      }
    } catch (error) {
      toast.error('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  // Loading Screen Component
  if (showLoadingScreen) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://raw.githubusercontent.com/AquaCasaster/db_image/main/1754050637694-t67cjn.jpg')`,
          }}
        >
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/60"></div>
        </div>

        {/* Loading Content */}
        <div className="relative z-10 min-h-screen flex flex-col p-4 text-white">
          {/* Game Logo - Centered */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-12">
              
            </div>

            {/* Loading Icons */}
            
          </div>

          {/* Progress Bar Container - Bottom */}
          <div className="w-full max-w-lg mx-auto pb-8">
            {/* Progress Bar */}
            <div className="w-full">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-300">{loadingText}</span>
                <span className="text-sm font-medium text-purple-400">{progress}%</span>
              </div>
              
              <div className="w-full bg-gray-700/50 rounded-full h-4 backdrop-blur-sm border border-gray-600/30">
                <div 
                  className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 h-4 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Loading Tips */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400 italic">
                "Every great adventure begins with a single step..."
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Login Form
  return (
    <div className="min-h-screen rpg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-lg mb-4 rpg-glow">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 rpg-text-glow">SATARUZ</h1>
          <p className="text-gray-300">Welcome back to your adventure</p>
        </div>
        
        {/* Login Form */}
        <div className="rpg-card">
          <h2 className="text-2xl font-semibold text-white text-center mb-6">Sign In</h2>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-modern w-full"
                placeholder="Enter your email"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Lock className="w-4 h-4 inline mr-2" />
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-modern w-full pr-12"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-300">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-purple-400 hover:text-purple-300 font-medium"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Join thousands of players in this epic RPG adventure
          </p>
        </div>
      </div>
    </div>
  );
}
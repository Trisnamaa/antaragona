import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut,
  TrendingUp,
  X,
  User,
  Zap,
  Star,
  Crown,
  Settings,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { calculateRequiredExp, calculateRequiredZGold, calculateStrengthIncrease } from '../utils/levelUtils';
import { GAME_ASSETS } from '../assets/gameAssets';
import { GlobalChat } from '../components/GlobalChat';
import { DungeonModal } from '../components/DungeonModal';
import { ZTokenResetInfo } from '../components/ZTokenResetInfo';
import { RaidModal } from '../components/RaidModal';
import { useCostumes } from '../hooks/useCostumes';
import { TitleDisplay } from '../components/TitleDisplay';
import { useUserTitle } from '../hooks/useTitles';
import { useFriends } from '../hooks/useFriends';
import { FriendSystem } from '../components/FriendSystem';
import { FriendNotification } from '../components/FriendNotification';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  profile_image_url: string;
  character_type: string;
  zgold: number;
  ztoken: number;
  raid_tickets: number;
  level: number;
  exp: number;
  strength: number;
  clover: number;
}

interface RedeemReward {
  zgold: number;
  ztoken: number;
  exp: number;
}

interface UserProfile {
  id: string;
  username: string;
  profile_image_url: string;
  character_type: string;
  level: number;
  exp: number;
  strength: number;
  zgold: number;
  ztoken: number;
  created_at: string;
}

interface GameMode {
  name: string;
  image: string;
  path?: string;
  comingSoon?: boolean;
  color: string;
  action?: () => void;
}

export default function Lobby() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showLevelUpAnimation, setShowLevelUpAnimation] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showGameModesModal, setShowGameModesModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showDungeonModal, setShowDungeonModal] = useState(false);
  const [showZTokenResetInfo, setShowZTokenResetInfo] = useState(false);
  const [showRaidModal, setShowRaidModal] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<UserProfile | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [currentReward, setCurrentReward] = useState<RedeemReward | null>(null);
  const [loadingUserProfile, setLoadingUserProfile] = useState(false);
  const [showFriendSystemModal, setShowFriendSystemModal] = useState(false);
  const [currentFriendRequest, setCurrentFriendRequest] = useState<any>(null);
  
  const { equippedCostume } = useCostumes(profile?.id || null);
  const { friends, friendRequests, respondToFriendRequest, updateUserActivity } = useFriends(profile?.id || null);
  
  const navigate = useNavigate();

  const GAME_MODES: GameMode[] = [
    { name: 'Adventure', image: 'https://pomf2.lain.la/f/qgi7zos.png', path: '/adventure', color: 'from-red-400 to-red-600' },
    { 
      name: 'RAID', 
      image: 'https://i.pinimg.com/736x/d4/5e/6f/d45e6f7g8h9i0j1k2l3m4n5o6p7q8r9s.jpg', 
      color: 'from-red-500 to-red-700', 
      action: () => {
        setShowGameModesModal(false);
        setTimeout(() => {
          setShowRaidModal(true);
        }, 150);
      }
    },
    { 
      name: 'Dungeon', 
      image: 'https://i.pinimg.com/736x/81/c9/76/81c976d54a8c3f67cf606465dba75c24.jpg', 
      color: 'from-purple-400 to-purple-600', 
      action: () => {
        setShowGameModesModal(false);
        setTimeout(() => {
          setShowDungeonModal(true);
        }, 150);
      }
    },
    { name: 'Fishing', image: 'https://pomf2.lain.la/f/wl60b1iv.png', path: '/fishing', color: 'from-blue-400 to-blue-600' },
    { name: 'Farming', image: 'https://pomf2.lain.la/f/gq7oi9dj.png', path: '/farming', color: 'from-green-400 to-green-600' },
    { name: 'Building', image: 'https://pomf2.lain.la/f/yvzzev23.png', comingSoon: true, color: 'from-yellow-400 to-yellow-600' },
    { name: 'Trading', image: 'https://pomf2.lain.la/f/5bshu1x1.png', comingSoon: true, color: 'from-purple-400 to-purple-600' },
    { name: 'Mining', image: 'https://pomf2.lain.la/f/h53dcc8z.png', comingSoon: true, color: 'from-orange-400 to-orange-600' },
    { name: 'Hunting', image: 'https://pomf2.lain.la/f/76tj5lxa.png', comingSoon: true, color: 'from-pink-400 to-pink-600' }
  ];

  const handleUserInteraction = () => {
    if (profile?.id) {
      updateUserActivity(profile.id, 'interaction');
    }
  };

  useEffect(() => {
    loadProfile();
    
    // Auto-show friend request notification if there are pending requests
    if (friendRequests.length > 0 && !currentFriendRequest) {
      setCurrentFriendRequest(friendRequests[0]);
    }
  }, []);
  
  useEffect(() => {
    // Auto-show friend request notification when new requests come in
    if (friendRequests.length > 0 && !currentFriendRequest) {
      setCurrentFriendRequest(friendRequests[0]);
    }
  }, [friendRequests, currentFriendRequest]);

  const handleAcceptFriendRequest = async (requestId: string) => {
    await respondToFriendRequest(requestId, 'accepted');
    setCurrentFriendRequest(null);
    await loadProfile(); // Refresh profile
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    await respondToFriendRequest(requestId, 'rejected');
    setCurrentFriendRequest(null);
  };

  const handleFriendRequestTimeout = () => {
    setCurrentFriendRequest(null);
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const loadUserProfile = async (username: string) => {
    if (!username || username === profile?.username) return;
    
    setLoadingUserProfile(true);
    
    try {
      const { data: userProfiles, error } = await supabase.rpc('find_user_profile', {
        search_username: username
      });

      if (error) {
        console.error('Error loading user profile:', error);
        toast.error('Failed to load user profile');
        return;
      }
      
      if (!userProfiles || userProfiles.length === 0) {
        toast.error('User profile not found');
        return;
      }
      
      const userProfile = userProfiles[0];
      setSelectedUserProfile(userProfile);
      setShowUserProfile(true);
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      toast.error('An error occurred while loading profile');
    } finally {
      setLoadingUserProfile(false);
    }
  };

  // Component untuk menampilkan profile dengan title
  function UserProfileWithTitle({ userProfile }: { userProfile: UserProfile }) {
    const { title } = useUserTitle(userProfile.id);
    
    return (
      <div className="text-center mb-6">
        <div className="relative inline-block">
          <img
            src={userProfile.profile_image_url}
            alt={userProfile.username}
            className="avatar avatar-lg mx-auto mb-4"
          />
          <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
            {userProfile.level}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 mb-2">
          <h3 className="text-2xl font-bold text-white">{userProfile.username}</h3>
          {title && (
            <TitleDisplay 
              title={title} 
              size="medium" 
              showIcon={true}
            />
          )}
        </div>
        <div className="badge badge-primary">Level {userProfile.level}</div>
      </div>
    );
  }
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleRedeemCode = async () => {
    if (!profile) return;
    
    try {
      const { data: codeData, error: codeError } = await supabase
        .from('redeem_codes')
        .select('*')
        .eq('code', redeemCode.trim())
        .eq('is_active', true)
        .single();

      if (codeError || !codeData) {
        toast.error('Invalid or inactive code');
        return;
      }

      const { data: claimedData, error: claimedError } = await supabase
        .from('claimed_codes')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('code_id', codeData.id)
        .maybeSingle();

      if (claimedData) {
        toast.error('Code already used');
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          zgold: profile.zgold + codeData.zgold,
          ztoken: profile.ztoken + codeData.ztoken,
          exp: profile.exp + codeData.exp
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      const { error: claimError } = await supabase
        .from('claimed_codes')
        .insert({
          user_id: profile.user_id,
          code_id: codeData.id
        });

      if (claimError) throw claimError;

      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          zgold: prev.zgold + codeData.zgold,
          ztoken: prev.ztoken + codeData.ztoken,
          exp: prev.exp + codeData.exp
        };
      });

      setCurrentReward({
        zgold: codeData.zgold,
        ztoken: codeData.ztoken,
        exp: codeData.exp
      });
      setShowRedeemModal(false);
      setShowRewardModal(true);
      setRedeemCode('');

      toast.success('Code redeemed successfully!');
    } catch (error) {
      console.error('Redeem error:', error);
      toast.error('Failed to redeem code');
    }
  };

  const handleLevelUp = async () => {
    if (!profile) return;

    const requiredExp = calculateRequiredExp(profile.level);
    const requiredZGold = calculateRequiredZGold(profile.level);
    const strengthIncrease = calculateStrengthIncrease(profile.level);

    if (profile.exp < requiredExp) {
      toast.error(`Not enough EXP! Need ${requiredExp} EXP to level up`);
      return;
    }

    if (profile.zgold < requiredZGold) {
      toast.error(`Not enough ZGold! Need ${requiredZGold} ZGold to level up`);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          level: profile.level + 1,
          exp: profile.exp - requiredExp,
          zgold: profile.zgold - requiredZGold,
          strength: profile.strength + strengthIncrease
        })
        .eq('id', profile.id);

      if (error) throw error;

      setShowLevelUpAnimation(true);
      setTimeout(() => setShowLevelUpAnimation(false), 2000);

      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          level: prev.level + 1,
          exp: prev.exp - requiredExp,
          zgold: prev.zgold - requiredZGold,
          strength: prev.strength + strengthIncrease
        };
      });

      toast.success(`Level Up! Now level ${profile.level + 1}`);
    } catch (error) {
      toast.error('Failed to level up');
    }
  };

  const handleGameModeClick = (mode: GameMode) => {
    if (mode.comingSoon) {
      toast.success(`${mode.name} coming soon!`);
      return;
    }
    if (mode.action) {
      mode.action();
      return;
    }
    if (mode.path) {
      navigate(mode.path);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  if (!profile) return null;

  const requiredExp = calculateRequiredExp(profile.level);
  const requiredZGold = calculateRequiredZGold(profile.level);
  const expProgress = (profile.exp / requiredExp) * 100;

  return (
    <div className="min-h-screen rpg-bg">
      <div className="min-h-screen pb-20 px-4">
        {/* Header */}
        <div className="pt-2 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img
                  src={profile.profile_image_url}
                  alt={profile.username}
                  className="avatar avatar-md"
                />
                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                  {profile.level}
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
                
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-300">{profile.exp}/{requiredExp} EXP</span>
            </div>
            <div className="progress-modern">
              <div 
                className="progress-fill bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${Math.min(expProgress, 100)}%` }}
              />
          </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button 
                className="btn-secondary btn-sm"
                onClick={() => navigate('/profile')}
              >
                <img src={GAME_ASSETS.SETTING} alt="Setting" className="w-4 h-4" />
              </button>
              <button 
                className="btn-danger btn-sm"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 md:grid-cols-4 gap-4 mb-2">
{/* ZGold */}
<div className="flex items-center justify-between border border-yellow-400 bg-yellow-900/30 rounded-md px-2 py-1 space-x-1.5 w-fit max-w-full">
  <p className="text-xs font-semibold text-white">{profile.zgold.toLocaleString()}</p>
  <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-5 h-5" />
</div>

{/* ZToken */}
<div
  className="flex items-center justify-between border border-blue-400 bg-blue-900/30 rounded-md px-2 py-1 space-x-1.5 w-fit max-w-full cursor-pointer hover:shadow-md transition-shadow"
  onClick={() => setShowZTokenResetInfo(true)}
>
  <p className="text-xs font-semibold text-white">{profile.ztoken}</p>
  <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-5 h-5" />
</div>

{/* ZTicket */}
<div className="flex items-center justify-between border border-purple-400 bg-purple-900/30 rounded-md px-2 py-1 space-x-1.5 w-fit max-w-full">
  <p className="text-xs font-semibold text-white">{profile.raid_tickets}</p>
  <img src={GAME_ASSETS.ZTICKET} alt="ZTicket" className="w-5 h-5" />
</div>
              <div className="flex items-center justify-between border border-green-400 bg-green-900/30 rounded-md px-2 py-1 space-x-1.5 w-fit max-w-full">
  <p className="text-xs font-semibold text-white">{profile.clover}</p>
  <img src={GAME_ASSETS.CLOVER} alt="Clover" className="w-5 h-5" />
</div>
          
          </div>  
           {/* Quick Actions */}
        <div className="flex justify-center sm:justify-start flex-wrap gap-4 mb-4">
  <button 
    className="flex items-center justify-between border border-green-400 bg-green-900/30 rounded-md px-2 py-1 space-x-1.5 w-fit max-w-full"
    onClick={() => setShowFriendSystemModal(true)}
  >
    <img src={GAME_ASSETS.FRIENDS} alt="Friends" className="w-8 h-8" />
    {friendRequests.length > 0 && (
      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
        {friendRequests.length}
      </div>
    )}
  </button>
  <button 
    className="flex items-center justify-between border border-yellow-400 bg-green-900/30 rounded-md px-2 py-1 space-x-1.5 w-fit max-w-full"
    onClick={() => {
      navigate('/leaderboard');
      handleUserInteraction();
    }}
  >
    <img src={GAME_ASSETS.LB} alt="LB" className="w-8 h-8" />
  </button>

  <button 
    className="flex items-center justify-between border border-white-400 bg-green-900/30 rounded-md px-2 py-1 space-x-1.5 w-fit max-w-full"
    onClick={() => {
      setShowChat(true);
      handleUserInteraction();
    }}
  >
    <img src={GAME_ASSETS.GLOBAL_CHAT} alt="Global Chat" className="w-8 h-8" />
  </button>

  <button 
    className="flex items-center justify-between border border-red-400 bg-green-900/30 rounded-md px-2 py-1 space-x-1.5 w-fit max-w-full"
    onClick={() => {
      setShowRedeemModal(true);
      handleUserInteraction();
    }}
  >
    <img src={GAME_ASSETS.RCODE} alt="Rcode" className="w-8 h-8" />
  </button>
</div>

      </div>

        {/* Character Display */}
        <div className="flex flex-col items-center justify-center mb-8">
          <AnimatePresence>
            {showLevelUpAnimation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 2 }}
                className="absolute inset-0 flex items-center justify-center z-20 px-4"
              >
                <div className="rpg-card-accent p-8 text-center animate-pulse">
                  <Crown className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                  <div className="text-3xl font-bold text-white mb-2">Level Up!</div>
                  <div className="text-xl text-gray-300">Level {profile.level}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center mb-6 max-w-sm">
            <motion.img
              src={GAME_ASSETS.getCharacterImage(profile.character_type as 'male' | 'female', equippedCostume)}
              alt="Character"
              className="w-40 h-40 object-contain mx-auto mb-4"
              animate={{
                y: [0, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <div className="flex items-center justify-center text-gray-300">
              <Zap className="w-4 h-4 mr-1" />
              <span>Strength: {profile.strength}</span>
            </div>
          </div>

          <button
            onClick={handleLevelUp}
            className="flex items-center justify-center btn-primary btn-lg mb-4"
          >
            <TrendingUp className="w-4 h-4 mr-1" />({requiredZGold.toLocaleString()}<img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-4 h-4" />
)
          </button>
          
          <p className="text-sm text-gray-300 text-center max-w-xs">
            Strength +{calculateStrengthIncrease(profile.level)} on next level
          </p>
        </div>

       

        {/* Global Chat Component */}
        <GlobalChat 
          profile={profile}
          showChat={showChat}
          setShowChat={setShowChat}
        />

        {/* Friend System Component */}
        <FriendSystem
          isOpen={showFriendSystemModal}
          onClose={() => setShowFriendSystemModal(false)}
          profile={profile}
          onProfileUpdate={loadProfile}
        />

        {/* Friend Request Notification */}
        {currentFriendRequest && (
          <FriendNotification
            request={currentFriendRequest}
            onAccept={() => handleAcceptFriendRequest(currentFriendRequest.id)}
            onReject={() => handleRejectFriendRequest(currentFriendRequest.id)}
            onTimeout={handleFriendRequestTimeout}
          />
        )}

        {/* Dungeon Modal */}
        <DungeonModal
          isOpen={showDungeonModal}
          onClose={() => setShowDungeonModal(false)}
          profile={profile}
          onProfileUpdate={loadProfile}
        />

        {/* ZToken Reset Info Modal */}
        <ZTokenResetInfo
          isOpen={showZTokenResetInfo}
          onClose={() => setShowZTokenResetInfo(false)}
        />

        {/* RAID Modal */}
        <RaidModal
          isOpen={showRaidModal}
          onClose={() => setShowRaidModal(false)}
          profile={profile}
          onProfileUpdate={loadProfile}
        />

        {/* RAID Invite Notification */}
        {/* This will be handled by RaidModal component */}

        {/* Navigation Bar */}
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
              onClick={() => navigate('/shop')}
            >
              <img src={GAME_ASSETS.SHOP} alt="Shop" className="w-8 h-8" />
              <span className="text-xs text-gray-300 mt-1">Shop</span>
            </button>
            <button 
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              onClick={() => setShowGameModesModal(true)}
            >
              <img src={GAME_ASSETS.GAME_MODE} alt="Game Mode" className="w-8 h-8" />
              <span className="text-xs text-gray-300 mt-1">Games</span>
            </button>
            <button 
              className="flex flex-col items-center p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
              onClick={() => navigate('/battle')}
            >
              <img src={GAME_ASSETS.BATTLE} alt="Battle" className="w-9 h-8" />
              <span className="text-xs text-gray-300 mt-1">Battle</span>
            </button>
          </div>
        </div>

        {/* Game Modes Modal */}
        {showGameModesModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 overflow-y-auto z-50">
            <div className="rpg-card max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Game Modes</h2>
                <button 
                  onClick={() => setShowGameModesModal(false)}
                  className="btn-secondary btn-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
                {GAME_MODES.map((mode, index) => (
                  <motion.button
                    key={index}
                    className={`text-center p-4 hover:shadow-lg transition-all ${mode.comingSoon ? 'opacity-50' : ''}`}
                    onClick={() => handleGameModeClick(mode)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={`w-16 h-16 bg-gradient-to-br ${mode.color} rounded-2xl p-3 mb-3 mx-auto shadow-lg`}>
                      <img 
                        src={mode.image} 
                        alt={mode.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="font-medium text-white text-sm">{mode.name}</p>
                    {mode.comingSoon && (
                      <p className="text-xs text-gray-400 mt-1">Coming Soon</p>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Redeem Code Modal */}
        {showRedeemModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="rpg-card max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Redeem Code</h2>
                <button 
                  onClick={() => setShowRedeemModal(false)}
                  className="btn-secondary btn-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="Enter redeem code"
                className="input-modern w-full mb-4"
              />
              <button
                onClick={handleRedeemCode}
                className="btn-success w-full"
              >
                Redeem
              </button>
            </div>
          </div>
        )}

        {/* Reward Modal */}
        {showRewardModal && currentReward && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rpg-card max-w-md w-full mx-4 text-center"
            >
              <h2 className="text-2xl font-bold text-white mb-6">Congratulations!</h2>
              <div className="space-y-4 mb-6">
                {currentReward.zgold > 0 && (
                  <div className="rpg-card-light flex items-center justify-center">
                    <img src={GAME_ASSETS.ZGOLD} alt="ZGold" className="w-8 h-8 mr-3" />
                    <span className="text-xl font-semibold">+{currentReward.zgold.toLocaleString()}</span>
                  </div>
                )}
                {currentReward.ztoken > 0 && (
                  <div className="rpg-card-light flex items-center justify-center">
                    <img src={GAME_ASSETS.ZTOKEN} alt="ZToken" className="w-8 h-8 mr-3" />
                    <span className="text-xl font-semibold">+{currentReward.ztoken}</span>
                  </div>
                )}
                {currentReward.exp > 0 && (
                  <div className="rpg-card-light flex items-center justify-center">
                    <Star className="w-8 h-8 mr-3 text-yellow-500" />
                    <span className="text-xl font-semibold">+{currentReward.exp} EXP</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowRewardModal(false)}
                className="btn-primary w-full"
              >
                Claim Rewards
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
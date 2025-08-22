import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Users, 
  Search, 
  UserPlus, 
  Bell, 
  Send,
  Check,
  XIcon,
  Heart,
  Star
} from 'lucide-react';
import { useFriends } from '../hooks/useFriends';
import { getUserProfileById, unfriendUser } from '../hooks/useFriends';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { GAME_ASSETS } from '../assets/gameAssets';
import { TitleDisplay } from './TitleDisplay';
import { useUserTitle } from '../hooks/useTitles';
import { PlayerProfileModal } from './PlayerProfileModal';

interface Profile {
  id: string;
  username: string;
  profile_image_url: string;
  character_type: string;
  level: number;
  clover: number;
}

interface FriendSystemProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onProfileUpdate: () => void;
}

// Component untuk menampilkan friend dengan title
function FriendWithTitle({ 
  friendId, 
  username, 
  profileImageUrl, 
  characterType, 
  level, 
  canSendClover, 
  isOnline,
  lastSeen,
  onSendClover,
  onViewProfile,
  onUnfriend
}: {
  friendId: string;
  username: string;
  profileImageUrl: string;
  characterType: string;
  level: number;
  canSendClover: boolean;
  isOnline: boolean;
  lastSeen: string;
  onSendClover: (friendId: string) => void;
  onViewProfile: (friendId: string) => void;
  onUnfriend: (friendId: string) => void;
}) {
  const { title } = useUserTitle(friendId);
  
  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };
  
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border transition-all duration-200 ${
      isOnline 
        ? 'bg-green-900/20 border-green-500/30 shadow-md shadow-green-500/10' 
        : 'bg-gray-700/30 border-gray-600/30 opacity-75'
    }`}
    onClick={() => onViewProfile(friendId)}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={profileImageUrl}
            alt={username}
            className={`w-12 h-12 rounded-full object-cover border-2 transition-all ${
              isOnline 
                ? 'border-green-400 shadow-md shadow-green-400/30' 
                : 'border-gray-600'
            }`}
          />
          {/* Online Status Indicator */}
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${
            isOnline ? 'bg-green-400' : 'bg-gray-500'
          }`}></div>
          <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-semibold px-1 rounded-full">
            {level}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold ${isOnline ? 'text-white' : 'text-gray-400'}`}>
              {username}
            </span>
            {title && (
              <TitleDisplay 
                title={title} 
                size="small" 
                showIcon={true}
              />
            )}
            
          </div>
          <div className={`text-xs capitalize ${isOnline ? 'text-gray-300' : 'text-gray-500'}`}>
            {characterType} • Level {level} • {isOnline ? 'Online' : formatLastSeen(lastSeen)}
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSendClover(friendId);
          }}
          disabled={!canSendClover}
          className={`p-2 rounded-lg transition-all ${
            canSendClover 
              ? isOnline 
                ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' 
                : 'bg-green-700 hover:bg-green-800 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          title={canSendClover ? 'Send Clover' : 'Already sent today'}
        >
          <img src={GAME_ASSETS.CLOVER} alt="Clover" className="w-5 h-5" />
        </button>
        
      </div>
    </div>
  );
}

// Component untuk menampilkan friend request dengan title
function FriendRequestWithTitle({ 
  request, 
  onAccept, 
  onReject 
}: {
  request: any;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { title } = useUserTitle(request.requester_id);
  
  return (
    <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600/50">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={request.requester_profile_image_url}
            alt={request.requester_username}
            className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
          />
          <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-semibold px-1 rounded-full">
            {request.requester_level}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white">{request.requester_username}</span>
            {title && (
              <TitleDisplay 
                title={title} 
                size="small" 
                showIcon={true}
              />
            )}
          </div>
          <div className="text-xs text-gray-400 capitalize">
            {request.requester_character_type} • Level {request.requester_level}
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(request.id)}
          className="btn-success btn-sm"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => onReject(request.id)}
          className="btn-danger btn-sm"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function FriendSystem({ isOpen, onClose, profile, onProfileUpdate }: FriendSystemProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<any>(null);
  const [showPlayerProfileModal, setShowPlayerProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const formatLastSeen = (lastSeen: string) => {
    if (!lastSeen) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMs = now.getTime() - lastSeenDate.getTime();
    
    if (isNaN(diffInMs) || diffInMs < 0) return 'Unknown';
    
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${diffInDays}d ago`;
  };

  const {
    friends,
    friendRequests,
    loading,
    loadFriends,
    loadFriendRequests,
    sendFriendRequest,
    respondToFriendRequest,
    sendClover,
    searchUsers
  } = useFriends(profile?.id || null);

  useEffect(() => {
    if (isOpen && profile) {
      loadFriends();
      loadFriendRequests();
    }
  }, [isOpen, profile]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setSearchLoading(true);
    try {
      const results = await searchUsers(searchTerm);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendFriendRequest = async (targetUsername: string) => {
    const success = await sendFriendRequest(targetUsername);
    if (success) {
      handleSearch(); // Refresh search results
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    const success = await respondToFriendRequest(requestId, 'accepted');
    if (success) {
      onProfileUpdate(); // Update profile to refresh friend count
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    await respondToFriendRequest(requestId, 'rejected');
  };

  const handleSendClover = async (friendId: string) => {
    const success = await sendClover(friendId);
    if (success) {
      onProfileUpdate(); // Update profile to refresh clover count
    }
  };

  const handleViewProfile = async (profileId: string) => {
    setProfileLoading(true);
    try {
      const { data: profileData, error } = await supabase.rpc('get_user_profile_by_id', {
        p_profile_id: profileId
      });
      
      if (error) {
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile');
        return;
      }
      
      if (profileData && profileData.length > 0) {
        setSelectedPlayerProfile(profileData[0]);
        setShowPlayerProfileModal(true);
      } else {
        toast.error('Profile not found');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleViewProfileFromSearch = async (userId: string) => {
    setProfileLoading(true);
    try {
      // userId dari search adalah profile_id, bukan user_id
      const { data: profileData, error } = await supabase.rpc('get_user_profile_by_id', {
        p_profile_id: userId
      });
      
      if (error) {
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile');
        return;
      }
      
      if (profileData && profileData.length > 0) {
        setSelectedPlayerProfile(profileData[0]);
        setShowPlayerProfileModal(true);
      } else {
        toast.error('Profile not found');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUnfriend = async (friendId: string) => {
    if (!profile) return;
    
    const confirmUnfriend = window.confirm('Are you sure you want to remove this friend?');
    if (!confirmUnfriend) return;
    
    try {
      const result = await unfriendUser(profile.id, friendId);
      if (result.success) {
        toast.success(result.message);
        await loadFriends(); // Refresh friend list
        onProfileUpdate(); // Update profile
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error unfriending user:', error);
      toast.error('Failed to unfriend user');
    }
  };
  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">TEMAN</h2>
              
            </div>
            <button 
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'friends'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              ({friends.length})
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'search'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-lg font-medium transition-all relative ${
                activeTab === 'requests'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
              }`}
            >
              <Bell className="w-4 h-4 inline mr-2" />
              {friendRequests.length > 0 && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {friendRequests.length}
                </div>
              )}
            </button>
            <div className="flex items-center gap-2 bg-green-900/30 px-3 py-1 rounded-lg border border-green-500/30">
                              <img src={GAME_ASSETS.CLOVER} alt="Clover" className="w-5 h-5" />
                <span className="font-semibold text-green-300">{profile.clover}</span>
              </div>
          </div>

          {/* Content */}
          <div className="min-h-[400px]">
            {/* Friends Tab */}
            {activeTab === 'friends' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Heart className="w-5 h-5 mr-2 text-red-400" />
                  Your Friends ({friends.length})
                </h3>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                    <p className="text-gray-400">Loading friends...</p>
                  </div>
                ) : friends.length > 0 ? (
                  <div className="space-y-3">
                    {friends.map((friend) => (
                      <FriendWithTitle
                        key={friend.friend_id}
                        friendId={friend.friend_id}
                        username={friend.friend_username}
                        profileImageUrl={friend.friend_profile_image_url}
                        characterType={friend.friend_character_type}
                        level={friend.friend_level}
                        canSendClover={friend.can_send_clover}
                        isOnline={friend.is_online}
                        lastSeen={friend.last_seen}
                        onSendClover={handleSendClover}
                        onViewProfile={handleViewProfile}
                        onUnfriend={handleUnfriend}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-white mb-2">No friends yet</p>
                    <p className="text-gray-400">Search for players to add as friends!</p>
                  </div>
                )}
                
                {/* Online Friends Summary */}
                {friends.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-600/30">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">Status:</span>
                      <div className="flex items-center gap-4">
                        <span className="text-green-400">🟢 {friends.filter(f => f.is_online).length} Online</span>
                        <span className="text-gray-500">⚫ {friends.filter(f => !f.is_online).length} Offline</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Tab */}
            {activeTab === 'search' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Search className="w-5 h-5 mr-2 text-blue-400" />
                  Find Friends
                </h3>
                
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by username or UUID..."
                    className="input-modern flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searchLoading || !searchTerm.trim()}
                    className="btn-primary"
                  >
                    {searchLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {searchResults.length > 0 ? (
                  <div className="space-y-3">
                    {searchResults.map((user) => (
                      <div 
                        key={user.user_id} 
                        className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600/50 cursor-pointer hover:bg-gray-600/50 transition-all"
                        onClick={() => handleViewProfile(user.user_id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={user.profile_image_url}
                              alt={user.username}
                              className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
                            />
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-xs font-semibold px-1 rounded-full">
                              {user.level}
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-white">{user.username}</div>
                            <div className="text-xs text-gray-400 capitalize">
                              {user.character_type} • Level {user.level}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          {user.friendship_status === 'none' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendFriendRequest(user.username);
                              }}
                              className="btn-success btn-sm"
                            >
                              <UserPlus className="w-4 h-4 mr-1" />
                            </button>
                          )}
                          {user.friendship_status === 'accepted' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnfriend(user.user_id);
                              }}
                              className="btn-danger btn-sm"
                            >
                              <XIcon className="w-4 h-4 mr-1" />
                            </button>
                          )}
                          {(user.friendship_status === 'pending' || user.friendship_status === 'rejected') && (
                            <div className="badge badge-warning">Pending</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchTerm && !searchLoading ? (
                  <div className="text-center py-8">
                    <Search className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-400">No users found</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Bell className="w-5 h-5 mr-2 text-yellow-400" />
                  Friend Requests ({friendRequests.length})
                </h3>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                    <p className="text-gray-400">Loading requests...</p>
                  </div>
                ) : friendRequests.length > 0 ? (
                  <div className="space-y-3">
                    {friendRequests.map((request) => (
                      <FriendRequestWithTitle
                        key={request.id}
                        request={request}
                        onAccept={handleAcceptRequest}
                        onReject={handleRejectRequest}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Bell className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-white mb-2">No friend requests</p>
                    <p className="text-gray-400">You'll see incoming friend requests here</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <div className="rpg-card-accent p-3">
              <h4 className="font-semibold text-white mb-2 flex items-center">
                <Star className="w-4 h-4 mr-2 text-yellow-400" />
                Clover System
              </h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>• Kirim 🍀 ke teman sekali per hari</p>  
<p>• Gunakan 🍀 di Toko 🍀 khusus</p>  
<p>• 🟢 Hijau = Teman online</p>  
<p>• ⚫ Abu-abu = Teman offline</p>  
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Player Profile Modal - Outside Friend System */}
      <PlayerProfileModal
        isOpen={showPlayerProfileModal}
        onClose={() => setShowPlayerProfileModal(false)}
        profile={selectedPlayerProfile}
        loading={profileLoading}
      />
    </AnimatePresence>
  );
}
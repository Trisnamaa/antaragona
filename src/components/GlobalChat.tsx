import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GAME_ASSETS } from '../assets/gameAssets';
import { TitleDisplay } from './TitleDisplay';
import { useUserTitle } from '../hooks/useTitles';
import { supabase as supabaseClient } from '../lib/supabase';
import { PlayerProfileModal } from './PlayerProfileModal';
import toast from 'react-hot-toast';

// Component untuk menampilkan username dengan title
function UsernameWithTitle({ message }: { message: ChatMessage }) {
  // Get profile_id from user_id for title lookup
  const [profileId, setProfileId] = React.useState<string | null>(null);
  const { title } = useUserTitle(profileId);
  
  React.useEffect(() => {
    const getProfileId = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', message.user_id)
          .single();
        
        if (!error && data) {
          setProfileId(data.id);
        }
      } catch (error) {
        console.error('Error getting profile ID:', error);
      }
    };
    
    if (message.user_id) {
      getProfileId();
    }
  }, [message.user_id]);
  
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">{message.username}</span>
      {title && (
        <TitleDisplay 
          title={title} 
          size="small" 
          showIcon={true}
        />
      )}
    </div>
  );
}

interface Profile {
  id: string;
  user_id: string;
  username: string;
  profile_image_url: string;
  character_type: string;
  level: number;
}

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
}

interface GlobalChatProps {
  profile: Profile;
  showChat: boolean;
  setShowChat: (show: boolean) => void;
}

export function GlobalChat({ profile, showChat, setShowChat }: GlobalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<any>(null);
  const [showPlayerProfileModal, setShowPlayerProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showChat) {
      loadMessages();
      subscribeToMessages();
      startCleanupInterval();
      startRefreshInterval();
    } else {
      // Cleanup subscription when chat is closed
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [showChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('global_chat')
        .select('id, user_id, username, message, created_at')
        .order('created_at', { ascending: true })
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Only load messages from last 30 minutes
        .limit(100);

      if (error) throw error;

      // Only update if there are actual changes to prevent unnecessary re-renders
      const newMessages = data || [];
      setMessages(prevMessages => {
        // Check if messages have actually changed
        if (JSON.stringify(prevMessages) !== JSON.stringify(newMessages)) {
          return newMessages;
        }
        return prevMessages;
      });
    } catch (error) {
      console.error('Error loading messages:', error);
      // Don't show error toast for background refreshes
    } finally {
      // Only set loading false for initial load
      if (loadingMessages) {
        setLoadingMessages(false);
      }
    }
  };

  const startRefreshInterval = () => {
    // Refresh messages every 2 seconds for real-time updates
    refreshIntervalRef.current = setInterval(() => {
      loadMessages();
    }, 2000); // 2 seconds
  };
  const startCleanupInterval = () => {
    // Clean up old messages every 5 minutes
    cleanupIntervalRef.current = setInterval(() => {
      cleanupOldMessages();
    }, 5 * 60 * 1000); // 5 minutes
  };

  const cleanupOldMessages = () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    setMessages(prev => prev.filter(msg => new Date(msg.created_at) > thirtyMinutesAgo));
  };
  const subscribeToMessages = () => {
    // Cleanup existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    
    subscriptionRef.current = supabase
      .channel(`global_chat_${Date.now()}`) // Unique channel name to avoid conflicts
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'global_chat' },
        (payload) => {
          console.log('New message received:', payload.new);
          const newMsg: ChatMessage = {
            id: payload.new.id,
            user_id: payload.new.user_id,
            username: payload.new.username,
            message: payload.new.message,
            created_at: payload.new.created_at
          };
          
          setMessages(prev => {
            // Avoid duplicates
            const exists = prev.some(msg => msg.id === newMsg.id);
            if (exists) return prev;
            
            // Add new message and keep only recent messages (last 30 minutes)
            const updated = [...prev, newMsg];
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            return updated.filter(msg => new Date(msg.created_at) > thirtyMinutesAgo);
          });
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to global chat');
        }
      });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    const messageToSend = newMessage.trim();
    
    try {
      const { error } = await supabase
        .from('global_chat')
        .insert({
          user_id: profile.user_id,
          username: profile.username,
          message: messageToSend
        });

      if (error) throw error;

      setNewMessage('');
      
      // Message will be added via real-time subscription
      // Just scroll to bottom
      setTimeout(scrollToBottom, 100);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleUserProfileClick = async (userId: string) => {
    setProfileLoading(true);
    try {
      // First get profile_id from user_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (profileError || !profileData) {
        toast.error('Profile not found');
        return;
      }

      // Then get full profile data using profile_id
      const { data: fullProfileData, error } = await supabase.rpc('get_user_profile_by_id', {
        p_profile_id: profileData.id
      });
      
      if (error) {
        console.error('Error loading profile:', error);
        toast.error('Failed to load profile');
        return;
      }
      
      if (fullProfileData && fullProfileData.length > 0) {
        setSelectedPlayerProfile(fullProfileData[0]);
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

  // State untuk menyimpan profile data real-time
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});

  // Load profile data untuk setiap user yang muncul di chat
  const loadUserProfileData = async (userId: string) => {
    if (userProfiles[userId]) return userProfiles[userId];
    
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('id, profile_image_url, level')
        .eq('user_id', userId)
        .single();

      if (!error && profileData) {
        const profileInfo = {
          profile_image_url: profileData.profile_image_url,
          level: profileData.level
        };
        
        setUserProfiles(prev => ({
          ...prev,
          [userId]: profileInfo
        }));
        
        return profileInfo;
      }
    } catch (error) {
      console.error('Error loading user profile data:', error);
    }
    
    // Fallback untuk current user
    if (userId === profile.user_id) {
      return {
        profile_image_url: profile.profile_image_url,
        level: profile.level
      };
    }
    
    // Default fallback
    return {
      profile_image_url: 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752079455935-tzjifn.png',
      level: 1
    };
  };

  // Load profile data untuk semua messages saat chat dibuka
  useEffect(() => {
    if (showChat && messages.length > 0) {
      messages.forEach(message => {
        if (message.user_id !== profile.user_id) {
          loadUserProfileData(message.user_id);
        }
      });
    }
  }, [showChat, messages, profile.user_id]);

  const getUserProfileData = (userId: string) => {
    return userProfiles[userId] || {
      profile_image_url: userId === profile.user_id ? profile.profile_image_url : 'https://raw.githubusercontent.com/AquaCasaster/db_image/main/1752079455935-tzjifn.png',
      level: userId === profile.user_id ? profile.level : 1
    };
  };

  // Initial load with loading state
  useEffect(() => {
    if (showChat) {
      setLoadingMessages(true);
      loadMessages();
    }
  }, [showChat]);
  return (
    <AnimatePresence>
      {showChat && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="rpg-card w-full max-w-md h-[70vh] sm:h-[600px] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div className="flex items-center space-x-2">
                    <img src={GAME_ASSETS.GLOBAL_CHAT} alt="Global Chat" className="w-5 h-5" />
                <h2 className="text-lg font-semibold text-white">Global Chat</h2>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Real-time updates every 2s"></div>
              </div>
              <button 
                onClick={() => setShowChat(false)}
                className="btn-secondary btn-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {loadingMessages && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-400">Loading messages...</p>
                </div>
              )}
              
              {!loadingMessages && messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-400">No messages yet. Start the conversation!</p>
                </div>
              )}
              
              {messages.map((message) => {
                const userProfile = getUserProfileData(message.user_id);
                const isOwnMessage = message.user_id === profile.user_id;
                
                return (
                  <motion.div 
                    key={message.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}
                  >
                    <button
                      onClick={() => handleUserProfileClick(message.user_id)}
                      className="flex-shrink-0"
                    >
                      <div className="relative">
                        <img
                          src={userProfile.profile_image_url}
                          alt={message.username}
                          className="w-8 h-8 rounded-full object-cover border-2 border-gray-600 hover:border-purple-400 transition-colors"
                        />
                        <div className={`absolute -bottom-1 ${isOwnMessage ? '-left-1' : '-right-1'} bg-blue-500 text-white text-xs font-semibold px-1 rounded-full min-w-[16px] h-4 flex items-center justify-center`}>
                          {userProfile.level}
                        </div>
                      </div>
                    </button>
                    <div className={`flex-1 min-w-0 ${isOwnMessage ? 'text-right' : ''}`}>
                      <div className={`flex items-center space-x-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                        <button
                          onClick={() => handleUserProfileClick(message.user_id)}
                          className={`hover:text-blue-300 transition-colors text-sm flex items-center gap-2 ${
                            isOwnMessage ? 'text-purple-400' : 'text-blue-400'
                          }`}
                        >
                          <UsernameWithTitle message={message} />
                        </button>
                      </div>
                      <div className={`inline-block max-w-xs sm:max-w-sm p-3 rounded-lg ${
                        isOwnMessage 
                          ? 'text-white' 
                          : 'text-gray-100'
                      }`}>
                        <p className="text-sm break-words">
                          {message.message}
                        </p>
                        <span className={`text-xs ${isOwnMessage ? 'text-purple-200' : 'text-gray-400'}`}>
    {formatTime(message.created_at)}
  </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="input-modern flex-1 text-sm"
                  maxLength={20}
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || loading}
                  className="btn-primary px-3 py-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {newMessage.length}/20 characters
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Player Profile Modal */}
      <PlayerProfileModal
        isOpen={showPlayerProfileModal}
        onClose={() => setShowPlayerProfileModal(false)}
        profile={selectedPlayerProfile}
        loading={profileLoading}
      />
    </AnimatePresence>
  );
}
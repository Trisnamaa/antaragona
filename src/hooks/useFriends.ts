import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Friend {
  friend_id: string;
  friend_username: string;
  friend_profile_image_url: string;
  friend_character_type: string;
  friend_level: number;
  can_send_clover: boolean;
  friendship_created_at: string;
  is_online: boolean;
  last_seen: string;
}

interface FriendRequest {
  id: string;
  requester_id: string;
  requester_username: string;
  requester_profile_image_url: string;
  requester_character_type: string;
  requester_level: number;
  created_at: string;
}

interface SearchResult {
  user_id: string;
  username: string;
  profile_image_url: string;
  character_type: string;
  level: number;
  friendship_status: string;
}

interface UseFriendsReturn {
  friends: Friend[];
  friendRequests: FriendRequest[];
  loading: boolean;
  loadFriends: () => Promise<void>;
  loadFriendRequests: () => Promise<void>;
  sendFriendRequest: (targetUsername: string) => Promise<boolean>;
  respondToFriendRequest: (friendshipId: string, response: 'accepted' | 'rejected') => Promise<boolean>;
  sendClover: (friendId: string) => Promise<boolean>;
  searchUsers: (searchTerm: string) => Promise<SearchResult[]>;
  updateUserActivity: (activityType?: string) => Promise<void>;
}

export function useFriends(profileId: string | null): UseFriendsReturn {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFriends = async () => {
    if (!profileId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_friend_list', {
        p_player_profile_id: profileId
      });

      if (error) throw error;
      setFriends(data || []);
    } catch (error) {
      console.error('Error loading friends:', error);
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const loadFriendRequests = async () => {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          requester_id,
          created_at,
          profiles!friendships_requester_id_fkey (
            username,
            profile_image_url,
            character_type,
            level
          )
        `)
        .eq('addressee_id', profileId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedRequests: FriendRequest[] = (data || []).map(request => ({
        id: request.id,
        requester_id: request.requester_id,
        requester_username: (request.profiles as any)?.username || 'Unknown',
        requester_profile_image_url: (request.profiles as any)?.profile_image_url || '',
        requester_character_type: (request.profiles as any)?.character_type || 'male',
        requester_level: (request.profiles as any)?.level || 1,
        created_at: request.created_at
      }));

      setFriendRequests(transformedRequests);
    } catch (error) {
      console.error('Error loading friend requests:', error);
      toast.error('Failed to load friend requests');
    }
  };

  const sendFriendRequest = async (targetUsername: string): Promise<boolean> => {
    if (!profileId) return false;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('send_friend_request', {
        p_requester_profile_id: profileId,
        p_target_username: targetUsername
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        return true;
      } else {
        toast.error(data.message);
        return false;
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast.error('Failed to send friend request');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const respondToFriendRequest = async (
    friendshipId: string, 
    response: 'accepted' | 'rejected'
  ): Promise<boolean> => {
    if (!profileId) return false;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('respond_to_friend_request', {
        p_addressee_profile_id: profileId,
        p_friendship_id: friendshipId,
        p_response: response
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        await loadFriendRequests();
        if (response === 'accepted') {
          await loadFriends();
        }
        return true;
      } else {
        toast.error(data.message);
        return false;
      }
    } catch (error) {
      console.error('Error responding to friend request:', error);
      toast.error('Failed to respond to friend request');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const sendClover = async (friendId: string): Promise<boolean> => {
    if (!profileId) return false;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('send_clover', {
        p_sender_profile_id: profileId,
        p_receiver_profile_id: friendId
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        await loadFriends(); // Refresh to update can_send_clover status
        return true;
      } else {
        toast.error(data.message);
        return false;
      }
    } catch (error) {
      console.error('Error sending clover:', error);
      toast.error('Failed to send clover');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (searchTerm: string): Promise<SearchResult[]> => {
    if (!profileId || !searchTerm.trim()) return [];

    try {
      const { data, error } = await supabase.rpc('search_users_for_friends', {
        p_searcher_profile_id: profileId,
        p_search_term: searchTerm.trim()
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
      return [];
    }
  };

  const updateUserActivity = async (activityType: string = 'general') => {
    if (!profileId) return;

    try {
      const { error } = await supabase.rpc('update_user_activity', {
        p_profile_id: profileId,
        p_activity_type: activityType
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  };

  useEffect(() => {
    if (profileId) {
      loadFriends();
      loadFriendRequests();
      updateUserActivity(profileId, 'lobby'); // Mark user as online when component loads
      
      // Update activity every 2 minutes to maintain online status
      const activityInterval = setInterval(() => {
        updateUserActivity(profileId, 'lobby');
      }, 2 * 60 * 1000); // 2 minutes
      
      return () => clearInterval(activityInterval);
    }
  }, [profileId]);

  return {
    friends,
    friendRequests,
    loading,
    loadFriends,
    loadFriendRequests,
    sendFriendRequest,
    respondToFriendRequest,
    sendClover,
    searchUsers,
    updateUserActivity,
    getUserProfileById: (profileId: string) => getUserProfileById(profileId),
    unfriendUser: (currentUserId: string, friendId: string) => unfriendUser(currentUserId, friendId)
  };
}

export async function getUserProfileById(profileId: string) {
  try {
    const { data, error } = await supabase.rpc('get_user_profile_by_id', {
      p_profile_id: profileId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

export async function unfriendUser(currentUserId: string, friendId: string) {
  try {
    const { data, error } = await supabase.rpc('unfriend_user', {
      p_current_user_id: currentUserId,
      p_friend_id: friendId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error unfriending user:', error);
    throw error;
  }
}
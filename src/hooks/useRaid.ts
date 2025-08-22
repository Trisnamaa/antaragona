import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RaidMap {
  id: string;
  name: string;
  description: string;
  background_url: string;
  boss_name: string;
  difficulty_level: number;
  base_reward_exp: number;
  boss_image_url: string; // Added for game screen
}

export interface RaidRoom {
  id: string;
  room_uuid: string;
  creator_id: string;
  map_id: string;
  status: 'waiting' | 'in_progress' | 'completed';
  max_players: number;
  created_at: string;
  raid_maps: RaidMap;
  // New fields for game state
  current_round: number;
  current_turn: number;
  boss_hp: number | null;
  boss_max_hp: number | null;
}

export interface RaidParticipant {
  id: string;
  room_id: string;
  profile_id: string;
  slot_number: number;
  current_hp: number;
  max_hp: number;
  is_ready: boolean;
  is_alive: boolean; // Added for game screen
  claimed_rewards_at: string | null; // New field for reward synchronization
  profiles: {
    id: string;
    username: string;
    level: number;
    character_type: string;
    strength: number;
    profile_image_url: string;
  };
}

export interface RaidInvite {
  id: string;
  room_uuid: string;
  inviter_username: string;
  invitee_username: string;
  status: 'pending' | 'accepted' | 'rejected';
  expires_at: string;
}

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
}

export const RaidUtils = {
  getDifficultyName: (level: number): string => {
    switch (level) {
      case 1: return 'Easy';
      case 2: return 'Normal';
      case 3: return 'Hard';
      case 4: return 'Expert';
      case 5: return 'Master';
      default: return 'Unknown';
    }
  },

  getDifficultyColor: (level: number): string => {
    switch (level) {
      case 1: return 'text-green-400';
      case 2: return 'text-blue-400';
      case 3: return 'text-yellow-400';
      case 4: return 'text-orange-400';
      case 5: return 'text-red-400';
      default: return 'text-gray-400';
    }
  }
};

export function useRaid(profileId: string | null) {
  const [raidMaps, setRaidMaps] = useState<RaidMap[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RaidRoom | null>(null);
  const [participants, setParticipants] = useState<RaidParticipant[]>([]);
  const [raidInvites, setRaidInvites] = useState<RaidInvite[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [completionCounts, setCompletionCounts] = useState<Record<string, number>>({});
  const [roomChannel, setRoomChannel] = useState<RealtimeChannel | null>(null);

  // Refs untuk mengelola subscription dan interval
  const inviteChannelRef = useRef<RealtimeChannel | null>(null);
  const roomRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inviteRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadInvites = useCallback(async () => {
    if (!profileId) return;

    try {
      const { data: invites, error } = await supabase
        .from('raid_invites')
        .select(`
          *,
          raid_rooms (
            room_uuid,
            raid_maps (name)
          )
        `)
        .eq('invitee_id', profileId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;
      setRaidInvites(invites || []);
    } catch (error) {
      console.error('Error loading invites:', error);
    }
  }, [profileId]);

  // Fungsi untuk memulai subscription invite
  const subscribeToInvites = useCallback(() => {
    if (!profileId) return;
    
    // Cleanup existing subscription
    if (inviteChannelRef.current) {
      supabase.removeChannel(inviteChannelRef.current);
      inviteChannelRef.current = null;
    }
    
    const inviteChannel = supabase
      .channel(`raid-invites:${profileId}_${Date.now()}`) // Unique channel name
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'raid_invites',
          filter: `invitee_id=eq.${profileId}`,
        },
        (payload) => {
          console.log('New raid invite received:', payload.new);
          // Manually fetch the full invite details
          const fetchInvite = async () => {
            const { data: newInvite, error } = await supabase
              .from('raid_invites')
              .select(`
                *,
                raid_rooms (
                  room_uuid,
                  raid_maps (name)
                )
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (newInvite) {
              setRaidInvites(prev => {
                // Avoid duplicates
                const exists = prev.some(invite => invite.id === newInvite.id);
                if (exists) return prev;
                return [...prev, newInvite];
              });
            }
          };
          fetchInvite();
        }
      )
      .subscribe((status) => {
        console.log('Invite subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to raid invites');
        }
      });
    
    inviteChannelRef.current = inviteChannel;
  }, [profileId]);

  // Fungsi untuk memulai polling invite berkala
  const startInviteRefreshInterval = useCallback(() => {
    // Clear existing interval
    if (inviteRefreshIntervalRef.current) {
      clearInterval(inviteRefreshIntervalRef.current);
    }
    
    // Refresh invites every 3 seconds for real-time updates
    inviteRefreshIntervalRef.current = setInterval(() => {
      loadInvites();
    }, 3000); // 3 seconds
  }, [loadInvites]);

  // Effect untuk mengelola invite subscription dan polling
  useEffect(() => {
    if (profileId) {
      loadInvites(); // Initial load
      subscribeToInvites();
      startInviteRefreshInterval();
    }
    
    // Cleanup on unmount or profileId change
    return () => {
      if (inviteChannelRef.current) {
        supabase.removeChannel(inviteChannelRef.current);
        inviteChannelRef.current = null;
      }
      if (inviteRefreshIntervalRef.current) {
        clearInterval(inviteRefreshIntervalRef.current);
        inviteRefreshIntervalRef.current = null;
      }
    };
  }, [profileId, subscribeToInvites, startInviteRefreshInterval]);

  const loadRaidData = useCallback(async () => {
    if (!profileId) return;

    try {
      setLoading(true);

      // Load raid maps
      const { data: maps, error: mapsError } = await supabase
        .from('raid_maps')
        .select('*')
        .order('difficulty_level');

      if (mapsError) throw mapsError;
      setRaidMaps(maps || []);

      // Load completion counts for each map
      const { data: completions, error: completionsError } = await supabase
        .from('raid_progress')
        .select('map_id')
        .eq('profile_id', profileId);

      if (completionsError) throw completionsError;

      const counts: Record<string, number> = {};
      completions?.forEach(completion => {
        counts[completion.map_id] = (counts[completion.map_id] || 0) + 1;
      });
      setCompletionCounts(counts);

    } catch (error) {
      console.error('Error loading raid data:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const getTotalCompletions = useCallback(async (mapId: string): Promise<number> => {
    if (!profileId) return 0;
    
    try {
      const { data, error } = await supabase.rpc('get_raid_progress', {
        p_profile_id: profileId
      });
      
      if (error) {
        console.error('Error getting raid progress:', error);
        return 0;
      }
      
      if (data && Array.isArray(data)) {
        const mapProgress = data.find((progress: any) => progress.map_id === mapId);
        return mapProgress ? mapProgress.completion_count : 0;
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting raid progress:', error);
      return 0;
    }
  }, [profileId]);

  const loadRoomData = useCallback(async (roomUuid: string) => {
    try {
      setLoading(true);
      // Load room details
      const { data: room, error: roomError } = await supabase
        .from('raid_rooms')
        .select(`
          *,
          raid_maps (*)
        `)
        .eq('room_uuid', roomUuid)
        .single();

      if (roomError) throw roomError;
      setCurrentRoom(room);

      // Load participants
      const { data: participants, error: participantsError } = await supabase
        .from('raid_participants')
        .select(`
          *,
          profiles (
            id,
            username,
            level,
            character_type,
            strength,
            profile_image_url
          )
        `)
        .eq('room_id', room.id)
        .order('slot_number');

      if (participantsError) throw participantsError;
      setParticipants(participants || []);

      // Load chat messages
      const { data: messages, error: messagesError } = await supabase
        .from('raid_chat')
        .select(`
          id,
          message,
          created_at,
          profiles!raid_chat_profile_id_fkey (username)
        `)
        .eq('room_id', room.id)
        .order('created_at');

      if (messagesError) throw messagesError;
      
      const formattedMessages = messages?.map(msg => ({
        id: msg.id,
        username: (msg.profiles as { username: string }[])[0]?.username || 'Unknown',
        message: msg.message,
        created_at: msg.created_at
      })) || [];
      
      setChatMessages(formattedMessages);

      return room;
    } catch (error) {
      console.error('Error loading room data:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createRoom = useCallback(async (mapId:string,
  ) => {
    if (!profileId) return { success: false };

    console.log(`[Raid] User ${profileId} is attempting to create a room for map ${mapId}`);

    try {
      // Check raid tickets
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('raid_tickets')
        .eq('id', profileId)
        .single();

      if (profileError) throw profileError;
      if (!profile || profile.raid_tickets < 1) {
        return { success: false, error: 'Insufficient raid tickets' };
      }

      // Create room
      const roomUuid = `RAID_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      
      const { data: room, error: roomError } = await supabase
        .from('raid_rooms')
        .insert({
          room_uuid: roomUuid,
          creator_id: profileId,
          map_id: mapId,
          status: 'waiting',
          max_players: 3
        })
        .select('*')
        .single();

      if (roomError) throw roomError;

      // Add creator as participant
      const { error: participantError } = await supabase
        .from('raid_participants')
        .insert({
          room_id: room.id,
          profile_id: profileId,
          slot_number: 1,
          current_hp: 100,
          max_hp: 100,
          is_ready: false
        });

      if (participantError) throw participantError;

      // Deduct raid ticket
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ raid_tickets: profile.raid_tickets - 1 })
        .eq('id', profileId);

      if (updateError) throw updateError;

      console.log(`[Raid] User ${profileId} successfully created room ${roomUuid}`);
      
      // After creating, load the room data. The useEffect will then trigger the subscription.
      loadRoomData(roomUuid);

      return { success: true, room_uuid: roomUuid };
    } catch (error) {
      console.error(`[Raid] Error creating room for user ${profileId}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }, [profileId, loadRoomData]);

  // Fungsi untuk memulai polling room data berkala
  const startRoomRefreshInterval = useCallback(() => {
    if (!currentRoom?.room_uuid) return;
    
    // Clear existing interval
    if (roomRefreshIntervalRef.current) {
      clearInterval(roomRefreshIntervalRef.current);
    }
    
    // Refresh room data every 2 seconds for real-time updates
    roomRefreshIntervalRef.current = setInterval(() => {
      if (currentRoom?.room_uuid) {
        loadRoomData(currentRoom.room_uuid);
      }
    }, 2000); // 2 seconds
  }, [currentRoom?.room_uuid, loadRoomData]);

  // This effect will manage the subscription lifecycle
  useEffect(() => {
    if (currentRoom?.id && currentRoom.room_uuid) {
      const channel = supabase.channel(`raid-room:${currentRoom.room_uuid}_${Date.now()}`); // Unique channel name
      
      channel
        .on('broadcast', { event: 'user-action' }, () => {
          loadRoomData(currentRoom.room_uuid);
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'raid_participants', filter: `room_id=eq.${currentRoom.id}` },
          (payload) => {
            console.log('Raid participants changed:', payload);
            loadRoomData(currentRoom.room_uuid);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'raid_rooms', filter: `id=eq.${currentRoom.id}` },
          (payload) => {
            console.log(`[Raid Room: ${currentRoom.room_uuid}] Room updated:`, payload.new);
            
            // Force full reload to ensure all clients get the latest state
            // This is critical for round progression and turn management
            if (currentRoom?.room_uuid) {
              loadRoomData(currentRoom.room_uuid);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'raid_chat', filter: `room_id=eq.${currentRoom.id}` },
          (payload) => {
            console.log(`[Raid Room: ${currentRoom.room_uuid}] New chat message:`, payload.new);
            const fetchMessage = async () => {
              const { data: msg, error } = await supabase
                .from('raid_chat')
                .select(`id, message, created_at, profiles!raid_chat_profile_id_fkey(username)`)
                .eq('id', payload.new.id)
                .single();

              if (msg) {
                const formattedMessage = {
                  id: msg.id,
                  username: (msg.profiles as { username: string }[])[0]?.username || 'Unknown',
                  message: msg.message,
                  created_at: msg.created_at
                };
                setChatMessages(prev => {
                  // Avoid duplicates
                  const exists = prev.some(message => message.id === formattedMessage.id);
                  if (exists) return prev;
                  return [...prev, formattedMessage];
                });
              }
            };
            fetchMessage();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Raid Room: ${currentRoom.room_uuid}] Successfully subscribed to room updates.`);
          }
        });

      setRoomChannel(channel);
      
      // Start polling as backup
      startRoomRefreshInterval();

      return () => {
        supabase.removeChannel(channel);
        setRoomChannel(null);
        // Clear room refresh interval
        if (roomRefreshIntervalRef.current) {
          clearInterval(roomRefreshIntervalRef.current);
          roomRefreshIntervalRef.current = null;
        }
      };
    }
  }, [currentRoom?.id, currentRoom?.room_uuid, loadRoomData, startRoomRefreshInterval]);

  const sendInvite = useCallback(async (roomUuid: string, username: string) => {
    if (!profileId) return false;

    try {
      const { data, error } = await supabase.rpc('send_raid_invite', {
        p_inviter_profile_id: profileId,
        p_room_uuid: roomUuid,
        p_invitee_username: username
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending invite:', error);
      return false;
    }
  }, [profileId]);

  const respondToInvite = useCallback(async (inviteId: string, response: 'accepted' | 'rejected') => {
    if (!profileId) return false;

    console.log(`[Raid] User ${profileId} is responding '${response}' to invite ${inviteId}`);

    try {
      const { data, error } = await supabase.rpc('respond_to_raid_invite', {
        p_invitee_profile_id: profileId,
        p_invite_id: inviteId,
        p_response: response
      });

      if (error) throw error;
      
      if (data.success && response === 'accepted') {
        console.log(`[Raid] User ${profileId} accepted invite and is joining room ${data.room_uuid}`);
        // After accepting, load the room data. The useEffect will then trigger the subscription.
        loadRoomData(data.room_uuid).then(() => {
          // Broadcast to other clients after data is loaded
          roomChannel?.send({
            type: 'broadcast',
            event: 'user-action',
            payload: { message: `User ${profileId} joined the room.` },
          });
        });
      }

      return data;
    } catch (error) {
      console.error(`[Raid] Error for user ${profileId} responding to invite ${inviteId}:`, error);
      return { success: false, error: (error as Error).message };
    }
  }, [profileId, loadRoomData, roomChannel]);

  const leaveRoom = useCallback(async () => {
    if (!profileId || !currentRoom) return;

    console.log(`[Raid] User ${profileId} is leaving room ${currentRoom.room_uuid}`);

    try {
      // Hapus partisipan dari room
      await supabase
        .from('raid_participants')
        .delete()
        .eq('profile_id', profileId)
        .eq('room_id', currentRoom.id);

      // Broadcast ke client lain
      roomChannel?.send({
        type: 'broadcast',
        event: 'user-action',
        payload: { message: `User ${profileId} left the room.` },
      });

      // Cek jika ada partisipan lain, jika tidak ada hapus room
      const { data: remainingParticipants } = await supabase
        .from('raid_participants')
        .select('id')
        .eq('room_id', currentRoom.id);

      if (remainingParticipants && remainingParticipants.length === 0) {
        console.log(`[Raid] Room ${currentRoom.room_uuid} is empty, deleting.`);
        await supabase.from('raid_rooms').delete().eq('id', currentRoom.id);
      }
    } catch (error) {
      console.error(`[Raid] Error leaving room for user ${profileId}:`, error);
    }
  }, [profileId, currentRoom, roomChannel]);

  const startRaid = useCallback(async (roomUuid: string) => {
    console.log(`[Raid] Starting raid for room ${roomUuid}`);
    try {
      // Initialize boss HP for round 1 when starting
      const { error: updateError } = await supabase
        .from('raid_rooms')
        .update({ 
          status: 'in_progress',
          current_round: 1,
          current_turn: 0,
          boss_hp: 150,
          boss_max_hp: 150
        })
        .eq('room_uuid', roomUuid);

      if (updateError) throw updateError;
      
      console.log(`[Raid] Successfully started raid for room ${roomUuid}`);
      
      // Broadcast to ensure immediate reaction from other clients
      roomChannel?.send({
        type: 'broadcast',
        event: 'user-action',
        payload: { message: 'Raid started! Round 1 begins!' },
      });

      return true;
    } catch (error) {
      console.error(`[Raid] Error starting raid:`, error);
      return false;
    }
  }, [roomChannel]);

  const sendChatMessage = useCallback(async (roomId: string, message: string) => {
    if (!profileId) return false;

    try {
      const { error } = await supabase
        .from('raid_chat')
        .insert({
          room_id: roomId,
          profile_id: profileId,
          message: message
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending chat message:', error);
      return false;
    }
  }, [profileId]);


  const markRewardsAsClaimed = useCallback(async (roomUuid: string, selectedCards: number[]) => {
    if (!profileId || !currentRoom) return false;

    console.log(`[Raid Room: ${roomUuid}] User ${profileId} is claiming cards:`, selectedCards);

    try {
      const { data, error } = await supabase.rpc('claim_selected_cards', {
        p_room_uuid: roomUuid,
        p_profile_id: profileId,
        p_selected_cards: selectedCards,
        p_map_id: currentRoom.map_id
      });

      if (error) throw error;

      if (data && data.success) {
        console.log(`[Raid Room: ${roomUuid}] User ${profileId} successfully claimed rewards:`, data);
        
        // Update participant to mark as claimed
        await supabase
          .from('raid_participants')
          .update({ claimed_rewards_at: new Date().toISOString() })
          .eq('room_id', currentRoom.id)
          .eq('profile_id', profileId);
        
        // Broadcast to other players
        roomChannel?.send({
          type: 'broadcast',
          event: 'user-action',
          payload: { message: `User ${profileId} has claimed their rewards.` },
        });
        
        return true;
      } else {
        console.error(`[Raid Room: ${roomUuid}] Failed to claim rewards:`, data);
        return false;
      }
    } catch (error) {
      console.error(`[Raid Room: ${roomUuid}] Error claiming rewards for user ${profileId}:`, error);
      return false;
    }
  }, [profileId, currentRoom, roomChannel]);

  const generateCardRewards = useCallback(async (roomUuid: string) => {
    if (!profileId || !currentRoom) return null;

    try {
      const { data, error } = await supabase.rpc('generate_raid_rewards_and_update_profile', {
        p_room_uuid: roomUuid,
        p_profile_id: profileId,
        p_map_id: currentRoom.map_id
      });

      if (error) throw error;

      if (data && data.success) {
        console.log(`[Raid Room: ${roomUuid}] Generated card rewards:`, data);
        
        // Convert database rewards to card format for UI
        const cards = data.rewards.map((reward: any) => ({
          id: reward.id,
          type: reward.type,
          value: reward.value,
          claimed: reward.claimed || false
        }));
        
        return {
          success: true,
          rewards: cards,
          completion_count: data.completion_count,
          master_title_unlocked: data.master_title_unlocked,
          title_name: data.title_name
        };
      }
      
      return null;
    } catch (error) {
      console.error(`[Raid Room: ${roomUuid}] Error generating card rewards:`, error);
      return null;
    }
  }, [profileId, currentRoom]);

  const getCardPool = useCallback(async (roomUuid: string) => {
    try {
      const { data, error } = await supabase.rpc('get_raid_card_pool', {
        p_room_uuid: roomUuid
      });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error getting card pool:', error);
      return [];
    }
  }, []);

  const checkPlayerSelections = useCallback(async (roomUuid: string) => {
    if (!profileId) return null;

    try {
      const { data: roomData } = await supabase
        .from('raid_rooms')
        .select('id')
        .eq('room_uuid', roomUuid)
        .single();

      if (!roomData) return null;

      const { data, error } = await supabase
        .from('raid_player_selections')
        .select('*')
        .eq('room_id', roomData.id)
        .eq('profile_id', profileId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking player selections:', error);
      return null;
    }
  }, [profileId]);

  return {
    raidMaps,
    currentRoom,
    participants,
    raidInvites,
    chatMessages,
    loading,
    getTotalCompletions,
    createRoom,
    sendInvite,
    respondToInvite,
    startRaid,
    sendChatMessage,
    loadRaidData,
    loadRoomData,
    loadInvites,
    setCurrentRoom,
    leaveRoom,
    markRewardsAsClaimed,
    generateCardRewards,
    getCardPool,
    checkPlayerSelections
  };
}

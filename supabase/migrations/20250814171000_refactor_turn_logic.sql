-- Add a dedicated column to store whose turn it is, which is more robust
ALTER TABLE public.raid_rooms
ADD COLUMN current_turn_profile_id UUID REFERENCES public.profiles(id);

COMMENT ON COLUMN public.raid_rooms.current_turn_profile_id IS 'The profile_id of the participant whose turn it currently is.';

-- We need a function to properly start the raid and set the first turn
CREATE OR REPLACE FUNCTION start_raid_and_set_turn(
    p_room_uuid UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_room_id UUID;
    v_first_player_id UUID;
BEGIN
    SELECT id INTO v_room_id FROM public.raid_rooms WHERE room_uuid = p_room_uuid;

    -- Find the player in the lowest slot number to start
    SELECT profile_id INTO v_first_player_id
    FROM public.raid_participants
    WHERE room_id = v_room_id
    ORDER BY slot_number
    LIMIT 1;

    -- Update the room to start the game and set the first turn
    UPDATE public.raid_rooms
    SET 
        status = 'in_progress',
        current_turn_profile_id = v_first_player_id
    WHERE room_uuid = p_room_uuid;
END;
$$;

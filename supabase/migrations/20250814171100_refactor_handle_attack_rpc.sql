-- Drop the old function if it exists
DROP FUNCTION IF EXISTS handle_raid_attack(UUID, UUID);

-- Create the new, more robust function for handling attacks
CREATE OR REPLACE FUNCTION handle_raid_attack(
    p_room_uuid UUID,
    p_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_room RECORD;
    v_player RECORD;
    v_map RECORD;
    v_player_damage INT;
    v_new_boss_hp INT;
    v_boss_damage INT;
    v_new_player_hp INT;
    v_alive_participants public.raid_participants[];
    v_current_player_index INT;
    v_next_player_index INT;
    v_next_player_profile_id UUID;
BEGIN
    -- Get room, player, and map details
    SELECT * INTO v_room FROM public.raid_rooms WHERE room_uuid = p_room_uuid;
    SELECT * INTO v_player FROM public.raid_participants WHERE room_id = v_room.id AND profile_id = p_profile_id;
    SELECT * INTO v_map FROM public.raid_maps WHERE id = v_room.map_id;

    -- Validate turn
    IF v_room.current_turn_profile_id IS NULL OR v_room.current_turn_profile_id != p_profile_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not your turn.');
    END IF;

    -- Player attacks boss
    SELECT strength INTO v_player_damage FROM public.profiles WHERE id = p_profile_id;
    v_new_boss_hp := GREATEST(0, COALESCE(v_room.boss_hp, 0) - v_player_damage);

    UPDATE public.raid_rooms SET boss_hp = v_new_boss_hp WHERE id = v_room.id;

    -- Check if boss is defeated
    IF v_new_boss_hp <= 0 THEN
        IF v_room.current_round < 3 THEN
            -- Go to next round, find the first player again
            SELECT profile_id INTO v_next_player_profile_id FROM public.raid_participants WHERE room_id = v_room.id AND is_alive = TRUE ORDER BY slot_number LIMIT 1;
            UPDATE public.raid_rooms
            SET current_round = v_room.current_round + 1,
                current_turn = 0, -- Reset turn counter for simplicity
                current_turn_profile_id = v_next_player_profile_id,
                boss_hp = NULL,
                boss_max_hp = NULL
            WHERE id = v_room.id;
        ELSE
            UPDATE public.raid_rooms SET status = 'completed' WHERE id = v_room.id;
        END IF;
    ELSE
        -- Boss attacks player
        v_boss_damage := (SELECT (CASE v_map.difficulty_level WHEN 1 THEN 25 WHEN 2 THEN 35 ELSE 50 END) * (1 + (v_map.difficulty_level - 1) * 0.5));
        v_new_player_hp := GREATEST(0, v_player.current_hp - v_boss_damage);

        UPDATE public.raid_participants
        SET current_hp = v_new_player_hp,
            is_alive = (v_new_player_hp > 0)
        WHERE id = v_player.id;

        -- Find next alive player to advance the turn
        SELECT array_agg(p ORDER BY p.slot_number) INTO v_alive_participants FROM public.raid_participants p WHERE p.room_id = v_room.id AND p.is_alive = TRUE;

        IF array_length(v_alive_participants, 1) = 0 THEN
            UPDATE public.raid_rooms SET status = 'completed' WHERE id = v_room.id;
        ELSE
            -- Find current player's index in the array of alive players
            FOR i IN 1..array_length(v_alive_participants, 1) LOOP
                IF v_alive_participants[i].profile_id = p_profile_id THEN
                    v_current_player_index := i;
                    EXIT;
                END IF;
            END LOOP;

            -- Determine next player's index, wrapping around
            v_next_player_index := (v_current_player_index % array_length(v_alive_participants, 1)) + 1;
            v_next_player_profile_id := v_alive_participants[v_next_player_index].profile_id;

            UPDATE public.raid_rooms
            SET current_turn_profile_id = v_next_player_profile_id,
                current_turn = v_room.current_turn + 1
            WHERE id = v_room.id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Attack handled.');
END;
$$;

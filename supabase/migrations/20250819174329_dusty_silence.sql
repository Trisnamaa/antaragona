-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view raid card pool" ON raid_card_pool;
DROP POLICY IF EXISTS "System can update raid card pool" ON raid_card_pool;
DROP POLICY IF EXISTS "Users can view own selections" ON raid_player_selections;
DROP POLICY IF EXISTS "Users can insert own selections" ON raid_player_selections;
DROP POLICY IF EXISTS "Users can update own selections" ON raid_player_selections;

-- Drop existing raid_rewards table if exists (to avoid conflicts)
DROP TABLE IF EXISTS raid_rewards CASCADE;

-- Create raid_card_pool table to store the 10 cards generated per raid room
CREATE TABLE IF NOT EXISTS raid_card_pool (
    id SERIAL PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES raid_rooms(id) ON DELETE CASCADE,
    card_position INTEGER NOT NULL CHECK (card_position BETWEEN 1 AND 10),
    reward_type TEXT NOT NULL CHECK (reward_type IN ('raid_ticket', 'ztoken', 'exp', 'zgold')),
    reward_value INTEGER NOT NULL,
    is_claimed BOOLEAN DEFAULT FALSE,
    claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, card_position)
);

-- Create raid_player_selections table to track each player's selected cards
CREATE TABLE IF NOT EXISTS raid_player_selections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES raid_rooms(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    selected_cards INTEGER[] NOT NULL DEFAULT '{}',
    rewards_claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, profile_id)
);

-- Enable RLS (Row Level Security)
ALTER TABLE raid_card_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE raid_player_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for raid_card_pool
CREATE POLICY "Users can view raid card pool" ON raid_card_pool
    FOR SELECT USING (
        room_id IN (
            SELECT r.id FROM raid_rooms r 
            JOIN raid_participants rp ON r.id = rp.room_id 
            WHERE rp.profile_id IN (
                SELECT id FROM profiles WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "System can update raid card pool" ON raid_card_pool
    FOR UPDATE USING (true);

-- RLS Policies for raid_player_selections
CREATE POLICY "Users can view own selections" ON raid_player_selections
    FOR SELECT USING (profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own selections" ON raid_player_selections
    FOR INSERT WITH CHECK (profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update own selections" ON raid_player_selections
    FOR UPDATE USING (profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    ));

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS generate_raid_card_pool(TEXT);
DROP FUNCTION IF EXISTS claim_selected_cards(TEXT, UUID, INTEGER[], UUID);
DROP FUNCTION IF EXISTS get_raid_card_pool(TEXT);
DROP FUNCTION IF EXISTS generate_raid_rewards_and_update_profile(TEXT, UUID, UUID);

-- Function to generate 10 cards pool for a raid room
CREATE OR REPLACE FUNCTION generate_raid_card_pool(
    p_room_uuid TEXT
) RETURNS JSON AS $$
DECLARE
    v_room_id UUID;
    v_card_position INTEGER;
    v_reward_type TEXT;
    v_reward_value INTEGER;
    v_cards JSONB := '[]'::JSONB;
    v_card_record RECORD;
    v_random_value REAL;
BEGIN
    -- Resolve room_id from room_uuid
    SELECT id INTO v_room_id FROM raid_rooms WHERE room_uuid = p_room_uuid;
    IF v_room_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Room not found'
        );
    END IF;

    -- Check if cards already generated for this room
    IF EXISTS (SELECT 1 FROM raid_card_pool WHERE room_id = v_room_id) THEN
        -- Return existing cards
        SELECT json_agg(
            json_build_object(
                'id', card_position,
                'type', reward_type,
                'value', reward_value,
                'claimed', is_claimed
            ) ORDER BY card_position
        ) INTO v_cards
        FROM raid_card_pool 
        WHERE room_id = v_room_id;
        
        RETURN json_build_object(
            'success', true,
            'cards', v_cards,
            'message', 'Cards already generated'
        );
    END IF;

    -- Generate 10 random cards
    FOR v_card_position IN 1..10 LOOP
        v_random_value := random();
        
        -- Determine reward type and value based on probability
        IF v_random_value < 0.4 THEN
            -- 40% chance for ZToken (50-200)
            v_reward_type := 'ztoken';
            v_reward_value := 50 + floor(random() * 151);
        ELSIF v_random_value < 0.7 THEN
            -- 30% chance for EXP (200-600)
            v_reward_type := 'exp';
            v_reward_value := 200 + floor(random() * 401);
        ELSIF v_random_value < 0.9 THEN
            -- 20% chance for ZGold (500-2000)
            v_reward_type := 'zgold';
            v_reward_value := 500 + floor(random() * 1501);
        ELSE
            -- 10% chance for Raid Ticket (1-2)
            v_reward_type := 'raid_ticket';
            v_reward_value := 1 + floor(random() * 2);
        END IF;
        
        -- Insert card into pool
        INSERT INTO raid_card_pool (room_id, card_position, reward_type, reward_value)
        VALUES (v_room_id, v_card_position, v_reward_type, v_reward_value)
        RETURNING * INTO v_card_record;
        
        -- Add to result array
        v_cards := v_cards || jsonb_build_array(json_build_object(
            'id', v_card_record.card_position,
            'type', v_card_record.reward_type,
            'value', v_card_record.reward_value,
            'claimed', v_card_record.is_claimed
        ));
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'cards', v_cards,
        'message', 'Cards generated successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to claim selected cards and update player profile
CREATE OR REPLACE FUNCTION claim_selected_cards(
    p_room_uuid TEXT,
    p_profile_id UUID,
    p_selected_cards INTEGER[],
    p_map_id UUID
) RETURNS JSON AS $$
DECLARE
    v_room_id UUID;
    v_card_record RECORD;
    v_total_ztoken INTEGER := 0;
    v_total_exp INTEGER := 0;
    v_total_zgold INTEGER := 0;
    v_total_raid_tickets INTEGER := 0;
    v_current_ztoken INTEGER;
    v_current_exp INTEGER;
    v_current_zgold INTEGER;
    v_current_raid_tickets INTEGER;
    v_completion_count INTEGER;
    v_title_name TEXT;
    v_title_id UUID;
    v_claimed_rewards JSONB := '[]'::JSONB;
BEGIN
    -- Resolve room_id from room_uuid
    SELECT id INTO v_room_id FROM raid_rooms WHERE room_uuid = p_room_uuid;
    IF v_room_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Room not found'
        );
    END IF;

    -- Validate that exactly 2 cards are selected
    IF array_length(p_selected_cards, 1) != 2 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Must select exactly 2 cards'
        );
    END IF;

    -- Check if player has already claimed rewards
    IF EXISTS (SELECT 1 FROM raid_player_selections WHERE room_id = v_room_id AND profile_id = p_profile_id AND rewards_claimed = true) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Rewards already claimed'
        );
    END IF;

    -- Validate that selected cards exist and are not claimed
    FOR i IN 1..array_length(p_selected_cards, 1) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM raid_card_pool 
            WHERE room_id = v_room_id 
            AND card_position = p_selected_cards[i] 
            AND is_claimed = false
        ) THEN
            RETURN json_build_object(
                'success', false,
                'error', 'Card ' || p_selected_cards[i] || ' is not available'
            );
        END IF;
    END LOOP;

    -- Get current player stats
    SELECT 
        COALESCE(ztoken, 0),
        COALESCE(exp, 0),
        COALESCE(zgold, 0),
        COALESCE(raid_tickets, 0)
    INTO v_current_ztoken, v_current_exp, v_current_zgold, v_current_raid_tickets
    FROM profiles 
    WHERE id = p_profile_id;

    -- Claim selected cards and calculate totals
    FOR i IN 1..array_length(p_selected_cards, 1) LOOP
        -- Update card as claimed
        UPDATE raid_card_pool 
        SET is_claimed = true, claimed_by = p_profile_id, claimed_at = NOW()
        WHERE room_id = v_room_id AND card_position = p_selected_cards[i]
        RETURNING * INTO v_card_record;

        -- Add to claimed rewards array
        v_claimed_rewards := v_claimed_rewards || jsonb_build_array(json_build_object(
            'id', v_card_record.card_position,
            'type', v_card_record.reward_type,
            'value', v_card_record.reward_value
        ));

        -- Calculate totals by reward type
        CASE v_card_record.reward_type
            WHEN 'ztoken' THEN v_total_ztoken := v_total_ztoken + v_card_record.reward_value;
            WHEN 'exp' THEN v_total_exp := v_total_exp + v_card_record.reward_value;
            WHEN 'zgold' THEN v_total_zgold := v_total_zgold + v_card_record.reward_value;
            WHEN 'raid_ticket' THEN v_total_raid_tickets := v_total_raid_tickets + v_card_record.reward_value;
        END CASE;
    END LOOP;

    -- Update player profile with rewards
    UPDATE profiles 
    SET 
        ztoken = v_current_ztoken + v_total_ztoken,
        exp = v_current_exp + v_total_exp,
        zgold = v_current_zgold + v_total_zgold,
        raid_tickets = v_current_raid_tickets + v_total_raid_tickets
    WHERE id = p_profile_id;

    -- Record player selection
    INSERT INTO raid_player_selections (room_id, profile_id, selected_cards, rewards_claimed, claimed_at)
    VALUES (v_room_id, p_profile_id, p_selected_cards, true, NOW())
    ON CONFLICT (room_id, profile_id) 
    DO UPDATE SET 
        selected_cards = p_selected_cards,
        rewards_claimed = true,
        claimed_at = NOW();

    -- Update or create raid progress
    INSERT INTO raid_progress (profile_id, map_id, completion_count, last_completed_at)
    VALUES (p_profile_id, p_map_id, 1, NOW())
    ON CONFLICT (profile_id, map_id) 
    DO UPDATE SET 
        completion_count = raid_progress.completion_count + 1,
        last_completed_at = NOW(),
        updated_at = NOW();

    -- Get updated completion count
    SELECT completion_count INTO v_completion_count
    FROM raid_progress 
    WHERE profile_id = p_profile_id AND map_id = p_map_id;

    -- Check if player unlocked master title (50 completions)
    IF v_completion_count >= 50 THEN
        -- Get map name for title
        SELECT 
            CASE 
                WHEN name = 'Eclipse Protocol' THEN 'Eclipse Master'
                WHEN name = 'Neon Warden' THEN 'Neon Master'
                WHEN name = 'Crimson Exodus' THEN 'Crimson Master'
                ELSE name || ' Master'
            END
        INTO v_title_name
        FROM raid_maps 
        WHERE id = p_map_id;

        -- Get title ID from existing titles table
        SELECT id INTO v_title_id
        FROM titles 
        WHERE name = v_title_name;

        -- Insert into player_titles if title exists and player doesn't have it
        IF v_title_id IS NOT NULL THEN
            INSERT INTO player_titles (profile_id, title_id, is_equipped)
            VALUES (p_profile_id, v_title_id, false)
            ON CONFLICT (profile_id, title_id) DO NOTHING;
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true,
        'rewards', v_claimed_rewards,
        'totals', json_build_object(
            'ztoken', v_total_ztoken,
            'exp', v_total_exp,
            'zgold', v_total_zgold,
            'raid_ticket', v_total_raid_tickets
        ),
        'completion_count', v_completion_count,
        'master_title_unlocked', v_completion_count >= 50,
        'title_name', v_title_name
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get raid card pool for a room
CREATE OR REPLACE FUNCTION get_raid_card_pool(
    p_room_uuid TEXT
) RETURNS JSON AS $$
DECLARE
    v_cards JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', card_position,
            'type', reward_type,
            'value', reward_value,
            'claimed', is_claimed
        ) ORDER BY card_position
    ) INTO v_cards
    FROM raid_card_pool 
    WHERE room_id = (SELECT id FROM raid_rooms WHERE room_uuid = p_room_uuid);
    
    RETURN COALESCE(v_cards, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main function for RaidGame integration - generates cards and handles completion
CREATE OR REPLACE FUNCTION generate_raid_rewards_and_update_profile(
    p_room_uuid TEXT,
    p_profile_id UUID,
    p_map_id UUID
) RETURNS JSON AS $$
DECLARE
    v_room_id UUID;
    v_cards_result JSON;
    v_completion_count INTEGER;
    v_title_name TEXT;
    v_title_id UUID;
    v_master_title_unlocked BOOLEAN := false;
BEGIN
    -- Resolve room_id from room_uuid
    SELECT id INTO v_room_id FROM raid_rooms WHERE room_uuid = p_room_uuid;
    IF v_room_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Room not found'
        );
    END IF;

    -- Generate card pool for the room
    SELECT generate_raid_card_pool(p_room_uuid) INTO v_cards_result;
    
    IF NOT (v_cards_result->>'success')::boolean THEN
        RETURN v_cards_result;
    END IF;

    -- Update or create raid progress
    INSERT INTO raid_progress (profile_id, map_id, completion_count, last_completed_at)
    VALUES (p_profile_id, p_map_id, 1, NOW())
    ON CONFLICT (profile_id, map_id) 
    DO UPDATE SET 
        completion_count = raid_progress.completion_count + 1,
        last_completed_at = NOW(),
        updated_at = NOW();

    -- Get updated completion count
    SELECT completion_count INTO v_completion_count
    FROM raid_progress 
    WHERE profile_id = p_profile_id AND map_id = p_map_id;

    -- Check if player unlocked master title (50 completions)
    IF v_completion_count >= 50 THEN
        -- Get map name for title
        SELECT 
            CASE 
                WHEN name = 'Eclipse Protocol' THEN 'Eclipse Master'
                WHEN name = 'Neon Warden' THEN 'Neon Master'
                WHEN name = 'Crimson Exodus' THEN 'Crimson Master'
                ELSE name || ' Master'
            END
        INTO v_title_name
        FROM raid_maps 
        WHERE id = p_map_id;

        -- Get title ID from existing titles table
        SELECT id INTO v_title_id
        FROM titles 
        WHERE name = v_title_name;

        -- Insert into player_titles if title exists and player doesn't have it
        IF v_title_id IS NOT NULL THEN
            INSERT INTO player_titles (profile_id, title_id, is_equipped)
            VALUES (p_profile_id, v_title_id, false)
            ON CONFLICT (profile_id, title_id) DO NOTHING;
            
            v_master_title_unlocked := true;
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true,
        'rewards', v_cards_result->'cards',
        'completion_count', v_completion_count,
        'master_title_unlocked', v_master_title_unlocked,
        'title_name', v_title_name
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON raid_card_pool TO authenticated;
GRANT SELECT, INSERT, UPDATE ON raid_player_selections TO authenticated;
GRANT EXECUTE ON FUNCTION generate_raid_card_pool TO authenticated;
GRANT EXECUTE ON FUNCTION claim_selected_cards TO authenticated;
GRANT EXECUTE ON FUNCTION get_raid_card_pool TO authenticated;
GRANT EXECUTE ON FUNCTION generate_raid_rewards_and_update_profile TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_raid_card_pool_room_id ON raid_card_pool(room_id);
CREATE INDEX IF NOT EXISTS idx_raid_card_pool_position ON raid_card_pool(room_id, card_position);
CREATE INDEX IF NOT EXISTS idx_raid_player_selections_room_profile ON raid_player_selections(room_id, profile_id);
/*
  # Fix ambiguous column reference in costume functions

  1. Function Updates
    - Fix ambiguous column reference for costume_id in equip_costume function
    - Fix ambiguous column reference for costume_id in unequip_costume function
    - Rename parameters to avoid conflicts with table column names

  2. Changes Made
    - Rename costume_id parameter to _costume_id in equip_costume function
    - Update all references within the function body
    - Ensure proper table aliases are used
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS equip_costume(uuid, uuid);
DROP FUNCTION IF EXISTS unequip_costume(uuid);

-- Recreate equip_costume function with fixed parameter names
CREATE OR REPLACE FUNCTION equip_costume(
  player_profile_id uuid,
  _costume_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  costume_exists boolean;
  player_owns_costume boolean;
BEGIN
  -- Check if costume exists and is active
  SELECT EXISTS(
    SELECT 1 FROM costumes c
    WHERE c.id = _costume_id AND c.is_active = true
  ) INTO costume_exists;
  
  IF NOT costume_exists THEN
    RAISE EXCEPTION 'Costume does not exist or is not active';
  END IF;
  
  -- Check if player owns this costume
  SELECT EXISTS(
    SELECT 1 FROM player_costumes pc
    WHERE pc.profile_id = player_profile_id AND pc.costume_id = _costume_id
  ) INTO player_owns_costume;
  
  IF NOT player_owns_costume THEN
    RAISE EXCEPTION 'Player does not own this costume';
  END IF;
  
  -- Unequip all current costumes for this player
  UPDATE player_costumes 
  SET is_equipped = false 
  WHERE profile_id = player_profile_id;
  
  -- Equip the new costume
  UPDATE player_costumes 
  SET is_equipped = true 
  WHERE profile_id = player_profile_id AND costume_id = _costume_id;
  
  -- Update profile with equipped costume
  UPDATE profiles 
  SET equipped_costume_id = _costume_id 
  WHERE id = player_profile_id;
  
  RETURN true;
END;
$$;

-- Recreate unequip_costume function
CREATE OR REPLACE FUNCTION unequip_costume(
  player_profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Unequip all costumes for this player
  UPDATE player_costumes 
  SET is_equipped = false 
  WHERE profile_id = player_profile_id;
  
  -- Remove equipped costume from profile
  UPDATE profiles 
  SET equipped_costume_id = NULL 
  WHERE id = player_profile_id;
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION equip_costume(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unequip_costume(uuid) TO authenticated;
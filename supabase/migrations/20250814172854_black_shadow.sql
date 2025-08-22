@@ .. @@
 -- Drop existing function if it exists
 DROP FUNCTION IF EXISTS handle_raid_attack(text, uuid);
+DROP FUNCTION IF EXISTS handle_raid_attack(uuid, uuid);
 DROP FUNCTION IF EXISTS raid_attack_boss(uuid, uuid, integer);
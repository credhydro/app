-- ============================================================
-- CredHydro Schema v4 — Auth & Row-Level Security
-- Safe to rerun: drops policies before recreating them.
-- Apply in Supabase SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own profile" ON user_profiles;
CREATE POLICY "users read own profile" ON user_profiles
  FOR SELECT USING (id = auth.uid());

-- ------------------------------------------------------------
-- 2. devices
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  device_id        TEXT PRIMARY KEY,
  label            TEXT NOT NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users read devices" ON devices;
CREATE POLICY "authenticated users read devices" ON devices
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO devices (device_id, label) VALUES
  ('argonaut-pi-01', 'Argonaut Pi 01'),
  ('argonaut-pi-02', 'Argonaut Pi 02'),
  ('argonaut-pi-03', 'Argonaut Pi 03')
ON CONFLICT (device_id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. is_admin() helper (CREATE OR REPLACE is already safe)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM user_profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- ------------------------------------------------------------
-- 4. RLS on sensor/data tables
-- ------------------------------------------------------------

ALTER TABLE ambient_raw ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON ambient_raw;
CREATE POLICY "device scoped read" ON ambient_raw FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE ambient_derived ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON ambient_derived;
CREATE POLICY "device scoped read" ON ambient_derived FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE circulation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON circulation;
CREATE POLICY "device scoped read" ON circulation FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE lights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON lights;
CREATE POLICY "device scoped read" ON lights FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE fan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON fan;
CREATE POLICY "device scoped read" ON fan FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE energy_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON energy_costs;
CREATE POLICY "device scoped read" ON energy_costs FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE dosing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON dosing_events;
CREATE POLICY "device scoped read" ON dosing_events FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE ph_dosing_training ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON ph_dosing_training;
CREATE POLICY "device scoped read" ON ph_dosing_training FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE calibrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device scoped read" ON calibrations;
CREATE POLICY "device scoped read" ON calibrations FOR SELECT USING (
  is_admin()
  OR device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
);

ALTER TABLE trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trials scoped read" ON trials;
CREATE POLICY "trials scoped read" ON trials FOR SELECT USING (
  is_admin()
  OR trial_name IN (
    SELECT DISTINCT trial_name FROM ambient_raw
    WHERE device_id = (SELECT device_id FROM devices WHERE assigned_user_id = auth.uid())
  )
);

-- ------------------------------------------------------------
-- 5. After applying this file:
--
--    a) Create users in Supabase Auth dashboard
--
--    b) Mark each user as admin or regular:
--       INSERT INTO user_profiles (id, is_admin)
--       VALUES ('<user-uuid>', FALSE);   -- regular user
--
--       INSERT INTO user_profiles (id, is_admin)
--       VALUES ('<admin-uuid>', TRUE);   -- admin
--
--    c) Assign a Pi to each regular user:
--       UPDATE devices SET assigned_user_id = '<user-uuid>'
--       WHERE device_id = 'argonaut-pi-01';
-- ------------------------------------------------------------

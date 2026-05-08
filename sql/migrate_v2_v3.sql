-- ============================================================
-- Migration: v2 → v3
-- Run in Supabase SQL Editor.
-- Wipes all data, adds fan + dosing_events tables, fan_wh column.
-- ============================================================

-- Wipe all existing data (RESTART IDENTITY resets id sequences)
-- fan and dosing_events are excluded — they don't exist yet and will be empty after creation
TRUNCATE TABLE
    calibrations,
    ph_dosing_training,
    energy_costs,
    lights,
    circulation,
    ambient_derived,
    ambient_raw,
    trials
RESTART IDENTITY CASCADE;

-- Add fan_wh to energy_costs (idempotent)
ALTER TABLE energy_costs
    ADD COLUMN IF NOT EXISTS fan_wh DOUBLE PRECISION;

-- Add fan table (idempotent)
CREATE TABLE IF NOT EXISTS fan (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid          UUID        NOT NULL UNIQUE,
    trial_name    TEXT        NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    device_id     TEXT        NOT NULL,
    datetime_utc  TIMESTAMPTZ NOT NULL,
    on_mins       DOUBLE PRECISION,
    energy_wh     DOUBLE PRECISION,
    ingested_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fan_trial_time ON fan (trial_name, datetime_utc);
CREATE INDEX IF NOT EXISTS idx_fan_device     ON fan (device_id, datetime_utc);

-- Add dosing_events table (idempotent)
CREATE TABLE IF NOT EXISTS dosing_events (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid             UUID        NOT NULL UNIQUE,
    trial_name       TEXT        NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    device_id        TEXT        NOT NULL,
    datetime_utc     TIMESTAMPTZ NOT NULL,
    ph_before        DOUBLE PRECISION,
    delta_before     DOUBLE PRECISION,
    run_time_secs    DOUBLE PRECISION,
    ph_after         DOUBLE PRECISION,
    delta_after      DOUBLE PRECISION,
    accuracy         DOUBLE PRECISION,
    dose_ml          DOUBLE PRECISION,
    ingested_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dosing_events_trial_time ON dosing_events (trial_name, datetime_utc);
CREATE INDEX IF NOT EXISTS idx_dosing_events_device     ON dosing_events (device_id, datetime_utc);

-- Record migration
INSERT INTO schema_version (version, notes)
VALUES (3, 'Added fan, dosing_events tables; fan_wh to energy_costs — May 2026')
ON CONFLICT (version) DO NOTHING;

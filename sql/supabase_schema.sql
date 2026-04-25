-- ============================================================
-- Argonaut: Supabase (PostgreSQL) cloud schema
-- Target: Supabase / Postgres 15+
-- Purpose: durable cloud copy of all sensor + trial data,
--          synced from on-device SQLite every 30 min.
--
-- Sync model:
--   * Each row has a `uuid` generated on the Pi side.
--   * Cloud upserts use ON CONFLICT (uuid) DO NOTHING/UPDATE,
--     making sync retries idempotent.
--   * `ingested_at` is set server-side so you can audit clock drift
--     between the Pi (`datetime_utc`) and the cloud.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ------------------------------------------------------------
-- trials: master record, one row per grow cycle
-- ------------------------------------------------------------
CREATE TABLE trials (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid               UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    trial_name         TEXT        NOT NULL UNIQUE,
    crop_type          TEXT,
    planting_date      DATE,
    harvest_date       DATE,
    plant_count        INTEGER,
    grow_medium        TEXT,
    system_volume_gal  DOUBLE PRECISION,
    harvest_mass_g     DOUBLE PRECISION,
    notes              TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    ingested_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ambient_raw: core sensor readings (every 30 min)
-- ------------------------------------------------------------
CREATE TABLE ambient_raw (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                 UUID        NOT NULL UNIQUE,
    trial_name           TEXT        NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    datetime_utc         TIMESTAMPTZ NOT NULL,
    airtemp_c            DOUBLE PRECISION,
    humidity_pct         DOUBLE PRECISION,
    vpd_kpa              DOUBLE PRECISION,
    ppfd_umol_m2_s       DOUBLE PRECISION,
    temp_reservoir_c     DOUBLE PRECISION,
    ph                   DOUBLE PRECISION,
    ec_us                DOUBLE PRECISION,
    flow_lpm             DOUBLE PRECISION,
    co2_ppm              DOUBLE PRECISION,
    airtemp_flag         SMALLINT CHECK (airtemp_flag         BETWEEN 0 AND 4),
    humidity_flag        SMALLINT CHECK (humidity_flag        BETWEEN 0 AND 4),
    temp_reservoir_flag  SMALLINT CHECK (temp_reservoir_flag  BETWEEN 0 AND 4),
    ph_flag              SMALLINT CHECK (ph_flag              BETWEEN 0 AND 4),
    ec_flag              SMALLINT CHECK (ec_flag              BETWEEN 0 AND 4),
    ppfd_flag            SMALLINT CHECK (ppfd_flag            BETWEEN 0 AND 4),
    flow_flag            SMALLINT CHECK (flow_flag            BETWEEN 0 AND 4),
    ingested_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ambient_raw_trial_time ON ambient_raw (trial_name, datetime_utc);

-- ------------------------------------------------------------
-- ambient_derived: Farquhar-Ball-Berry-Medlyn outputs
-- ------------------------------------------------------------
CREATE TABLE ambient_derived (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                    UUID        NOT NULL UNIQUE,
    trial_name              TEXT        NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    datetime_utc            TIMESTAMPTZ NOT NULL,
    assimilation_umol_m2_s  DOUBLE PRECISION,
    hs                      DOUBLE PRECISION,
    gsw_bb_mol_m2_s         DOUBLE PRECISION,
    gc_bb_mol_m2_s          DOUBLE PRECISION,
    gsw_medlyn_mol_m2_s     DOUBLE PRECISION,
    gsc_medlyn_mol_m2_s     DOUBLE PRECISION,
    flux_mol_m2_s           DOUBLE PRECISION,
    flux_umol_m2_s          DOUBLE PRECISION,
    flux_co2_g_m2_s         DOUBLE PRECISION,
    co2_intercellular_ppm   DOUBLE PRECISION,
    ingested_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ambient_derived_trial_time ON ambient_derived (trial_name, datetime_utc);

-- ------------------------------------------------------------
-- circulation: pump event log (hourly)
-- ------------------------------------------------------------
CREATE TABLE circulation (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid              UUID        NOT NULL UNIQUE,
    trial_name        TEXT        NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    datetime_utc      TIMESTAMPTZ NOT NULL,
    pump_on_mins      DOUBLE PRECISION,
    avg_rate_lpm      DOUBLE PRECISION,
    volume_moved_gal  DOUBLE PRECISION,
    energy_wh         DOUBLE PRECISION,
    ingested_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_circulation_trial_time ON circulation (trial_name, datetime_utc);

-- ------------------------------------------------------------
-- lights: lighting energy log (every 30 min)
-- ------------------------------------------------------------
CREATE TABLE lights (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid          UUID        NOT NULL UNIQUE,
    trial_name    TEXT        NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    datetime_utc  TIMESTAMPTZ NOT NULL,
    energy_wh     DOUBLE PRECISION,
    ammeter_v     DOUBLE PRECISION,
    ingested_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lights_trial_time ON lights (trial_name, datetime_utc);

-- ------------------------------------------------------------
-- energy_costs: hourly energy + CAISO grid data
-- ------------------------------------------------------------
CREATE TABLE energy_costs (
    id                             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid                           UUID        NOT NULL UNIQUE,
    trial_name                     TEXT        NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    datetime_utc                   TIMESTAMPTZ NOT NULL,
    pumping_wh                     DOUBLE PRECISION,
    lighting_wh                    DOUBLE PRECISION,
    total_wh                       DOUBLE PRECISION,
    rate                           DOUBLE PRECISION,
    energy_cost                    DOUBLE PRECISION,
    renewables_pct                 DOUBLE PRECISION,
    emissions_intensity_g_per_kwh  DOUBLE PRECISION,
    my_emissions_g                 DOUBLE PRECISION,
    future_cost                    DOUBLE PRECISION,
    ingested_at                    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_energy_costs_trial_time ON energy_costs (trial_name, datetime_utc);

-- ------------------------------------------------------------
-- ph_dosing_training: ML training data for pH doser model
-- ------------------------------------------------------------
CREATE TABLE ph_dosing_training (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid               UUID        NOT NULL UNIQUE,
    trial_name         TEXT        NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    datetime_utc       TIMESTAMPTZ NOT NULL,
    start_ph           DOUBLE PRECISION,
    start_delta_ph     DOUBLE PRECISION,
    run_time           DOUBLE PRECISION,
    end_ph             DOUBLE PRECISION,
    end_delta_ph       DOUBLE PRECISION,
    accuracy           DOUBLE PRECISION,
    system_volume_gal  DOUBLE PRECISION,
    ingested_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ph_dosing_training_trial_time ON ph_dosing_training (trial_name, datetime_utc);

-- ------------------------------------------------------------
-- calibrations: probe calibration records (not strictly trial-scoped)
-- ------------------------------------------------------------
CREATE TABLE calibrations (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid              UUID        NOT NULL UNIQUE,
    trial_name        TEXT        REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE SET NULL,
    datetime_utc      TIMESTAMPTZ NOT NULL,
    device            TEXT        NOT NULL,
    probe_name        TEXT,
    address           TEXT,
    device_info       TEXT,
    points_completed  TEXT,
    final_cal_status  TEXT,
    verify_reading    TEXT,
    slope             TEXT,
    notes             TEXT,
    ingested_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_calibrations_probe_time ON calibrations (probe_name, datetime_utc);

-- ------------------------------------------------------------
-- sync_log: optional but very useful — record every sync attempt
-- so you can debug intermittent connectivity from the cloud side.
-- ------------------------------------------------------------
CREATE TABLE sync_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id       TEXT        NOT NULL,           -- e.g. hostname of the Pi
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ DEFAULT NOW(),
    table_name      TEXT        NOT NULL,
    rows_attempted  INTEGER,
    rows_inserted   INTEGER,
    rows_skipped    INTEGER,                        -- already present (uuid conflict)
    success         BOOLEAN     NOT NULL,
    error_message   TEXT
);
CREATE INDEX idx_sync_log_device_time ON sync_log (device_id, started_at DESC);

-- ------------------------------------------------------------
-- schema_version: pin the Pi and the cloud to the same version
-- ------------------------------------------------------------
CREATE TABLE schema_version (
    version     INTEGER     PRIMARY KEY,
    applied_at  TIMESTAMPTZ DEFAULT NOW(),
    notes       TEXT
);
INSERT INTO schema_version (version, notes) VALUES (1, 'Initial Argonaut schema, April 2026');

-- ============================================================
-- Example upsert pattern used by the Pi sync job:
--
--   INSERT INTO ambient_raw (uuid, trial_name, datetime_utc, airtemp_c, ...)
--   VALUES ($1, $2, $3, $4, ...)
--   ON CONFLICT (uuid) DO NOTHING;
--
-- For tables that may be edited after initial insert (e.g. trials,
-- where harvest_date / harvest_mass_g get filled in later):
--
--   INSERT INTO trials (uuid, trial_name, ...)
--   VALUES ($1, $2, ...)
--   ON CONFLICT (uuid) DO UPDATE
--     SET harvest_date   = EXCLUDED.harvest_date,
--         harvest_mass_g = EXCLUDED.harvest_mass_g,
--         notes          = EXCLUDED.notes;
-- ============================================================

-- ============================================================
-- Optional: Row Level Security (enable + add policies before
-- exposing the anon key to the dashboard).
-- ============================================================
-- ALTER TABLE trials              ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ambient_raw         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ambient_derived     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE circulation         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lights              ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE energy_costs        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ph_dosing_training  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE calibrations        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sync_log            ENABLE ROW LEVEL SECURITY;

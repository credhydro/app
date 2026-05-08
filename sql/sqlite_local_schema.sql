-- ============================================================
-- Argonaut: on-device SQLite schema (Raspberry Pi 5)
-- File: argonaut.db
-- Path: /home/jadelaars/Desktop/Argonaut/data/argonaut.db
--
-- This is the offline-first source of truth. Sensor logger writes
-- here every 30 min regardless of network state. A separate sync
-- job pushes unsynced rows to Supabase and stamps `synced_at`.
--
-- Conventions:
--   * `uuid` is generated locally so cloud upserts are idempotent.
--   * `synced_at` is NULL until the cloud has acknowledged the row.
--   * `device_id` is the Pi hostname (e.g. 'argonaut-pi-01').
--   * Local data is NEVER deleted by sync — keep it as a backup.
--   * Timestamps are ISO 8601 strings in UTC (SQLite has no native
--     timestamptz). Always store as 'YYYY-MM-DDTHH:MM:SSZ'.
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;   -- better concurrent reads while logger writes

-- ------------------------------------------------------------
-- trials
-- ------------------------------------------------------------
CREATE TABLE trials (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid               TEXT    NOT NULL UNIQUE
                        DEFAULT (lower(hex(randomblob(4))) || '-' ||
                                 lower(hex(randomblob(2))) || '-4' ||
                                 substr(lower(hex(randomblob(2))), 2) || '-' ||
                                 substr('89ab', abs(random()) % 4 + 1, 1) ||
                                 substr(lower(hex(randomblob(2))), 2) || '-' ||
                                 lower(hex(randomblob(6)))),
    trial_name         TEXT    NOT NULL UNIQUE,
    crop_type          TEXT,
    planting_date      TEXT,
    harvest_date       TEXT,
    plant_count        INTEGER,
    grow_medium        TEXT,
    system_volume_gal  REAL,
    harvest_mass_g     REAL,
    notes              TEXT,
    created_at         TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    synced_at          TEXT
);
CREATE INDEX idx_trials_unsynced ON trials (synced_at) WHERE synced_at IS NULL;

-- ------------------------------------------------------------
-- ambient_raw
-- ------------------------------------------------------------
CREATE TABLE ambient_raw (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid                 TEXT    NOT NULL UNIQUE
                          DEFAULT (lower(hex(randomblob(4))) || '-' ||
                                   lower(hex(randomblob(2))) || '-4' ||
                                   substr(lower(hex(randomblob(2))), 2) || '-' ||
                                   substr('89ab', abs(random()) % 4 + 1, 1) ||
                                   substr(lower(hex(randomblob(2))), 2) || '-' ||
                                   lower(hex(randomblob(6)))),
    trial_name           TEXT    NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    device_id            TEXT    NOT NULL,
    datetime_utc         TEXT    NOT NULL,
    airtemp_C            REAL,
    humidity_pct         REAL,
    vpd_kpa              REAL,
    ppfd_umol_m2_s       REAL,
    temp_reservoir_C     REAL,
    ph                   REAL,
    ec_us                REAL,
    flow_lpm             REAL,
    co2_ppm              REAL,
    airtemp_flag         INTEGER CHECK (airtemp_flag         BETWEEN 0 AND 4),
    humidity_flag        INTEGER CHECK (humidity_flag        BETWEEN 0 AND 4),
    temp_reservoir_flag  INTEGER CHECK (temp_reservoir_flag  BETWEEN 0 AND 4),
    ph_flag              INTEGER CHECK (ph_flag              BETWEEN 0 AND 4),
    ec_flag              INTEGER CHECK (ec_flag              BETWEEN 0 AND 4),
    ppfd_flag            INTEGER CHECK (ppfd_flag            BETWEEN 0 AND 4),
    flow_flag            INTEGER CHECK (flow_flag            BETWEEN 0 AND 4),
    synced_at            TEXT
);
CREATE INDEX idx_ambient_raw_trial_time ON ambient_raw (trial_name, datetime_utc);
CREATE INDEX idx_ambient_raw_device     ON ambient_raw (device_id, datetime_utc);
CREATE INDEX idx_ambient_raw_unsynced   ON ambient_raw (synced_at) WHERE synced_at IS NULL;

-- ------------------------------------------------------------
-- ambient_derived
-- ------------------------------------------------------------
CREATE TABLE ambient_derived (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid                    TEXT    NOT NULL UNIQUE
                             DEFAULT (lower(hex(randomblob(4))) || '-' ||
                                      lower(hex(randomblob(2))) || '-4' ||
                                      substr(lower(hex(randomblob(2))), 2) || '-' ||
                                      substr('89ab', abs(random()) % 4 + 1, 1) ||
                                      substr(lower(hex(randomblob(2))), 2) || '-' ||
                                      lower(hex(randomblob(6)))),
    trial_name              TEXT    NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    device_id               TEXT    NOT NULL,
    datetime_utc            TEXT    NOT NULL,
    assimilation_umol_m2_s  REAL,
    hs                      REAL,
    gsw_bb_mol_m2_s         REAL,
    gc_bb_mol_m2_s          REAL,
    gsw_medlyn_mol_m2_s     REAL,
    gsc_medlyn_mol_m2_s     REAL,
    flux_mol_m2_s           REAL,
    flux_umol_m2_s          REAL,
    flux_CO2_g_m2_s         REAL,
    co2_intercellular_ppm   REAL,
    synced_at               TEXT
);
CREATE INDEX idx_ambient_derived_trial_time ON ambient_derived (trial_name, datetime_utc);
CREATE INDEX idx_ambient_derived_device     ON ambient_derived (device_id, datetime_utc);
CREATE INDEX idx_ambient_derived_unsynced   ON ambient_derived (synced_at) WHERE synced_at IS NULL;

-- ------------------------------------------------------------
-- circulation
-- ------------------------------------------------------------
CREATE TABLE circulation (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid              TEXT    NOT NULL UNIQUE
                       DEFAULT (lower(hex(randomblob(4))) || '-' ||
                                lower(hex(randomblob(2))) || '-4' ||
                                substr(lower(hex(randomblob(2))), 2) || '-' ||
                                substr('89ab', abs(random()) % 4 + 1, 1) ||
                                substr(lower(hex(randomblob(2))), 2) || '-' ||
                                lower(hex(randomblob(6)))),
    trial_name        TEXT    NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    device_id         TEXT    NOT NULL,
    datetime_utc      TEXT    NOT NULL,
    pump_on_mins      REAL,
    avg_rate_lpm      REAL,
    volume_moved_gal  REAL,
    energy_wh         REAL,
    synced_at         TEXT
);
CREATE INDEX idx_circulation_trial_time ON circulation (trial_name, datetime_utc);
CREATE INDEX idx_circulation_device     ON circulation (device_id, datetime_utc);
CREATE INDEX idx_circulation_unsynced   ON circulation (synced_at) WHERE synced_at IS NULL;

-- ------------------------------------------------------------
-- lights
-- ------------------------------------------------------------
CREATE TABLE lights (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid          TEXT    NOT NULL UNIQUE
                   DEFAULT (lower(hex(randomblob(4))) || '-' ||
                            lower(hex(randomblob(2))) || '-4' ||
                            substr(lower(hex(randomblob(2))), 2) || '-' ||
                            substr('89ab', abs(random()) % 4 + 1, 1) ||
                            substr(lower(hex(randomblob(2))), 2) || '-' ||
                            lower(hex(randomblob(6)))),
    trial_name    TEXT    NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    device_id     TEXT    NOT NULL,
    datetime_utc  TEXT    NOT NULL,
    energy_wh     REAL,
    ammeter_v     REAL,
    synced_at     TEXT
);
CREATE INDEX idx_lights_trial_time ON lights (trial_name, datetime_utc);
CREATE INDEX idx_lights_device     ON lights (device_id, datetime_utc);
CREATE INDEX idx_lights_unsynced   ON lights (synced_at) WHERE synced_at IS NULL;

-- ------------------------------------------------------------
-- energy_costs
-- ------------------------------------------------------------
CREATE TABLE energy_costs (
    id                             INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid                           TEXT    NOT NULL UNIQUE
                                    DEFAULT (lower(hex(randomblob(4))) || '-' ||
                                             lower(hex(randomblob(2))) || '-4' ||
                                             substr(lower(hex(randomblob(2))), 2) || '-' ||
                                             substr('89ab', abs(random()) % 4 + 1, 1) ||
                                             substr(lower(hex(randomblob(2))), 2) || '-' ||
                                             lower(hex(randomblob(6)))),
    trial_name                     TEXT    NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    device_id                      TEXT    NOT NULL,
    datetime_utc                   TEXT    NOT NULL,
    pumping_wh                     REAL,
    lighting_wh                    REAL,
    total_wh                       REAL,
    rate                           REAL,
    energy_cost                    REAL,
    renewables_pct                 REAL,
    emissions_intensity_g_per_kWh  REAL,
    my_emissions_g                 REAL,
    future_cost                    REAL,
    synced_at                      TEXT
);
CREATE INDEX idx_energy_costs_trial_time ON energy_costs (trial_name, datetime_utc);
CREATE INDEX idx_energy_costs_device     ON energy_costs (device_id, datetime_utc);
CREATE INDEX idx_energy_costs_unsynced   ON energy_costs (synced_at) WHERE synced_at IS NULL;

-- ------------------------------------------------------------
-- ph_dosing_training
-- ------------------------------------------------------------
CREATE TABLE ph_dosing_training (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid               TEXT    NOT NULL UNIQUE
                        DEFAULT (lower(hex(randomblob(4))) || '-' ||
                                 lower(hex(randomblob(2))) || '-4' ||
                                 substr(lower(hex(randomblob(2))), 2) || '-' ||
                                 substr('89ab', abs(random()) % 4 + 1, 1) ||
                                 substr(lower(hex(randomblob(2))), 2) || '-' ||
                                 lower(hex(randomblob(6)))),
    trial_name         TEXT    NOT NULL REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE CASCADE,
    device_id          TEXT    NOT NULL,
    datetime_utc       TEXT    NOT NULL,
    start_ph           REAL,
    start_delta_ph     REAL,
    run_time           REAL,
    end_ph             REAL,
    end_delta_ph       REAL,
    accuracy           REAL,
    system_volume_gal  REAL,
    synced_at          TEXT
);
CREATE INDEX idx_ph_dosing_training_trial_time ON ph_dosing_training (trial_name, datetime_utc);
CREATE INDEX idx_ph_dosing_training_device     ON ph_dosing_training (device_id, datetime_utc);
CREATE INDEX idx_ph_dosing_training_unsynced   ON ph_dosing_training (synced_at) WHERE synced_at IS NULL;

-- ------------------------------------------------------------
-- calibrations (probe-scoped, optional trial link)
-- ------------------------------------------------------------
CREATE TABLE calibrations (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid              TEXT    NOT NULL UNIQUE
                       DEFAULT (lower(hex(randomblob(4))) || '-' ||
                                lower(hex(randomblob(2))) || '-4' ||
                                substr(lower(hex(randomblob(2))), 2) || '-' ||
                                substr('89ab', abs(random()) % 4 + 1, 1) ||
                                substr(lower(hex(randomblob(2))), 2) || '-' ||
                                lower(hex(randomblob(6)))),
    trial_name        TEXT    REFERENCES trials(trial_name) ON UPDATE CASCADE ON DELETE SET NULL,
    device_id         TEXT    NOT NULL,
    datetime_utc      TEXT    NOT NULL,
    device            TEXT    NOT NULL,
    probe_name        TEXT,
    address           TEXT,
    device_info       TEXT,
    points_completed  TEXT,
    final_cal_status  TEXT,
    verify_reading    TEXT,
    slope             TEXT,
    notes             TEXT,
    synced_at         TEXT
);
CREATE INDEX idx_calibrations_probe_time ON calibrations (probe_name, datetime_utc);
CREATE INDEX idx_calibrations_device     ON calibrations (device_id, datetime_utc);
CREATE INDEX idx_calibrations_unsynced   ON calibrations (synced_at) WHERE synced_at IS NULL;

-- ------------------------------------------------------------
-- schema_version: keep this in lockstep with Supabase
-- ------------------------------------------------------------
CREATE TABLE schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    notes       TEXT
);
INSERT INTO schema_version (version, notes) VALUES (1, 'Initial Argonaut schema, April 2026');
INSERT INTO schema_version (version, notes) VALUES (2, 'Added device_id to all sensor tables, April 2026');

-- ============================================================
-- Useful sync queries for the Pi-side worker:
--
-- 1. Pull a batch of unsynced rows for a table:
--    SELECT * FROM ambient_raw
--    WHERE synced_at IS NULL
--    ORDER BY datetime_utc
--    LIMIT 500;
--
-- 2. After Supabase ACKs the batch, mark them synced:
--    UPDATE ambient_raw
--    SET synced_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
--    WHERE uuid IN (?, ?, ?, ...);
--
-- 3. How far behind is the device?
--    SELECT COUNT(*) AS backlog
--    FROM ambient_raw
--    WHERE synced_at IS NULL;
-- ============================================================

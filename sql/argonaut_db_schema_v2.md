# Argonaut Database Schema Reference
## Version 2 — April 2026

**Database:** SQLite  
**Local path (Pi):** `/home/jadelaars/Desktop/Argonaut/data/argonaut.db`  
**Symlink path (dashboard access):** `/var/lib/argonaut/argonaut.db`  
**Schema version:** 2  
**Active Pi:** `arg-02`  

---

## Overview

Single SQLite database file spanning all grow trials. All tables share a `trial_name` column for cross-trial queries. The `trials` table is the master record — all other tables reference it via `trial_name`.

**Key conventions:**
- All timestamps stored as ISO 8601 text in UTC. Handle timezone conversion on the client side.
- All numeric sensor values stored as REAL (float). `NULL` = sensor unavailable or failed. **Do not treat `0.0` as a failed read — filter on the `_flag` column instead.**
- `_flag` columns use QAQC integer codes (see flag reference below).
- `trial_name` is the common key across all tables — always filter by it to scope queries to a grow cycle.
- `uuid` is a stable RFC 4122 row identifier for syncing to cloud. Use this, not `id`, as the foreign key in any cloud database.
- `device_id` identifies which Pi wrote the row. Currently always `arg-02`. Will be meaningful when additional Pis are deployed.
- `synced_at` is NULL for unsynced rows. Set by the sync job after a row is pushed to cloud. Do not write to this column from the dashboard.

**QAQC flag values:**
| Value | Meaning |
|-------|---------|
| 0 | No QC performed |
| 1 | Good |
| 2 | Suspect |
| 3 | Bad |
| 4 | Not evaluated |

---

## Tables

### `trials`
Grow cycle metadata. One row per trial. Master record — all other tables reference `trial_name`.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Unique. Links all tables. e.g. `trial_002` |
| uuid | TEXT | Row identifier for cloud sync |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| crop_type | TEXT | e.g. `lettuce` |
| planting_date | TEXT | ISO 8601 date |
| harvest_date | TEXT | ISO 8601 date. Filled at harvest |
| plant_count | INTEGER | Number of plants |
| grow_medium | TEXT | e.g. `rockwool`, `coco coir` |
| system_volume_gal | REAL | Reservoir volume in gallons |
| harvest_mass_g | REAL | Total harvest mass in grams. Filled at harvest |
| notes | TEXT | Free text trial notes |
| created_at | TEXT | ISO 8601 timestamp |

**Note:** `trials` does not have a `device_id` column — a trial belongs to the system, not a specific Pi.

---

### `ambient_raw`
Core sensor readings. Written every 30 minutes by cron.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Links to trials |
| datetime_utc | TEXT NOT NULL | ISO 8601 |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row e.g. `arg-02` |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| airtemp_C | REAL | Air temperature °C. NULL if sensor failed |
| humidity_pct | REAL | Relative humidity %. NULL if sensor failed |
| vpd_kpa | REAL | Vapor pressure deficit kPa. Derived from airtemp + humidity |
| ppfd_umol_m2_s | REAL | Photosynthetic photon flux density µmol/m²/s |
| temp_reservoir_C | REAL | Reservoir water temperature °C. NULL if sensor failed |
| ph | REAL | pH of nutrient solution. NULL if probe disconnected or failed |
| ec_us | REAL | Electrical conductivity µS/cm. NULL if sensor failed |
| flow_lpm | REAL | Water flow rate litres/min. NULL if sensor failed |
| co2_ppm | REAL | Ambient CO2 ppm |
| airtemp_flag | INTEGER | QAQC flag — see flag reference |
| humidity_flag | INTEGER | QAQC flag |
| temp_reservoir_flag | INTEGER | QAQC flag |
| ph_flag | INTEGER | QAQC flag |
| ec_flag | INTEGER | QAQC flag |
| ppfd_flag | INTEGER | QAQC flag |
| flow_flag | INTEGER | QAQC flag. Flag=0 (no QC) when pump is off — flow=0 is expected and not meaningful to test |

**Dashboard note:** Always filter or visually distinguish flagged data. Suspect (flag=2) and bad (flag=3) readings should not be treated as valid sensor data in charts or aggregations. Use `WHERE ph_flag = 1` for clean data only.

---

### `ambient_derived`
Computed leaf gas exchange values. Written every 30 minutes alongside `ambient_raw`. Based on the Farquhar-Ball-Berry-Medlyn photosynthesis model. These are scientific model outputs, not raw sensor reads.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Links to trials |
| datetime_utc | TEXT NOT NULL | ISO 8601 |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| assimilation_umol_m2_s | REAL | Net CO2 assimilation rate µmol/m²/s |
| hs | REAL | Relative humidity at leaf surface (0–1) |
| gsw_bb_mol_m2_s | REAL | Ball-Berry stomatal conductance to H2O mol/m²/s |
| gc_bb_mol_m2_s | REAL | Ball-Berry conductance to CO2 mol/m²/s |
| gsw_medlyn_mol_m2_s | REAL | Medlyn stomatal conductance to H2O mol/m²/s |
| gsc_medlyn_mol_m2_s | REAL | Medlyn conductance to CO2 mol/m²/s |
| flux_mol_m2_s | REAL | CO2 flux mol/m²/s |
| flux_umol_m2_s | REAL | CO2 flux µmol/m²/s |
| flux_CO2_g_m2_s | REAL | CO2 flux g/m²/s |
| co2_intercellular_ppm | REAL | Intercellular CO2 concentration ppm |

---

### `circulation`
Pump event log. Written once per pump cycle, typically hourly.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Links to trials |
| datetime_utc | TEXT NOT NULL | ISO 8601. Timestamp of cycle completion |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| pump_on_mins | REAL | Duration pump was running in minutes |
| avg_rate_lpm | REAL | Average flow rate litres/min during cycle |
| volume_moved_gal | REAL | Total volume circulated in gallons |
| energy_wh | REAL | Energy consumed Wh |

---

### `lights`
Lighting energy log. Written every 30 minutes.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Links to trials |
| datetime_utc | TEXT NOT NULL | ISO 8601 |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| energy_wh | REAL | Energy consumed Wh |
| ammeter_v | REAL | Raw CT sensor voltage. ON ~0.32V, OFF ~0.000V |

---

### `fan`
Fan event log. Written per fan cycle.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Links to trials |
| datetime_utc | TEXT NOT NULL | ISO 8601 |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| on_mins | REAL | Duration fan was running in minutes |
| energy_wh | REAL | Energy consumed Wh |

---

### `energy_costs`
Hourly energy cost analysis. Written at :58 each hour. Enriched with CAISO California grid data.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Links to trials |
| datetime_utc | TEXT NOT NULL | ISO 8601, hourly resolution |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| pumping_wh | REAL | Pump energy this hour Wh |
| lighting_wh | REAL | Lighting energy this hour Wh |
| fan_wh | REAL | Fan energy this hour Wh |
| total_wh | REAL | Total energy this hour Wh |
| rate | REAL | Electricity rate $/kWh (time-of-use) |
| energy_cost | REAL | Cost this hour $ |
| renewables_pct | REAL | Grid renewables % from CAISO |
| emissions_intensity_g_per_kWh | REAL | Grid CO2 intensity g/kWh |
| my_emissions_g | REAL | Argonaut CO2 emissions this hour g |
| future_cost | REAL | Social cost of carbon $ |

---

### `dosing_events`
pH dosing event log. Written once per dosing cycle.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Links to trials |
| datetime_utc | TEXT NOT NULL | ISO 8601 |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| ph_before | REAL | pH reading before dosing |
| delta_before | REAL | pH delta from target before dosing |
| run_time_secs | REAL | Doser pump runtime in seconds |
| ph_after | REAL | pH measured hours after dosing |
| delta_after | REAL | pH delta from target after dosing |
| accuracy | REAL | Dosing accuracy (delta_before − delta_after) |
| dose_ml | REAL | Estimated volume dosed in ml |

---

### `ph_dosing_training`
Machine learning training data for the pH dosing RandomForest model. Accumulates across trials.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT NOT NULL | Links to trials |
| datetime_utc | TEXT NOT NULL | ISO 8601 |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| start_ph | REAL | pH before dosing |
| start_delta_ph | REAL | pH delta from target before dosing |
| run_time | REAL | Doser runtime in seconds |
| end_ph | REAL | pH measured hours after dosing |
| end_delta_ph | REAL | pH delta from target after dosing |
| accuracy | REAL | Dosing accuracy (start_delta − end_delta) |
| system_volume_gal | REAL | Reservoir volume at time of dose |

**Note:** Model validity is tied to `system_volume_gal`. Training data from a different system volume is not valid for predictions at a new volume.

---

### `calibrations`
Sensor calibration records. Not strictly trial-scoped — belongs to probes, which persist across grow cycles.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| trial_name | TEXT | Optional trial association |
| datetime_utc | TEXT NOT NULL | ISO 8601 |
| uuid | TEXT | Row identifier for cloud sync |
| device_id | TEXT | Pi that wrote this row |
| synced_at | TEXT | ISO 8601. NULL = not yet synced |
| device | TEXT NOT NULL | e.g. `ph`, `ec` |
| probe_name | TEXT | Unique probe ID e.g. `PH-001` |
| address | TEXT | I2C address e.g. `0x63` |
| device_info | TEXT | Firmware version string from probe |
| points_completed | TEXT | Calibration points e.g. `['mid', 'low', 'high']` |
| final_cal_status | TEXT | EZO calibration status response |
| verify_reading | TEXT | Post-calibration verification reading |
| slope | TEXT | Probe slope coefficients from EZO |
| notes | TEXT | Free text notes |

**Probe naming convention:** `PH-001`, `PH-002`, `EC-001`, `EC-002` etc. Probe names are stored in EZO chip non-volatile memory and persist across power cycles and redeployments.

---

### `schema_version`
Migration history. Do not write to this table from the dashboard.

| Column | Type | Notes |
|--------|------|-------|
| version | INTEGER PK | Schema version number |
| applied_at | TEXT | ISO 8601 timestamp migration was applied |
| notes | TEXT | Description of changes |

---

## Example Queries

```sql
-- All sensor readings for a trial, clean data only
SELECT datetime_utc, airtemp_C, humidity_pct, vpd_kpa, ph, ec_us
FROM ambient_raw
WHERE trial_name = 'trial_002'
AND ph_flag = 1
ORDER BY datetime_utc;

-- Latest reading for each sensor (live dashboard)
SELECT datetime_utc, airtemp_C, humidity_pct, vpd_kpa, ph, ec_us, flow_lpm
FROM ambient_raw
WHERE trial_name = 'trial_002'
ORDER BY datetime_utc DESC
LIMIT 1;

-- Hourly averages for charting
SELECT
    strftime('%Y-%m-%dT%H:00:00', datetime_utc) as hour,
    AVG(airtemp_C)    as avg_temp,
    AVG(humidity_pct) as avg_humidity,
    AVG(vpd_kpa)      as avg_vpd,
    AVG(ph)           as avg_ph
FROM ambient_raw
WHERE trial_name = 'trial_002'
AND airtemp_flag = 1
GROUP BY hour
ORDER BY hour;

-- Total energy cost for a trial
SELECT
    SUM(energy_cost) as total_cost_usd,
    SUM(total_wh)    as total_wh,
    SUM(future_cost) as total_carbon_cost_usd
FROM energy_costs
WHERE trial_name = 'trial_002';

-- Unsynced rows across all tables (for sync job)
SELECT 'ambient_raw' as tbl, COUNT(*) as unsynced FROM ambient_raw WHERE synced_at IS NULL
UNION ALL
SELECT 'circulation',        COUNT(*) FROM circulation       WHERE synced_at IS NULL
UNION ALL
SELECT 'lights',             COUNT(*) FROM lights            WHERE synced_at IS NULL
UNION ALL
SELECT 'energy_costs',       COUNT(*) FROM energy_costs      WHERE synced_at IS NULL;

-- Trial summary
SELECT
    t.trial_name,
    t.crop_type,
    t.planting_date,
    t.harvest_date,
    t.plant_count,
    t.grow_medium,
    t.harvest_mass_g,
    COUNT(a.id) as total_readings
FROM trials t
LEFT JOIN ambient_raw a ON t.trial_name = a.trial_name
GROUP BY t.trial_name;

-- Calibration history for a probe
SELECT datetime_utc, probe_name, points_completed, slope, verify_reading
FROM calibrations
WHERE probe_name = 'PH-001'
ORDER BY datetime_utc;

-- pH dosing history for a trial
SELECT datetime_utc, ph_before, ph_after, delta_before, delta_after, accuracy, run_time_secs
FROM dosing_events
WHERE trial_name = 'trial_002'
ORDER BY datetime_utc;
```

---

## Planned Tables

| Table | Purpose |
|-------|---------|
| `growth_model` | Digital twin predictions — estimated harvest date, yield mass |
| `commands` | Command queue for REST API execute-now device control |
| `device_status` | Real-time device state log |

---

## Write Cadence Reference

| Table | Written by | Frequency |
|-------|-----------|-----------|
| `ambient_raw` | `read_data.py` | Every 30 mins |
| `ambient_derived` | `read_data.py` | Every 30 mins |
| `lights` | `read_data.py` | Every 30 mins |
| `circulation` | `circulation.py` | Each pump cycle (~hourly) |
| `fan` | `fan.py` | Each fan cycle |
| `energy_costs` | `energy_costs.py` | Hourly at :58 |
| `dosing_events` | `doser.py` | Each dosing cycle (~twice daily) |
| `ph_dosing_training` | `doser.py` | Each dosing cycle |
| `calibrations` | `calibrate_ph.py` | Manual, pre-trial |
| `trials` | `start_trial()` | Manual, once per grow cycle |

---

*Argonaut Hydroponic Control System — Credible Hydroponics — April 2026 — Schema v2*

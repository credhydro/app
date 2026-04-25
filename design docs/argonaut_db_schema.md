# Argonaut Database Schema Reference

**Database:** SQLite  
**File:** `argonaut.db`  
**Location:** `/home/jadelaars/Desktop/Argonaut/data/argonaut.db`  
**Version:** April 2026  

---

## Overview

Single SQLite database file spanning all grow trials. All tables share a `trial_name` column for cross-trial queries. The `trials` table is the master record -- all other tables reference it via `trial_name`.

**Key conventions:**
- All timestamps stored as ISO 8601 text in UTC. Handle timezone conversion on the client side.
- All numeric sensor values stored as REAL (float). Null = sensor unavailable or failed.
- `_flag` columns use QAQC integer codes (see flag reference below).
- `trial_name` is the common key across all tables -- always filter by it to scope queries to a grow cycle.

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
Grow cycle metadata. One row per trial. Master record -- all other tables reference `trial_name`.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | INTEGER | PK | Auto-increment |
| trial_name | TEXT | yes | Unique. Links all tables. e.g. "trial_001" |
| crop_type | TEXT | | e.g. "lettuce" |
| planting_date | TEXT | | ISO 8601 date |
| harvest_date | TEXT | | ISO 8601 date. Filled at harvest. |
| plant_count | INTEGER | | Number of plants |
| grow_medium | TEXT | | e.g. "rockwool" |
| system_volume_gal | REAL | | Reservoir volume in gallons |
| harvest_mass_g | REAL | | Total harvest mass in grams. Filled at harvest. |
| notes | TEXT | | Free text trial notes |
| created_at | TEXT | | ISO 8601 timestamp |

---

### `ambient_raw`
Core sensor readings. Written every 30 minutes.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | INTEGER | PK | Auto-increment |
| trial_name | TEXT | yes | Links to trials |
| datetime_utc | TEXT | yes | ISO 8601 |
| airtemp_C | REAL | | Air temperature in Celsius |
| humidity_pct | REAL | | Relative humidity % |
| vpd_kpa | REAL | | Vapor pressure deficit kPa |
| ppfd_umol_m2_s | REAL | | Photosynthetic photon flux density |
| temp_reservoir_C | REAL | | Reservoir water temperature Celsius |
| ph | REAL | | pH of nutrient solution |
| ec_us | REAL | | Electrical conductivity uS/cm |
| flow_lpm | REAL | | Water flow rate litres/min |
| co2_ppm | REAL | | Ambient CO2 ppm |
| airtemp_flag | INTEGER | | QAQC flag (see flag reference) |
| humidity_flag | INTEGER | | QAQC flag |
| temp_reservoir_flag | INTEGER | | QAQC flag |
| ph_flag | INTEGER | | QAQC flag |
| ec_flag | INTEGER | | QAQC flag |
| ppfd_flag | INTEGER | | QAQC flag |
| flow_flag | INTEGER | | QAQC flag |

**Dashboard note:** Visually distinguish flagged data (suspect=2, bad=3) from clean data (good=1) when plotting time series.

---

### `ambient_derived`
Computed leaf gas exchange values. Written every 30 minutes alongside `ambient_raw`. Based on the Farquhar-Ball-Berry-Medlyn photosynthesis model.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | INTEGER | PK | Auto-increment |
| trial_name | TEXT | yes | Links to trials |
| datetime_utc | TEXT | yes | ISO 8601 |
| assimilation_umol_m2_s | REAL | | Net CO2 assimilation rate |
| hs | REAL | | Relative humidity at leaf surface (0-1) |
| gsw_bb_mol_m2_s | REAL | | Ball-Berry stomatal conductance to H2O |
| gc_bb_mol_m2_s | REAL | | Ball-Berry conductance to CO2 |
| gsw_medlyn_mol_m2_s | REAL | | Medlyn stomatal conductance to H2O |
| gsc_medlyn_mol_m2_s | REAL | | Medlyn conductance to CO2 |
| flux_mol_m2_s | REAL | | CO2 flux mol/m2/s |
| flux_umol_m2_s | REAL | | CO2 flux umol/m2/s |
| flux_CO2_g_m2_s | REAL | | CO2 flux g/m2/s |
| co2_intercellular_ppm | REAL | | Intercellular CO2 concentration ppm |

---

### `circulation`
Pump event log. Written once per pump cycle (typically hourly).

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | INTEGER | PK | Auto-increment |
| trial_name | TEXT | yes | Links to trials |
| datetime_utc | TEXT | yes | ISO 8601 |
| pump_on_mins | REAL | | Duration pump was running in minutes |
| avg_rate_lpm | REAL | | Average flow rate litres/min |
| volume_moved_gal | REAL | | Total volume circulated in gallons |
| energy_wh | REAL | | Energy consumed Wh |

---

### `lights`
Lighting energy log. Written every 30 minutes.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | INTEGER | PK | Auto-increment |
| trial_name | TEXT | yes | Links to trials |
| datetime_utc | TEXT | yes | ISO 8601 |
| energy_wh | REAL | | Energy consumed Wh |
| ammeter_v | REAL | | Raw ammeter voltage reading |

---

### `energy_costs`
Hourly energy cost analysis. Written at :58 each hour. Enriched with CAISO grid data.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | INTEGER | PK | Auto-increment |
| trial_name | TEXT | yes | Links to trials |
| datetime_utc | TEXT | yes | ISO 8601, hourly resolution |
| pumping_wh | REAL | | Pump energy this hour Wh |
| lighting_wh | REAL | | Lighting energy this hour Wh |
| total_wh | REAL | | Total energy this hour Wh |
| rate | REAL | | Electricity rate $/kWh (time-of-use) |
| energy_cost | REAL | | Cost this hour $ |
| renewables_pct | REAL | | Grid renewables % from CAISO |
| emissions_intensity_g_per_kWh | REAL | | Grid CO2 intensity g/kWh |
| my_emissions_g | REAL | | Argonaut CO2 emissions this hour g |
| future_cost | REAL | | Social cost of carbon $ |

---

### `ph_dosing_training`
Machine learning training data for the pH dosing model. Accumulates across trials. Used to predict doser runtime based on pH delta.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | INTEGER | PK | Auto-increment |
| trial_name | TEXT | yes | Links to trials |
| datetime_utc | TEXT | yes | ISO 8601 |
| start_ph | REAL | | pH before dosing |
| start_delta_ph | REAL | | pH delta from target before dosing |
| run_time | REAL | | Doser runtime in seconds |
| end_ph | REAL | | pH measured hours after dosing |
| end_delta_ph | REAL | | pH delta from target after dosing |
| accuracy | REAL | | Dosing accuracy (start_delta - end_delta) |
| system_volume_gal | REAL | | System volume at time of dose |

**Note:** Model validity is tied to `system_volume_gal`. If system volume changes, training data from previous volume is not valid for new predictions.

---

### `calibrations`
Sensor calibration records. Not trial-scoped -- belongs to probes, not grow cycles. Supports the sensors-as-a-service model where probes are tracked across deployments.

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | INTEGER | PK | Auto-increment |
| trial_name | TEXT | | Optional trial association |
| datetime_utc | TEXT | yes | ISO 8601 |
| device | TEXT | yes | e.g. "ph", "ec" |
| probe_name | TEXT | | Unique probe ID e.g. "PH-001" |
| address | TEXT | | I2C address e.g. "0x63" |
| device_info | TEXT | | Firmware version string from probe |
| points_completed | TEXT | | Calibration points e.g. "['mid', 'low', 'high']" |
| final_cal_status | TEXT | | EZO calibration status response |
| verify_reading | TEXT | | Post-calibration verification reading |
| slope | TEXT | | Probe slope coefficients from EZO |
| notes | TEXT | | Free text notes |

**Probe naming convention:** `PH-001`, `PH-002`, `EC-001`, `EC-002` etc. Probe names are stored in the EZO chip's non-volatile memory and persist across power cycles.

---

## Example queries

```sql
-- All sensor readings for a trial
SELECT * FROM ambient_raw
WHERE trial_name = 'trial_001'
ORDER BY datetime_utc;

-- Good quality pH readings only (flag = 1)
SELECT datetime_utc, ph FROM ambient_raw
WHERE trial_name = 'trial_001'
AND ph_flag = 1
ORDER BY datetime_utc;

-- Total energy cost for a trial
SELECT SUM(energy_cost) as total_cost,
       SUM(total_wh) as total_wh
FROM energy_costs
WHERE trial_name = 'trial_001';

-- Calibration history for a specific probe
SELECT * FROM calibrations
WHERE probe_name = 'PH-001'
ORDER BY datetime_utc;

-- Trial summary
SELECT t.trial_name, t.crop_type, t.planting_date, t.harvest_date,
       t.plant_count, t.harvest_mass_g,
       COUNT(a.id) as total_readings
FROM trials t
LEFT JOIN ambient_raw a ON t.trial_name = a.trial_name
GROUP BY t.trial_name;
```

---

## Planned additions

The following tables are planned for future implementation:

- `growth_model` -- digital twin predictions (estimated harvest date, mass)
- `commands` -- command queue for REST API execute-now functions
- `device_status` -- real-time device state log

---

*Generated April 2026 -- Argonaut Hydroponic Control System*

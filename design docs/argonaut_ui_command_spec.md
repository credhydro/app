# Argonaut — UI Command Spec v1
**Date:** June 8, 2026
**From:** Jason Adelaars — Credible Hydroponics
**For:** UI Development Team
**Status:** Specification — pending implementation

---

## Overview

This document defines the full dashboard menu structure, user inputs, command queue
items, and config values for the Argonaut grower-facing UI. It is the authoritative
reference for what the dashboard exposes to growers, what data flows to the Pi, and
what is read-only.

### Key architecture principle

All commands flow through a Supabase `commands` table. The Pi polls this table every
minute, claims pending commands for its `device_id`, executes them locally, and writes
the result back. The Pi never accepts inbound connections. The dashboard never writes
directly to the Pi filesystem or database.

Config values set by the grower are written to `grow_cycle.json` on the Pi by the
command consumer. Cron reads from local config on every cycle. If Supabase is
unreachable, the Pi continues running on the last written local config — correct
failure mode.

---

## Multi-Unit Architecture Note

**Not built in v1, but decisions made now affect future feasibility.**

A grower may operate multiple Argonaut units — different rooms, different system
types, different crops running concurrently. The data model already supports this:
every table in Supabase has a `device_id` column identifying which Pi wrote each row.
No schema changes are required for multi-unit support.

**One requirement for all queries built in v1:**

Every Supabase query in the dashboard must include a `device_id` filter from day one.

```javascript
// Every query scoped to a specific unit
const { data } = await supabase
  .from('ambient_raw')
  .select('*')
  .eq('device_id', activeDeviceId)
  .order('datetime_utc', { ascending: false })
  .limit(1)
```

If queries are built without this filter now, every hook will require a rewrite when
multi-unit support is added. If they are built with it, adding multi-unit later is
a matter of changing the value of `activeDeviceId` — the query logic stays identical.

**What multi-unit v2 will require:**

- Unit switcher in nav — grower selects which Argonaut they are viewing
- `activeDeviceId` stored in app state, passed to every query
- Commands routed to selected `device_id`
- Dashboard scoped to one unit at a time (unit-scoped, not farm-scoped)

**Farm-scoped view** — showing all units simultaneously, aggregate costs across fleet,
side-by-side sensor comparison — is a v3 feature. Do not design for it now.

**Current device_id:** `arg-02`

### Command table schema (Supabase)

```
commands
    id              INTEGER PK
    device_id       TEXT        -- which Pi this command is for
    command         TEXT        -- e.g. "lights_on", "set_lights_schedule"
    params          JSONB       -- e.g. {"lights_on_hours": [6,7,8,9]}
    status          TEXT        -- pending / claimed / complete / failed
    created_at      TIMESTAMPTZ
    claimed_at      TIMESTAMPTZ
    completed_at    TIMESTAMPTZ
    result          JSONB       -- Pi writes outcome here
```

---

## Navigation Structure

```
Dashboard
    ├── Current Information      (read only)
    ├── Crop                     (trial registration + harvest)
    ├── Lights                   (schedule + manual control)
    ├── Pump                     (schedule + manual control)
    ├── Fan                      (schedule + manual control)
    ├── Other                    (generic electrical subsystem)
    ├── pH Dosing                (ML dosing control)
    ├── Harvest / Yields         (history + harvest registration)
    ├── Feedback to CredHydro    (bug reporting)
    └── Settings                 (farm registration — one time setup)
```

**Deferred / not in v1:**
- Nutrient Dosing — growers manage manually, no automation in v1
- Sensors — calibration as a service, no UI calibration flow in v1

---

## 1. Current Information

**Read only. No commands.**

Displays real-time sensor readings pulled from Supabase `ambient_raw` and
`ambient_derived` tables. All values sourced from most recent row for the active trial.

| Metric | Source | Good range |
|---|---|---|
| pH | `ambient_raw.ph` | 5.5 – 6.5 |
| EC | `ambient_raw.ec_us` (display as mS/cm) | 1.0 – 2.5 mS/cm |
| VPD | `ambient_raw.vpd_kpa` | 0.8 – 1.2 kPa |
| DLI | Integrated from today's `ppfd_umol_m2_s` readings | 10 – 30 mol/m²/day |
| Growth Rate | `ambient_derived.assimilation_umol_m2_s` (latest) | 10 – 25 µmol/m²/s |
| Air Temp | `ambient_raw.airtemp_C` | 18 – 26 °C |
| Humidity | `ambient_raw.humidity_pct` | 50 – 70 % |
| Flow Rate | Most recent `circulation.avg_rate_lpm` | > 1.0 lpm |
| Running Cost | SUM of `energy_costs.energy_cost` for active trial | — |

Each metric color-codes: green inside good range, amber / red outside.

Show "last reading" timestamp from most recent `ambient_raw` row.

**Enhancement request (grower feedback):** Time series chart view for each metric.
Toggle between gauge and chart. Deferred to v2 but noted here for planning.

---

## 2. Crop

Two distinct UI states within this section.

### State 1 — Trial Registration

**Trigger:** Grower clicks "Start New Trial"
**UI pattern:** Modal or slide-in panel — not full page navigation
**API action:** POST full payload to Supabase `commands` table with
`command: "start_trial"`. Pi executes `start_trial()`, captures setpoints from
`grow_cycle.json` at that moment, writes to local `trials` table.

| Field | Type | Required | Notes |
|---|---|---|---|
| `crop_type` | Dropdown | Yes | Lettuce, Basil, Tomato, Strawberry, Other |
| `cultivar` | Text | No | e.g. "Red Butter", "Genovese" |
| `harvest_type` | Dropdown | Yes | See options below. Default: All at once |
| `plant_count` | Integer | Yes | Number of plants |
| `planting_date` | Date picker | Yes | Defaults to today |
| `data_sharing_consent` | Boolean toggle | Yes | See consent note below |

**Harvest type options (plain English):**

| Display label | Internal value |
|---|---|
| All at once (lettuce, spinach) | `single_cut` |
| Continuously (tomatoes, strawberries) | `continuous` |
| Cut and come again (basil, kale) | `cut_and_come_again` |
| Progressive thinning (microgreens) | `progressive_thinning` |

Default to "All at once" — lettuce growers should not need to think about this.
Include the dropdown for growers who want it. Gather feedback on whether it creates
confusion before deciding to simplify or expand.

**Data sharing consent** — store with timestamp and version:

```
farms table (Supabase):
    data_sharing_consent    BOOLEAN
    consent_given_at        TIMESTAMPTZ
    consent_version         TEXT        -- e.g. "v1.0"
```

Re-prompt growers if consent version changes.

### State 2 — Harvest Registration

**Trigger:** "Register Harvest" button — visible only when trial is active
**UI pattern:** Full-screen flow — this is a significant grower moment, not a modal
**API action:** POST full harvest payload to `commands` table with
`command: "register_harvest"`. Pi writes to `trials` table, runs `compile_trial.py`,
calls Claude API for agronomic feedback, writes result back to commands table.

**Display weighing protocol prominently before weight entry fields:**

> **Weigh in this order:**
>
> **1. Total harvest mass** — all plants removed from system, roots still attached,
> growing medium still on. Weigh everything that came off the system.
>
> **2. Marketable mass** — after trimming: roots removed, outer damaged or yellowed
> leaves removed, growing medium removed. This is what you would hand to a customer.
>
> **3. Cull mass** — plants that are unsellable (bolted, too damaged, undersized).
> Weigh as whole plants — no trimming needed.
>
> Trim waste is calculated automatically: Total − Marketable − Cull.

| Field | Type | Required | Notes |
|---|---|---|---|
| `harvest_date` | Date picker | Yes | Defaults to today |
| `harvest_mass_g` | Decimal | Yes | Total mass before trimming |
| `marketable_mass_g` | Decimal | Yes | Post-trim sellable mass |
| `cull_mass_g` | Decimal | Yes | Unsellable whole plants |
| `plants_surviving` | Integer | Yes | Plants that made it to harvest |
| `pest_disease_event` | Boolean toggle | Yes | Did any pest/disease issue occur? |
| `equipment_failure_event` | Boolean toggle | Yes | Did any equipment fail? |
| `labor_hours_estimated` | Decimal | No | Routine O&M hours, exclude harvest day |

**Validation:**
- `marketable_mass_g + cull_mass_g` must not exceed `harvest_mass_g` by more than 5%
- `plants_surviving` must not exceed `plant_count` from trial registration
- `harvest_date` must be on or after `planting_date`

**After submission:**
1. Loading state: "Compiling trial data..."
2. Pi runs `compile_trial.py` — 2–5 seconds
3. Pi calls Claude API for agronomic feedback — 3–8 seconds
4. Results screen: key metrics + Claude plain-English summary
5. Options: download compiled JSON, start next trial

**Note:** Claude feedback quality depends on `crop_constraints` table being populated
with literature-derived optimal ranges. Lettuce values must be in place before
trial_003 harvest. This is a hard dependency.

---

## 3. Lights

### Controls

**on / off / auto toggle**
- `auto` — follow the lights schedule
- `on` — manual override, lights stay on regardless of schedule
- `off` — manual override, lights stay off regardless of schedule

Manual override requires an override flag on the Pi side. Returning to `auto` clears
the override. The schedule must not override a manual state until the grower
explicitly selects `auto`.

**Commands:**

| Command | Params | Notes |
|---|---|---|
| `lights_on` | none | Manual override |
| `lights_off` | none | Manual override |
| `lights_auto` | none | Return to schedule |
| `set_lights_schedule` | `{"lights_on_hours": [6,7,8,...]}` | Array of integers 0–23 |

### Setup fields (set at trial registration, not mid-trial commands)

| Field | Type | Notes |
|---|---|---|
| Uses lights? | Boolean | If No, hide entire section |
| Environment | Dropdown | Fully indoor / Greenhouse / Outdoor |
| Light sensor connected | Boolean | Maps to `PPFD_FROM_SENSOR` in grow_cycle.json |
| Estimated PPFD at canopy | Decimal | µmol/m²/s — show if no light sensor. Helper: "Check your fixture spec sheet" |
| Total light fixture watts | Decimal | Maps to `LIGHTS_POWER_W`. Used for energy calculation |

### Lights schedule UI

24-hour grid. Grower taps hours to toggle on/off. Submit sends `set_lights_schedule`
command with array of on-hours. Pi validates: integers 0–23, no duplicates, at least
1 hour. Pi writes to `grow_cycle.json`, logs change to `photoperiod_changes` table
with timestamp.

### Decision tree for visible controls

```
Uses lights?
    NO  → hide entire lights section
    YES →
        Environment?
            INDOOR / GREENHOUSE → show schedule, PPFD estimate, wattage
            OUTDOOR →
                Light sensor connected?
                    NO  → show schedule only
                    YES → show PPFD threshold for auto-shutoff (v2 feature, not v1)
```

### Deferred (v2)

PPFD threshold for outdoor auto-shutoff — requires Quantum sensor integration to be
mature. Flag as future feature, do not build in v1.

---

## 4. Pump

### Controls

**on / off / auto toggle** — same override pattern as lights. Pump off manual override
should trigger a dashboard alert after 2 hours — roots dry out fast.

**Commands:**

| Command | Params | Notes |
|---|---|---|
| `pump_on` | none | Manual override |
| `pump_off` | none | Manual override |
| `pump_auto` | none | Return to schedule |
| `set_pump_frequency` | `{"interval_mins": 60}` | How often to run |
| `set_pump_duration` | `{"duration_mins": 4}` | How long to run each cycle |

### Setup fields

| Field | Type | Notes |
|---|---|---|
| System type | Dropdown | See options below — drives pump behavior |
| Pump watts | Decimal | Setup only — used for energy calculation |

**System type options:**

| Display label | Internal value | Pump behavior |
|---|---|---|
| Nutrient Film Technique (NFT) | `NFT` | Continuous 24/7 |
| Deep Water Culture (DWC) | `DWC` | Periodic interval |
| Shallow Water Culture (SWC) | `SWC` | Periodic interval with air lead-in |
| Ebb and Flow | `ebb_flow` | Periodic interval |
| Aeroponic | `aeroponic` | Periodic interval |

System type should be set at trial registration and not changed mid-trial. The Pi
derives pump behavior from this value — growers should not need to know that NFT means
continuous pump.

### Mid-trial adjustable

Frequency and duration are legitimate mid-trial controls — a grower may need to adjust
if roots are drying out or flow rate is declining. Both are command queue items.

### Display

Most recent average flow rate from `circulation.avg_rate_lpm`. Also displayed in
Current Information.

---

## 5. Fan

### Controls

**on / off / auto toggle** — same pattern as pump and lights.

**Commands:**

| Command | Params | Notes |
|---|---|---|
| `fan_on` | none | Manual override |
| `fan_off` | none | Manual override |
| `fan_auto` | none | Return to schedule |
| `set_fan_frequency` | `{"interval_mins": 60}` | How often to run |
| `set_fan_duration` | `{"on_mins": 10}` | How long to run each cycle |

### Setup fields

| Field | Type | Notes |
|---|---|---|
| Fan watts | Decimal | Setup only — used for energy calculation |

**Note for implementation:** Fan is currently coupled to the circulation sequence in
`main.py`. Fan scheduling as an independent control requires the `handle_circulation()`
refactor to be complete before fan commands work correctly end to end. Confirm with
Jason before building the fan command consumer on the Pi side.

---

## 6. Other

Generic electrical subsystem slot. Designed for devices like air pumps, dehumidifiers,
or humidifiers. Same control pattern as Fan and Pump.

### Controls

**on / off / auto toggle**

**Commands:**

| Command | Params | Notes |
|---|---|---|
| `other_on` | none | Manual override |
| `other_off` | none | Manual override |
| `other_auto` | none | Return to schedule |
| `set_other_frequency` | `{"interval_mins": 60}` | How often to run |
| `set_other_duration` | `{"on_mins": 10}` | How long to run each cycle |

### Setup fields

| Field | Type | Notes |
|---|---|---|
| Device name | Text | e.g. "Air Pump", "Dehumidifier" — grower labels this slot |
| Watts | Decimal | Setup only — used for energy calculation |

**Note:** The GPIO pin assignment for "Other" is set at the hardware level by
Credible Hydroponics, not by the grower. Currently maps to `AC_PORT3_GPIO = 26`
in hardware config. Growers name the device, they do not configure GPIO.

---

## 7. pH Dosing

### Display (read only)

- Current pH — same indicator as Current Information
- Time of last dose — from `dosing_events.datetime_utc`
- Argonaut confidence level — displayed as 1–10 scale for pH down

**Confidence level formula:**
```
confidence = min(10, int(training_rows / PH_TRAINING_MIN * 3))
```
Where `training_rows` = count of rows in `ph_dosing_training` and
`PH_TRAINING_MIN` = 5 (minimum rows before ML model activates).
Reaches 10 after approximately 17 training rows.

### pH target range

Slider bar: set desired pH range (lower and upper bound).
Maps to `TARGET_PH` (lower bound) and `TARGET_PH + PH_MAX_DELTA` (upper bound).
No backend logic change required — clean translation to existing two-value model.

**Command:**

| Command | Params |
|---|---|
| `set_ph_target` | `{"target_ph": 5.5, "ph_max_delta": 0.3}` |

### Manual dosing

Growers train Argonaut by running the doser manually in the early stages of a trial.
Argonaut records the resulting pH change. Over time it becomes confident enough to
run automatically. Explain this training loop clearly in the UI so growers understand
why they need to wait until the next day to see the effect — otherwise they will dose
again manually and corrupt the training data.

**pH down only in v1.** pH up hardware not yet deployed. Do not show pH up controls
until hardware exists.

**Manual dose — pH down:**
- Integer input, units: seconds
- Submit button
- Pi-side hard limits: maximum runtime cap, minimum cooldown period between doses
- Every manual dose logged to `dosing_events` table

**Command:**

| Command | Params | Notes |
|---|---|---|
| `dose_ph_down` | `{"run_time_secs": 30}` | Pi enforces max cap regardless of value sent |

### Automatic dosing

| Field | Type | Notes |
|---|---|---|
| Automatic dosing | Boolean toggle | Enables / disables doser cron |
| Dose time 1 | Time picker HH:MM AM/PM | First daily dose |
| Dose time 2 | Time picker HH:MM AM/PM | Second daily dose (result measurement) |

**Validation:** Minimum 6 hours between dose times. The Pi needs time between morning
dose and evening measurement for pH to stabilize. If times are too close, training
data is invalid.

**Commands:**

| Command | Params |
|---|---|
| `set_doser_auto` | `{"enabled": true}` |
| `set_doser_schedule` | `{"dose_times": ["01:45", "18:45"]}` |

**grow_cycle.json addition needed:**
`DOSER_ENABLED` boolean flag — Pi consumer enables/disables dosing without touching
cron entries.

### pH up (future)

Deferred until pH up doser hardware is deployed. Schema and command pattern will
mirror pH down. Do not build UI for this in v1.

---

## 8. Harvest / Yields

Two distinct UI states.

### State 1 — Active trial view

"Register Harvest" button prominent. Links to harvest registration flow defined in
Section 2 — Crop.

### State 2 — Historical view

Trial cards showing key outcomes per completed trial.

**Per trial card:**

```
trial_002 — Red Butter Lettuce — 30 days
Marketable yield:     704 g
Cost per gram:        $0.022 / g
DLI achieved:         18.4 mol/m²/day
Avg VPD:              0.94 kPa
Avg pH:               5.6
Survival rate:        100%
```

Click any trial card → trial detail view including Claude agronomic summary below
the metrics.

Side-by-side comparison across trials deferred until 3+ trials exist. Do not build
comparison view in v1.

**Hard dependency:** Claude feedback requires `crop_constraints` table populated with
literature-derived optimal ranges. Lettuce values must be in place before this section
displays meaningful feedback. Confirm with Jason before enabling Claude feedback in
production.

---

## 9. Feedback to CredHydro

Simple support form. No Pi involvement, no command queue.

Fields: name, email, message, submit.

Posts to Credible Hydroponics support channel. Implementation detail left to UI team.

---

## 10. Settings (Farm Registration)

One-time onboarding flow. Accessible later for edits via Settings menu item.
Not part of main navigation — moves to Settings or Profile section.

| Field | Type | Required | Notes |
|---|---|---|---|
| Farm name | Text | No | e.g. "Rooftop Greenhouse" |
| City | Text | Yes | |
| State | Text | Yes | |
| Country | Text | Yes | |
| Timezone | Dropdown | Yes | IANA timezone list |
| Environment type | Dropdown | Yes | Fully indoor / Greenhouse / Outdoor |
| System type | Dropdown | Yes | NFT / DWC / SWC / Ebb & Flow / Aeroponic |
| HVAC — cooling | Boolean | Yes | Active cooling available? |
| HVAC — heating | Boolean | Yes | Active heating available? |
| HVAC — dehumidification | Boolean | Yes | Active dehumidification available? |
| HVAC — humidification | Boolean | Yes | Active humidification available? |
| Grow space | Decimal | No | Total canopy area m² |
| Electricity rate | Decimal | No | $/kWh — helper: "Check your electricity bill" |

Latitude and longitude reverse-geocoded from city/state/country. Grower does not
enter coordinates.

HVAC booleans determine what parameter recommendations are achievable — a farm with
no humidity control cannot be recommended a VPD setpoint that requires it.

---

## Command Summary

All commands the Pi must handle in v1:

| Command | Section | Params |
|---|---|---|
| `start_trial` | Crop | trial registration payload |
| `register_harvest` | Crop | harvest payload |
| `lights_on` | Lights | none |
| `lights_off` | Lights | none |
| `lights_auto` | Lights | none |
| `set_lights_schedule` | Lights | `{"lights_on_hours": [...]}` |
| `pump_on` | Pump | none |
| `pump_off` | Pump | none |
| `pump_auto` | Pump | none |
| `set_pump_frequency` | Pump | `{"interval_mins": N}` |
| `set_pump_duration` | Pump | `{"duration_mins": N}` |
| `fan_on` | Fan | none |
| `fan_off` | Fan | none |
| `fan_auto` | Fan | none |
| `set_fan_frequency` | Fan | `{"interval_mins": N}` |
| `set_fan_duration` | Fan | `{"on_mins": N}` |
| `other_on` | Other | none |
| `other_off` | Other | none |
| `other_auto` | Other | none |
| `set_other_frequency` | Other | `{"interval_mins": N}` |
| `set_other_duration` | Other | `{"on_mins": N}` |
| `set_ph_target` | pH Dosing | `{"target_ph": N, "ph_max_delta": N}` |
| `dose_ph_down` | pH Dosing | `{"run_time_secs": N}` |
| `set_doser_auto` | pH Dosing | `{"enabled": bool}` |
| `set_doser_schedule` | pH Dosing | `{"dose_times": ["HH:MM", "HH:MM"]}` |

---

## Config Values Written to grow_cycle.json

These are setup values, not mid-trial commands. Written at trial registration or
farm setup. Not exposed as real-time controls.

| Key | Section | Notes |
|---|---|---|
| `LIGHTS_PPFD_UMOL` | Lights | Fixture PPFD at canopy |
| `LIGHTS_POWER_W` | Lights | Fixture wattage |
| `PPFD_FROM_SENSOR` | Lights | Use Quantum sensor vs fixed value |
| `PUMP_WATTS` | Pump | Pump wattage |
| `SYSTEM_TYPE` | Pump | Drives pump behavior — set once |
| `FAN_WATTS` | Fan | Fan wattage |
| `OTHER_DEVICE_NAME` | Other | Grower-supplied label |
| `OTHER_WATTS` | Other | Wattage for energy calculation |
| `DOSER_ENABLED` | pH Dosing | Enable/disable doser cron (new flag) |

---

## Deferred Features

| Feature | Section | Reason |
|---|---|---|
| Nutrient Dosing | — | Growers manage manually, low frequency |
| Sensor calibration UI | Sensors | Sensors as a service model, v2 |
| Sensor performance metrics | Sensors | Not enough data to know what's useful yet |
| PPFD threshold outdoor auto-shutoff | Lights | Requires mature Quantum sensor integration |
| pH up doser | pH Dosing | Hardware not yet deployed |
| Harvest photo upload | Crop | Storage complexity, unclear analytical value |
| Trial comparison view | Harvest/Yields | Deferred until 3+ trials exist |
| Time series chart per metric | Current Information | Grower-requested, v2 |
| Trial start / finish command | Crop | Harvest registration is a form, not a signal |

---

## Open Questions for UI Team

1. How are you currently reading sensor data for the real-time dashboard — direct
   Supabase query, or polling an endpoint?
2. What is your current authentication model for remote dashboard access?
3. Are you building for mobile, desktop, or both? The harvest flow benefits from
   mobile-first design — grower is standing at the system with a scale.
4. `fan` and `dosing_events` tables are not yet in your sync script — confirm when
   these will be added.
5. Running cost display currently sums all `energy_costs.energy_cost` rows — needs
   to be scoped to active trial. Also requested: monthly view and trial view displayed
   concurrently.

---

*Argonaut Hydroponic Control System — Credible Hydroponics — UI Command Spec v1 — June 2026*

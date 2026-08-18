# CredHydro

Frontend dashboard and data pipeline for the CredHydro hydroponic monitoring platform. The dashboard displays real-time sensor readings and equipment operations pulled from a Supabase backend.

**GitHub:** https://github.com/credhydro/app

---

## Supabase project

| Field | Value |
|---|---|
| Project name | CredHydro |
| Project ID | `rqywzhfxyxfuywlhjghp` |
| Region | us-west-2 |
| REST API base URL | `https://rqywzhfxyxfuywlhjghp.supabase.co/rest/v1/` |

---

## Repository structure

```
dashboard/        React web app (Vite + TypeScript + Tailwind)
scripts/          Python sync scripts (Pi → Supabase)
sql/              Database schemas and migrations
test_data/        Local SQLite test database and upload utilities
```

---

## Dashboard

### Tech stack

- **React 18** with TypeScript
- **Vite** for bundling and dev server
- **Tailwind CSS** for styling
- **Supabase JS client** for real-time database queries

### What it displays

#### Home — gauge cards

Six at-a-glance metric cards pulled from the `ambient_raw`, `ambient_derived`, and `energy_costs` Supabase tables:

| Metric | Source | Good range |
|---|---|---|
| **pH** | `ambient_raw.ph` | 5.5 – 6.5 pH |
| **EC** | `ambient_raw.ec_us` (converted µS → mS/cm) | 1.0 – 2.5 mS/cm |
| **VPD** | `ambient_raw.vpd_kpa` | 0.8 – 1.2 kPa |
| **DLI** | `lights.dli_mol_m2_day` (latest row) | 12 – 17 mol/m²/day |
| **Growth Rate** | `ambient_derived.assimilation_umol_m2_s` (latest row) | 10 – 25 µmol/m²/s |
| **Running Cost** | Sum of all `energy_costs.energy_cost` rows | — |

Each gauge card color-codes the value: green when inside the good range, amber/red outside it. A "last reading" timestamp is shown at the top of the page from the most recent `ambient_raw` row.

#### Home — operations timeline

An SVG timeline chart showing equipment activity over the **last 48 hours**, with 12-hour tick marks on the time axis. Four rows are rendered:

| Row | Source table | Column used |
|---|---|---|
| **Lights** | `lights` | `energy_wh` (non-zero = on period) |
| **Fan** | `fan` | `on_mins` |
| **Pump** | `circulation` | `pump_on_mins` |
| **Dosing** | `dosing_events` | event timestamp (rendered as vertical tick marks) |

### Data refresh

Both hooks (`useAmbientData`, `useOperationsData`) poll Supabase every **5 minutes** via `setInterval`.

### Layout

- **Desktop (md+):** fixed 224 px sidebar with logo and nav, content fills the remaining width.
- **Mobile:** sidebar is hidden; a top header bar with the logo appears instead.

---

## Running the dashboard locally

```bash
cd dashboard
cp .env.example .env        # fill in your Supabase URL and anon key
npm install
npm run dev                 # starts at http://localhost:5173
```

### Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

### Build for production

```bash
npm run build   # output in dashboard/dist/
```

---

## Database

The Supabase schema is defined in [sql/supabase_schema.sql](sql/supabase_schema.sql). The local SQLite schema used on the Raspberry Pi is in [sql/sqlite_local_schema.sql](sql/sqlite_local_schema.sql). See [sql/argonaut_db_schema_v2.md](sql/argonaut_db_schema_v2.md) for a full schema reference.

## Data sync

Both scripts use only Python stdlib (`sqlite3`, `urllib`, `json`) — no pip dependencies required.

### `scripts/sync_ambient.py` — incremental sync (production, runs on the Pi)

Designed to run as an hourly cron job on the Argonaut Pi. It incrementally uploads only new rows to Supabase:

1. Queries each table for rows where `synced_at IS NULL`
2. POSTs them to Supabase in batches of 200 via the REST API (`on_conflict=uuid` so duplicates are safely ignored)
3. Stamps successfully uploaded rows with `synced_at = now()` in SQLite

**Tables synced:** `trials`, `ambient_raw`, `ambient_derived`, `circulation`, `lights`, `energy_costs`, `ph_dosing_training`, `calibrations`

**Cron example (every hour):**
```
0 * * * * /usr/bin/python3 /home/argonaut-dev/scripts/sync_ambient.py >> /home/argonaut-dev/logs/sync.log 2>&1
```

**Environment variables** (or set in a `.env` file next to the script):

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Service role key (bypasses RLS) |
| `ARGONAUT_DB` | Path to SQLite database (default: `/var/lib/argonaut/argonaut.db`) |
| `SYNC_TABLES` | Comma-separated list of tables to sync (default: all tables above) |

### `test_data/upload_to_supabase.py` — bulk upload (dev/test use)

A one-shot utility for seeding or resetting Supabase from a local copy of `argonaut.db`. Unlike the sync script, it uploads all rows unconditionally with no `synced_at` tracking. Reads credentials from `dashboard/.env` automatically when run from the repo.

```bash
python test_data/upload_to_supabase.py           # upload all rows
python test_data/upload_to_supabase.py --clear   # wipe Supabase first, then upload
```

The `--clear` flag deletes tables in reverse order (children before parents) to respect foreign key constraints before re-uploading. It also injects a default `device_id` for older test data that pre-dates schema v2.

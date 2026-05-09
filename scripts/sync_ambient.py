#!/usr/bin/env python3
"""
Sync unsynced rows from SQLite → Supabase for one or more tables.
Designed to run as a cron job on the Argonaut Pi.

Cron example (every hour):
    0 * * * * /usr/bin/python3 /home/argonaut-dev/scripts/sync_ambient.py >> /home/argonaut-dev/logs/sync.log 2>&1

Environment variables (or set in a .env file):
    SUPABASE_URL        Supabase project URL
    SUPABASE_KEY        Service role key (bypasses RLS)
    ARGONAUT_DB         Path to SQLite database (default: /var/lib/argonaut/argonaut.db)
    SYNC_TABLES         Comma-separated list of tables to sync (default: all below)
    DOTENV_PATH         Path to .env file (default: same directory as this script)

Exit codes:
    0  success (including "nothing to sync")
    1  one or more tables failed
"""
import json
import logging
import os
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

DB_PATH     = Path(os.environ.get("ARGONAUT_DB", "/var/lib/argonaut/argonaut.db"))
DOTENV_PATH = Path(os.environ.get("DOTENV_PATH", Path(__file__).parent / ".env"))
BATCH_SIZE  = 200

DEFAULT_TABLES = [
    "trials",
    "ambient_raw",
    "ambient_derived",
    "circulation",
    "lights",
    "energy_costs",
    "ph_dosing_training",
    "calibrations",
]

SKIP_COLS = {"id", "synced_at"}

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger(__name__)

# ── Credentials ───────────────────────────────────────────────────────────────

def _load_dotenv(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    if not path.exists():
        return result
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip()
    return result

_env = _load_dotenv(DOTENV_PATH)
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or _env.get("SUPABASE_URL") or _env.get("VITE_SUPABASE_URL", "")).rstrip("/")
SUPABASE_KEY = (
    os.environ.get("SUPABASE_KEY")
    or _env.get("SUPABASE_KEY")
    or _env.get("SUPABASE_SERVICE_KEY")
    or _env.get("VITE_SUPABASE_ANON_KEY", "")
)

# ── Supabase ──────────────────────────────────────────────────────────────────

def _upsert(table: str, rows: list[dict]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict=uuid"
    req = urllib.request.Request(
        url,
        data=json.dumps(rows).encode(),
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req):
            pass
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} — {body}") from e

# ── SQLite ────────────────────────────────────────────────────────────────────

def _mark_synced(con: sqlite3.Connection, table: str, ids: list[int]) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")
    con.executemany(
        f"UPDATE {table} SET synced_at = ? WHERE id = ?",
        [(now, row_id) for row_id in ids],
    )
    con.commit()


def _sync_table(con: sqlite3.Connection, table: str) -> int:
    try:
        cur = con.execute(
            f"SELECT * FROM {table} WHERE synced_at IS NULL ORDER BY rowid"
        )
    except sqlite3.OperationalError:
        log.info("%s: not in SQLite, skipping", table)
        return 0

    col_names = [d[0].lower() for d in cur.description]
    id_idx    = [d[0] for d in cur.description].index("id")

    batch: list[dict] = []
    batch_ids: list[int] = []
    total = 0

    for raw_row in cur:
        row = {col: val for col, val in zip(col_names, raw_row) if col not in SKIP_COLS}
        batch.append(row)
        batch_ids.append(raw_row[id_idx])

        if len(batch) >= BATCH_SIZE:
            _upsert(table, batch)
            _mark_synced(con, table, batch_ids)
            total += len(batch)
            batch, batch_ids = [], []

    if batch:
        _upsert(table, batch)
        _mark_synced(con, table, batch_ids)
        total += len(batch)

    return total

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL / SUPABASE_KEY not configured")
        return 1

    if not DB_PATH.exists():
        log.error("Database not found: %s", DB_PATH)
        return 1

    raw = os.environ.get("SYNC_TABLES", "")
    tables = [t.strip() for t in raw.split(",") if t.strip()] if raw else DEFAULT_TABLES

    try:
        con = sqlite3.connect(str(DB_PATH))
    except sqlite3.Error as e:
        log.error("Cannot open database: %s", e)
        return 1

    failed = False
    try:
        for table in tables:
            try:
                n = _sync_table(con, table)
                if n:
                    log.info("%s: %d rows uploaded", table, n)
                else:
                    log.info("%s: nothing to sync", table)
            except Exception as e:
                log.error("%s: %s", table, e)
                failed = True
    finally:
        con.close()

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

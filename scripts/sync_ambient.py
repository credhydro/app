#!/usr/bin/env python3
"""
Sync unsynced ambient_raw rows from SQLite → Supabase.
Designed to run as a cron job on the Argonaut Pi.

Cron example (every 30 min, matching the sensor write cadence):
    */30 * * * * /usr/bin/python3 /home/jadelaars/Desktop/Argonaut/scripts/sync_ambient.py >> /var/log/argonaut_sync.log 2>&1

Environment variables (or set in a .env file):
    SUPABASE_URL        Supabase project URL
    SUPABASE_KEY        Service role key (bypasses RLS)
    ARGONAUT_DB         Path to SQLite database (default: /var/lib/argonaut/argonaut.db)
    DOTENV_PATH         Path to .env file (default: same directory as this script)

Exit codes:
    0  success (including "nothing to sync")
    1  error
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

DB_PATH = Path(os.environ.get("ARGONAUT_DB", "/var/lib/argonaut/argonaut.db"))
DOTENV_PATH = Path(os.environ.get("DOTENV_PATH", Path(__file__).parent / ".env"))
BATCH_SIZE = 200
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
    or _env.get("SUPABASE_SERVICE_KEY")
    or _env.get("VITE_SUPABASE_ANON_KEY", "")
)

# ── Supabase ──────────────────────────────────────────────────────────────────

def _upsert_batch(rows: list[dict]) -> None:
    """POST rows to Supabase; existing UUIDs are silently skipped."""
    url = f"{SUPABASE_URL}/rest/v1/ambient_raw"
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

def _mark_synced(con: sqlite3.Connection, ids: list[int]) -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")
    con.executemany(
        "UPDATE ambient_raw SET synced_at = ? WHERE id = ?",
        [(now, row_id) for row_id in ids],
    )
    con.commit()

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL / SUPABASE_KEY not configured")
        return 1

    if not DB_PATH.exists():
        log.error("Database not found: %s", DB_PATH)
        return 1

    try:
        con = sqlite3.connect(str(DB_PATH))
    except sqlite3.Error as e:
        log.error("Cannot open database: %s", e)
        return 1

    try:
        cur = con.execute(
            "SELECT * FROM ambient_raw WHERE synced_at IS NULL ORDER BY datetime_utc"
        )
        col_names = [d[0].lower() for d in cur.description]
        id_idx = [d[0] for d in cur.description].index("id")

        batch: list[dict] = []
        batch_ids: list[int] = []
        total = 0

        for raw_row in cur:
            row = {col: val for col, val in zip(col_names, raw_row) if col not in SKIP_COLS}
            batch.append(row)
            batch_ids.append(raw_row[id_idx])

            if len(batch) >= BATCH_SIZE:
                _upsert_batch(batch)
                _mark_synced(con, batch_ids)
                total += len(batch)
                log.info("Uploaded %d rows (running total: %d)", len(batch), total)
                batch, batch_ids = [], []

        if batch:
            _upsert_batch(batch)
            _mark_synced(con, batch_ids)
            total += len(batch)

        if total:
            log.info("Sync complete — %d rows uploaded", total)
        else:
            log.info("Nothing to sync")

        return 0

    except Exception as e:
        log.error("Sync failed: %s", e)
        return 1
    finally:
        con.close()


if __name__ == "__main__":
    sys.exit(main())

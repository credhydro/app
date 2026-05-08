#!/usr/bin/env python3
"""
Upload all data from argonaut.db (SQLite) to Supabase.
No pip dependencies — stdlib only (sqlite3, uuid, json, urllib).

Usage:
    python test_data/upload_to_supabase.py           # upload
    python test_data/upload_to_supabase.py --clear   # delete all rows first, then upload

Reads credentials from dashboard/.env automatically.
Override by setting SUPABASE_URL and SUPABASE_KEY env vars.
"""
import json
import os
import sqlite3
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

# ── Credentials ──────────────────────────────────────────────────────────────

def _load_dotenv() -> dict[str, str]:
    env_path = Path(__file__).parent.parent / "dashboard" / ".env"
    result: dict[str, str] = {}
    if not env_path.exists():
        return result
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            result[k.strip()] = v.strip()
    return result

_env = _load_dotenv()
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or _env.get("VITE_SUPABASE_URL", "")).rstrip("/")
# Prefer the service role key (bypasses RLS); fall back to anon key for read-only ops.
SUPABASE_KEY = (
    os.environ.get("SUPABASE_KEY")
    or _env.get("SUPABASE_SERVICE_KEY")
    or _env.get("VITE_SUPABASE_ANON_KEY", "")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit(
        "Credentials missing.\n"
        "Add SUPABASE_SERVICE_KEY to dashboard/.env or set SUPABASE_KEY env var."
    )

# ── Config ────────────────────────────────────────────────────────────────────

DB_PATH = Path(__file__).parent / "argonaut.db"
BATCH_SIZE = 200

# Upload order matters: trials must precede tables that reference it.
TABLES = [
    "trials",
    "ambient_raw",
    "ambient_derived",
    "circulation",
    "fan",
    "lights",
    "energy_costs",
    "ph_dosing_training",
    "dosing_events",
    "calibrations",
]

# Columns that exist in SQLite but not in Supabase.
SKIP_COLS = {"id", "synced_at"}

# Default values injected when a column is required in Supabase but absent
# in older SQLite exports (e.g. test data pre-dating schema v2).
COL_DEFAULTS = {"device_id": "arg-02"}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _delete_all(table: str) -> None:
    """Delete every row in a Supabase table (requires a filter, so we match all UUIDs)."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?uuid=not.is.null"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
        method="DELETE",
    )
    try:
        with urllib.request.urlopen(req):
            pass
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"{table}: HTTP {e.code} — {body}") from e
    print(f"  cleared {table}")


def _post(table: str, rows: list[dict]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    payload = json.dumps(rows).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status not in (200, 201):
                raise RuntimeError(f"HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"{table}: HTTP {e.code} — {body}") from e


def _upload_table(con: sqlite3.Connection, table: str, valid_trials: set[str]) -> None:
    cur = con.execute(f"SELECT * FROM {table}")  # noqa: S608 (local read-only db)
    cols = [d[0].lower() for d in cur.description]  # normalise case (e.g. airtemp_C → airtemp_c)
    has_trial_fk = "trial_name" in cols and table != "trials"

    batch: list[dict] = []
    total = 0

    for raw_row in cur:
        row = {col: val for col, val in zip(cols, raw_row) if col not in SKIP_COLS}
        if has_trial_fk and row.get("trial_name") not in valid_trials:
            continue
        if table != "trials":
            for col, default in COL_DEFAULTS.items():
                row.setdefault(col, default)
        row["uuid"] = str(uuid.uuid4())
        batch.append(row)

        if len(batch) >= BATCH_SIZE:
            _post(table, batch)
            total += len(batch)
            batch = []
            print(f"  {table}: {total} rows …")

    if batch:
        _post(table, batch)
        total += len(batch)

    print(f"  {table}: {total} rows done")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    clear = "--clear" in sys.argv

    if clear:
        print(f"Clearing {SUPABASE_URL} …\n")
        for table in reversed(TABLES):  # children before parents
            _delete_all(table)
        print()

    if not DB_PATH.exists():
        raise SystemExit(f"Database not found: {DB_PATH}")

    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    try:
        print(f"Source : {DB_PATH}")
        print(f"Target : {SUPABASE_URL}\n")
        valid_trials = {r[0] for r in con.execute("SELECT trial_name FROM trials")}
        for table in TABLES:
            _upload_table(con, table, valid_trials)
    finally:
        con.close()

    print("\nUpload complete.")


if __name__ == "__main__":
    main()

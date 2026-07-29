# Lights → `commands` table reference (as implemented)

**Scope:** this documents what the dashboard *actually writes* to Supabase `commands`
today. The Lights tab is currently the only page wired to `sendCommand` — Pump, Fan,
Other, and pH Dosing are described in `argonaut_ui_command_spec.md` but have no UI yet,
so their commands don't appear here.

Source: [`dashboard/src/pages/LightsPage.tsx`](../dashboard/src/pages/LightsPage.tsx)
via [`dashboard/src/lib/commands.ts`](../dashboard/src/lib/commands.ts).

---

## Columns the dashboard sets on every insert

`sendCommand(deviceId, command, params, trialName)` inserts exactly these fields —
everything else (`created_at`, and any pickup/execution/result columns) is left for
Supabase defaults or the Pi-side consumer to fill in:

| Column | Value | Notes |
|---|---|---|
| `device_id` | `selectedDevice` from `AuthContext` | Never null — both call sites guard on `if (!selectedDevice) return` before sending |
| `command` | see table below | |
| `params` | see table below | `null` when the command takes no arguments |
| `trial_name` | `selectedTrial` from `AuthContext`, or `null` | `null` when the sidebar trial picker is set to "All trials" — this is a normal, expected value, not an error state |
| `status` | `'pending'`, always | ⚠️ Caveat carried over from the earlier repo review: the checked-in `sql/supabase_schema.sql` has no `status` column on `commands` (it uses `picked_up_at`/`executed_at` instead). The code assumes the design spec's `status` column exists in the live Supabase schema. Verify against the actual live schema before relying on this table for anything status-related. |

---

## Command → params reference

| UI action | `commands.command` | `commands.params` | Trigger |
|---|---|---|---|
| Click **On** | `"lights_on"` | `null` | `handleMode('on')` — manual override, lights stay on regardless of schedule |
| Click **Off** | `"lights_off"` | `null` | `handleMode('off')` — manual override, lights stay off regardless of schedule |
| Click **Auto (schedule)** | `"lights_auto"` | `null` | `handleMode('auto')` — per design spec, clears the manual override and resumes the saved schedule |
| Click **Save Schedule** | `"set_lights_schedule"` | `{"lights_on_hours": [<int 0-23>, ...]}` | `handleSaveSchedule()` — array is deduplicated (toggle can't add a repeat) and sorted ascending before sending |

### Example rows

```json
// Grower taps "Off"
{
  "device_id": "arg-02",
  "command": "lights_off",
  "params": null,
  "trial_name": "trial_003",
  "status": "pending"
}

// Grower saves a 5am–9pm-ish custom schedule, no active trial selected
{
  "device_id": "arg-02",
  "command": "set_lights_schedule",
  "params": { "lights_on_hours": [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
  "trial_name": null,
  "status": "pending"
}
```

### `lights_on_hours` shape notes

- Integers `0`–`23`, one per on-hour, in the array — not ranges, not booleans-per-hour.
- Deduplicated and sorted ascending by the UI before sending (`LightsPage.tsx`'s
  `handleSaveSchedule`), so the Pi never receives duplicate or out-of-order hours.
- **No client-side minimum:** the UI lets a grower uncheck every hour and save,
  producing `"lights_on_hours": []`. The design spec says "Pi validates: integers
  0–23, no duplicates, at least 1 hour" — that minimum-1-hour check is not enforced
  in the dashboard and must exist Pi-side, or an empty schedule can currently be sent.

---

## Not covered here (design spec only, not yet built)

`pump_*`, `fan_*`, `other_*`, `set_ph_target`, `dose_ph_down`, `set_doser_*`,
`start_trial`, `register_harvest` — see `argonaut_ui_command_spec.md`'s Command
Summary table. None of these are emitted by any current page in `dashboard/src/pages`.

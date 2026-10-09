# CredHydro Dashboard

Web dashboard for the CredHydro hydroponic monitoring platform. Built with
React 18, TypeScript, Vite and Tailwind CSS; reads data through the Supabase
JS client. Deployed to GitHub Pages on every push to `main`
(`.github/workflows/deploy.yml`).

## Pages

- **Home** -- at-a-glance gauge cards (pH, EC, VPD, DLI, photosynthetic rate,
  running cost) and a 48-hour equipment timeline.
- **Lights** -- manual and scheduled lighting controls.
- **pH Dosing** -- target pH range and auto-doser toggles.
- **Growth Photos** -- upload a plant photo and view the returned canopy analysis.

Data refreshes every 5 minutes. Desktop uses a fixed sidebar; mobile uses a
top header and tab bar.

## Running locally

```bash
cd dashboard
cp .env.example .env        # fill in your Supabase URL and anon key
npm install
npm run dev                 # http://localhost:5173
```

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |

## Build

```bash
npm run build   # output in dashboard/dist/
```

Backend schema, migrations and device-side code are maintained privately.

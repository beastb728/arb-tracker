# Arb Bankroll Tracker

Tracks how much crypto sits in each betting account, works out arbitrage stakes for each match, and plans which transfers and bets to make (earliest match first).

- `index.html` – the whole app (Money, Matches, Planner tabs)
- `api/state.js` – Vercel function that stores the shared data in Upstash Redis behind a password

## Deploy on Vercel

1. Import this repo in Vercel (framework preset: **Other**, no build command).
2. In the project, go to **Storage** and add **Upstash Redis** (free). It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. In **Settings → Environment Variables**, add `APP_PASSWORD` with the password everyone will type.
4. Redeploy. Open the site, enter the password once per device.

Opened as a local file, the app saves in that browser only.

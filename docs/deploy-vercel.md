# Rohi Travels — Move Hosting to Vercel (Keep Everything Else)
**Written:** 18 Oct 2026 · Repo: `rohitravelsryk-git/rohitravels-com` · Branch: `main`

## What does NOT change (verified against the repo)
| Item | Why it stays |
|---|---|
| Database & all its settings | The app talks to the Lovable Cloud database via URL + keys; the database itself never moves in this phase |
| Admin login & users | Auth data lives in that same database |
| RLS / security rules | Same database, same policies |
| Google Sheets mirrors | Server functions call Sheets with the same service-account JSON |
| Repository | Same repo, same `main` branch, same commit history |
| Rollback | Revert the DNS record — the Lovable version can serve again |

## What changes
- The site is **served by Vercel** (free Hobby tier) instead of Lovable hosting.
- **Every push to `main` auto-deploys to Vercel** — that is how you see and verify changes: open the deployment URL (or the domain after cutover) right after a push, and see each commit listed in the Vercel dashboard. No Lovable publish button is ever pressed again.
- Secrets live in Vercel's project settings (Environment Variables), never in code or chat.

## The one thing to verify after the first deploy
**Email** is sent through Lovable's email API (`sendLovableEmail` uses `LOVABLE_API_KEY`). After deploying, send one test email. If it fails from Vercel, the fallback is a small GitHub change to send via Resend/SMTP instead — nothing else is affected.

## Credit reality (honest version)
- After cutover: hosting/compute for serving the site on Lovable's side stops; build/publish credits stop (nothing is ever built or published in Lovable).
- The **database keeps running on Lovable Cloud** and keeps its small runtime metering (the Database part of your screenshot) while it stays there. True zero comes later, optionally, by moving the database to your own Supabase project (zero-loss export/import — separate plan, already written).

## Steps

### 1. Import the repo into Vercel (you do this, ~10 minutes)
1. Create a free account at vercel.com (sign in with GitHub).
2. Add New → Project → Import `rohitravelsryk-git/rohitravels-com`.
3. Build settings: Framework Preset **Other** (or Vite), Build Command `vite build`, Install Command `npm ci`.
4. Before the first build, add the environment variables below.

### 2. Environment variables (in Vercel → Project → Settings → Environment Variables)
Copy the values from the Lovable project's Cloud settings (Cloud tab / connection details). **Never paste them into chat or code.**

| Variable | Notes |
|---|---|
| `VITE_SUPABASE_URL` | From Cloud settings |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | From Cloud settings |
| `SUPABASE_URL` | Same URL, server side |
| `SUPABASE_SECRET_KEY` | Server secret key (legacy name: `SUPABASE_SERVICE_ROLE_KEY`) |
| `SESSION_SECRET` | Any long random string (generate a new one) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The same service-account JSON the Sheets sync uses |
| `ROHI_FINANCIAL_BACKUP_SHEET_ID` | Backup workbook ID |
| `GOOGLE_SHEETS_API_KEY` | If used |
| `LOVABLE_API_KEY` | Only if email keeps working externally (see email note) |
| `SKIP_LOVABLE_MCP_PLUGIN` | `1` (the MCP routes are already committed; this skips the Lovable-only build plugin) |
| `NITRO_PRESET` | `vercel` (the Lovable build config defaults to a cloudflare target; this retargets the build to Vercel) |

### 3. First deploy & test checklist (on the `*.vercel.app` URL — the live site is untouched)
- [ ] Homepage loads with the Warm Clay design
- [ ] `/admin` login works with an existing admin account → proves database + auth are intact
- [ ] Airline Accounts opens; add a test entry → it appears in agent ledger AND the Google Sheets mirror
- [ ] Delete the test entry → mirrors update correctly
- [ ] Send one test email (only if email features are in use)
- [ ] Balances Overview / reconciliation pages load without timeouts

### 4. Domain cutover (only after the checklist passes)
1. In Vercel → Project → Domains → add `rohitravels.com` and `www.rohitravels.com`.
2. At name.com: point `rohitravels.com` A record `185.158.133.1` → `76.76.21.21`, and `www` CNAME → `cname.vercel-dns.com`. SSL is automatic on Vercel.
3. Rollback any time: change the records back.

### 5. Decommission the Lovable side (after 1–2 verified days)
1. In "MY Final Project": Project settings → Git → **Disconnect Git sync** (stops Lovable-side sync work on every push).
2. Never press Publish there again; optionally take its published site offline after cutover.
3. Later, optionally: move the database to your own Supabase project (zero-loss plan) → then the Lovable project can be archived/deleted → true zero credits.

## Corrections to two ideas from the discussion
1. **"Later reconnect GitHub into Lovable to see live changes"** — that direction doesn't exist: Lovable's Git sync always creates a *new* private repository and cannot attach to an existing one. Live changes will be visible on Vercel instead (deployment list + the live URL), which serves the same purpose.
2. **Using this workspace's Lovable credits (option 1)** — not needed on this path: everything here runs free through GitHub and Vercel. Also, a Lovable project in this workspace would be a separate copy that diverges from the live app, so it's the wrong tool anyway.

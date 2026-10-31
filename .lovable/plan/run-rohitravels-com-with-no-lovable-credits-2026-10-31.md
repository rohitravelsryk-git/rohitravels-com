# Run rohitravels.com with no Lovable credits

## The honest limit
Lovable can't host a live site with a working database for free. The database running time and serving the site always use credits. To get to zero Lovable credits, the site has to run **outside Lovable**, on free hosting that you own. Your GitHub repo (rohitravelsryk-git/rohitravels-com) already has all the code, so this is possible.

## Target setup (free tiers)
```text
GitHub (main)  --push-->  Cloudflare Pages/Workers (free)  -->  rohitravels.com
                                   |
                                   v
                     Your own Supabase project (free tier)
```
- **Website:** Cloudflare (free plan). It rebuilds by itself whenever you push to GitHub, so updates are easy and cost nothing.
- **Database, logins, file uploads:** your own free Supabase account under rohitravelsryk@gmail.com.
- **Lovable:** used only when you choose. With no messages, it uses no credits.

## Steps (done by you or a developer, not by Lovable AI)
1. **Back up everything first.** Export all data (More > Database > Manage > Settings > Export data) and download uploaded files (payment slips, passports, tickets). Keep the Google Sheets backups.
2. **Create a free Supabase project.** Run the files in `supabase/migrations/` in date order, then import the exported data. Copy the uploaded files into the matching storage buckets.
3. **Move logins.** Agents and admins set a new password the first time they sign in, or you send them reset emails.
4. **Create a Cloudflare account** and connect the GitHub repo. Set these values: the new database address, the public key, the private service key (server only), the Google Sheets keys and the email sending key.
5. **Email:** Lovable's built-in email sending doesn't come along. Use the free tier of a mail service like Resend for OTP and booking emails.
6. **Test the new address** (e.g. `rohitravels.pages.dev`): fares, bookings, agent portal, Airline Accounts and the Accounts Book.
7. **Switch the domain.** Point rohitravels.com's DNS to Cloudflare and remove it from Lovable.
8. **Shut down Lovable Cloud.** Pause the old backend, and only after a week of checking that everything works on the new setup.

## Trade-offs
- Free Supabase **pauses after 7 days with no activity**. Real visitors keep it awake. A free outside ping service can also keep it awake.
- Free limits: 500 MB of data and 1 GB of files. Watch the usage.
- Some features are built for Lovable and need small code changes before they work elsewhere: AI features, Lovable email sending and the Lovable connectors for Google Sheets.

## Technical notes
- The app is TanStack Start and already targets Cloudflare Workers, so `wrangler` deployment fits.
- Replace connector-gateway calls (Google Sheets) with a Google service account or OAuth credentials.
- Replace Lovable email and the AI Gateway with direct provider keys, or turn those features off.
- Per your rule, none of this will be done in Lovable unless you write "approved build". I can write a detailed step-by-step migration checklist for your developer if you want one.

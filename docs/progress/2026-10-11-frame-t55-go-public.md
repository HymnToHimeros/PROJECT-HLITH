2026-10-11 · **FRAME: ready to go public (T55, with T11)** (branch `frame/go-public`).
Public pages that open without signing in, as plain HTML built from one text source
(`config/legal/content.ts`): /about (the homepage description), /privacy and /terms, written
against what the code really does (data kept in London, UK; Supabase, Cloudflare, Google/Discord,
HoYoverse and Anthropic only for the features you use; no cookies, ads or tracking; 30-day deletion
grace; 30-day backups; UK/EU GDPR rights; `[CONTACT EMAIL]` for the owner to fill in). The sign-in
screen describes HLITH and links to all three with the fan notice; so does every Account section.
T11: a daily job (`purge-accounts`, migration 0013) finishes deletions after the grace period
(rows, pictures, saved HoYoLAB logins, the sign-in) and removes nightly backups older than 30 days;
tested in a local database. Also fixed: the Assistant key no longer goes into backup files.
Screenshots: `docs/owner-reports/2026-10-11/go-public/`.
Sign-in: Discord is open to everyone and first; Google and the email link are greyed out ("Not
open to the public yet. Sign in with Discord."), and "Owner or tester? Use Google or email" unlocks
them on that device. Supabase's Discord sign-in always asks for identify + email and needs the
email, so it can't be dropped; the policy says exactly what Discord gives us.
Left for the owner: fill in [CONTACT EMAIL]; in Google Cloud, set the homepage, privacy and terms
links on the OAuth consent screen and publish the app.

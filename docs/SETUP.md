# PROJECT-HLITH · SETUP

What you set up outside the code, in order. Values marked **public** may be
pasted in chat or committed; values marked **secret** never leave the
dashboard they come from.

## 1. Supabase (database, login, server functions) · free plan
1. supabase.com → **Start your project** → sign in with GitHub.
2. **New project**: name `PROJECT-HLITH`, generate a database password and keep
   it in a password manager (**secret**), pick the region nearest you, plan **Free**.
3. When it's ready: **Connect** (or Project Settings → API). Copy:
   - **Project URL** (**public**), e.g. `https://abcd1234.supabase.co`
   - **Publishable / anon key** (**public**)
   - Never copy out the **service_role / secret** key (**secret**).
4. Tables are created automatically: Project Settings → **Integrations** →
   GitHub → repository `HymnToHimeros/PROJECT-HLITH`, working directory `.`,
   **Deploy to production** on, branch `main` → Enable integration. Every merge
   to main then applies new files in `supabase/migrations/`. Do **not** also paste
   them in the SQL Editor, or they run twice. (Enabled 2026-10-09.)
5. Make yourself owner (after your first sign-in): **Table Editor** → `owners`
   → Insert row → your `user_id` from **Authentication → Users**.

Free-plan notes: the project pauses after 7 days with no visits (open the app
once a week, or move to Pro, $25/month); no automatic backups (ROADMAP R24).

## 2. Login providers
Both need the callback address: `https://<your-project>.supabase.co/auth/v1/callback`.

**Discord** (done 2026-10-09) · discord.com/developers/applications → New Application → OAuth2:
- Add redirect: the callback address above.
- Copy **Client ID** (**public**) and **Client Secret** (**secret**).
- Supabase → Authentication → Sign In / Providers → Discord → paste both → Enable.

**Google** · console.cloud.google.com → new project → APIs & Services:
- OAuth consent screen: External, app name `HLITH`, your email.
- Credentials → Create OAuth client ID → Web application → Authorized redirect
  URI: the callback address above.
- Copy **Client ID** (**public**) and **Client Secret** (**secret**).
- Supabase → Authentication → Sign In / Providers → Google → paste both → Enable.

**Email links** work out of the box for testing (Supabase's own mailer is
limited to a few emails an hour). Before real users: Resend (section 4).

Supabase → Authentication → URL Configuration (done 2026-10-09): **Site URL**
`https://project-hlith.hliskjlf.workers.dev`, **Redirect URLs**
`https://project-hlith.hliskjlf.workers.dev/**`. Without this, sign-in returns
to `localhost` and fails.

## 3. Connect the app (done 2026-10-09)
The live project's two public values are in `config/.env.production`:
project `qywvnvwfsknfcxgpbivo`, URL `https://qywvnvwfsknfcxgpbivo.supabase.co`.
Builds use them; unit and browser tests run without them ("this device only"
mode). Tables checked live: all 10 exist, and writes without sign-in are refused.

## 4. Later
- **Resend** (sign-in emails at scale): resend.com → API key (**secret**) →
  Supabase → Authentication → Emails → SMTP settings.
- **Cloudflare R2** (backups, R24).

## 5. Hosting · Cloudflare (set up 2026-10-09)
Cloudflare dashboard → Create app → Connect GitHub → `PROJECT-HLITH`.
Project name `project-hlith`, build command `npm run build`, deploy command
`npx wrangler deploy`, preview builds on. `wrangler.jsonc` in the repo tells
Cloudflare to serve `./dist` and send unknown addresses to the app.
Every merge to `main` redeploys the site.

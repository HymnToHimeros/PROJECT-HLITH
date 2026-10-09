# PROJECT-HLITH · DEPLOY

**Live:** https://project-hlith.hliskjlf.workers.dev (since 2026-10-09)

## How a change goes live
1. A pull request merges into `main`.
2. **Cloudflare** (Workers with static assets, project `project-hlith`) builds it with
   `npm run build` and publishes `./dist` via `npx wrangler deploy` (`wrangler.jsonc`).
   Pull requests also get a test copy at `https://<version>-project-hlith.hliskjlf.workers.dev`.
3. **Supabase** (project `qywvnvwfsknfcxgpbivo`) applies any new file in
   `supabase/migrations/` through its GitHub integration.

## Settings that live outside the code
| Where | Setting | Value |
|---|---|---|
| Cloudflare → Workers & Pages | workers.dev subdomain | `hliskjlf` |
| Cloudflare → project-hlith | build / deploy | `npm run build` / `npx wrangler deploy`, preview builds on |
| Supabase → Auth → URL Configuration | Site URL | `https://project-hlith.hliskjlf.workers.dev` |
| Supabase → Auth → URL Configuration | Redirect URLs | `https://project-hlith.hliskjlf.workers.dev/**` |
| Supabase → Auth → Providers | Discord | on (app "HLITH" in the Discord developer portal) |
| Supabase → Auth → Providers | Email link | on (built-in mailer: a few emails per hour) |
| Supabase → Auth → Providers | Google | not set up yet |

If the address changes (new subdomain or own domain), update the Site URL and
Redirect URLs in Supabase, or sign-in sends people to the wrong place.

# FRAME — T79: GitHub tidy round 2 and a showcase README

- **Root tidy:** the app's page moved from the root to `src/index.html`. Vite now uses `src/` as
  its root, with `public/` and the `dist/` output where they were, and the tests keep running
  from the project root. Check, build and all 178 browser tests pass.
- **Kept in the root on purpose:**
  - `package.json`, `package-lock.json`, `LICENSE`, `README.md`, `.gitignore`, `.gitattributes`
    and `CLAUDE.md`: these must stay.
  - `tsconfig.json`: editors look for it next to the code to type-check `src/`, so moving it
    would break type checking in every editor.
  - `wrangler.jsonc`: Cloudflare's deploy reads it from the root, and moving it can't be
    proven safe without changing the live deploy settings.
- **README rewritten as a showcase:**
  - The opening: the Hagalaz mark, the name and its story, an animated tour, and contents links.
  - A feature tour with real screenshots of every module at PC width and four at phone width.
  - "How it keeps itself current": a diagram of the data refresh and the leak finder, ending
    in a findings inbox that Himeros verifies.
  - Theorycraft, with the "far from perfect" note.
  - Themes, plus the owner's looks, badges, frames and names as small animations, labelled
    "not publicly available yet".
  - Ambitions, how it's built, run it locally, credits.
- **Pictures:** new pictures are WebP files in `docs/screenshots/` (about 3.4 MB in all). The
  old README pictures moved to `docs/screenshots/archive/`.
  - The app screens come from the app in "this device only" mode, with its labelled example data.
  - The owner looks come from the private T74 clips (rendered images only; no pack, manifest or
    drawing source).
  - The badges, frames and names were rendered from the app's own drawings on a temporary
    page, which is not committed.
- The owner's OK on the owner-look images is needed before merge (via MANAGER).

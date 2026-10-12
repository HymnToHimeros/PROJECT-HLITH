# 2026-10-12 · ERROR-FIX · T75 owner theme Remove seemed to do nothing (branch errorfix/t75-owner-theme-remove)

- Cause: Remove did save (manifest.json on the server was the empty list), but every read of the list went through the browser/CDN cache, so the console list and Account → Theme kept showing the old copy. The console's own reads before an edit (Undo, Add, pictures) could also start from that old copy.
- Fix: the owner themes list and packs (JSON) are always read fresh (a new cache nonce and `no-store` each time); pictures keep their cache (each upload has a new name). After any save, the list and the picker update straight away; a worn theme that was removed already falls back (stopWearing).
- Test: a storage client that caches like a browser; Remove takes the theme out of the console and Account → Theme without a reload, Undo brings it back, and every list read asks the server. It fails on the old code.
- Drafts table not touched.

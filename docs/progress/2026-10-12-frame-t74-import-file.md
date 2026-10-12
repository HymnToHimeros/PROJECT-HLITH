# FRAME — T74: "Add from a file" for the set themes

- Owner console → Owner themes gets an **Add from a file** button next to "Add the set themes".
- It reads a set-themes file (a JSON list of looks, or `{ "themes": [...] }`) and does exactly what
  "Add the set themes" does: each look's pictures go to their own file in the private store, set
  looks added before are brought up to date (your picture kept), your own themes are never touched,
  and the first ten set themes (retired) never come back.
- A bad file (not JSON, no list, a look without an id) adds nothing and says why.
- Why: loading the 40 new looks into `owner_theme_drafts` one SQL call at a time stopped working
  part-way (25 of 40 are in). The file route needs no SQL and no database change.
- The file itself is private: it is sent to the owner as a private download, never put in the repo
  or the app.
- Tests: `OwnerThemesAdmin.test.tsx` covers the file route, bad files and the retired ids.

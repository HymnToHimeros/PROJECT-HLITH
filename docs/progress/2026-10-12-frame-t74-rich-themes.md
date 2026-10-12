# 2026-10-12 · FRAME · T74 redo: set themes that dress the whole app

Owner: the set themes were "minimalistic … less than the public Themes". Redo: each one a full look.

- Skins (src/core/theme/skin.ts, skins.css): a theme picks, from fixed lists with neutral names,
  its card shape, inner edge and surface, sidebar and header style, heading treatment and font
  (10 fonts, loaded only when worn), button, chip and progress-bar style, and layout feel. The
  app's cards, buttons, chips, bars, sidebar, header and title get stable hooks (hlith-card, …)
  through CSS `composes`, so no component changed.
- Packs (skinPack.ts): one private JSON per theme holds its drawings: background scene layers
  (inline, moving with generic sk-… motion that follows Animations), card frame (border-image),
  corner ornaments (one drawing turned four ways), sidebar watermark, header art, title flourish,
  card-heading divider and the active-page marker. Loaded only while the theme is worn.
- Every drawing goes through svgClean.ts first: an allowlist of drawing elements and attributes;
  no scripts, handlers, links, styles, foreign content or animation elements; ids prefixed.
- "Add the set themes" never adds the first ten set themes again (retired, known by fingerprint), uploads each draft's pack to the private store and brings set themes
  added before up to date (keeping the owner's picture); the owner's own themes stay untouched.
- The ten themes themselves (art, names, colours) live only in the owner-only drafts, never here.
  Review screenshots and motion clips: a private claude.ai page sent to MANAGER.
- Not merged until the owner says yes.

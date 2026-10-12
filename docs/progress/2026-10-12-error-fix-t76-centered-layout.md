# 2026-10-12 · ERROR-FIX · T76 "HSR stuff gets centred" (branch errorfix/t76-hsr-centered)

- Cause: a theme look with layout "centered" (skins.css, T74) capped every block of the page at 1180px and centred it on screens 1100px and wider: a wide empty band beside the sidebar, the page header moved off the content's edge, and a taller page. Not game-specific: ZZZ does the same with that look; HSR showed it because that's where the owner wore it.
- The line across the background in the owner's screenshot: the theme backgrounds are fixed to the window, so a full-page capture draws them only once, a window high. While scrolling there is no seam (checked at 1945 × 1050).
- Fix: "centered" now lays out like "standard"; the value stays valid. A look never changes the page's width or position.
- Tests: skins.css has no width, max-width or auto margins on page blocks (unit); at 1945 px wide, every layout keeps the header at the content edge and full width (browser). Both fail on the old CSS.

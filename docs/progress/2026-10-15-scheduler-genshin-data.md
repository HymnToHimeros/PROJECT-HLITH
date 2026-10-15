# 2026-10-15 · SCHEDULER · Genshin Impact data (G2)

- Done: src/games/genshin/data, before FRAME's contract, game id `genshin`.
  - Characters and weapons from nanoka.cc (`npm run data:nanoka`): 136 characters, 5★ top / 4★ mid.
    - The 2 leaks from build 7.1.53 (Mitya, Valeriy) are marked as leaks.
    - The Traveler is listed per element. Mannequins and placeholders are left out.
    - 242 weapons, 5/4/3★.
  - Versions, wishes, events and endgame (`npm run data:genshin-schedule`):
    - 46 versions with official starts from the update notices; "Luna I–VIII" = 6.0–6.7.
    - 14 wishes: character, character-2, weapon, standard, beginner, with chronicled supported. Current periods come from the in-game notices (server time).
    - 31 events with Primogems from the wiki, including Spiral Abyss (800), Imaginarium Theater (reward unknown) and Stygian Onslaught (450) as endgame.
- Rhythm: genshin offsets learned from the Special Program posts.
- The data refresh runs the schedule import once the contract exists.
- Left out honestly: events without an end, and versions whose neighbour's notice has no update time. Unknown rewards stay null.

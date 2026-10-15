# 2026-10-15 · LOGIC-CORE · Endfield Planner pass

Done:
- Pulls → Planner now reads which 6★ results were the featured operator. Before, it read the raw
  history (Endfield pulls don't say their banner), so after you got the featured operator it still
  counted the 120 guarantee as open and showed a worst case that was too small.
- The marking (featured or a lost 50/50, from the one banner of that type open at the time) now
  happens once for the whole Pulls screen, so History, the Luck report and the Planner agree.
- Each Chartered banner card names the earlier limited operators a lost 50/50 can also give.
- A test renders the real Endfield Pulls → Planner: featured pulled → worst case is the 240 copy;
  Typhoeus on Si's banner → a loss, 120 guarantee still open; 69 pulls → pity 69/80.
- The Calculator only counts pulls you will have; it has no pity numbers, so nothing changed there.

Not done:
- Weapon banners: history still can't tell the featured weapon, so the 8th-issue sure weapon is
  assumed still open.

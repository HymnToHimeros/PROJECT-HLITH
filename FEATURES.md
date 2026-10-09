# PROJECT-HLITH · Feature map (from V1, V2 must keep all of it)

Rebuilt per game through the game contract. Principle: features share one set of data and feed each other. Build the shared data first, then the screens on top.

## Shell (always there)
- **Assistant**: chat with screenshots and web search. Can act on the app: propose plans (shown in Calendar), propose a route, update account numbers, update backlog progress, mark tasks done. User chooses its model and sees what each message costs.
- **Account**: sync across devices (name + PIN), backup and restore, HoYoLAB link, evening-message settings, calendar feed link, setup checklist, Guide.

## Modules
- **Today**: tonight's run (tasks in order, with why), dailies/weeklies that reset at the server reset, stamina, live banners, events ending soon, wishlist of upcoming banners for "wanted" characters. Gets from: tasks + reset times, Events, Banners + Roster, Pre-farm (stamina hint), HoYoLAB (live stamina, check-in).
- **Events**: events, endgame cycles, login events with states (open / done / skipped) and days claimed. Feeds Pulls budget, Calendar, Today, evening message.
- **Calendar**: banners opening/leaving, events start/end, endgame resets, weekly/monthly resets, own plans. Gets from Banners, Events, endgame, Assistant plans. Exported as a phone-calendar feed.
- **Backlog**: permanent content that still gives currency (story, side quests, exploration, modes, achievements). Each item done / total + reward. Per-category switch: count rewards toward pulls or not. Feeds the Pulls budget. Edited by Assistant and screenshots.
- **Pulls** (4 tabs): Planner (pulls by banner start/end, chance, worst case) · Calculator (budget to version end, by source) · Bank log (ledger: have, earned, bought, spent) · History (real pull import → pity + 50/50) · Luck report (avg pity, 50/50 record, free vs paid, cost per 5★).
- **Banners**: live and upcoming, art, leaks (hideable), "fit" of each character to your roster.
- **Roster**: every character, owned / wanted, Eidolons (HSR) / Mindscapes (ZZZ), character page (build, gear effects, who fits). Includes **Teams**: presets scored against recommended teams, who fits, if you pull, team ideas from owned, share-a-team. ZZZ: kit check (what each kit does, with game text as proof).
- **Farm (Pre-farm)**: choose characters → total materials, crafting-up, stamina plan, gear to farm from their builds.

## Connections
1. **One pull budget.** One engine. Inputs: bank; this version's income by source (daily, weekly, endgame, monthly, events, login, one-time, paid extras only if on); Backlog rewards of enabled categories. Done events, claimed login days and time passing turn income into "already earned" (never counted twice). Rows covered by Backlog are skipped. Past rewards never count. Planner → to banner start; Calculator → to version end. Backlog → Calculator → Planner is one chain; Planner links back ("your Backlog could add about N pulls").
2. **Pity.** History sets pity and 50/50 in Planner (odds, worst case). Luck report uses history + bank log.
3. **Roster → everything about characters.** Owned / wanted feed team scores (wanted < owned), Banners fit, if you pull, team ideas, Today wishlist. HoYoLAB import fills roster.
4. **Pre-farm → Today.** Chosen characters' needs decide the stamina hint.
5. **Same state feeds the outside world.** Evening message and calendar feed are built from the same data as Today and Calendar.
6. **Assistant writes back.** Plans → Calendar; backlog/account numbers → budget; mark done → Today.

## Rules
- Never show a number the app can't back up; missing value shows "no data yet". Percentages only when data and build are complete.
- Everything is built per game via the contract; a game lacks a module → it doesn't show.
- User data is never wiped; built-in list updates never change progress.
- Multi-user, worldwide: per-user data, per-game server and reset rule, local time display, locale-aware dates and numbers. The owner maintains game records and built-in lists without touching user progress.

## V2 decisions (Oct 2026)
- Modules: Today, Events, Calendar, Backlog, Pulls, Banners, Roster (tabs: Characters, Teams), Farm, Intel. ZZZ adds Kit check as a game-only module.
- Leaks live inside Banners and Calendar (dashed, "unverified"). Intel stays its own module for new content no other module covers.
- Owner console: owner-only area to oversee HLITH (game records and rules, built-in lists, leak sources, announcements). Users never see it.
- Data is separate per user. Community features (public plans, shared teams) are possible later, not planned now.
- Login: proper accounts (email, Google, Discord), replacing name + PIN.
- English only for now.

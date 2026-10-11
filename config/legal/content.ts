/**
 * HLIÐSKJÁLF's public pages (owner's T55): About (the homepage description), the Privacy policy
 * and the Terms of service. Written to match what the app really does (checked against the code,
 * 2026-10-11); config/legal/pages.ts turns them into plain HTML files that open without signing
 * in and without the app's JavaScript.
 *
 * If what the app does with data changes, change this text in the same pull request.
 * CONTACT is the project's public contact address (owner's choice); no personal address goes here.
 *
 * Markup in the strings: **bold** and [text](link). Nothing else.
 */

export type Block = { h: string } | { p: string } | { list: string[] } | { note: string };

export interface LegalPage {
  slug: 'about' | 'privacy' | 'terms';
  title: string;
  /** One line for search results and link previews. */
  description: string;
  updated: string;
  blocks: Block[];
}

export const CONTACT = 'hlidskjalf.contact@gmail.com';
export const COPYRIGHT = '© 2026 HymnToHimeros. All rights reserved. See LICENSE.';
export const LICENSE_URL = 'https://github.com/HymnToHimeros/PROJECT-HLITH/blob/main/LICENSE';
export const UPDATED = '11 October 2026';
export const FAN_NOTICE = 'HLIÐSKJÁLF is a fan-made tool. It is not affiliated with, endorsed or sponsored by HoYoverse (COGNOSPHERE PTE. LTD.). Game names, characters and art belong to HoYoverse.';

export const ABOUT: LegalPage = {
  slug: 'about',
  title: 'HLIÐSKJÁLF',
  description: 'PROJECT-HLITH (HLIÐSKJÁLF): a free command hub for Honkai: Star Rail and Zenless Zone Zero. Plan pulls, track dailies, events and your roster, on phone and PC.',
  updated: UPDATED,
  blocks: [
    { p: '**One seat, every world.** HLIÐSKJÁLF (PROJECT-HLITH) is a free, fan-made command hub for **Honkai: Star Rail** and **Zenless Zone Zero**. It is named after Odin’s high seat, from which he sees every world: everything you need for your games, in one place, on your phone and your PC.' },
    { h: 'What it does' },
    {
      list: [
        '**Today:** your daily and weekly resets on your own server, the tasks still open, and tonight’s run in the order things run out.',
        '**Pulls:** a pull planner and odds calculator, your bank log of premium currency, and your pull history (imported from the game’s own history link or a UIGF/SRGF file) with your pity and a luck report.',
        '**Banners, Events and Calendar:** what’s live, what’s next, how much each event still gives you, all on one timeline.',
        '**Roster and Teams:** the characters you own and want, builds, recommended teams and how well each character fits yours.',
        '**Backlog and Farm:** story and side content you haven’t done yet, and the materials to farm next.',
        '**HoYoLAB link (optional):** live stamina, the daily check-in and redeem codes, done for you if you switch it on.',
        '**The Assistant (optional):** ask questions about your own account, using your own Claude API key.',
        '**Make it yours:** themes, accent colours, fonts, a profile card with badges, and much more.',
      ],
    },
    { h: 'Your data' },
    { p: 'No ads, no tracking, nothing sold. Your data is private to your account and you can export or delete it at any time. Read the [Privacy policy](/privacy) and the [Terms of service](/terms).' },
    { h: 'Get started' },
    { p: '[Open HLIÐSKJÁLF](/) and sign in with Discord or Google. It’s free. Sign-in with an email link opens to everyone later.' },
    { h: 'Contact' },
    { p: `Questions, ideas or problems: **${CONTACT}**.` },
    { note: FAN_NOTICE },
  ],
};

export const PRIVACY: LegalPage = {
  slug: 'privacy',
  title: 'Privacy policy',
  description: 'What HLIÐSKJÁLF (PROJECT-HLITH) keeps about you, where, for how long, and your rights.',
  updated: UPDATED,
  blocks: [
    { h: 'The short version' },
    {
      list: [
        'HLIÐSKJÁLF keeps only what it needs to work for you: your sign-in, your settings and your game data, and the extras you switch on yourself.',
        'No ads, no analytics or tracking, and your data is never sold or shared for marketing.',
        'Your data is kept in **London, United Kingdom**. Only you can see it in the app.',
        'You can download everything (Account → Backup → Export my data) and delete your account (Account → Backup → Delete my account) whenever you like.',
      ],
    },

    { h: 'Who runs HLIÐSKJÁLF' },
    { p: `HLIÐSKJÁLF (also called PROJECT-HLITH or HLITH) is a free, fan-made tool run by one person (“we” below). Questions, requests about your data, or anything else: **${CONTACT}**.` },

    { h: 'What we keep, and why' },
    {
      p: '**Your account.** Signing in is handled by our sign-in provider (Supabase). It keeps what the sign-in service hands over, which sign-in methods you used, when you created the account and last signed in, and short sign-in logs (with your IP address) to keep accounts safe. We use this only to let you sign in and keep your data yours, and never show your email to anyone else.',
    },
    {
      list: [
        '**Discord** (open to everyone): your Discord user ID, username, display name, avatar picture link and the email address on your Discord account. Discord always shares the email for this kind of sign-in (the “identify” and “email” permissions), and our sign-in provider needs it to create an account; HLIÐSKJÁLF doesn’t email you or use it for anything else. We never see your Discord password, messages or servers.',
        '**Google** (open to everyone): your Google account ID, name, email address and profile picture link. HLIÐSKJÁLF asks Google only for the basic “openid”, “email” and “profile” permissions, and our sign-in provider keeps these to create and recognise your account; HLIÐSKJÁLF doesn’t email you or use them for anything else. We never see your Google password, contacts, files, mail or anything else in your Google account.',
        '**Email link** (not open to the public yet): only your email address.',
      ],
    },
    { p: '**Your settings and game data.** What you enter or import in the app: your games and servers, layout and look, bank log, imported pulls, roster, builds, teams, plans, backlog and event progress, and today’s ticks. It is stored with your account so it follows you to every device.' },
    { p: '**Your username and agreeing to these terms.** The username you choose (others see it on your profile card, in the community and in the owner’s lists), when you last changed it, and which version of the Terms of service and this Privacy policy you agreed to and when. It’s removed with your account.' },
    { p: '**Your profile.** The name, bio, title, picture and banner you choose, and which characters and badges you show. Profile pictures and banners you upload are stored as **public links** (anyone who has the exact link can open the picture) so they can be shown; your name, bio and data are not public.' },
    { p: '**Your profile card, only if you switch it on.** If you turn on “Show my profile card with teams I share”, anyone signed in to HLIÐSKJÁLF who opens a team link you shared can see your card: your name, picture, title, badge, showcase and pull counts, as far as your privacy switches allow. It is off unless you turn it on.' },
    { p: '**Background pictures** you upload are kept in private storage that only your account can read.' },
    { p: '**Moderation (only if it happens).** If the owner silences, suspends or removes your account, we keep what was done, when, until when, and the owner’s reason, so it can end on time and be looked back on. It’s included when you export your data and removed with your account.' },
    { p: '**Tester role and invites (only if you’re invited).** If you accept an invite link, we keep that you’re a tester, when you joined and which invite you used. For each invite link we keep the owner’s own note, when it was made, used or cancelled, and who used it; the link’s secret itself is not kept, only a fingerprint of it. The owner sees testers’ profile names and when they joined. Deleting your account removes your tester role and the invite records with your account on them.' },
    {
      p: '**HoYoLAB link (optional).** To show live stamina or do the daily check-in and redeem codes, HLIÐSKJÁLF needs your HoYoLAB login (the login cookie values). You choose how it is kept: used once and not stored; remembered only in your browser; or saved on our server so the daily check-in can run while you’re away. A login saved on the server is kept in an encrypted vault, readable only by our server functions. We also keep your HoYoLAB account number, your game accounts’ UIDs, nicknames, servers and levels, and the results of each check-in and code redemption. “Forget” overwrites the saved login straight away and stops everything automatic; the link’s record and its history stay until you delete your account.',
    },
    { p: '**Pull history import.** The game’s history link you paste (with its one-time key) is used for that one import and never stored. We keep the pulls themselves (what you got and when), without your game UID.' },
    { p: '**The Assistant (optional).** Your Claude API key is kept in your browser only (or only for the open tab, if you choose), never on our server and never in backup files. When you ask a question, our server passes your message, any picture you add, and a summary of your HLIÐSKJÁLF data to Anthropic using your key, and keeps nothing of it.' },
    { p: '**Reminders and calendar feed (optional).** Your reminder choices and a snapshot of upcoming resets, banners, events and your plan titles, so the evening message and the calendar feed can be made. The calendar feed is a private link with a long random secret: anyone you give the link to can read it, and “New link” or “Switch off” ends the old one.' },
    { p: '**Account deletion requests:** when you asked, when it will be completed, and the reason if you gave one.' },
    { p: '**Backups.** Every night our server makes a private copy of the database, so nothing is lost if something breaks. Copies are kept for **30 days**.' },

    { h: 'What stays on your device' },
    { p: 'The app also keeps a copy of your settings and data in your browser’s storage so it works quickly and offline, plus small preferences (for example dismissed notes). It is used only by HLIÐSKJÁLF on your device. Your sign-in session is kept there too. HLIÐSKJÁLF **sets no cookies** and uses no advertising or analytics scripts. If you use HLIÐSKJÁLF without an account (“this device only”), everything stays in your browser and nothing reaches our server.' },

    { h: 'Who handles your data for us' },
    {
      list: [
        '**Supabase** (database, sign-in, file storage and server functions). Our project is hosted in **London, United Kingdom** (AWS eu-west-2).',
        '**Cloudflare** (delivers the website). It sees technical request data such as your IP address, as any web host does.',
        '**Discord** or **Google**, when you sign in with them; sign-in emails (once open) are sent through Supabase.',
        '**HoYoverse / HoYoLAB**, only for the HoYoLAB and history-link features you use: our server talks to them with your login or link on your behalf.',
        '**Anthropic**, only if you use the Assistant, with your own key and under your own agreement with Anthropic. Anthropic is in the United States.',
        '**static.nanoka.cc**, a community site the game art pictures are loaded from. Your browser fetches the pictures directly, so that site sees your IP address (but not which page you were on).',
      ],
    },
    { p: 'They process data only to provide their part of the service. Data that leaves the UK (for example to Anthropic, or Cloudflare’s worldwide network) is protected by those companies’ standard data-protection terms. The UK has an adequacy decision from the EU, so data kept there is treated like data kept in the EU.' },

    { h: 'Who can see your data' },
    { p: 'In the app, only you (and, if you switched your profile card on, people who open a team link you shared, as above). The person who runs HLIÐSKJÁLF can technically access the database and storage to run, back up and fix the service, and will only do so for that. The owner’s console in the app shows totals (for example how many accounts there are), the list of invited testers, and a list of accounts with only: profile name and picture, how you sign in (Discord, Google or email, never the address), when you joined and were last active, whether you’re a tester, and whether the account is silenced, suspended or being deleted. Never your email address or your data.' },

    { h: 'What we never do' },
    { list: ['Sell, rent or trade your data.', 'Show ads or use your data for advertising.', 'Track you across other sites, or use analytics or fingerprinting.', 'Read your HoYoLAB login for anything other than the features you switched on.'] },

    { h: 'How long we keep it' },
    {
      list: [
        'Your data is kept while your account exists.',
        '**Deleting your account** starts a 30-day grace period: you can still sign in, export everything, or change your mind. After 30 days, everything is removed for good: your rows, your uploaded pictures, your saved HoYoLAB logins and your sign-in account (with what Discord or Google gave us). Nightly backups that still hold it are removed within a further 30 days.',
        'Request logs kept by Supabase and Cloudflare follow their own short retention.',
      ],
    },

    { h: 'Your rights' },
    {
      p: `Under the UK and EU General Data Protection Regulation you can ask to **see** your data, **get a copy** of it (Account → Backup → Export my data does this for you), **correct** it, **delete** it, **restrict** or **object** to how it’s used, and **withdraw consent** for optional features at any time (switch them off or use “Forget”). Write to ${CONTACT}; we answer within one month. You can also complain to a data-protection authority: in the UK the Information Commissioner’s Office (ico.org.uk), or the authority in your EU country.`,
    },
    { p: '**Why we may use your data:** to provide the service you signed up for (your account, settings and game data); because you chose to (the optional features: HoYoLAB link, the Assistant, reminders, the profile card); and to keep the service safe and working (backups, preventing abuse).' },

    { h: 'Children' },
    { p: 'HLIÐSKJÁLF is not meant for children under 13. If you are under the age of digital consent in your country (16 in some EU countries), please ask a parent or guardian before creating an account.' },

    { h: 'Changes to this policy' },
    { p: 'If we change what we do with your data, we update this page and the date above, and tell you in the app before an important change takes effect.' },
    { note: FAN_NOTICE },
  ],
};

export const TERMS: LegalPage = {
  slug: 'terms',
  title: 'Terms of service',
  description: 'The rules for using HLIÐSKJÁLF (PROJECT-HLITH), a free fan-made tool.',
  updated: UPDATED,
  blocks: [
    { h: 'The short version' },
    { p: 'HLIÐSKJÁLF is a free, fan-made tool, offered as it is. Use it fairly, keep your logins safe, and remember that your game accounts are governed by HoYoverse’s own terms.' },

    { h: '1. About HLIÐSKJÁLF' },
    { p: `HLIÐSKJÁLF (PROJECT-HLITH) is a free tool to plan and track Honkai: Star Rail and Zenless Zone Zero, run by one person. ${FAN_NOTICE} Contact: ${CONTACT}.` },

    { h: '2. Using it' },
    {
      list: [
        'You can use HLIÐSKJÁLF without an account (on this device only) or with one. By creating an account or using the service, you agree to these terms and the [Privacy policy](/privacy).',
        'You must be at least 13 (and old enough in your country to agree to these terms, or have a parent’s or guardian’s agreement).',
        'Keep your sign-in safe. You are responsible for what happens under your account.',
      ],
    },

    { h: '3. Your game accounts and HoYoLAB' },
    {
      list: [
        'Linking HoYoLAB, importing your history and the automatic check-in and codes are optional. They use your own login, on your behalf and at your request.',
        'Your game and HoYoLAB accounts are governed by HoYoverse’s terms. Whether to use automation with them is your choice and your responsibility. We can’t guarantee HoYoverse won’t change or limit what their services allow.',
        'You can stop at any time: switch the features off, or use “Forget” to remove a saved login.',
      ],
    },

    { h: '4. The Assistant' },
    { p: 'The Assistant uses your own Claude API key. Your use of it, and any cost, is between you and Anthropic under Anthropic’s terms. Answers can be wrong: check anything important in the game.' },

    { h: '5. Acceptable use' },
    {
      list: [
        'Don’t break the law, harm others, or use HLIÐSKJÁLF to harass anyone.',
        'Don’t upload pictures or text you have no right to share, or that are illegal, sexual involving minors, hateful or meant to harass.',
        'Don’t try to get into other people’s accounts or data, overload the service, or get around its limits and security.',
        'Don’t use HLIÐSKJÁLF to scrape or resell data.',
      ],
    },
    { p: 'We may remove content or suspend accounts that break these rules, and will tell you why where we can.' },

    { h: '6. Moderation' },
    {
      p: `To keep HLIÐSKJÁLF safe for everyone, the owner may, for accounts that break these rules or harm others: **silence** an account for a time (it keeps using its own HLIÐSKJÁLF, but can’t share or show up in anything others see), **suspend** it for a time or for good (it can’t use HLIÐSKJÁLF, but its data is kept and it can still download it), or **remove** it (suspended now and deleted after 30 days, the same as deleting it yourself; this can be undone until then). Questions or disagreements: ${CONTACT}.`,
    },

    { h: '7. Your content' },
    { p: 'What you enter and upload stays yours. You let us store it and show it to you (and to others only where you chose to, such as public profile pictures or your profile card) so the service can work. That permission ends when you delete it or your account.' },

    { h: '8. Game content and names' },
    { p: 'Game names, characters, art and data shown in HLIÐSKJÁLF belong to HoYoverse and are used for fan, informational purposes. Lists and numbers come from public sources and the community and may be incomplete, early or wrong; leaks are always marked unverified.' },

    { h: '9. No warranty' },
    { p: 'HLIÐSKJÁLF is provided free and **as is**, without any warranty. Plans, odds, timers and recommendations are estimates. We do our best to keep it working and your data safe, but we can’t promise it will always be available, correct or free of errors. Keep your own backups (Account → Backup).' },

    { h: '10. Liability' },
    { p: 'As far as the law allows, we are not liable for indirect losses or for losses in your games or game accounts (for example a missed reward or a pull decision). Nothing in these terms limits rights you have as a consumer that can’t be limited by law.' },

    { h: '11. Changes and ending' },
    {
      list: [
        'We may change or stop features, or the service as a whole. If HLIÐSKJÁLF is going to close, we will tell you in the app in advance so you can export your data.',
        'We may update these terms. We change the date above and tell you in the app before important changes take effect. If you keep using HLIÐSKJÁLF after that, the new terms apply.',
        'You can stop using HLIÐSKJÁLF and delete your account at any time (Account → Backup → Delete my account).',
      ],
    },

    { h: '12. Copyright and licence' },
    {
      p: `HLIÐSKJÁLF’s own code, design, texts, themes, artwork, badges, rules and data files are © 2026 HymnToHimeros, all rights reserved. You may use the app here for your own personal use. Copying, hosting or reusing any of it needs written permission: see the [LICENSE](${LICENSE_URL}). The names HLIÐSKJÁLF, PROJECT-HLITH and HLITH and the emblem may not be used for other projects. Open-source parts and fonts keep their own licences; game content belongs to HoYoverse.`,
    },

    { h: '13. Contact' },
    { p: `Questions about these terms: ${CONTACT}.` },
    { note: FAN_NOTICE },
  ],
};

export const PAGES: LegalPage[] = [ABOUT, PRIVACY, TERMS];

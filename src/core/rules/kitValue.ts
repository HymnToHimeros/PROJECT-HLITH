/**
 * Kit-aware team value (owner's job T30, both games). A team is worth what its kits multiply the damage dealer's
 * damage by, read from the kit numbers:
 * - every counted buff has a size from its kit text (+40% DMG, DEF −30%, ×1.35) and a zone (the stat it gives);
 * - inside one zone the sizes add (Lucia's +20% and Dialyn's +40% DMG make +60%); zones multiply;
 * - the team's multiplier is the product over zones of (1 + the zone's total).
 * A size the kit doesn't write as a percentage (+600 ATK, "one more turn") counts as a typical buff of the game: the
 * middle of every read percentage, said in the Why. No damage formula, no character stats: only the kit numbers.
 * Points are the multiplier on a log scale (POINTS × ln(multiplier)), so they add up line by line and a team's
 * percentage against another is the ratio of their multipliers. Rules: docs/logic/hsr-decisions.md 37, zzz-decisions.md 61.
 */

/** Points per unit of ln(multiplier): ×2 is about 6.9 points. */
export const POINTS = 10;

/** One sized contribution of a line: its zone and its size as a fraction (+40% = 0.4). */
export interface Part {
  zone: string;
  size: number;
  /** 'stated': written in the kit as a percentage or a ×; 'typical': not written as one, counted as the game's typical buff. */
  how: 'stated' | 'typical';
}

const num = (s: string) => Number(s.replace(/,/g, ''));

/**
 * The size a kit amount states, as a fraction; undefined when it isn't a percentage or a multiplier.
 * "+20%", "20%", "−20%", "up to +100.8%", "+50%, 2 turns", "×1.15 with 1 other Nihility" (→ 0.15), "+20% per stack, up to 2" (→ 0.4), "+11.2%/16.8%/22.4%" (→ 0.224), "+20% to +60%" (→ 0.6),
 * "(7 + 1.5 × Special Attack level)%" (at `level`).
 */
export function sizeOf(amount: string, level = 12): number | undefined {
  const a = amount.trim();
  const times = /^×\s*(\d+(?:\.\d+)?)/.exec(a);
  if (times?.[1]) return num(times[1]) - 1;
  const formula = /^\(\s*(-?\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*×\s*[A-Za-z ]+level\s*\)\s*%/.exec(a);
  if (formula?.[1] && formula[2]) return (num(formula[1]) + num(formula[2]) * level) / 100;
  // "+15% at 1 stack, +5% per extra stack, up to 5 stacks": at full stacks, 15% + 4 × 5% = 35%.
  const extra = /^\+?(\d+(?:\.\d+)?)% at 1 stack,\s*\+(\d+(?:\.\d+)?)% per extra stack,\s*up to (\d+) stacks/.exec(a);
  if (extra?.[1] && extra[2] && extra[3]) return (num(extra[1]) + num(extra[2]) * (num(extra[3]) - 1)) / 100;
  // "+20% to +60% (fewer enemies, more)", "+20–60%": a range, counted at its top (the full setup).
  const range = /^([+−-])?\s*(\d[\d,]*(?:\.\d+)?)%?\s*(?:to|–)\s*\+?(\d[\d,]*(?:\.\d+)?)%/.exec(a);
  if (range?.[3]) return (num(range[3]) / 100) * (range[1] === '−' || range[1] === '-' ? -1 : 1);
  // "+11.2%/16.8%/22.4% with 1/2/3 Songbirds", "35%/50%": steps, counted at the last one (the full setup, like stacks).
  const steps = /^([+−-])?\s*(\d[\d,]*(?:\.\d+)?)%?(?:\s*\/\s*\d[\d,]*(?:\.\d+)?%?)+/.exec(a);
  if (steps && /%/.test(steps[0])) {
    const last = [...steps[0].matchAll(/(\d[\d,]*(?:\.\d+)?)/g)].map((m) => num(m[1] ?? '0')).pop() ?? 0;
    return (last / 100) * (steps[1] === '−' || steps[1] === '-' ? -1 : 1);
  }
  const pct = /^(?:up to\s+)?([+−-])?\s*(\d[\d,]*(?:\.\d+)?)\s*%/.exec(a);
  if (pct?.[2]) {
    // "+20% per stack, up to 2": at full stacks.
    const stacks = /per stack[^,;]*,\s*up to\s+(\d+)/.exec(a);
    return (num(pct[2]) / 100) * (pct[1] === '−' || pct[1] === '-' ? -1 : 1) * (stacks?.[1] ? num(stacks[1]) : 1);
  }
  return undefined;
}

/** The middle of a list of sizes: what a buff without a stated percentage counts as. */
export function typicalSize(sizes: number[]): number {
  const s = sizes.filter((x) => x > 0).sort((a, b) => a - b);
  if (!s.length) return 0.2;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0.2) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/** Extra hits (HSR extra-dmg, ZZZ extra-hit) whose size is a share of the damage dealer's own hits ("24% of each hit"). */
const EXTRA = new Set(['extra-dmg', 'extra-hit']);
const OF_THEIR_DAMAGE = /of (each|every)\b[^,;]*\b(hit|DoT|instance)|of DMG dealt|of the original|of the Burn|of each DoT|of the Attribute Anomaly DMG|of the Disorder DMG/i;

/**
 * A part for one gives-amount: its stated size, or the typical one. Negative sizes (enemy DEF −30%) count as their size.
 * An extra hit counts its stated size only when it is a share of the damage dealer's own damage ("24% of each hit");
 * "80% of the Bondmate's ATK" is a hit of its own whose size against theirs the kit doesn't give: typical.
 */
export function partOf(zone: string, amount: string, typical: number, level?: number): Part {
  if (EXTRA.has(zone) && !OF_THEIR_DAMAGE.test(amount)) return { zone, size: typical, how: 'typical' };
  const s = sizeOf(amount, level);
  return s === undefined || s === 0 ? { zone, size: typical, how: 'typical' } : { zone, size: Math.abs(s), how: 'stated' };
}

export interface Valued {
  /** POINTS × ln(multiplier). */
  points: number;
  multiplier: number;
  /** Each zone's total, as a fraction. */
  zones: Map<string, number>;
  /** Each line's points (its share of its zones' log value, by size). */
  shares: number[];
}

/**
 * The team's value from its lines' parts. Inside a zone the parts add; each line gets the share of the zone's
 * ln(1 + total) that its size makes of the total, so the lines' points add up to the team's points exactly.
 */
export function value(lines: Part[][]): Valued {
  const zones = new Map<string, number>();
  for (const parts of lines) for (const p of parts) zones.set(p.zone, (zones.get(p.zone) ?? 0) + p.size);
  const shares = lines.map((parts) =>
    parts.reduce((n, p) => {
      const total = zones.get(p.zone) ?? 0;
      return total > 0 ? n + (POINTS * Math.log(1 + total) * p.size) / total : n;
    }, 0),
  );
  const points = [...zones.values()].reduce((n, t) => n + POINTS * Math.log(1 + t), 0);
  return { points, multiplier: Math.exp(points / POINTS), zones, shares };
}

/** A team's percentage against another, from their points: the ratio of their multipliers. */
export const percentOf = (mine: number, best: number) => Math.round(Math.exp((mine - best) / POINTS) * 100);

/** Points for display: one decimal. */
export const shown = (n: number) => Math.round(n * 10) / 10;

/** The multiplier in words: "×3.4". */
export const timesWords = (value: number) => `×${Math.exp(value / POINTS).toFixed(1)}`;
/** A team in words: its count and its kit value, "9 (kit value ×3.4)". */
export const countWords = (r: { count: number; value: number }) => `${r.count} (kit value ${timesWords(r.value)})`;

/** Said with every score (T30). */
export const VALUE_NOTE =
  "The count is how many kit lines connect. The kit value (×N) is what ranks teams and gives the %: each buff at its size in the kit text, buffs of one kind add up, different kinds multiply. It is read from the kits alone, not a damage calculation.";

/** The Why's note on sizes the kit doesn't give as a % (T30): "Counted as a typical buff (+20%, no % in the kit text): …". */
export function typicalNote(lines: { who: string; tag: string; value?: number; parts?: Part[] }[], name: (id: string) => string): string | undefined {
  const typ = lines.filter((l) => (l.value ?? 0) > 0 && l.parts?.some((p) => p.how === 'typical'));
  if (!typ.length) return undefined;
  const size = typ.flatMap((l) => l.parts ?? []).find((p) => p.how === 'typical')?.size ?? 0;
  const items = [...new Set(typ.map((l) => `${name(l.who)}'s “${l.tag}”`))];
  return `Counted as a typical buff (+${Math.round(size * 100)}%, the kit text gives no %): ${items.join('; ')}.`;
}

/** The damage dealer's biggest hit on each stat, from their damage notes ("1170% of Khaslana's ATK" → ATK 11.7). */
function ownHit(quotes: { quote: string }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const q of quotes)
    for (const m of q.quote.matchAll(/(\d+(?:\.\d+)?)% of (?:[A-Z][^.%]*?'s |this unit's )(ATK|Max HP|DEF)\b/g)) {
      const stat = m[2] ?? '';
      out.set(stat, Math.max(out.get(stat) ?? 0, Number(m[1]) / 100));
    }
  return out;
}

/**
 * T30 (B): a support's own damage adds to the team's, as a share of the damage dealer's: "12% of Tribbie's Max HP per
 * target hit" against the damage dealer's biggest hit on the same stat in their damage notes ("56% of Castorice's Max
 * HP"). A different stat, or no number on either side: the typical buff. Both games.
 */
export function ownDamagePart(amount: string, ddQuotes: { quote: string }[], typical: number): Part {
  const m = /(\d+(?:\.\d+)?)% of (?:[A-Z][^.%]*?'s |her |his )(initial )?(ATK|Max HP|DEF)\b/.exec(amount);
  const hit = m?.[3] ? ownHit(ddQuotes).get(m[3]) : undefined;
  if (!m?.[1] || !hit) return { zone: 'extra-dmg', size: typical, how: 'typical' };
  return { zone: 'extra-dmg', size: Number(m[1]) / 100 / hit, how: 'stated' };
}

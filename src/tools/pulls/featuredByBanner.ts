import type { Banner, HistoryMapping, PullRecord } from '../../core/contract';

/**
 * For a game whose history doesn't say which banner a pull came from and has no standard list (Endfield):
 * a top result on one of `rule.types` is featured when it is in the featured list of the one banner of
 * that type open at the pull's time, and a lost 50/50 otherwise, whatever pool it came from (Endfield's
 * Chartered banners also give earlier limited operators, `Banner.alsoAvailable`). Never guessed: no open
 * banner, or more than one, leaves it unknown; so does the banner's own sure pull (`guaranteeAt`, not a
 * 50/50) and a banner whose featured list is empty. Pulls that already say featured or not are kept as they are.
 */
export function featuredByBanner(pulls: PullRecord[], banners: Banner[], rule: NonNullable<HistoryMapping['featuredByBanner']>): PullRecord[] {
  const types = new Set(rule.types);
  const openAt = (type: string, at: number) => banners.filter((b) => b.type === type && !b.leak && Date.parse(b.start) <= at && at < Date.parse(b.end));
  const sorted = [...pulls].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  // Per banner: pulls counted on it so far, and whether its featured result came.
  const counted = new Map<string, number>();
  const got = new Set<string>();
  const marked = new Map<string, boolean>();
  for (const p of sorted) {
    if (!types.has(p.bannerType)) continue;
    const open = openAt(p.bannerType, Date.parse(p.time));
    const only = open.length === 1 ? open[0] : undefined;
    if (!only) continue;
    const n = (counted.get(only.id) ?? 0) + 1;
    counted.set(only.id, n);
    if (p.rarity !== 'top' || p.featured !== undefined || only.featured.length === 0) continue;
    const isFeatured = only.featured.includes(p.itemId);
    const sure = isFeatured && rule.guaranteeAt !== undefined && n === rule.guaranteeAt && !got.has(only.id);
    if (isFeatured) got.add(only.id);
    if (!sure) marked.set(p.id, isFeatured);
  }
  if (!marked.size) return pulls;
  return pulls.map((p) => {
    const f = marked.get(p.id);
    return f === undefined ? p : { ...p, featured: f };
  });
}

/**
 * Backlog logic, no React: items grouped by category with what each still
 * gives, and the input the pull-budget engine takes (`backlogForBudget`).
 * A done count you never entered is unknown, never 0: its reward is left out.
 */
import type { BacklogItem, GameContract, IncomeRow } from '../../core/contract';
import { known } from '../../core/contract/known';
import type { GameUserData } from '../../core/data/userData';
import { budget, budgetPulls, pullsFor, type BudgetInput } from '../budget/budget';

export const ORDER = ['story', 'side-quests', 'permanent-events', 'exploration', 'modes', 'achievements'];
const LABEL: Record<string, string> = {
  story: 'Main story',
  'side-quests': 'Side quests',
  'permanent-events': 'Permanent events',
  exploration: 'Exploration',
  modes: 'Modes',
  achievements: 'Achievements',
};
export const categoryLabel = (id: string) => LABEL[id] ?? (id.charAt(0).toUpperCase() + id.slice(1)).replace(/-/g, ' ');

export interface ItemView {
  item: BacklogItem;
  /** Your done count, or the example one; null = you haven't entered it. */
  done: number | null;
  doneExample: boolean;
  /** Reward still to get; null when the reward or your progress is unknown. */
  rewardLeft: number | null;
}

export interface CategoryView {
  id: string;
  label: string;
  enabled: boolean;
  items: ItemView[];
  /** Known rewards left, by currency. */
  rewardLeft: Record<string, number>;
  /** Items whose reward left can't be worked out (reward or progress unknown). */
  unknown: ItemView[];
  /** Income rows this category already covers when it's on (they're skipped in Pulls, never counted twice). */
  covers: IncomeRow[];
}

/** How an item is shown: an ordered checklist, a single tick box, or a counter. */
export type Shape = 'steps' | 'check' | 'counter';
export const shapeOf = (item: BacklogItem): Shape => (item.steps && item.steps.length > 0 ? 'steps' : item.total === 1 ? 'check' : 'counter');

/** Finished, as far as your progress shows (unknown progress is not finished). */
export const isDone = (v: ItemView) => v.done !== null && v.done >= v.item.total;

/** For the tab badge: how many items are still open (unknown progress counts as open). */
export function openCount(cat: CategoryView): number {
  return cat.items.filter((v) => !isDone(v)).length;
}

/** Items in their groups, in list order; items without a group come first, under no heading. */
export function groupsOf(items: ItemView[]): { name: string | null; items: ItemView[] }[] {
  const out: { name: string | null; items: ItemView[] }[] = [];
  for (const v of items) {
    const name = v.item.group?.trim() || null;
    let g = out.find((x) => x.name === name);
    if (!g) {
      g = { name, items: [] };
      if (name === null) out.unshift(g);
      else out.push(g);
    }
    g.items.push(v);
  }
  return out;
}

/** Every category the game knows plus any your items use, in the usual order. */
export function categoryIds(items: BacklogItem[]): string[] {
  const ids = new Set([...ORDER, ...items.map((i) => i.category)]);
  const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  return [...ids].sort((a, b) => rank(a) - rank(b));
}

/** Reward left, in proportion to what's not done yet. */
export function rewardLeft(item: BacklogItem, done: number | null): number | null {
  if (item.reward === null || done === null) return null;
  if (item.total <= 0) return 0;
  return Math.round((item.reward * Math.max(0, item.total - Math.min(done, item.total))) / item.total);
}

export function categories(game: GameContract, items: BacklogItem[], user: GameUserData, exampleDone: Record<string, number> = {}): CategoryView[] {
  const byId = new Map<string, CategoryView>();
  for (const item of items) {
    let cat = byId.get(item.category);
    if (!cat) {
      cat = {
        id: item.category,
        label: categoryLabel(item.category),
        enabled: !user.backlogOff.includes(item.category),
        items: [],
        rewardLeft: {},
        unknown: [],
        covers: game.income.filter((r) => r.coveredByBacklog === item.category),
      };
      byId.set(item.category, cat);
    }
    const mine = user.backlog[item.id];
    const ex = exampleDone[item.id];
    const done = mine ?? ex ?? null;
    const view: ItemView = { item, done, doneExample: mine === undefined && ex !== undefined, rewardLeft: rewardLeft(item, done) };
    cat.items.push(view);
    if (view.rewardLeft === null) cat.unknown.push(view);
    else cat.rewardLeft[item.currency] = (cat.rewardLeft[item.currency] ?? 0) + view.rewardLeft;
  }
  const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);
  return [...byId.values()].sort((a, b) => rank(a.id) - rank(b.id));
}

/** One budget entry per category and currency. Nothing known in a category → null (shown as "no data"). */
export function backlogForBudget(cats: CategoryView[]): NonNullable<BudgetInput['backlog']> {
  const out: NonNullable<BudgetInput['backlog']> = [];
  for (const c of cats) {
    const currencies = new Set(c.items.map((i) => i.item.currency));
    for (const currency of currencies) {
      const left = c.rewardLeft[currency];
      out.push({ category: c.id, label: c.label, enabled: c.enabled, rewardLeft: left ?? null, currency });
    }
  }
  return out;
}

const mainBanner = (game: GameContract) => game.bannerTypes.find((t) => t.target === 'character') ?? game.bannerTypes[0];

/** Pulls from a set of amounts: premium ÷ per-pull, plus pull items usable on the main banner. */
export function pullsOf(game: GameContract, amounts: Record<string, number>): number {
  const main = mainBanner(game);
  if (main) return pullsFor(game, amounts, main.id);
  let premium = 0;
  for (const c of game.currencies) if (c.perPull && !c.paid) premium += (amounts[c.id] ?? 0) / c.perPull;
  return Math.floor(premium + 1e-9);
}

export interface BacklogEstimate {
  /** Rewards left in switched-on categories, by currency (known items only). */
  counted: Record<string, number>;
  /** "Backlog could add about N pulls" — switched-on categories only. */
  pulls: number;
  /** Rewards left in switched-off categories. */
  offPulls: number;
  off: Record<string, number>;
  anyEnabled: boolean;
  /** Switched-on categories where nothing is known yet. */
  noData: string[];
}

/** Runs the one budget engine with only the Backlog, so these numbers match Pulls exactly. */
export function estimate(game: GameContract, cats: CategoryView[]): BacklogEstimate {
  const b = budget({
    game: { ...game, income: [] },
    serverId: undefined,
    now: 0,
    until: 0,
    bank: known({}, 'user'),
    backlog: backlogForBudget(cats),
    paidExtras: false,
  });
  const main = mainBanner(game);
  const pulls = main ? budgetPulls(game, b, main.id) : null;
  return {
    counted: b.income,
    pulls: pulls?.known ? pulls.value : pullsOf(game, b.income),
    off: b.backlogPotential,
    offPulls: pullsOf(game, b.backlogPotential),
    anyEnabled: cats.some((c) => c.enabled),
    noData: b.leftOut,
  };
}

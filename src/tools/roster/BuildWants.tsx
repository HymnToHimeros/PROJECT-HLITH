import { useMemo } from 'react';
import type { Character, TeamPreset } from '../../core/contract';
import { FIT_WORD } from '../../core/rules/buildFit';
import r from './roster.module.css';
import { useTeamAccount } from './TeamParts';
import type { RosterData } from './useRosterData';

/**
 * Which build each of their teams wants on them (owner's job T18: "Robin • Summeretto with Phainon is an HP-only build").
 * A team wants a build when this character's buff to its damage dealer grows with their own stat. Hidden when none does.
 */
export function BuildWants({ data, character: c }: { data: RosterData; character: Character }) {
  const { game, user, presets } = data;
  const rules = game.rules.teams;
  // Everything the team rules read (roster, builds, team lists, the assume and leak switches): a change asks again.
  const account = useTeamAccount(data);
  const rows = useMemo(() => {
    if (!rules || presets.example) return [];
    const firsts = (p: TeamPreset) => p.slots.map((s) => s.characters[0]).filter((x): x is string => Boolean(x));
    // A game team as its card shows it (T40: the better unit per slot), so the wants are about the same members.
    const teams = [...user.teams.map((t) => ({ id: t.id, name: t.name, members: t.members })), ...presets.list.map((p) => ({ id: p.id, name: p.name, members: rules.fill?.(p, account) ?? firsts(p) }))].filter((t) =>
      t.members.includes(c.id),
    );
    return teams.flatMap((t) => {
      const v = rules.verdict(t.members, account);
      return v.rated ? (v.wants ?? []).filter((w) => w.who === c.id).map((w) => ({ team: t, want: w })) : [];
    });
  }, [rules, presets, user.teams, c.id, account]);
  if (!rows.length) return null;
  // One line per stat: their build is the same in every team, so the fit is too; the teams that want it are listed.
  const byStat = [...new Map(rows.map((x) => [x.want.stat, { want: x.want, teams: [...new Set(rows.filter((y) => y.want.stat === x.want.stat).map((y) => y.team.name))] }])).values()];
  return (
    <section className={r.card} aria-labelledby="build-wants">
      <h3 className={r.cardTitle} id="build-wants">
        Builds their teams want
      </h3>
      <p className={r.cardText}>
        {byStat.length === 1
          ? `Their teams want ${c.name} built for ${byStat[0]?.want.stat ?? ''}: their buff to the damage dealer grows with it.`
          : `Different teams want different builds on ${c.name}: ${byStat.map((x) => x.want.stat).join(', ')}.`}
      </p>
      <ul className={r.whyList}>
        {byStat.map(({ want, teams }) => (
          <li key={want.stat} className={r.whyItem}>
            <span className={r.whyPoints}>{want.max ? `+${want.points}` : '·'}</span>
            <span>
              <strong>{want.stat} build</strong> · yours: {want.fit === 'no-build' ? FIT_WORD[want.fit] : `${want.have} → ${FIT_WORD[want.fit]}`}
              <span className={r.wantTeams}>Wanted by {teams.length === 1 ? teams[0] : `${teams.length} teams: ${teams.join('; ')}`}.</span>
              <span className={r.whyQuote}>
                {want.proof.skill}: “{want.proof.quote}”
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

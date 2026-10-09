import type { GameContract } from '../../core/contract';
import { setTick } from '../../core/data/userData';
import { Button, GameTag } from '../../core/ui';
import { cx } from '../../core/ui/cx';
import { byUrgency, type Task } from './tasks';
import t from './today.module.css';

interface Props {
  tasks: Task[];
  /** Games whose server isn't chosen yet: their tasks can't be timed. */
  noServer: GameContract[];
  tags: boolean;
  now: number;
  openAccount: () => void;
}

/**
 * ★ Tonight's run (R43, no design yet: built from the shared tokens). The
 * tasks you haven't ticked, in the order to do them, each with one line on why.
 */
export function TonightsRun({ tasks, noServer, tags, now, openAccount }: Props) {
  const open = tasks.filter((x) => !x.done).sort(byUrgency);
  const doneCount = tasks.length - open.length;
  return (
    <section className={t.card} aria-label="Tonight’s run">
      <div className={t.cardHead}>
        <h3 className={t.cardTitle}>Tonight’s run</h3>
        {tasks.length > 0 && (
          <span className={t.count}>
            {doneCount}/{tasks.length} done
          </span>
        )}
      </div>
      <p className={t.sub}>What’s left, in the order to do it: whatever runs out first goes first.</p>
      {open.length > 0 && (
        <ol className={t.list}>
          {open.map((task, i) => (
            <li key={`${task.game.id}:${task.id}`}>
              <label className={t.task}>
                <span className={t.order}>{i + 1}</span>
                <input type="checkbox" checked={false} onChange={() => setTick(task.game.id, task.id, new Date(now).toISOString())} aria-label={`Done: ${task.label}`} />
                <span className={t.taskBody}>
                  <span className={t.taskTop}>
                    {task.label}
                    {task.reward && <span className={t.reward}>{task.reward}</span>}
                    {tags && <GameTag label={task.game.short} vent={task.game.vent} />}
                  </span>
                  <span className={t.why}>{task.why}</span>
                </span>
              </label>
            </li>
          ))}
        </ol>
      )}
      {open.length === 0 && tasks.length > 0 && <p className={t.allDone}>All done for tonight. Ticks clear at the next reset.</p>}
      {noServer.length > 0 && (
        <div className={cx(t.prompt)}>
          <p>
            {noServer.length === 1 && !tags
              ? 'Choose your server first: the order depends on when your dailies reset.'
              : `Choose your server for ${noServer.map((g) => g.short).join(' and ')} to add its tasks: the order depends on when its dailies reset.`}
          </p>
          <Button variant="primary" onClick={openAccount}>
            Choose my server
          </Button>
        </div>
      )}
    </section>
  );
}

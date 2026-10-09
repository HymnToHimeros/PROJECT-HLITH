import { Button } from './Button';
import s from './ui.module.css';

interface Props {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void } | undefined;
}

/** Empty module: dashed card, NO DATA YET label, one sentence, one action. */
export function EmptyState({ title, body, action }: Props) {
  return (
    <section className={s.empty}>
      <span className={s.emptyLabel}>NO DATA YET</span>
      <h3 className={s.emptyTitle}>{title}</h3>
      <p className={s.emptyBody}>{body}</p>
      {action && (
        <Button variant="primary" className={s.emptyAction} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { activeAnnouncements, hiddenAnnouncements, hideAnnouncement, type Announcement } from '../data/announcements';
import a from './announcements.module.css';

/**
 * Notes from the owner (Owner console → Announcements), as a strip at the top of every
 * page while they are active. Hide one and this device remembers it; nothing shows
 * without a server or when signed out.
 */
const loadActive = () => activeAnnouncements();

export function AnnouncementStrip({ load = loadActive }: { load?: () => Promise<Announcement[]> }) {
  const [list, setList] = useState<Announcement[]>([]);
  const [hidden, setHidden] = useState<string[]>(() => hiddenAnnouncements());
  useEffect(() => {
    let alive = true;
    void load()
      .then((rows) => alive && setList(rows))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [load]);
  const shown = list.filter((x) => !hidden.includes(x.id));
  if (shown.length === 0) return null;
  return (
    <div className={a.stack}>
      {shown.map((x) => (
        <section key={x.id} className={`${a.strip} ${x.level === 'warning' ? a.warning : ''}`} role={x.level === 'warning' ? 'alert' : 'status'} aria-label={`Announcement: ${x.title}`}>
          <span className={a.label}>{x.level === 'warning' ? 'HEADS UP' : 'NEWS'}</span>
          <span className={a.text}>
            <strong className={a.title}>{x.title}</strong>
            {x.body && <span className={a.body}>{x.body}</span>}
          </span>
          <button
            type="button"
            className={a.close}
            aria-label={`Hide announcement: ${x.title}`}
            onClick={() => {
              hideAnnouncement(x.id);
              setHidden((h) => [...h, x.id]);
            }}
          >
            Hide
          </button>
        </section>
      ))}
    </div>
  );
}

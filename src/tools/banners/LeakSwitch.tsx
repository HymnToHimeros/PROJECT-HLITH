import { setHideLeaks, useHideLeaks } from './leakPref';
import b from './banners.module.css';

/** The "Hide leaks" switch, remembered in this browser. */
export function LeakSwitch() {
  const hide = useHideLeaks();
  return (
    <label className={b.toggle}>
      <input type="checkbox" role="switch" checked={hide} onChange={(e) => setHideLeaks(e.target.checked)} />
      Hide leaks
    </label>
  );
}

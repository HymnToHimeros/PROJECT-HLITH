/**
 * Honest data: a value is either proven or missing, never guessed.
 * Every number the app shows travels in a Known<T>.
 */
export type DataSource = 'official' | 'hoyolab' | 'import' | 'scan' | 'user' | 'assistant' | 'leak';

export type FixAction = 'connect-account' | 'import-history' | 'import-build' | 'enter-manually' | 'scan-screenshot';

export type Known<T> =
  | { known: true; value: T; source: DataSource; at: string }
  | { known: false; fix?: FixAction };

export const known = <T>(value: T, source: DataSource, at: string = new Date().toISOString()): Known<T> => ({
  known: true,
  value,
  source,
  at,
});

export const unknown = <T = never>(fix?: FixAction): Known<T> => (fix ? { known: false, fix } : { known: false });

/** The words shown after "No data yet ·". */
export const FIX_LABEL: Record<FixAction, string> = {
  'connect-account': 'Connect account',
  'import-history': 'Import',
  'import-build': 'Import build',
  'enter-manually': 'Add it',
  'scan-screenshot': 'Scan a screenshot',
};

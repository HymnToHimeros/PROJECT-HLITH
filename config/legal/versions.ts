/**
 * The current versions of the Terms of service and the Privacy policy (T62). Everyone accepts
 * them once before using HLIÐSKJÁLF. To ask everyone again after a real change: raise the number
 * here AND in a new migration (public.terms_version() / public.privacy_version(), first set in
 * supabase/migrations/0016_first_run.sql). tests/firstRun.test.ts keeps both equal.
 */
export const LEGAL_VERSIONS = { terms: 1, privacy: 1 } as const;

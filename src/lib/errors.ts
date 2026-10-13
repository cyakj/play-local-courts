/**
 * Best-effort human message from anything thrown or returned as an error.
 * Supabase/PostgREST errors are plain objects ({ message, code, details }), not `Error` instances,
 * so `e instanceof Error` alone would hide the real cause behind a generic fallback.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown };
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.details === 'string' && o.details) return o.details;
  }
  if (typeof e === 'string' && e) return e;
  return fallback;
}

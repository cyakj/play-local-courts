// "14:30" -> "2:30 PM", "09:00" -> "9:00 AM". Mirrors the per-screen copy
// already duplicated in my-reservations.tsx — kept here once so new
// admin components don't add a 4th copy.
export function formatTime12h(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mins = m && m !== '00' ? `:${m}` : ':00';
  return `${display}${mins} ${suffix}`;
}

// "2026-08-20" -> "Aug 20, 2026"
export function formatDateFull(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

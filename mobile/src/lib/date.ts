const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());

export function shiftDate(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

export function prettyDate(iso: string) {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === shiftDate(t, -1)) return 'Yesterday';
  if (iso === shiftDate(t, 1)) return 'Tomorrow';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function relativeDays(isoDateTime: string) {
  const days = Math.floor((Date.now() - new Date(isoDateTime).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export function defaultMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast' as const;
  if (h < 15) return 'lunch' as const;
  if (h < 21) return 'dinner' as const;
  return 'snack' as const;
}

// Utility helpers — no unused imports
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatWeight(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  return `${kg} kg`;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending:    'bg-amber-500/20 text-amber-400 border-amber-500/30',
    accepted:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
    packed:     'bg-purple-500/20 text-purple-400 border-purple-500/30',
    shipped:    'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    delivered:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    cancelled:  'bg-red-500/20 text-red-400 border-red-500/30',
    paid:       'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    failed:     'bg-red-500/20 text-red-400 border-red-500/30',
    refunded:   'bg-slate-500/20 text-slate-400 border-slate-500/30',
    available:  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    reserved:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
    sold:       'bg-blue-500/20 text-blue-400 border-blue-500/30',
    expired:    'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return map[status] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

export function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    fresh:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    sprouted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    rotten:   'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return map[category] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30';
}

export function getCategoryIcon(category: string): string {
  const map: Record<string, string> = {
    fresh: '🧅',
    sprouted: '🌱',
    rotten: '♻️',
  };
  return map[category] ?? '🧅';
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

export function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Extracts a human-readable error message from an Axios error response.
 * Falls back to `fallback` (default: 'Something went wrong') when no
 * server message is present.
 *
 * Single source of truth — import this instead of defining a local copy.
 */
export function extractMessage(
  err: unknown,
  fallback = 'Something went wrong'
): string {
  return (
    (err as { response?: { data?: { message?: string } } })
      ?.response?.data?.message ?? fallback
  );
}

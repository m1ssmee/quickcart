export interface LedgerEntry {
  chargeId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'declined' | 'refunded';
  networkReference: string;
  createdAt: Date;
}

const entries: LedgerEntry[] = [];

export async function recordCharge(entry: LedgerEntry): Promise<void> {
  entries.push(entry);
}

export function chargesForOrder(orderId: string): LedgerEntry[] {
  return entries.filter((e) => e.orderId === orderId);
}

export function settledTotal(currency: string, since: Date): number {
  return entries
    .filter((e) => e.currency === currency && e.status === 'succeeded' && e.createdAt >= since)
    .reduce((sum, e) => sum + e.amount, 0);
}

export async function markRefunded(chargeId: string): Promise<LedgerEntry> {
  const entry = entries.find((e) => e.chargeId === chargeId);
  if (!entry) throw new Error(`charge ${chargeId} not found`);
  if (entry.status !== 'succeeded') throw new Error(`charge ${chargeId} cannot be refunded from ${entry.status}`);
  entry.status = 'refunded';
  return entry;
}

export function dailySummary(day: Date): { count: number; succeeded: number; declined: number } {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const todays = entries.filter((e) => e.createdAt >= start && e.createdAt < end);
  return {
    count: todays.length,
    succeeded: todays.filter((e) => e.status === 'succeeded').length,
    declined: todays.filter((e) => e.status === 'declined').length,
  };
}

// TODO: export the daily summary to the finance reporting bucket

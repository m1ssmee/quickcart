import { randomUUID } from 'node:crypto';
import { available, decrement, increment, withSkuLock } from './stock';

export interface ReservationLine {
  sku: string;
  quantity: number;
}

export type ReservationResult = { ok: true; id: string } | { ok: false; missing: string[] };

const reservations = new Map<string, { lines: ReservationLine[]; expiresAt: number }>();
const RESERVATION_TTL_MS = 10 * 60 * 1000;

export async function reserveStock(lines: ReservationLine[], now = Date.now()): Promise<ReservationResult> {
  const missing = lines.filter((l) => available(l.sku) < l.quantity).map((l) => l.sku);
  if (missing.length) return { ok: false, missing };

  const taken: ReservationLine[] = [];
  try {
    for (const line of lines) {
      await withSkuLock(line.sku, () => decrement(line.sku, line.quantity));
      taken.push(line);
    }
  } catch {
    for (const line of taken) await withSkuLock(line.sku, () => increment(line.sku, line.quantity));
    return { ok: false, missing: lines.filter((l) => !taken.includes(l)).map((l) => l.sku) };
  }

  const id = `res_${randomUUID().slice(0, 8)}`;
  reservations.set(id, { lines, expiresAt: now + RESERVATION_TTL_MS });
  return { ok: true, id };
}

export async function releaseReservation(id: string): Promise<void> {
  const reservation = reservations.get(id);
  if (!reservation) return;
  reservations.delete(id);
  for (const line of reservation.lines) await withSkuLock(line.sku, () => increment(line.sku, line.quantity));
}

export async function expireReservations(now = Date.now()): Promise<number> {
  let expired = 0;
  for (const [id, reservation] of reservations) {
    if (reservation.expiresAt <= now) {
      await releaseReservation(id);
      expired++;
    }
  }
  return expired;
}

export interface Product {
  sku: string;
  name: string;
  priceMinor: number;
  currency: string;
}

const products = new Map<string, Product>([
  ['TEA-001', { sku: 'TEA-001', name: 'Assam breakfast tea, 250g', priceMinor: 450, currency: 'EUR' }],
  ['MUG-014', { sku: 'MUG-014', name: 'Stoneware mug, 350ml', priceMinor: 1200, currency: 'EUR' }],
  ['KET-002', { sku: 'KET-002', name: 'Stovetop kettle, 1.5l', priceMinor: 3900, currency: 'EUR' }],
  ['FIL-030', { sku: 'FIL-030', name: 'Paper filters, pack of 100', priceMinor: 350, currency: 'EUR' }],
]);

const onHand = new Map<string, number>([
  ['TEA-001', 140],
  ['MUG-014', 32],
  ['KET-002', 9],
  ['FIL-030', 400],
]);

// Serialises stock changes per SKU so concurrent reservations cannot oversell.
const locks = new Map<string, Promise<void>>();

export async function withSkuLock<T>(sku: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = locks.get(sku) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => (release = resolve));
  locks.set(sku, previous.then(() => current));
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(sku) === current) locks.delete(sku);
  }
}

export function available(sku: string): number {
  return onHand.get(sku) ?? 0;
}

/** Decrements stock. Callers must hold the SKU lock (see reservations.ts). */
export function decrement(sku: string, quantity: number): void {
  const current = available(sku);
  if (current < quantity) throw new Error(`insufficient stock for ${sku}`);
  onHand.set(sku, current - quantity);
}

export function increment(sku: string, quantity: number): void {
  onHand.set(sku, available(sku) + quantity);
}

export function listProducts(): (Product & { available: number })[] {
  return [...products.values()].map((p) => ({ ...p, available: available(p.sku) }));
}

// All amounts inside services are integers in minor units (cents, pence).

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

export function formatMoney(minor: number, currency: string, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(fromMinorUnits(minor));
}

export function addTax(minor: number, ratePercent: number): number {
  return Math.round(minor * (1 + ratePercent / 100));
}

export function splitEvenly(minor: number, parts: number): number[] {
  if (parts <= 0) throw new Error('parts must be positive');
  const base = Math.floor(minor / parts);
  const remainder = minor - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function sumMinor(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

export function percentOf(minor: number, percent: number): number {
  return Math.round((minor * percent) / 100);
}

export function isSameAmount(a: number, b: number): boolean {
  return Number.isInteger(a) && Number.isInteger(b) && a === b;
}

// TODO: support currencies with three decimal places (KWD, BHD)

export function roundToNearest(minor: number, step: number): number {
  return Math.round(minor / step) * step;
}

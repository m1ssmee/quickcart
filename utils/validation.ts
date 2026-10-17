// Input validation and normalisation shared by every service.
// Each validator returns a ValidationResult so callers can collect all errors at once.

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

export function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(field: string, message: string): ValidationResult<T> {
  return { ok: false, errors: [{ field, message }] };
}

export function combine<T extends Record<string, unknown>>(results: { [K in keyof T]: ValidationResult<T[K]> }): ValidationResult<T> {
  const errors: ValidationError[] = [];
  const value = {} as T;
  for (const key of Object.keys(results) as (keyof T)[]) {
    const result = results[key];
    if (result.ok) value[key] = result.value;
    else errors.push(...result.errors);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function formatErrors(errors: ValidationError[]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join('; ');
}

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

export function requiredString(field: string, input: unknown, maxLength = 255): ValidationResult<string> {
  if (typeof input !== 'string') return fail(field, 'must be a string');
  const value = input.trim();
  if (!value) return fail(field, 'is required');
  if (value.length > maxLength) return fail(field, `must be at most ${maxLength} characters`);
  return ok(value);
}

export function optionalString(field: string, input: unknown, maxLength = 255): ValidationResult<string | undefined> {
  if (input === undefined || input === null || input === '') return ok(undefined);
  return requiredString(field, input, maxLength);
}

export function oneOf<T extends string>(field: string, input: unknown, allowed: readonly T[]): ValidationResult<T> {
  if (typeof input !== 'string' || !allowed.includes(input as T)) {
    return fail(field, `must be one of ${allowed.join(', ')}`);
  }
  return ok(input as T);
}

export function slug(field: string, input: unknown): ValidationResult<string> {
  const result = requiredString(field, input, 80);
  if (!result.ok) return result;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.value)) return fail(field, 'must be lowercase letters, digits and hyphens');
  return result;
}

export function normaliseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function truncate(input: string, maxLength: number, suffix = '…'): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, Math.max(0, maxLength - suffix.length)) + suffix;
}

export function stripControlCharacters(input: string): string {
  return input.replace(/[\u0000-\u001f\u007f]/g, '');
}

// ---------------------------------------------------------------------------
// Identity and contact details
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function email(field: string, input: unknown): ValidationResult<string> {
  const result = requiredString(field, input, 254);
  if (!result.ok) return result;
  const value = result.value.toLowerCase();
  if (!EMAIL_PATTERN.test(value)) return fail(field, 'must be a valid email address');
  return ok(value);
}

export function password(field: string, input: unknown): ValidationResult<string> {
  if (typeof input !== 'string') return fail(field, 'must be a string');
  if (input.length < 12) return fail(field, 'must be at least 12 characters');
  if (input.length > 128) return fail(field, 'must be at most 128 characters');
  if (!/[a-z]/.test(input) || !/[A-Z]/.test(input) || !/[0-9]/.test(input)) {
    return fail(field, 'must contain upper and lower case letters and a digit');
  }
  return ok(input);
}

export function phoneNumber(field: string, input: unknown): ValidationResult<string> {
  const result = requiredString(field, input, 32);
  if (!result.ok) return result;
  const digits = result.value.replace(/[\s().-]/g, '');
  if (!/^\+?[0-9]{7,15}$/.test(digits)) return fail(field, 'must be a valid phone number');
  return ok(digits.startsWith('+') ? digits : `+${digits}`);
}

export function personName(field: string, input: unknown): ValidationResult<string> {
  const result = requiredString(field, input, 120);
  if (!result.ok) return result;
  const value = normaliseWhitespace(stripControlCharacters(result.value));
  if (/[0-9<>]/.test(value)) return fail(field, 'contains invalid characters');
  return ok(value);
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
}

const POSTAL_PATTERNS: Record<string, RegExp> = {
  GB: /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i,
  US: /^[0-9]{5}(?:-[0-9]{4})?$/,
  DE: /^[0-9]{5}$/,
  FR: /^[0-9]{5}$/,
  NL: /^[0-9]{4} ?[A-Z]{2}$/i,
  IN: /^[1-9][0-9]{5}$/,
};

export const SHIPPING_COUNTRIES = Object.keys(POSTAL_PATTERNS);

export function countryCode(field: string, input: unknown): ValidationResult<string> {
  if (typeof input !== 'string' || !/^[A-Za-z]{2}$/.test(input)) return fail(field, 'must be a two-letter country code');
  const value = input.toUpperCase();
  if (!SHIPPING_COUNTRIES.includes(value)) return fail(field, `we do not ship to ${value}`);
  return ok(value);
}

export function postalCode(field: string, input: unknown, country: string): ValidationResult<string> {
  const result = requiredString(field, input, 12);
  if (!result.ok) return result;
  const pattern = POSTAL_PATTERNS[country];
  if (pattern && !pattern.test(result.value)) return fail(field, `is not a valid postal code for ${country}`);
  return ok(result.value.toUpperCase());
}

export function address(field: string, input: unknown): ValidationResult<Address> {
  if (!input || typeof input !== 'object') return fail(field, 'must be an object');
  const raw = input as Record<string, unknown>;
  const country = countryCode(`${field}.country`, raw.country);
  return combine<Address>({
    line1: requiredString(`${field}.line1`, raw.line1, 200),
    line2: optionalString(`${field}.line2`, raw.line2, 200),
    city: requiredString(`${field}.city`, raw.city, 100),
    postalCode: country.ok ? postalCode(`${field}.postalCode`, raw.postalCode, country.value) : requiredString(`${field}.postalCode`, raw.postalCode, 12),
    country,
  });
}

// ---------------------------------------------------------------------------
// Numbers, quantities and money
// ---------------------------------------------------------------------------

export function integer(field: string, input: unknown, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): ValidationResult<number> {
  const value = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
  if (typeof value !== 'number' || !Number.isInteger(value)) return fail(field, 'must be an integer');
  if (value < min) return fail(field, `must be at least ${min}`);
  if (value > max) return fail(field, `must be at most ${max}`);
  return ok(value);
}

export function quantity(field: string, input: unknown): ValidationResult<number> {
  return integer(field, input, 1, 99);
}

export function amountMinor(field: string, input: unknown): ValidationResult<number> {
  return integer(field, input, 1, 10_000_000);
}

export const CURRENCIES = ['EUR', 'USD', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export function currency(field: string, input: unknown): ValidationResult<Currency> {
  if (typeof input === 'string') return oneOf(field, input.toUpperCase(), CURRENCIES);
  return fail(field, 'must be a currency code');
}

export function percentage(field: string, input: unknown): ValidationResult<number> {
  if (typeof input !== 'number' || Number.isNaN(input)) return fail(field, 'must be a number');
  if (input < 0 || input > 100) return fail(field, 'must be between 0 and 100');
  return ok(input);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

const PREFIXED_ID = /^(ord|ch|res|usr|pm)_[a-z0-9]{6,16}$/;

export function prefixedId(field: string, input: unknown, prefix: 'ord' | 'ch' | 'res' | 'usr' | 'pm'): ValidationResult<string> {
  if (typeof input !== 'string' || !PREFIXED_ID.test(input) || !input.startsWith(`${prefix}_`)) {
    return fail(field, `must be a ${prefix}_ identifier`);
  }
  return ok(input);
}

export function sku(field: string, input: unknown): ValidationResult<string> {
  if (typeof input !== 'string' || !/^[A-Z]{3}-[0-9]{3}$/.test(input.toUpperCase())) {
    return fail(field, 'must look like ABC-123');
  }
  return ok(input.toUpperCase());
}

export function uuid(field: string, input: unknown): ValidationResult<string> {
  if (typeof input !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)) {
    return fail(field, 'must be a UUID');
  }
  return ok(input.toLowerCase());
}

// ---------------------------------------------------------------------------
// Dates and times
// ---------------------------------------------------------------------------

export function isoDate(field: string, input: unknown): ValidationResult<Date> {
  if (typeof input !== 'string') return fail(field, 'must be an ISO 8601 string');
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return fail(field, 'must be a valid date');
  return ok(date);
}

export function futureDate(field: string, input: unknown, now = new Date()): ValidationResult<Date> {
  const result = isoDate(field, input);
  if (!result.ok) return result;
  if (result.value <= now) return fail(field, 'must be in the future');
  return result;
}

export function dateRange(field: string, from: unknown, to: unknown): ValidationResult<{ from: Date; to: Date }> {
  const start = isoDate(`${field}.from`, from);
  const end = isoDate(`${field}.to`, to);
  if (!start.ok || !end.ok) return combine({ from: start, to: end });
  if (start.value > end.value) return fail(field, 'from must be before to');
  const days = (end.value.getTime() - start.value.getTime()) / 86_400_000;
  if (days > 366) return fail(field, 'range must be at most one year');
  return ok({ from: start.value, to: end.value });
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function nextBusinessDay(date: Date): Date {
  let next = addDays(startOfDay(date), 1);
  while (isWeekend(next)) next = addDays(next, 1);
  return next;
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export function luhnCheck(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function cardNumber(field: string, input: unknown): ValidationResult<string> {
  if (typeof input !== 'string') return fail(field, 'must be a string');
  const digits = input.replace(/[\s-]/g, '');
  if (!/^[0-9]{12,19}$/.test(digits)) return fail(field, 'must be 12 to 19 digits');
  if (!luhnCheck(digits)) return fail(field, 'is not a valid card number');
  return ok(digits);
}

export function cardExpiry(field: string, month: unknown, year: unknown, now = new Date()): ValidationResult<{ month: number; year: number }> {
  const m = integer(`${field}.month`, month, 1, 12);
  const y = integer(`${field}.year`, year, now.getFullYear(), now.getFullYear() + 20);
  if (!m.ok || !y.ok) return combine({ month: m, year: y });
  const lastDay = new Date(y.value, m.value, 0, 23, 59, 59);
  if (lastDay < now) return fail(field, 'card has expired');
  return ok({ month: m.value, year: y.value });
}

export function maskCardNumber(digits: string): string {
  return digits.length <= 4 ? digits : `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Collections and requests
// ---------------------------------------------------------------------------

export function arrayOf<T>(field: string, input: unknown, item: (field: string, value: unknown) => ValidationResult<T>, maxItems = 100): ValidationResult<T[]> {
  if (!Array.isArray(input)) return fail(field, 'must be an array');
  if (input.length > maxItems) return fail(field, `must contain at most ${maxItems} items`);
  const values: T[] = [];
  const errors: ValidationError[] = [];
  input.forEach((value, index) => {
    const result = item(`${field}[${index}]`, value);
    if (result.ok) values.push(result.value);
    else errors.push(...result.errors);
  });
  return errors.length ? { ok: false, errors } : ok(values);
}

export interface Pagination {
  limit: number;
  offset: number;
}

export function pagination(query: Record<string, unknown>): ValidationResult<Pagination> {
  return combine<Pagination>({
    limit: query.limit === undefined ? ok(20) : integer('limit', query.limit, 1, 100),
    offset: query.offset === undefined ? ok(0) : integer('offset', query.offset, 0),
  });
}

export interface OrderLineInput {
  sku: string;
  quantity: number;
}

export function orderLine(field: string, input: unknown): ValidationResult<OrderLineInput> {
  if (!input || typeof input !== 'object') return fail(field, 'must be an object');
  const raw = input as Record<string, unknown>;
  return combine<OrderLineInput>({ sku: sku(`${field}.sku`, raw.sku), quantity: quantity(`${field}.quantity`, raw.quantity) });
}

export function orderLines(input: unknown): ValidationResult<OrderLineInput[]> {
  const result = arrayOf('lines', input, orderLine, 50);
  if (!result.ok) return result;
  if (result.value.length === 0) return fail('lines', 'must contain at least one item');
  const seen = new Set<string>();
  for (const line of result.value) {
    if (seen.has(line.sku)) return fail('lines', `duplicate sku ${line.sku}`);
    seen.add(line.sku);
  }
  return result;
}

export function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Display formatting
// ---------------------------------------------------------------------------

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  return normaliseWhitespace(name)
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function maskEmail(value: string): string {
  const [local, domain] = value.split('@');
  if (!domain) return value;
  return `${local.slice(0, 1)}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
}

export function formatOrderReference(orderId: string): string {
  return orderId.replace(/^ord_/, '').toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
}

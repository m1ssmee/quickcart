import { randomUUID } from 'node:crypto';
import { toMinorUnits } from '../utils/money';

export type OrderStatus = 'pending' | 'paid' | 'payment_failed' | 'cancelled';

export interface OrderLine {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  lines: OrderLine[];
  currency: string;
  status: OrderStatus;
  chargeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orders = new Map<string, Order>();

export function createOrder(userId: string, lines: OrderLine[], currency = 'EUR'): Order {
  if (lines.length === 0) throw new Error('order must contain at least one line');
  for (const line of lines) {
    if (line.quantity <= 0) throw new Error(`invalid quantity for ${line.sku}`);
    if (line.unitPrice < 0) throw new Error(`invalid price for ${line.sku}`);
  }
  const now = new Date();
  const order: Order = { id: `ord_${randomUUID().slice(0, 8)}`, userId, lines, currency, status: 'pending', createdAt: now, updatedAt: now };
  orders.set(order.id, order);
  return order;
}

export function orderTotal(order: Order): number {
  return order.lines.reduce((sum, line) => sum + toMinorUnits(line.unitPrice) * line.quantity, 0);
}

export function getOrder(id: string): Order | undefined {
  return orders.get(id);
}

export function updateStatus(id: string, status: OrderStatus, chargeId?: string): Order {
  const order = orders.get(id);
  if (!order) throw new Error(`order ${id} not found`);
  order.status = status;
  if (chargeId) order.chargeId = chargeId;
  order.updatedAt = new Date();
  return order;
}

export function ordersForUser(userId: string): Order[] {
  return [...orders.values()].filter((o) => o.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// TODO: persist orders to Postgres instead of keeping them in memory

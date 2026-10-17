import { SERVICES } from '../gateway/config';
import { forward, UpstreamTimeoutError } from '../gateway/proxy';
import { reserveStock, releaseReservation } from '../inventory/reservations';
import { getOrder, orderTotal, updateStatus, type Order } from './orders';
import { log } from '../utils/logger';

export interface ChargeResponse {
  chargeId: string;
  status: 'succeeded' | 'declined';
}

export interface CheckoutResult {
  order: Order;
  charged: boolean;
  reason?: string;
}

const MAX_PAYMENT_ATTEMPTS = 2;

async function requestCharge(order: Order, paymentMethodId: string): Promise<ChargeResponse> {
  return forward<ChargeResponse>(SERVICES.payments, {
    method: 'POST',
    path: '/payments/charges',
    body: {
      order_id: order.id,
      amount: orderTotal(order),
      currency: order.currency,
      payment_method_id: paymentMethodId,
    },
  });
}

export async function checkout(orderId: string, paymentMethodId: string): Promise<CheckoutResult> {
  const order = getOrder(orderId);
  if (!order) throw new Error(`order ${orderId} not found`);
  if (order.status === 'paid') return { order, charged: false, reason: 'already paid' };

  const reservation = await reserveStock(order.lines.map((l) => ({ sku: l.sku, quantity: l.quantity })));
  if (!reservation.ok) {
    return { order, charged: false, reason: `out of stock: ${reservation.missing.join(', ')}` };
  }

  let charge: ChargeResponse | undefined;
  for (let attempt = 1; attempt <= MAX_PAYMENT_ATTEMPTS; attempt++) {
    try {
      charge = await requestCharge(order, paymentMethodId);
      break;
    } catch (err) {
      // retry added to fix flaky checkouts
      if (err instanceof UpstreamTimeoutError && attempt < MAX_PAYMENT_ATTEMPTS) {
        log('warn', 'payment timed out, retrying', { orderId: order.id, attempt });
        continue;
      }
      await releaseReservation(reservation.id);
      updateStatus(order.id, 'payment_failed');
      log('error', 'checkout failed', { orderId: order.id, error: String(err) });
      return { order, charged: false, reason: 'payment unavailable' };
    }
  }

  if (!charge || charge.status !== 'succeeded') {
    await releaseReservation(reservation.id);
    updateStatus(order.id, 'payment_failed');
    return { order, charged: false, reason: 'payment declined' };
  }

  updateStatus(order.id, 'paid', charge.chargeId);
  log('info', 'checkout complete', { orderId: order.id, chargeId: charge.chargeId });
  return { order, charged: true };
}

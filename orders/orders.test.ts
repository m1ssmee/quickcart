import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, orderTotal, updateStatus, getOrder } from './orders';

test('order totals are computed in minor units', () => {
  const order = createOrder('user_1', [
    { sku: 'TEA-001', quantity: 2, unitPrice: 4.5 },
    { sku: 'MUG-014', quantity: 1, unitPrice: 12 },
  ]);
  assert.equal(orderTotal(order), 2100);
});

test('empty orders are rejected', () => {
  assert.throws(() => createOrder('user_1', []), /at least one line/);
});

test('negative quantities are rejected', () => {
  assert.throws(() => createOrder('user_1', [{ sku: 'TEA-001', quantity: -1, unitPrice: 4.5 }]), /invalid quantity/);
});

test('status updates are persisted', () => {
  const order = createOrder('user_2', [{ sku: 'TEA-001', quantity: 1, unitPrice: 4.5 }]);
  updateStatus(order.id, 'paid', 'ch_123');
  assert.equal(getOrder(order.id)?.status, 'paid');
  assert.equal(getOrder(order.id)?.chargeId, 'ch_123');
});

test('orders for a user are newest first', async () => {
  const first = createOrder('user_3', [{ sku: 'TEA-001', quantity: 1, unitPrice: 4.5 }]);
  await new Promise((r) => setTimeout(r, 5));
  const second = createOrder('user_3', [{ sku: 'MUG-014', quantity: 1, unitPrice: 12 }]);
  const { ordersForUser } = await import('./orders');
  assert.deepEqual(ordersForUser('user_3').map((o) => o.id), [second.id, first.id]);
});

test('unknown orders cannot be updated', () => {
  assert.throws(() => updateStatus('ord_missing', 'paid'), /not found/);
});

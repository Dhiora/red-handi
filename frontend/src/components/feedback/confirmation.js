const confirmedStatuses = new Set(['confirmed', 'preparing', 'ready', 'out_for_delivery']);

export function shouldCelebrateOrder({order, routeId, requested, previousStatus, seen}) {
  return Boolean(
    order && String(order._id) === routeId && !seen &&
    order.paymentStatus === 'paid' && order.confirmedAt &&
    confirmedStatuses.has(order.status) &&
    (requested || previousStatus === 'pending_payment')
  );
}

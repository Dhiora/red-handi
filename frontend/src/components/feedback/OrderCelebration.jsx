import {useEffect, useRef, useState} from 'react';
import {Dialog} from 'radix-ui';
import {Check, Clock, ShoppingBag, Truck, X} from 'lucide-react';
import {formatDate, formatTime} from '../../api';
import {BrandMark} from './BrandLoader';
import {shouldCelebrateOrder} from './confirmation';

export function useOrderCelebration(order, routeId, requested) {
  const [celebration, setCelebration] = useState(null);
  const previous = useRef({id: null, status: null});
  const shown = useRef(new Set());

  useEffect(() => {
    if (!order || String(order._id) !== routeId) return;
    const key = `rh-celebrated:${routeId}`;
    let seen = shown.current.has(routeId);
    try { seen ||= sessionStorage.getItem(key) === 'yes'; } catch { /* In-memory guard still prevents repeats. */ }
    const previousStatus = previous.current.id === routeId ? previous.current.status : null;
    if (shouldCelebrateOrder({order, routeId, requested, previousStatus, seen})) {
      shown.current.add(routeId);
      try { sessionStorage.setItem(key, 'yes'); } catch { /* Storage is optional. */ }
      setCelebration(order);
    }
    previous.current = {id: routeId, status: order.status};
  }, [order, routeId, requested]);

  // A cancellation, navigation, or completion must never leave a stale success dialog over the page.
  const visible = celebration && String(celebration._id) === routeId &&
    order && !['cancelled', 'expired', 'completed'].includes(order.status);
  return {celebration: visible ? celebration : null, dismiss: () => setCelebration(null)};
}

const confetti = Array.from({length: 24}, (_, i) => ({
  left: `${8 + ((i * 37) % 84)}%`,
  delay: `${(i % 6) * 0.085}s`,
  drift: `${((i * 29) % 140) - 70}px`,
  spin: `${(i % 2 ? 1 : -1) * (160 + i * 21)}deg`,
}));

export default function OrderCelebration({order, onClose}) {
  const button = useRef(null);
  return (
    <Dialog.Root open={Boolean(order)} onOpenChange={open => {if (!open) onClose();}}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay rh-celebration-overlay" />
        <Dialog.Content className="rh-celebration" onOpenAutoFocus={event => {event.preventDefault(); button.current?.focus();}}>
          {order && <>
            <div className="rh-confetti" aria-hidden="true">{confetti.map((piece, i) =>
              <i key={i} style={{left: piece.left, '--delay': piece.delay, '--drift': piece.drift, '--spin': piece.spin, '--confetti-color': ['#b9261d', '#dfb657', '#758157'][i % 3]}} />
            )}</div>
            <Dialog.Close className="close-button" aria-label="Close order confirmation"><X size={19} /></Dialog.Close>
            <span className="rh-feedback-eyebrow">{order.preview ? 'PREVIEW ORDER CONFIRMED' : 'YOUR CRAVING IS CONFIRMED'}</span>
            <div className="rh-celebration-art">
              <BrandMark celebrating />
              <span className="rh-success-seal"><Check size={27} strokeWidth={3} /></span>
            </div>
            <Dialog.Title className="rh-celebration-title">Good things are<br /><em>on their way.</em></Dialog.Title>
            <Dialog.Description className="rh-celebration-description">
              {order.preview ? 'That’s how a happy handi begins. This is a preview; no payment was taken or food ordered.' : 'Your order is in. We’ll take it from here—one delicious handi at a time.'}
            </Dialog.Description>
            <div className="rh-confirmed-slot">
              {order.fulfilment === 'delivery' ? <Truck size={21} /> : <ShoppingBag size={21} />}
              <div><span>{order.fulfilment === 'delivery' ? 'YOUR DELIVERY SLOT' : 'YOUR PICKUP TIME'}</span><strong>{formatTime(order.scheduledAt)} · {formatDate(order.scheduledAt)}</strong></div>
            </div>
            <span className="rh-confirmed-reference">{order.number}</span>
            <button ref={button} className="button red full" onClick={onClose}>Track my handi</button>
            <p className="rh-confirmed-policy"><Clock size={14} /> Free cancellation for 3 minutes from confirmation.</p>
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

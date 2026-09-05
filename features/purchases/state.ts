export type PurchaseStatus = 'unavailable' | 'loading' | 'cancelled' | 'denied' | 'restored' | 'entitled';

export interface PurchaseState {
  configured: boolean;
  entitled: boolean;
  localizedPrice: string | null;
  status: PurchaseStatus;
  message: string;
}

export const unavailablePurchaseState: PurchaseState = {
  configured: false,
  entitled: false,
  localizedPrice: null,
  status: 'unavailable',
  message: 'Apple purchasing is unavailable right now. The free game remains fully playable.',
};

export const loadingPurchaseState: PurchaseState = {
  configured: true,
  entitled: false,
  localizedPrice: null,
  status: 'loading',
  message: 'Checking your Apple purchase…',
};

export function applyVerifiedPurchase(previous: PurchaseState, next: PurchaseState): PurchaseState {
  if (!next.configured || !next.entitled || next.status !== 'entitled') {
    return { ...next, entitled: previous.entitled && previous.configured };
  }
  return next;
}
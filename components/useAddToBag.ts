'use client';
import { useCallback } from 'react';
import { useCart } from '@/lib/cart';
import { flyToBag } from '@/lib/fly';
import type { Product } from '@/lib/products';

/** Only animates (and opens the drawer) if the cart actually accepts the item. */
export function useAddToBag() {
  const { add, canAdd, setOpen } = useCart();
  return useCallback(async (p: Product, from: DOMRect) => {
    if (!canAdd(p.id)) { setOpen(true); return false; }
    await flyToBag(from, p);
    const ok = add(p);
    if (ok) setOpen(true);
    return ok;
  }, [add, canAdd, setOpen]);
}

'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Product } from './products';
import { PRODUCTS } from './products';

export type CartLine = { id: string; qty: number };
const MAX_QTY = 9;

type CartCtx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  canAdd: (id: string) => boolean;
  add: (p: Product) => boolean;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
};

const Ctx = createContext<CartCtx | null>(null);
export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCart outside CartProvider');
  return c;
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('velune-cart');
      if (raw) setLines(JSON.parse(raw));
    } catch {}
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem('velune-cart', JSON.stringify(lines)); } catch {}
  }, [lines, hydrated]);

  const canAdd = useCallback((id: string) => (lines.find((l) => l.id === id)?.qty ?? 0) < MAX_QTY, [lines]);

  const add = useCallback((p: Product) => {
    if (!canAdd(p.id)) return false;
    setLines((ls) => {
      const found = ls.find((l) => l.id === p.id);
      return found ? ls.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { id: p.id, qty: 1 }];
    });
    return true;
  }, [canAdd]);

  const setQty = useCallback((id: string, qty: number) => {
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qty: Math.min(qty, MAX_QTY) } : l))));
  }, []);
  const remove = useCallback((id: string) => setLines((ls) => ls.filter((l) => l.id !== id)), []);

  const value = useMemo<CartCtx>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const subtotal = lines.reduce((n, l) => n + l.qty * (PRODUCTS.find((p) => p.id === l.id)?.price ?? 0), 0);
    return { lines, count, subtotal, open, setOpen, canAdd, add, setQty, remove };
  }, [lines, open, canAdd, add, setQty, remove]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

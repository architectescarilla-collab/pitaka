import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { seedData } from './seed';
import type { Data } from './types';
import { balances } from './money';

const KEY = 'pitaka:data:v1';

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Data;
      if (d && d.version === 1 && Array.isArray(d.accounts)) return d;
    }
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return seedData();
}

interface Store {
  data: Data;
  bal: Map<string, number>;
  /** Apply a change to a copy of the data. */
  update: (fn: (d: Data) => void) => void;
  replace: (d: Data) => void;
  saved: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(load);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [data]);

  const update = useCallback((fn: (d: Data) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const bal = useMemo(() => balances(data), [data]);
  const value = useMemo(() => ({ data, bal, update, replace: setData, saved }), [data, bal, update, saved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

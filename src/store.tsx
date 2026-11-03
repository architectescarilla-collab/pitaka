import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { seedData } from './seed';
import type { Data } from './types';
import { balances } from './money';
import { supabase, TABLE } from './supabase';

/** Data saved by the device-only version of Pitaka. */
export const LOCAL_KEY = 'pitaka:data:v1';
const cacheKey = (userId: string) => `pitaka:cache:${userId}`;

function isData(d: unknown): d is Data {
  return !!d && (d as Data).version === 1 && Array.isArray((d as Data).accounts) && Array.isArray((d as Data).txns);
}

function readJson(key: string): Data | null {
  try {
    const raw = localStorage.getItem(key);
    const d = raw ? JSON.parse(raw) : null;
    return isData(d) ? d : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, d: Data): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

/** Data left on this device by the earlier, device-only Pitaka, if any. */
export function deviceData(): Data | null {
  return readJson(LOCAL_KEY);
}

export type SyncState = 'local' | 'saving' | 'saved' | 'offline' | 'error';

interface Store {
  data: Data;
  bal: Map<string, number>;
  /** Apply a change to a copy of the data. */
  update: (fn: (d: Data) => void) => void;
  replace: (d: Data) => void;
  saved: boolean;
  sync: SyncState;
  email: string | null;
}

const Ctx = createContext<Store | null>(null);

/** Device-only mode: data lives in this browser's storage. */
export function LocalStoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(() => readJson(LOCAL_KEY) ?? seedData());
  const [saved, setSaved] = useState(true);
  useEffect(() => setSaved(writeJson(LOCAL_KEY, data)), [data]);
  return <Provide data={data} setData={setData} saved={saved} sync="local" email={null}>{children}</Provide>;
}

/** Signed-in mode: data lives in Supabase, cached on the device for quick start-up and offline use. */
export function CloudStoreProvider({ userId, email, initial, initialStamp, children }: { userId: string; email: string; initial: Data; initialStamp: string | null; children: ReactNode }) {
  const [data, setData] = useState<Data>(initial);
  const [sync, setSync] = useState<SyncState>('saved');
  const stamp = useRef<string | null>(initialStamp);
  const dirty = useRef(false);
  const first = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(data);
  latest.current = data;

  const push = useCallback(async () => {
    if (!supabase) return;
    setSync('saving');
    const now = new Date().toISOString();
    const { error } = await supabase.from(TABLE).upsert({ user_id: userId, data: latest.current, updated_at: now });
    if (error) {
      setSync(navigator.onLine ? 'error' : 'offline');
      return;
    }
    stamp.current = now;
    dirty.current = false;
    setSync('saved');
  }, [userId]);

  // Save a second after the last change.
  useEffect(() => {
    writeJson(cacheKey(userId), data);
    if (first.current) { first.current = false; return; }
    dirty.current = true;
    setSync('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(push, 800);
  }, [data, userId, push]);

  // When the app comes back into view, pick up changes made on another device, or retry a failed save.
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || !supabase) return;
      if (dirty.current) { push(); return; }
      const { data: row } = await supabase.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
      if (row && isData(row.data) && (!stamp.current || row.updated_at > stamp.current) && !dirty.current) {
        stamp.current = row.updated_at;
        first.current = true;
        setData(row.data);
      }
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }, [userId, push]);

  // Warn before closing with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return <Provide data={data} setData={setData} saved={sync !== 'error'} sync={sync} email={email}>{children}</Provide>;
}

export async function loadCloud(userId: string): Promise<{ data: Data | null; stamp: string | null; error?: string }> {
  if (!supabase) return { data: null, stamp: null };
  const { data: row, error } = await supabase.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) {
    const cached = readJson(cacheKey(userId));
    return { data: cached, stamp: null, error: error.message };
  }
  return { data: row && isData(row.data) ? row.data : null, stamp: row?.updated_at ?? null };
}

export async function createCloud(userId: string, d: Data): Promise<string | null> {
  if (!supabase) return 'Cloud storage is not set up.';
  const { error } = await supabase.from(TABLE).insert({ user_id: userId, data: d, updated_at: new Date().toISOString() });
  return error ? error.message : null;
}

function Provide({ data, setData, saved, sync, email, children }: { data: Data; setData: React.Dispatch<React.SetStateAction<Data>>; saved: boolean; sync: SyncState; email: string | null; children: ReactNode }) {
  const update = useCallback((fn: (d: Data) => void) => {
    setData((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, [setData]);
  const bal = useMemo(() => balances(data), [data]);
  const value = useMemo(() => ({ data, bal, update, replace: setData, saved, sync, email }), [data, bal, update, setData, saved, sync, email]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside a store provider');
  return s;
}

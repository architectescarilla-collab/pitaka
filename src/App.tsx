import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { Home } from './Home';
import { Activity } from './Activity';
import { Accounts, BalancesSheet } from './Accounts';
import { Plan } from './Plan';
import { Settings } from './Settings';
import { TxnEditor } from './TxnEditor';
import { Sheet } from './ui';
import { money } from './money';
import type { Adjustment, Txn } from './types';

type Tab = 'home' | 'activity' | 'accounts' | 'plan' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { id: 'activity', label: 'Activity', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'accounts', label: 'Accounts', icon: 'M3 7h18v12H3zM3 11h18M7 15h3' },
  { id: 'plan', label: 'Bills', icon: 'M7 3v3M17 3v3M4 8h16M5 5h14v15H5z' },
  { id: 'settings', label: 'Settings', icon: 'M4 7h9M17 7h3M15 5v4M4 17h3M11 17h9M9 15v4' },
];

function readTab(): Tab {
  const h = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === h) ? h : 'home';
}

function Shell() {
  const [tab, setTab] = useState<Tab>(readTab);
  const [editor, setEditor] = useState<{ txn?: Txn; kind?: 'expense' | 'repayment' } | null>(null);
  const [balances, setBalances] = useState(false);

  useEffect(() => {
    const on = () => setTab(readTab());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (t: Tab) => { location.hash = t; setTab(t); window.scrollTo(0, 0); };
  const edit = (t: Txn) => setEditor({ txn: t });

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><span className="brand-mark" aria-hidden="true">₱</span>Pitaka</span>
      </header>
      <main>
        {tab === 'home' && <Home onEdit={edit} onAddFirstBalance={() => setBalances(true)} />}
        {tab === 'activity' && <Activity onEdit={edit} />}
        {tab === 'accounts' && <Accounts onEdit={edit} onSetBalances={() => setBalances(true)} />}
        {tab === 'plan' && <Plan onAddRepayment={() => setEditor({ kind: 'repayment' })} />}
        {tab === 'settings' && <Settings />}
      </main>

      <button type="button" className="fab" aria-label="Add entry" onClick={() => setEditor({})}>+</button>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={t.icon} /></svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {editor && editor.txn?.kind === 'adjustment' && <AdjustmentSheet t={editor.txn} onClose={() => setEditor(null)} />}
      {editor && editor.txn?.kind !== 'adjustment' && <TxnEditor editing={editor.txn} initialKind={editor.kind} onClose={() => setEditor(null)} />}
      {balances && <BalancesSheet onClose={() => setBalances(false)} />}
    </div>
  );
}

function AdjustmentSheet({ t, onClose }: { t: Adjustment; onClose: () => void }) {
  const { data, update } = useStore();
  const a = data.accounts.find((x) => x.id === t.accountId);
  return (
    <Sheet title="Balance update" onClose={onClose} footer={<div className="row-actions"><button type="button" className="btn ghost danger" onClick={() => { update((d) => { d.txns = d.txns.filter((x) => x.id !== t.id); }); onClose(); }}>Delete</button><span className="spacer" /><button type="button" className="btn primary" onClick={onClose}>Done</button></div>}>
      <p>{a?.name}: {t.delta >= 0 ? '+' : ''}{money(t.delta, a?.currency ?? 'PHP')} on {t.date}.</p>
      <p className="muted small">{t.note ?? 'Balance correction'}. Balance updates make an account match its app without counting as income or spending. To change it, delete this one and update the balance again from Accounts.</p>
    </Sheet>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

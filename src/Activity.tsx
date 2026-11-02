import { useMemo, useState } from 'react';
import { useStore } from './store';
import { money, monthLabel, peso, phpValue } from './money';
import { AccountSelect } from './ui';
import type { Txn } from './types';

export function describe(t: Txn, name: (id: string) => string, rcv: (id: string) => string) {
  switch (t.kind) {
    case 'expense': return { title: t.description, sub: `${t.category} · ${name(t.accountId)}`, sign: -1 };
    case 'income': return { title: t.source, sub: `${t.category} · into ${name(t.accountId)}`, sign: 1 };
    case 'repayment': return { title: `${rcv(t.receivableId)} repayment`, sub: `Loan · into ${name(t.accountId)}`, sign: 1 };
    case 'adjustment': return { title: 'Balance update', sub: name(t.accountId), sign: t.delta >= 0 ? 1 : -1 };
    case 'transfer': {
      const label = { transfer: 'Transfer', card_payment: 'Card payment', investment: 'Investment', withdrawal: 'Cash withdrawal', conversion: 'Conversion' }[t.purpose];
      return { title: `${name(t.fromId)} → ${name(t.toId)}`, sub: label, sign: 0 };
    }
  }
}

export function TxnRow({ t, onClick }: { t: Txn; onClick: () => void }) {
  const { data } = useStore();
  const name = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? 'Removed account';
  const rcv = (id: string) => data.receivables.find((r) => r.id === id)?.name ?? 'Loan';
  const d = describe(t, name, rcv);
  const acctId = t.kind === 'transfer' ? t.fromId : t.accountId;
  const cur = data.accounts.find((a) => a.id === acctId)?.currency ?? 'PHP';
  const amount = t.kind === 'transfer' ? t.fromAmount : t.kind === 'adjustment' ? Math.abs(t.delta) : t.amount;
  return (
    <li>
      <button type="button" className="txn" onClick={onClick}>
        <span className="txn-main">
          <span className="txn-title">{d.title}</span>
          <span className="txn-sub">{d.sub}{t.kind === 'expense' && t.merchant ? ` · ${t.merchant}` : ''}</span>
        </span>
        <span className={'txn-amt' + (d.sign > 0 ? ' in' : d.sign < 0 ? ' out' : '')}>
          {d.sign > 0 ? '+' : d.sign < 0 ? '−' : ''}{money(amount, cur)}
          {cur === 'USD' && (t.kind === 'expense' || t.kind === 'income') && <span className="txn-sub">{peso(phpValue(t))}</span>}
        </span>
      </button>
    </li>
  );
}

export function Activity({ onEdit }: { onEdit: (t: Txn) => void }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [account, setAccount] = useState('');
  const [kind, setKind] = useState('');

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const name = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? '';
    const list = data.txns.filter((t) => {
      if (kind && t.kind !== kind) return false;
      if (account) {
        const ids = t.kind === 'transfer' ? [t.fromId, t.toId] : [t.accountId];
        if (!ids.includes(account)) return false;
      }
      if (needle) {
        const hay = JSON.stringify(t).toLowerCase() + ' ' + (t.kind === 'transfer' ? name(t.fromId) + name(t.toId) : name(t.accountId)).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const byMonth = new Map<string, Map<string, Txn[]>>();
    for (const t of list) {
      const m = t.date.slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, new Map());
      const days = byMonth.get(m)!;
      if (!days.has(t.date)) days.set(t.date, []);
      days.get(t.date)!.push(t);
    }
    return byMonth;
  }, [data, q, account, kind]);

  return (
    <div className="page">
      <div className="page-head"><h1>Activity</h1></div>
      <div className="filters">
        <input id="act-search" type="search" placeholder="Search: coffee, grab, nanay…" value={q} onChange={(e) => setQ(e.target.value)} />
        <AccountSelect id="act-account" accounts={data.accounts} value={account} onChange={setAccount} allowEmpty="All accounts" />
        <select id="act-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Everything</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
          <option value="transfer">Transfers</option>
          <option value="repayment">Loan repayments</option>
          <option value="adjustment">Balance updates</option>
        </select>
      </div>
      {groups.size === 0 && <p className="empty">{data.txns.length ? 'Nothing matches those filters.' : 'No entries yet. Tap + to add one.'}</p>}
      {[...groups].map(([m, days]) => (
        <section key={m} className="card">
          <h2>{monthLabel(m)}</h2>
          {[...days].map(([day, txns]) => (
            <div key={day} className="day-group">
              <h3 className="day-head">{new Date(day + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
              <ul className="txn-list">{txns.map((t) => <TxnRow key={t.id} t={t} onClick={() => onEdit(t)} />)}</ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

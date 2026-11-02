import { useState } from 'react';
import { useStore } from './store';
import { isLiability, money, peso, round2, toPhp, todayISO, TYPE_LABEL, TYPE_ORDER, uid, worth } from './money';
import { Field, NumberInput, Sheet } from './ui';
import { TxnRow } from './Activity';
import type { Account, AccountType, Currency, Txn } from './types';

export function Accounts({ onEdit, onSetBalances }: { onEdit: (t: Txn) => void; onSetBalances: () => void }) {
  const { data, bal } = useStore();
  const [open, setOpen] = useState<Account | 'new' | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const w = worth(data, bal);
  const rate = data.settings.usdRate;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Accounts</h1>
        <div className="row-actions">
          <button type="button" className="btn ghost" onClick={onSetBalances}>Update balances</button>
          <button type="button" className="btn primary" onClick={() => setOpen('new')}>Add account</button>
        </div>
      </div>

      <div className="kpis three">
        <div className="kpi"><span className="kpi-label">Cash and savings</span><span className="kpi-val">{peso(w.liquid, false)}</span></div>
        <div className="kpi"><span className="kpi-label">Investments and Pag-IBIG</span><span className="kpi-val">{peso(w.invested, false)}</span></div>
        <div className="kpi"><span className="kpi-label">Owed on cards</span><span className={'kpi-val' + (w.owed > 0 ? ' warn' : '')}>{peso(w.owed, false)}</span></div>
      </div>

      {TYPE_ORDER.map((type) => {
        const list = data.accounts.filter((a) => a.type === type && !a.archived);
        if (!list.length) return null;
        const total = list.reduce((s, a) => s + toPhp(a, bal.get(a.id) ?? 0, rate), 0);
        return (
          <section key={type} className="card">
            <div className="card-head"><h2>{TYPE_LABEL[type]}</h2><span className="muted num">{isLiability(list[0]) ? (total < 0 ? `${peso(-total)} owed` : peso(total)) : peso(total)}</span></div>
            <ul className="acct-list">
              {list.map((a) => {
                const v = bal.get(a.id) ?? 0;
                return (
                  <li key={a.id}>
                    <button type="button" className="acct" onClick={() => setOpen(a)}>
                      <span className="txn-main">
                        <span className="txn-title">{a.name}</span>
                        <span className="txn-sub">{a.institution}{a.due ? ` · due ${a.due}` : ''}</span>
                      </span>
                      <span className={'txn-amt' + (v < 0 ? ' out' : '')}>
                        {isLiability(a) && v < 0 ? `${money(-v, a.currency)} owed` : money(v, a.currency)}
                        {a.currency === 'USD' && <span className="txn-sub">{peso(v * rate)}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {data.accounts.some((a) => a.archived) && (
        <section className="card">
          <button type="button" className="btn ghost" onClick={() => setShowArchived((s) => !s)}>{showArchived ? 'Hide' : 'Show'} closed accounts</button>
          {showArchived && (
            <ul className="acct-list">
              {data.accounts.filter((a) => a.archived).map((a) => (
                <li key={a.id}><button type="button" className="acct" onClick={() => setOpen(a)}><span className="txn-title">{a.name}</span><span className="txn-amt">{money(bal.get(a.id) ?? 0, a.currency)}</span></button></li>
              ))}
            </ul>
          )}
        </section>
      )}

      {open && <AccountSheet account={open === 'new' ? null : open} onClose={() => setOpen(null)} onEdit={onEdit} />}
    </div>
  );
}

function AccountSheet({ account, onClose, onEdit }: { account: Account | null; onClose: () => void; onEdit: (t: Txn) => void }) {
  const { data, bal, update } = useStore();
  const [a, setA] = useState<Account>(account ?? { id: uid(), name: '', institution: '', type: 'savings', currency: 'PHP', aliases: [], archived: false });
  const [aliases, setAliases] = useState(a.aliases.join(', '));
  const current = account ? bal.get(account.id) ?? 0 : 0;
  const liability = a.type === 'credit' || a.type === 'paylater';
  const [target, setTarget] = useState<number | null>(account ? (liability ? -current : current) : null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const history = account ? data.txns.filter((t) => (t.kind === 'transfer' ? [t.fromId, t.toId] : [t.accountId]).includes(account.id)).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 30) : [];

  function save() {
    if (!a.name.trim()) return setError('Give the account a name.');
    const next: Account = { ...a, name: a.name.trim(), aliases: aliases.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) };
    update((d) => {
      const i = d.accounts.findIndex((x) => x.id === next.id);
      if (i >= 0) d.accounts[i] = next; else d.accounts.push(next);
      if (target !== null) {
        const wanted = liability ? -target : target;
        const delta = round2(wanted - (account ? current : 0));
        if (Math.abs(delta) > 0.004) d.txns.push({ id: uid(), kind: 'adjustment', accountId: next.id, delta, date: todayISO(), createdAt: Date.now(), note: 'Balance updated to match the app' });
      }
    });
    onClose();
  }

  function remove() {
    update((d) => {
      d.accounts = d.accounts.filter((x) => x.id !== a.id);
      d.txns = d.txns.filter((t) => !(t.kind === 'adjustment' && t.accountId === a.id));
    });
    onClose();
  }

  const used = account && data.txns.some((t) => t.kind !== 'adjustment' && (t.kind === 'transfer' ? [t.fromId, t.toId] : [t.accountId]).includes(account.id));

  return (
    <Sheet
      title={account ? account.name : 'New account'}
      onClose={onClose}
      footer={
        <>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row-actions">
            {account && <button type="button" className="btn ghost" onClick={() => { update((d) => { const x = d.accounts.find((y) => y.id === a.id); if (x) x.archived = !x.archived; }); onClose(); }}>{a.archived ? 'Reopen' : 'Close account'}</button>}
            {account && !used && (confirm ? <button type="button" className="btn danger" onClick={remove}>Yes, delete</button> : <button type="button" className="btn ghost danger" onClick={() => setConfirm(true)}>Delete</button>)}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn primary" onClick={save}>Save</button>
          </div>
        </>
      }
    >
      <div className="form-grid">
        <Field label={liability ? `Amount owed now (${a.currency})` : `Balance now (${a.currency})`} hint={account ? `Pitaka has ${money(liability ? -current : current, a.currency)}. Change it to match your bank app; the difference is saved as a balance update.` : 'What the account has today.'} wide>
          <NumberInput id="acct-balance" value={target} onChange={setTarget} />
        </Field>
        <Field label="Name"><input id="acct-name" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} /></Field>
        <Field label="Bank or app"><input id="acct-inst" value={a.institution} onChange={(e) => setA({ ...a, institution: e.target.value })} /></Field>
        <Field label="Type">
          <select id="acct-type" value={a.type} onChange={(e) => setA({ ...a, type: e.target.value as AccountType })}>
            {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Currency">
          <select id="acct-cur" value={a.currency} onChange={(e) => setA({ ...a, currency: e.target.value as Currency })} disabled={!!used}>
            <option>PHP</option><option>USD</option>
          </select>
        </Field>
        <Field label="Short names for quick entry" hint="Comma separated, e.g. rcbc cc, rcbc" wide>
          <input id="acct-aliases" value={aliases} onChange={(e) => setAliases(e.target.value)} />
        </Field>
        {liability && <Field label="Due"><input id="acct-due" value={a.due ?? ''} onChange={(e) => setA({ ...a, due: e.target.value })} placeholder="1st week of month" /></Field>}
        <Field label="Note" wide><input id="acct-note" value={a.note ?? ''} onChange={(e) => setA({ ...a, note: e.target.value })} placeholder="e.g. ends in 5487" /></Field>
      </div>
      {history.length > 0 && (
        <>
          <h3 className="mt">Recent activity</h3>
          <ul className="txn-list">{history.map((t) => <TxnRow key={t.id} t={t} onClick={() => { onClose(); onEdit(t); }} />)}</ul>
        </>
      )}
    </Sheet>
  );
}

/** Enter every account's current balance in one go. */
export function BalancesSheet({ onClose }: { onClose: () => void }) {
  const { data, bal, update } = useStore();
  const live = data.accounts.filter((a) => !a.archived);
  const [vals, setVals] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(live.map((a) => {
      const v = bal.get(a.id) ?? 0;
      return [a.id, v === 0 ? null : isLiability(a) ? -v : v];
    })),
  );

  function save() {
    update((d) => {
      for (const a of live) {
        const entered = vals[a.id];
        if (entered === null || entered === undefined) continue;
        const wanted = isLiability(a) ? -entered : entered;
        const delta = round2(wanted - (bal.get(a.id) ?? 0));
        if (Math.abs(delta) > 0.004) d.txns.push({ id: uid(), kind: 'adjustment', accountId: a.id, delta, date: todayISO(), createdAt: Date.now(), note: d.txns.length ? 'Balance updated to match the app' : 'Starting balance' });
      }
    });
    onClose();
  }

  return (
    <Sheet title="Update balances" onClose={onClose} footer={<div className="row-actions"><span className="spacer" /><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn primary" onClick={save}>Save balances</button></div>}>
      <p className="muted small">Enter what each account shows in its app today. For cards, enter the amount you owe. Leave a field empty to skip it. Changes are saved as balance updates, so they don't count as income or spending.</p>
      {TYPE_ORDER.map((type) => {
        const list = live.filter((a) => a.type === type);
        if (!list.length) return null;
        return (
          <fieldset key={type} className="bal-group">
            <legend>{TYPE_LABEL[type]}</legend>
            {list.map((a) => (
              <label key={a.id} className="bal-row">
                <span>{a.name}<span className="txn-sub">{isLiability(a) ? 'Owed' : a.currency}</span></span>
                <NumberInput id={`bal-${a.id}`} value={vals[a.id] ?? null} onChange={(v) => setVals((p) => ({ ...p, [a.id]: v }))} />
              </label>
            ))}
          </fieldset>
        );
      })}
    </Sheet>
  );
}

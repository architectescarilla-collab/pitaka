import { useState } from 'react';
import { useStore } from './store';
import { monthLabel, peso, receivableStatus, recurringActive, recurringMonthly, todayISO, uid } from './money';
import { AccountSelect, Field, NumberInput, Sheet } from './ui';
import type { Currency, Cycle, Receivable, Recurring } from './types';

const CYCLE_LABEL: Record<Cycle, string> = { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Every 6 months', annual: 'Yearly' };

export function Plan({ onAddRepayment }: { onAddRepayment: () => void }) {
  const { data } = useStore();
  const month = todayISO().slice(0, 7);
  const [rec, setRec] = useState<Recurring | 'new' | null>(null);
  const [rcv, setRcv] = useState<Receivable | 'new' | null>(null);
  const rate = data.settings.usdRate;
  const active = data.recurring.filter((r) => recurringActive(r, month)).sort((a, b) => recurringMonthly(b, rate) - recurringMonthly(a, rate));
  const inactive = data.recurring.filter((r) => !recurringActive(r, month));
  const monthly = active.reduce((s, r) => s + recurringMonthly(r, rate), 0);
  const name = (id?: string) => data.accounts.find((a) => a.id === id)?.name ?? '—';

  return (
    <div className="page">
      <div className="page-head"><h1>Bills and loans</h1></div>

      <section className="card">
        <div className="card-head">
          <h2>Recurring bills</h2>
          <button type="button" className="btn ghost" onClick={() => setRec('new')}>Add bill</button>
        </div>
        <p className="muted small">{active.length} active · {peso(monthly)} a month · {peso(monthly * 12)} a year</p>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Bill</th><th>Cycle</th><th className="num">Amount</th><th className="num">Per month</th><th>Paid with</th></tr></thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id} className="click" onClick={() => setRec(r)}>
                  <td>{r.name}{r.endMonth && <span className="txn-sub">until {monthLabel(r.endMonth)}</span>}</td>
                  <td>{CYCLE_LABEL[r.cycle]}</td>
                  <td className="num">{r.currency === 'USD' ? `US$${r.amount.toFixed(2)}` : peso(r.amount)}</td>
                  <td className="num">{peso(recurringMonthly(r, rate))}</td>
                  <td>{name(r.accountId)}</td>
                </tr>
              ))}
              {inactive.map((r) => (
                <tr key={r.id} className="click dim" onClick={() => setRec(r)}><td>{r.name}<span className="txn-sub">{r.active ? 'ended' : 'paused'}</span></td><td>{CYCLE_LABEL[r.cycle]}</td><td className="num">{peso(r.amount)}</td><td className="num">—</td><td>{name(r.accountId)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Money owed to you</h2>
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={() => setRcv('new')}>Add loan</button>
            <button type="button" className="btn primary" onClick={onAddRepayment}>Log repayment</button>
          </div>
        </div>
        <div className="loans">
          {data.receivables.map((r) => {
            const s = receivableStatus(r, data.txns, month);
            const pct = r.total ? s.collected / r.total : 0;
            return (
              <button type="button" key={r.id} className="loan" onClick={() => setRcv(r)}>
                <div className="card-head"><strong>{r.name}</strong><span className={'pill ' + (s.variance >= 0 ? 'ok' : 'bad')}>{s.variance >= 0 ? (s.variance > 0 ? `${peso(s.variance, false)} ahead` : 'On schedule') : `${peso(-s.variance, false)} behind`}</span></div>
                <div className="progress"><span style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
                <dl className="facts">
                  <div><dt>Collected</dt><dd>{peso(s.collected, false)}</dd></div>
                  <div><dt>Still owed</dt><dd>{peso(s.remaining, false)}</dd></div>
                  <div><dt>Due this month</dt><dd>{peso(s.thisMonthDue, false)}{s.thisMonthPaid >= s.thisMonthDue && s.thisMonthDue > 0 ? ' · paid' : ''}</dd></div>
                  <div><dt>Paid off by</dt><dd>{s.payoffMonth ? monthLabel(s.payoffMonth) : '—'}</dd></div>
                </dl>
              </button>
            );
          })}
          {data.receivables.length === 0 && <p className="muted small">No loans yet.</p>}
        </div>
      </section>

      {rec && <RecurringSheet item={rec === 'new' ? null : rec} onClose={() => setRec(null)} />}
      {rcv && <ReceivableSheet item={rcv === 'new' ? null : rcv} onClose={() => setRcv(null)} />}
    </div>
  );
}

function RecurringSheet({ item, onClose }: { item: Recurring | null; onClose: () => void }) {
  const { data, update } = useStore();
  const [r, setR] = useState<Recurring>(item ?? { id: uid(), name: '', category: 'Subscriptions', amount: 0, currency: 'PHP', cycle: 'monthly', active: true });
  const [err, setErr] = useState('');
  const save = () => {
    if (!r.name.trim()) return setErr('Give the bill a name.');
    update((d) => { const i = d.recurring.findIndex((x) => x.id === r.id); if (i >= 0) d.recurring[i] = r; else d.recurring.push(r); });
    onClose();
  };
  return (
    <Sheet title={item ? item.name : 'New bill'} onClose={onClose} footer={<>{err && <p className="form-error">{err}</p>}<div className="row-actions">{item && <button type="button" className="btn ghost danger" onClick={() => { update((d) => { d.recurring = d.recurring.filter((x) => x.id !== r.id); }); onClose(); }}>Delete</button>}<span className="spacer" /><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn primary" onClick={save}>Save</button></div></>}>
      <div className="form-grid">
        <Field label="Name"><input id="rec-name" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
        <Field label="Category"><select id="rec-cat" value={r.category} onChange={(e) => setR({ ...r, category: e.target.value })}>{data.categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Amount"><NumberInput id="rec-amt" value={r.amount} onChange={(v) => setR({ ...r, amount: v ?? 0 })} /></Field>
        <Field label="Currency"><select id="rec-cur" value={r.currency} onChange={(e) => setR({ ...r, currency: e.target.value as Currency })}><option>PHP</option><option>USD</option></select></Field>
        <Field label="How often"><select id="rec-cycle" value={r.cycle} onChange={(e) => setR({ ...r, cycle: e.target.value as Cycle })}>{(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}</select></Field>
        <Field label="Paid with"><AccountSelect id="rec-acct" accounts={data.accounts} value={r.accountId ?? ''} onChange={(v) => setR({ ...r, accountId: v || undefined })} allowEmpty="Not set" /></Field>
        <Field label="Last month (optional)" hint="It stops counting after this month."><input id="rec-end" type="month" value={r.endMonth ?? ''} onChange={(e) => setR({ ...r, endMonth: e.target.value || undefined })} /></Field>
        <Field label="Next due (optional)"><input id="rec-next" type="date" value={r.nextDue ?? ''} onChange={(e) => setR({ ...r, nextDue: e.target.value || undefined })} /></Field>
        <label className="check wide"><input id="rec-active" type="checkbox" checked={r.active} onChange={(e) => setR({ ...r, active: e.target.checked })} /> Active</label>
        <Field label="Note" wide><input id="rec-note" value={r.note ?? ''} onChange={(e) => setR({ ...r, note: e.target.value || undefined })} /></Field>
      </div>
    </Sheet>
  );
}

function ReceivableSheet({ item, onClose }: { item: Receivable | null; onClose: () => void }) {
  const { update } = useStore();
  const [r, setR] = useState<Receivable>(item ?? { id: uid(), name: '', principal: 0, total: 0, firstDue: todayISO().slice(0, 7), steps: [{ from: todayISO().slice(0, 7), amount: 0 }], priorCollected: 0 });
  const [err, setErr] = useState('');
  const save = () => {
    if (!r.name.trim()) return setErr('Give the loan a name.');
    if (!r.steps.length) return setErr('Add at least one monthly amount.');
    update((d) => { const i = d.receivables.findIndex((x) => x.id === r.id); if (i >= 0) d.receivables[i] = r; else d.receivables.push(r); });
    onClose();
  };
  const setStep = (i: number, patch: Partial<Receivable['steps'][number]>) => setR({ ...r, steps: r.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <Sheet title={item ? item.name : 'New loan'} onClose={onClose} footer={<>{err && <p className="form-error">{err}</p>}<div className="row-actions">{item && <button type="button" className="btn ghost danger" onClick={() => { update((d) => { d.receivables = d.receivables.filter((x) => x.id !== r.id); }); onClose(); }}>Delete</button>}<span className="spacer" /><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="button" className="btn primary" onClick={save}>Save</button></div></>}>
      <div className="form-grid">
        <Field label="Name"><input id="rcv-name" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
        <Field label="Borrower (optional)"><input id="rcv-borrower" value={r.borrower ?? ''} onChange={(e) => setR({ ...r, borrower: e.target.value || undefined })} /></Field>
        <Field label="Amount lent"><NumberInput id="rcv-principal" value={r.principal} onChange={(v) => setR({ ...r, principal: v ?? 0 })} /></Field>
        <Field label="Total to be repaid" hint="Including interest."><NumberInput id="rcv-total" value={r.total} onChange={(v) => setR({ ...r, total: v ?? 0 })} /></Field>
        <Field label="First payment due"><input id="rcv-first" type="month" value={r.firstDue} onChange={(e) => setR({ ...r, firstDue: e.target.value })} /></Field>
        <Field label="Collected before Pitaka" hint="Payments you received before you started logging them here."><NumberInput id="rcv-prior" value={r.priorCollected} onChange={(v) => setR({ ...r, priorCollected: v ?? 0 })} /></Field>
      </div>
      <h3 className="mt">Monthly amount due</h3>
      <p className="muted small">Add a new line when the monthly amount changes, for example ₱10,000 from March then ₱15,500 from July.</p>
      {r.steps.map((s, i) => (
        <div key={i} className="step-row">
          <Field label="From"><input id={`rcv-step-from-${i}`} type="month" value={s.from} onChange={(e) => setStep(i, { from: e.target.value })} /></Field>
          <Field label="Amount a month"><NumberInput id={`rcv-step-amt-${i}`} value={s.amount} onChange={(v) => setStep(i, { amount: v ?? 0 })} /></Field>
          <button type="button" className="icon-btn" aria-label="Remove this line" onClick={() => setR({ ...r, steps: r.steps.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => setR({ ...r, steps: [...r.steps, { from: todayISO().slice(0, 7), amount: r.steps[r.steps.length - 1]?.amount ?? 0 }] })}>Add a change</button>
    </Sheet>
  );
}

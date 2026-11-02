import { useMemo, useState } from 'react';
import { useStore } from './store';
import { parseEntry } from './parse';
import { AccountSelect, Field, NumberInput, Sheet } from './ui';
import { money, round2, todayISO, uid } from './money';
import type { Expense, Income, Repayment, Transfer, TransferPurpose, Txn } from './types';

type Kind = 'expense' | 'income' | 'transfer' | 'repayment';

interface Form {
  kind: Kind;
  date: string;
  amount: number | null;
  accountId: string | null;
  toId: string | null;
  toAmount: number | null;
  category: string;
  description: string;
  merchant: string;
  source: string;
  rate: number | null;
  fee: number | null;
  purpose: TransferPurpose;
  receivableId: string | null;
  reportMonth: string;
  note: string;
}

const PURPOSES: { v: TransferPurpose; label: string }[] = [
  { v: 'transfer', label: 'Move between my accounts' },
  { v: 'card_payment', label: 'Pay a card or pay-later bill' },
  { v: 'investment', label: 'Invest / Pag-IBIG contribution' },
  { v: 'withdrawal', label: 'Cash withdrawal' },
  { v: 'conversion', label: 'Currency conversion' },
];

const INCOME_CATS = ['Salary', 'Freelance', 'Bonus', 'Interest', 'Refund', 'Gift', 'Sale of items', 'Other'];

function blank(kind: Kind): Form {
  return { kind, date: todayISO(), amount: null, accountId: null, toId: null, toAmount: null, category: kind === 'income' ? 'Salary' : 'Dining Out', description: '', merchant: '', source: '', rate: null, fee: null, purpose: 'transfer', receivableId: null, reportMonth: '', note: '' };
}

function fromTxn(t: Txn, fee: Expense | undefined): Form {
  const f = blank(t.kind === 'adjustment' ? 'expense' : t.kind);
  f.date = t.date;
  f.note = t.note ?? '';
  if (t.kind === 'expense') Object.assign(f, { amount: t.amount, accountId: t.accountId, category: t.category, description: t.description, merchant: t.merchant ?? '', rate: t.rate });
  if (t.kind === 'income') Object.assign(f, { amount: t.amount, accountId: t.accountId, category: t.category, source: t.source, rate: t.rate, reportMonth: t.reportMonth ?? '' });
  if (t.kind === 'transfer') Object.assign(f, { amount: t.fromAmount, toAmount: t.toAmount, accountId: t.fromId, toId: t.toId, purpose: t.purpose, fee: fee?.amount ?? null });
  if (t.kind === 'repayment') Object.assign(f, { amount: t.amount, accountId: t.accountId, receivableId: t.receivableId });
  return f;
}

export function TxnEditor({ editing, initialKind = 'expense', onClose }: { editing?: Txn; initialKind?: Kind; onClose: () => void }) {
  const { data, update } = useStore();
  const linkedFee = editing ? (data.txns.find((t) => t.kind === 'expense' && t.feeOf === editing.id) as Expense | undefined) : undefined;
  const [f, setF] = useState<Form>(() => (editing ? fromTxn(editing, linkedFee) : blank(initialKind)));
  const [quick, setQuick] = useState('');
  const [error, setError] = useState('');
  const set = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }));

  const acct = (id: string | null) => data.accounts.find((a) => a.id === id);
  const from = acct(f.accountId);
  const to = acct(f.toId);
  const usdRate = data.settings.usdRate;
  const crossCurrency = f.kind === 'transfer' && from && to && from.currency !== to.currency;
  const needsRate = (f.kind === 'expense' || f.kind === 'income') && from?.currency === 'USD';

  const impliedToAmount = useMemo(() => {
    if (f.amount === null || !from || !to) return null;
    if (from.currency === to.currency) return f.amount;
    return round2(from.currency === 'USD' ? f.amount * usdRate : f.amount / usdRate);
  }, [f.amount, from, to, usdRate]);

  function applyQuick(text: string) {
    setQuick(text);
    if (!text.trim()) return;
    const d = parseEntry(text, data.accounts);
    setF((p) => ({
      ...p,
      kind: d.kind,
      date: d.date,
      amount: d.amount,
      accountId: d.accountId ?? p.accountId,
      toId: d.toId,
      toAmount: null,
      category: d.kind === 'transfer' ? p.category : d.category,
      description: d.kind === 'income' ? p.description : d.description,
      source: d.kind === 'income' ? d.description : p.source,
      fee: d.fee,
      purpose: d.purpose,
    }));
  }

  function save() {
    setError('');
    if (!f.amount || f.amount <= 0) return setError('Enter an amount above zero.');
    if (!f.accountId) return setError(f.kind === 'transfer' ? 'Choose the account the money leaves from.' : 'Choose an account.');
    if (f.kind === 'transfer' && !f.toId) return setError('Choose the account the money goes to.');
    if (f.kind === 'transfer' && f.toId === f.accountId) return setError('From and to must be different accounts.');
    if (f.kind === 'repayment' && !f.receivableId) return setError('Choose which loan this repayment is for.');

    const id = editing?.id ?? uid();
    const createdAt = editing?.createdAt ?? Date.now();
    const base = { id, date: f.date, note: f.note || undefined, createdAt };
    const rate = from?.currency === 'USD' ? (f.rate ?? usdRate) : 1;
    const out: Txn[] = [];

    if (f.kind === 'expense') {
      out.push({ ...base, kind: 'expense', accountId: f.accountId, amount: f.amount, rate, category: f.category, description: f.description || f.category, merchant: f.merchant || undefined } satisfies Expense);
    } else if (f.kind === 'income') {
      out.push({ ...base, kind: 'income', accountId: f.accountId, amount: f.amount, rate, category: f.category, source: f.source || f.category, reportMonth: f.reportMonth || undefined } satisfies Income);
    } else if (f.kind === 'repayment') {
      out.push({ ...base, kind: 'repayment', accountId: f.accountId, amount: f.amount, receivableId: f.receivableId! } satisfies Repayment);
    } else {
      const toAmount = crossCurrency ? (f.toAmount ?? impliedToAmount ?? f.amount) : f.amount;
      out.push({ ...base, kind: 'transfer', fromId: f.accountId, toId: f.toId!, fromAmount: f.amount, toAmount, purpose: f.purpose } satisfies Transfer);
      if (f.fee && f.fee > 0) {
        out.push({ id: linkedFee?.id ?? uid(), date: f.date, createdAt, kind: 'expense', accountId: f.accountId, amount: f.fee, rate, category: 'Fees & Interest', description: `Fee: ${from?.name} → ${to?.name}`, feeOf: id } satisfies Expense);
      }
    }

    update((d) => {
      d.txns = d.txns.filter((t) => t.id !== id && !(t.kind === 'expense' && t.feeOf === id));
      d.txns.push(...out);
    });
    onClose();
  }

  function remove() {
    if (!editing) return;
    update((d) => {
      d.txns = d.txns.filter((t) => t.id !== editing.id && !(t.kind === 'expense' && t.feeOf === editing.id));
    });
    onClose();
  }

  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Sheet
      title={editing ? 'Edit entry' : 'Add entry'}
      onClose={onClose}
      footer={
        <>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row-actions">
            {editing && !confirmDelete && <button type="button" className="btn ghost danger" onClick={() => setConfirmDelete(true)}>Delete</button>}
            {editing && confirmDelete && <button type="button" className="btn danger" onClick={remove}>Yes, delete it</button>}
            <span className="spacer" />
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn primary" onClick={save}>{editing ? 'Save changes' : 'Add'}</button>
          </div>
        </>
      }
    >
      {!editing && (
        <div className="quick">
          <input
            id="quick-entry"
            className="quick-input"
            placeholder="Type it like a chat: 290 rcbc cc lunch at heybo"
            value={quick}
            onChange={(e) => applyQuick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            autoComplete="off"
          />
          <p className="field-hint">Amount, account and what it was, in any order. Works with "yesterday", "last friday", "nov 1", "to mp2", "fee 5", "85 + 12".</p>
        </div>
      )}

      <div className="seg" role="tablist" aria-label="Entry type">
        {(['expense', 'income', 'transfer', 'repayment'] as Kind[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={f.kind === k} className={f.kind === k ? 'on' : ''} onClick={() => set({ kind: k })}>
            {k === 'expense' ? 'Expense' : k === 'income' ? 'Income' : k === 'transfer' ? 'Transfer' : 'Loan repayment'}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <Field label={f.kind === 'transfer' ? `Amount sent${from ? ` (${from.currency})` : ''}` : `Amount${from ? ` (${from.currency})` : ''}`}>
          <NumberInput id="f-amount" value={f.amount} onChange={(v) => set({ amount: v })} />
        </Field>
        <Field label="Date">
          <input id="f-date" type="date" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
        </Field>

        <Field label={f.kind === 'transfer' ? 'From' : f.kind === 'expense' ? 'Paid with' : 'Received in'}>
          <AccountSelect id="f-account" accounts={data.accounts} value={f.accountId} onChange={(v) => set({ accountId: v || null })} />
        </Field>

        {f.kind === 'transfer' && (
          <Field label="To">
            <AccountSelect id="f-to" accounts={data.accounts} value={f.toId} onChange={(v) => set({ toId: v || null })} />
          </Field>
        )}

        {f.kind === 'transfer' && crossCurrency && (
          <Field label={`Amount received (${to!.currency})`} hint={impliedToAmount !== null ? `At your saved rate this is ${money(impliedToAmount, to!.currency)}. Enter what actually arrived.` : undefined}>
            <NumberInput id="f-to-amount" value={f.toAmount} onChange={(v) => set({ toAmount: v })} placeholder={impliedToAmount !== null ? String(impliedToAmount) : undefined} />
          </Field>
        )}

        {f.kind === 'transfer' && (
          <>
            <Field label="What kind of transfer">
              <select id="f-purpose" value={f.purpose} onChange={(e) => set({ purpose: e.target.value as TransferPurpose })}>
                {PURPOSES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Fee (optional)" hint="Logged as a Fees & Interest expense from the same account.">
              <NumberInput id="f-fee" value={f.fee} onChange={(v) => set({ fee: v })} placeholder="0" />
            </Field>
          </>
        )}

        {f.kind === 'expense' && (
          <>
            <Field label="Category">
              <select id="f-category" value={f.category} onChange={(e) => set({ category: e.target.value })}>
                {data.categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="What was it">
              <input id="f-desc" value={f.description} onChange={(e) => set({ description: e.target.value })} placeholder="Lunch, coffee, Angkas…" />
            </Field>
            <Field label="Where (optional)">
              <input id="f-merchant" value={f.merchant} onChange={(e) => set({ merchant: e.target.value })} placeholder="KFC, IKEA, GrabFood…" />
            </Field>
          </>
        )}

        {f.kind === 'income' && (
          <>
            <Field label="Category">
              <select id="f-icat" value={f.category} onChange={(e) => set({ category: e.target.value })}>
                {INCOME_CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="From who">
              <input id="f-source" value={f.source} onChange={(e) => set({ source: e.target.value })} placeholder="Flow, HTH, friends…" />
            </Field>
            <Field label="Count it in month (optional)" hint="For a salary that arrives early, e.g. October pay received 29 Oct but counted in November.">
              <input id="f-report" type="month" value={f.reportMonth} onChange={(e) => set({ reportMonth: e.target.value })} />
            </Field>
          </>
        )}

        {f.kind === 'repayment' && (
          <Field label="Loan">
            <select id="f-rcv" value={f.receivableId ?? ''} onChange={(e) => set({ receivableId: e.target.value || null })}>
              <option value="">Choose a loan</option>
              {data.receivables.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
        )}

        {needsRate && (
          <Field label="₱ per USD" hint={`Saved rate is ${usdRate}. Use the actual rate if you know it.`}>
            <NumberInput id="f-rate" value={f.rate} onChange={(v) => set({ rate: v })} placeholder={String(usdRate)} />
          </Field>
        )}

        <Field label="Note (optional)" wide>
          <input id="f-note" value={f.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  );
}

import type { Account, AccountType, Data, Receivable, Recurring, Txn } from './types';

const php = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const php0 = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

export function peso(v: number, decimals = true): string {
  const s = (decimals ? php : php0).format(Math.abs(v));
  return (v < -0.004 ? '−' : '') + '₱' + s;
}

export function money(v: number, currency: 'PHP' | 'USD'): string {
  if (currency === 'PHP') return peso(v);
  return (v < -0.004 ? '−' : '') + 'US$' + php.format(Math.abs(v));
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

export const LIABILITY: AccountType[] = ['credit', 'paylater'];
export const isLiability = (a: Account) => LIABILITY.includes(a.type);

export const TYPE_LABEL: Record<AccountType, string> = {
  cash: 'Cash',
  wallet: 'E-wallets',
  savings: 'Savings',
  investment: 'Investments',
  government: 'Pag-IBIG',
  credit: 'Credit cards',
  paylater: 'Pay later',
};

export const TYPE_ORDER: AccountType[] = ['cash', 'wallet', 'savings', 'investment', 'government', 'credit', 'paylater'];

/** Balances in each account's own currency. Credit cards go negative as you charge them. */
export function balances(data: Data): Map<string, number> {
  const b = new Map<string, number>();
  for (const a of data.accounts) b.set(a.id, 0);
  const add = (id: string, v: number) => b.set(id, (b.get(id) ?? 0) + v);
  for (const t of data.txns) {
    switch (t.kind) {
      case 'expense': add(t.accountId, -t.amount); break;
      case 'income': add(t.accountId, t.amount); break;
      case 'repayment': add(t.accountId, t.amount); break;
      case 'adjustment': add(t.accountId, t.delta); break;
      case 'transfer': add(t.fromId, -t.fromAmount); add(t.toId, t.toAmount); break;
    }
  }
  for (const [k, v] of b) b.set(k, round2(v));
  return b;
}

export function toPhp(a: Account, v: number, usdRate: number): number {
  return a.currency === 'USD' ? v * usdRate : v;
}

export interface Worth {
  liquid: number;
  invested: number;
  owed: number;
  netWorth: number;
  receivablesLeft: number;
}

export function worth(data: Data, bal: Map<string, number>): Worth {
  let liquid = 0, invested = 0, owed = 0;
  for (const a of data.accounts) {
    const v = toPhp(a, bal.get(a.id) ?? 0, data.settings.usdRate);
    if (isLiability(a)) owed += -v;
    else if (a.type === 'investment' || a.type === 'government') invested += v;
    else liquid += v;
  }
  const receivablesLeft = data.receivables.reduce((s, r) => s + receivableStatus(r, data.txns).remaining, 0);
  return { liquid, invested, owed, netWorth: liquid + invested - owed, receivablesLeft };
}

export const monthOf = (d: string) => d.slice(0, 7);

/** PHP value of an expense or income. */
export const phpValue = (t: { amount: number; rate: number }) => round2(t.amount * t.rate);

export function reportMonth(t: Txn): string {
  return t.kind === 'income' && t.reportMonth ? t.reportMonth : monthOf(t.date);
}

export interface MonthStats {
  income: number;
  repayments: number;
  spent: number;
  net: number;
  savingsRate: number | null;
  byCategory: { category: string; amount: number }[];
  byDay: { day: string; amount: number }[];
  bySource: { source: string; amount: number }[];
}

export function monthStats(data: Data, month: string): MonthStats {
  let income = 0, spent = 0, repayments = 0;
  const cat = new Map<string, number>();
  const day = new Map<string, number>();
  const src = new Map<string, number>();
  for (const t of data.txns) {
    if (reportMonth(t) !== month) continue;
    if (t.kind === 'expense') {
      const v = phpValue(t);
      spent += v;
      cat.set(t.category, (cat.get(t.category) ?? 0) + v);
      day.set(t.date, (day.get(t.date) ?? 0) + v);
    } else if (t.kind === 'income') {
      const v = phpValue(t);
      income += v;
      src.set(t.source, (src.get(t.source) ?? 0) + v);
    } else if (t.kind === 'repayment') {
      repayments += t.amount;
    }
  }
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const byDay = Array.from({ length: days }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { day: d, amount: day.get(d) ?? 0 };
  });
  const totalIn = income + repayments;
  return {
    income,
    repayments,
    spent,
    net: totalIn - spent,
    savingsRate: totalIn > 0 ? (totalIn - spent) / totalIn : null,
    byCategory: [...cat].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    byDay,
    bySource: [...src].map(([source, amount]) => ({ source, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export function monthsWithData(data: Data, current: string): string[] {
  const s = new Set<string>([current]);
  for (const t of data.txns) if (t.kind !== 'adjustment') s.add(reportMonth(t));
  return [...s].sort().reverse();
}

export function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function addMonths(m: string, n: number): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- Recurring ----------

const PER_MONTH: Record<Recurring['cycle'], number> = { monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, annual: 1 / 12 };

export function recurringActive(r: Recurring, month: string): boolean {
  return r.active && (!r.endMonth || month <= r.endMonth);
}

export function recurringMonthly(r: Recurring, usdRate: number): number {
  const v = r.currency === 'USD' ? r.amount * usdRate : r.amount;
  return v * PER_MONTH[r.cycle];
}

// ---------- Receivables ----------

export function dueFor(r: Receivable, month: string): number {
  if (month < r.firstDue) return 0;
  let amt = 0;
  for (const s of [...r.steps].sort((a, b) => a.from.localeCompare(b.from))) if (s.from <= month) amt = s.amount;
  return amt;
}

export interface ReceivableStatus {
  collected: number;
  remaining: number;
  expected: number;
  variance: number;
  thisMonthDue: number;
  thisMonthPaid: number;
  payoffMonth: string | null;
}

export function receivableStatus(r: Receivable, txns: Txn[], month = todayISO().slice(0, 7)): ReceivableStatus {
  const pays = txns.filter((t): t is Extract<Txn, { kind: 'repayment' }> => t.kind === 'repayment' && t.receivableId === r.id);
  const collected = r.priorCollected + pays.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, r.total - collected);
  // Expected: sum of dues up to this month, capped at the total.
  let expected = 0;
  for (let m = r.firstDue; m <= month && expected < r.total; m = addMonths(m, 1)) expected += dueFor(r, m);
  expected = Math.min(expected, r.total);
  // Payoff: walk forward from next month until remaining is covered.
  let left = remaining, m = month, payoffMonth: string | null = null;
  for (let i = 0; i < 600 && left > 0.005; i++) {
    m = addMonths(m, 1);
    const d = dueFor(r, m);
    if (d <= 0) break;
    left -= d;
    if (left <= 0.005) payoffMonth = m;
  }
  const thisMonthPaid = pays.filter((p) => monthOf(p.date) === month).reduce((s, p) => s + p.amount, 0);
  return { collected, remaining, expected, variance: collected - expected, thisMonthDue: dueFor(r, month), thisMonthPaid, payoffMonth: remaining <= 0.005 ? month : payoffMonth };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

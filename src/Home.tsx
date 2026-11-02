import { useMemo, useState } from 'react';
import { useStore } from './store';
import { monthLabel, monthStats, monthsWithData, peso, recurringActive, recurringMonthly, todayISO, worth } from './money';
import { TxnRow } from './Activity';
import type { Txn } from './types';

export function Home({ onEdit, onAddFirstBalance }: { onEdit: (t: Txn) => void; onAddFirstBalance: () => void }) {
  const { data, bal } = useStore();
  const current = todayISO().slice(0, 7);
  const months = monthsWithData(data, current);
  const [month, setMonth] = useState(current);
  const s = useMemo(() => monthStats(data, month), [data, month]);
  const w = useMemo(() => worth(data, bal), [data, bal]);
  const noBalances = data.txns.length === 0;

  const recent = [...data.txns]
    .filter((t) => t.kind !== 'adjustment' && t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .slice(0, 8);

  const bills = data.recurring.filter((r) => recurringActive(r, month));
  const billsMonthly = bills.reduce((sum, r) => sum + recurringMonthly(r, data.settings.usdRate), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{monthLabel(month)}</h1>
          <p className="muted">
            {s.savingsRate === null ? 'Nothing has come in yet this month.' : `You kept ${(s.savingsRate * 100).toFixed(1)}% of what came in.`}
          </p>
        </div>
        <label className="month-pick">
          <span className="sr-only">Month</span>
          <select id="home-month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
      </div>

      {noBalances && (
        <div className="callout">
          <div>
            <strong>Start with your current balances.</strong>
            <p>Every account starts at ₱0. Enter what each one has now and Pitaka tracks from there.</p>
          </div>
          <button type="button" className="btn primary" onClick={onAddFirstBalance}>Set balances</button>
        </div>
      )}

      <div className="kpis">
        <Kpi label="Income" value={peso(s.income + s.repayments, false)} sub={s.repayments ? `incl. ${peso(s.repayments, false)} loan repayments` : 'Salary, refunds, interest'} />
        <Kpi label="Spent" value={peso(s.spent, false)} sub="All accounts and cards" />
        <Kpi label="Owed on cards" value={peso(w.owed, false)} sub="Right now" tone={w.owed > 0 ? 'warn' : undefined} />
        <Kpi label="Net cash flow" value={peso(s.net, false)} sub="Income minus spending" tone={s.net >= 0 ? 'ok' : 'bad'} />
        <Kpi label="Net worth" value={peso(w.netWorth, false)} sub={`${peso(w.receivablesLeft, false)} more owed to you`} />
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Spent per day</h2>
          <DailyBars days={s.byDay} />
        </section>
        <section className="card">
          <h2>By category</h2>
          {s.byCategory.length === 0 ? <p className="muted small">No spending logged this month.</p> : (
            <div className="bars">
              {s.byCategory.map((c, i) => (
                <div key={c.category} className="bar-row">
                  <span className="bar-label">{c.category}</span>
                  <span className="bar-track"><span className={'bar-fill' + (i === 0 ? ' top' : '')} style={{ width: `${(c.amount / s.byCategory[0].amount) * 100}%` }} /></span>
                  <span className="bar-val">{peso(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Latest entries</h2>
          {recent.length === 0 ? <p className="muted small">Nothing logged in {monthLabel(month)} yet. Tap + to add your first entry.</p> : (
            <ul className="txn-list">{recent.map((t) => <TxnRow key={t.id} t={t} onClick={() => onEdit(t)} />)}</ul>
          )}
        </section>
        <section className="card">
          <h2>Income by source</h2>
          {s.bySource.length === 0 ? <p className="muted small">No income logged this month.</p> : (
            <table className="tbl">
              <tbody>
                {s.bySource.map((r) => <tr key={r.source}><td>{r.source}</td><td className="num">{peso(r.amount)}</td></tr>)}
                {s.repayments > 0 && <tr><td>Loan repayments</td><td className="num">{peso(s.repayments)}</td></tr>}
              </tbody>
            </table>
          )}
          <h2 className="mt">Recurring bills</h2>
          <p className="muted small">{bills.length} active · {peso(billsMonthly)} a month</p>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className={'kpi-val' + (tone ? ' ' + tone : '')}>{value}</span>
      <span className="kpi-sub">{sub}</span>
    </div>
  );
}

function DailyBars({ days }: { days: { day: string; amount: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.amount));
  const W = 600, H = 180, pad = 22, bw = (W - 8) / days.length;
  const h = hover !== null ? days[hover] : null;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spending per day">
        {[0.5, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={(H - pad) * (1 - f)} y2={(H - pad) * (1 - f)} className="grid-line" />
        ))}
        {days.map((d, i) => {
          const bh = (d.amount / max) * (H - pad - 8);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
              <rect x={4 + i * bw} y={0} width={bw} height={H - pad} fill="transparent" />
              <rect x={4 + i * bw + bw * 0.15} y={H - pad - bh} width={bw * 0.7} height={Math.max(bh, d.amount ? 2 : 0)} rx={3} className={'day-bar' + (hover === i ? ' hot' : '')} />
              {(i === 0 || (i + 1) % 5 === 0) && <text x={4 + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="axis-text">{i + 1}</text>}
            </g>
          );
        })}
      </svg>
      <p className="chart-tip" aria-live="polite">
        {h ? `${new Date(h.day + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}: ${peso(h.amount)}` : `Highest day: ${peso(max === 1 && !days.some((d) => d.amount) ? 0 : max)}`}
      </p>
    </div>
  );
}

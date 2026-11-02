import { useRef, useState } from 'react';
import { useStore } from './store';
import { seedData } from './seed';
import { NumberInput, Field } from './ui';
import { phpValue } from './money';
import type { Data } from './types';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Settings() {
  const { data, update, replace, saved } = useStore();
  const [newCat, setNewCat] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const stamp = new Date().toISOString().slice(0, 10);

  function exportCsv() {
    const name = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? '';
    const rows = [['Date', 'Type', 'Description', 'Category', 'From', 'To', 'Amount', 'Amount (PHP)', 'Note']];
    for (const t of [...data.txns].sort((a, b) => a.date.localeCompare(b.date))) {
      if (t.kind === 'expense') rows.push([t.date, 'Expense', t.description, t.category, name(t.accountId), '', String(t.amount), String(phpValue(t)), t.note ?? '']);
      if (t.kind === 'income') rows.push([t.date, 'Income', t.source, t.category, '', name(t.accountId), String(t.amount), String(phpValue(t)), t.note ?? '']);
      if (t.kind === 'transfer') rows.push([t.date, 'Transfer', t.purpose, '', name(t.fromId), name(t.toId), String(t.fromAmount), '', t.note ?? '']);
      if (t.kind === 'repayment') rows.push([t.date, 'Loan repayment', data.receivables.find((r) => r.id === t.receivableId)?.name ?? '', '', '', name(t.accountId), String(t.amount), String(t.amount), t.note ?? '']);
      if (t.kind === 'adjustment') rows.push([t.date, 'Balance update', '', '', '', name(t.accountId), String(t.delta), '', t.note ?? '']);
    }
    download(`pitaka-${stamp}.csv`, rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  }

  async function importJson(f: File) {
    try {
      const d = JSON.parse(await f.text()) as Data;
      if (d.version !== 1 || !Array.isArray(d.accounts) || !Array.isArray(d.txns)) throw new Error('bad');
      replace(d);
      setMsg(`Restored ${d.txns.length} entries and ${d.accounts.length} accounts from ${f.name}.`);
    } catch {
      setMsg('That file isn’t a Pitaka backup. Choose a .json file saved from “Download backup”.');
    }
  }

  return (
    <div className="page">
      <div className="page-head"><h1>Settings</h1></div>

      <section className="card">
        <h2>Exchange rate</h2>
        <div className="form-grid">
          <Field label="₱ per US$" hint="Used to show USD accounts in pesos and as the default for USD entries.">
            <NumberInput id="set-rate" value={data.settings.usdRate} onChange={(v) => v && update((d) => { d.settings.usdRate = v; })} />
          </Field>
          <Field label="Monthly savings target">
            <NumberInput id="set-target" value={data.settings.monthlySavingsTarget} onChange={(v) => update((d) => { d.settings.monthlySavingsTarget = v ?? 0; })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2>Expense categories</h2>
        <div className="chips">
          {data.categories.map((c) => (
            <span key={c} className="chip">{c}<button type="button" aria-label={`Remove ${c}`} onClick={() => update((d) => { d.categories = d.categories.filter((x) => x !== c); })}>✕</button></span>
          ))}
        </div>
        <div className="inline-add">
          <input id="set-newcat" placeholder="New category" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button type="button" className="btn ghost" onClick={() => { const c = newCat.trim(); if (c && !data.categories.includes(c)) update((d) => { d.categories.push(c); }); setNewCat(''); }}>Add</button>
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">
          Pitaka keeps everything in this browser on this device. Nothing is sent to a server. {saved ? '' : 'Saving is blocked in this browser right now (private mode?), so download a backup before closing.'}
          Download a backup now and then, and restore it to move to another phone or browser.
        </p>
        <div className="row-actions wrap">
          <button type="button" className="btn primary" onClick={() => download(`pitaka-backup-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')}>Download backup</button>
          <button type="button" className="btn ghost" onClick={() => file.current?.click()}>Restore from backup</button>
          <button type="button" className="btn ghost" onClick={exportCsv}>Export entries as CSV</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
        {msg && <p className="small" role="status">{msg}</p>}
      </section>

      <section className="card">
        <h2>Start over</h2>
        <p className="muted small">Deletes every entry and puts your accounts, bills and loans back to the starting list with ₱0 balances.</p>
        {confirmReset
          ? <div className="row-actions"><button type="button" className="btn danger" onClick={() => { replace(seedData()); setConfirmReset(false); setMsg('Everything was reset.'); }}>Yes, delete everything</button><button type="button" className="btn ghost" onClick={() => setConfirmReset(false)}>Keep my data</button></div>
          : <button type="button" className="btn ghost danger" onClick={() => setConfirmReset(true)}>Reset Pitaka</button>}
      </section>
    </div>
  );
}

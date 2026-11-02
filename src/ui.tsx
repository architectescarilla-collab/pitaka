import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Account } from './types';
import { TYPE_LABEL, TYPE_ORDER } from './money';

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, wide }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return (
    <label className={'field' + (wide ? ' wide' : '')}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function AccountSelect({ accounts, value, onChange, id, allowEmpty }: { accounts: Account[]; value: string | null; onChange: (v: string) => void; id?: string; allowEmpty?: string }) {
  const live = accounts.filter((a) => !a.archived || a.id === value);
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
      {value === null && allowEmpty === undefined && <option value="">Choose an account</option>}
      {TYPE_ORDER.map((t) => {
        const group = live.filter((a) => a.type === t);
        if (!group.length) return null;
        return (
          <optgroup key={t} label={TYPE_LABEL[t]}>
            {group.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.currency === 'USD' ? ' (USD)' : ''}</option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

export function NumberInput({ value, onChange, id, placeholder }: { value: number | null; onChange: (v: number | null) => void; id?: string; placeholder?: string }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => {
    const cur = text.replace(/[₱,\s]/g, '');
    if ((value === null && cur !== '') || (value !== null && Number(cur) !== value)) setText(value === null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      id={id}
      inputMode="decimal"
      placeholder={placeholder ?? '0.00'}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const s = raw.replace(/[₱,\s]/g, '');
        if (s !== '' && !/^-?\d*\.?\d*$/.test(s)) return;
        setText(raw);
        onChange(s === '' || s === '-' || s === '.' ? null : Number(s));
      }}
    />
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

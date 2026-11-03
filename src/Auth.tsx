import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { CloudStoreProvider, createCloud, deviceData, loadCloud, LocalStoreProvider } from './store';
import { starterBlank, starterCommon } from './seed';
import type { Data } from './types';

/** Wraps the app: device-only when Supabase isn't configured, otherwise requires a login. */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!supabase) return <LocalStoreProvider>{children}</LocalStoreProvider>;
  return <CloudGate>{children}</CloudGate>;
}

type Loaded = { data: Data; stamp: string | null } | 'none' | null;

function CloudGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovering, setRecovering] = useState(false);
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    supabase!.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase!.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    setLoaded(null);
    setLoadError('');
    if (!userId) return;
    loadCloud(userId).then((r) => {
      if (r.error && !r.data) setLoadError(r.error);
      setLoaded(r.data ? { data: r.data, stamp: r.stamp } : r.error ? null : 'none');
    });
  }, [userId]);

  if (session === undefined) return <Splash text="Opening Pitaka…" />;
  if (recovering && session) return <SetPassword onDone={() => setRecovering(false)} />;
  if (!session) return <AuthScreen />;
  if (loadError) return <Splash text={`Couldn't load your data: ${loadError}. Check your connection and reload.`} signOut />;
  if (loaded === null) return <Splash text="Loading your data…" />;
  if (loaded === 'none') return <Onboard userId={session.user.id} onReady={(d) => setLoaded({ data: d, stamp: null })} />;
  return (
    <CloudStoreProvider key={session.user.id} userId={session.user.id} email={session.user.email ?? ''} initial={loaded.data} initialStamp={loaded.stamp}>
      {children}
    </CloudStoreProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand auth-brand"><span className="brand-mark" aria-hidden="true">₱</span>Pitaka</div>
        {children}
      </div>
    </div>
  );
}

function Splash({ text, signOut }: { text: string; signOut?: boolean }) {
  return (
    <Shell>
      <p className="muted" role="status">{text}</p>
      {signOut && <button type="button" className="btn ghost" onClick={() => supabase!.auth.signOut()}>Sign out</button>}
    </Shell>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!email.trim()) return setMsg({ kind: 'error', text: 'Enter your email.' });
    if (mode !== 'forgot' && password.length < 8) return setMsg({ kind: 'error', text: 'Passwords are at least 8 characters.' });
    setBusy(true);
    const redirect = window.location.origin;
    if (mode === 'signin') {
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMsg({ kind: 'error', text: error.message === 'Invalid login credentials' ? 'That email and password don’t match. Try again or reset your password.' : error.message });
    } else if (mode === 'signup') {
      const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } });
      if (error) setMsg({ kind: 'error', text: error.message });
      else if (!data.session) setMsg({ kind: 'info', text: `We sent a confirmation link to ${email.trim()}. Open it, then sign in here.` });
    } else {
      const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
      setMsg(error ? { kind: 'error', text: error.message } : { kind: 'info', text: `If ${email.trim()} has a Pitaka account, a reset link is on its way.` });
    }
    setBusy(false);
  }

  return (
    <Shell>
      <h1>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h1>
      <p className="muted small">{mode === 'signup' ? 'Your data is private to your account and syncs across your devices.' : mode === 'forgot' ? 'We’ll email you a link to set a new password.' : 'Track your pesos, cards and transfers the way you talk about them.'}</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="field"><span className="field-label">Email</span><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== 'forgot' && (
          <label className="field"><span className="field-label">Password</span><input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />{mode === 'signup' && <span className="field-hint">At least 8 characters.</span>}</label>
        )}
        {msg && <p className={msg.kind === 'error' ? 'form-error' : 'form-info'} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
        <button type="submit" className="btn primary block" disabled={busy}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}</button>
      </form>
      <div className="auth-links">
        {mode !== 'signin' && <button type="button" className="link" onClick={() => { setMode('signin'); setMsg(null); }}>I have an account</button>}
        {mode !== 'signup' && <button type="button" className="link" onClick={() => { setMode('signup'); setMsg(null); }}>Create an account</button>}
        {mode === 'signin' && <button type="button" className="link" onClick={() => { setMode('forgot'); setMsg(null); }}>Forgot password?</button>}
      </div>
    </Shell>
  );
}

function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setErr('Passwords are at least 8 characters.');
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) setErr(error.message); else onDone();
  }
  return (
    <Shell>
      <h1>Set a new password</h1>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="field"><span className="field-label">New password</span><input id="auth-new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="form-error" role="alert">{err}</p>}
        <button type="submit" className="btn primary block">Save password</button>
      </form>
    </Shell>
  );
}

function Onboard({ userId, onReady }: { userId: string; onReady: (d: Data) => void }) {
  const local = deviceData();
  const hasLocal = !!local && (local.txns.length > 0 || local.accounts.length > 0);
  const [choice, setChoice] = useState<'device' | 'common' | 'blank'>(hasLocal ? 'device' : 'common');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const d = choice === 'device' && local ? local : choice === 'blank' ? starterBlank() : starterCommon();
    const e = await createCloud(userId, d);
    setBusy(false);
    if (e) setErr(e); else onReady(d);
  }

  const opt = (v: typeof choice, title: string, text: string) => (
    <label className={'choice' + (choice === v ? ' on' : '')}>
      <input type="radio" name="starter" checked={choice === v} onChange={() => setChoice(v)} />
      <span><strong>{title}</strong><span className="muted small">{text}</span></span>
    </label>
  );

  return (
    <Shell>
      <h1>Set up your Pitaka</h1>
      <p className="muted small">Choose how to start. You can add, rename or remove accounts any time.</p>
      <div className="choices">
        {hasLocal && opt('device', 'Use what’s already on this device', `${local!.accounts.length} accounts and ${local!.txns.length} entries from when Pitaka ran on this device only.`)}
        {opt('common', 'Common Philippine accounts', 'Cash, Maya, GCash, GoTyme, BPI, RCBC, Wise, Pag-IBIG, credit cards and pay-later, all at ₱0.')}
        {opt('blank', 'Start blank', 'Only Cash on Hand. Add your own accounts.')}
      </div>
      {err && <p className="form-error" role="alert">{err}</p>}
      <button type="button" className="btn primary block" onClick={start} disabled={busy}>{busy ? 'Setting up…' : 'Continue'}</button>
      <button type="button" className="link" onClick={() => supabase!.auth.signOut()}>Sign out</button>
    </Shell>
  );
}

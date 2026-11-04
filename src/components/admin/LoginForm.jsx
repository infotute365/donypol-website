'use client';
import { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';

export default function LoginForm() {
  const [f, setF] = useState({ username: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      if (res.ok) {
        // Start a fresh authenticated request after the HTTP-only cookie is set.
        window.location.replace('/admin/dashboard');
        return;
      }
      const result = await res.json().catch(() => ({}));
      setErr(result.error || 'Unable to sign in. Please try again.');
    } catch {
      setErr('Could not connect to the website. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  const cls = 'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 focus:border-sun focus:outline-none';
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form action="/api/auth/login" method="post" onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-white/5 p-8 text-white">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sun text-ink"><LockKeyhole /></span>
        <h1 className="font-display text-2xl font-bold">Admin sign in</h1>
        <input className={cls} name="username" aria-label="Username" placeholder="Username" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required />
        <input className={cls} name="password" aria-label="Password" type="password" placeholder="Password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
        <button disabled={busy || !ready} className="w-full rounded-lg bg-sun py-3 font-semibold text-ink transition hover:brightness-110 disabled:opacity-60">{!ready ? 'Preparing sign in…' : busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

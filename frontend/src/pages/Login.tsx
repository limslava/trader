import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Button, ErrorText, Spinner } from '../components/ui';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute top-1/3 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-accent/25 to-accent-2/20 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-sm animate-rise">
        <img src="/favicon.svg" alt="" className="mb-8 size-12" />
        <h1 className="text-3xl font-semibold tracking-tight">Trader</h1>
        <p className="mt-2 text-[15px] text-muted">AI-аналитика Московской биржи</p>
        <div className="mt-10 flex h-12 items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-5 shadow-soft focus-within:border-ink/30">
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            aria-label="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <Button type="submit" variant="primary" className="size-10 shrink-0 px-0" disabled={busy || !password} aria-label="Войти">
            {busy ? <Spinner /> : <ArrowRight className="size-5" />}
          </Button>
        </div>
        <div className="mt-3 px-2">
          <ErrorText error={error} />
        </div>
      </form>
    </div>
  );
}

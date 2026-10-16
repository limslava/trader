import { startAuthentication } from '@simplewebauthn/browser';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ScanFace } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { Button, ErrorText, Spinner } from '../components/ui';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const status = useQuery({ queryKey: ['authStatus'], queryFn: api.authStatus, staleTime: 60_000, retry: false });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const askCode = needCode || !!status.data?.totpEnabled;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password, code || undefined);
      onSuccess();
    } catch (err) {
      // 428: the server wants a code it did not get (2FA enabled but the status query failed).
      if (err instanceof ApiError && err.status === 428) setNeedCode(true);
      else setError(err);
    } finally {
      setBusy(false);
    }
  };

  const passkey = async () => {
    setBusy(true);
    setError(null);
    try {
      const options = await api.passkeyLoginOptions();
      const response = await startAuthentication({ optionsJSON: options as never });
      await api.passkeyLoginVerify(response);
      onSuccess();
    } catch (err) {
      // The user cancelled the system dialog: not an error worth showing.
      if (!(err instanceof Error && err.name === 'NotAllowedError')) setError(err);
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

        {(status.data?.passkeys ?? 0) > 0 && (
          <Button type="button" variant="primary" size="lg" onClick={passkey} disabled={busy} className="mt-10 w-full">
            <ScanFace className="size-5" aria-hidden /> Войти по Face ID
          </Button>
        )}

        <div className={`${(status.data?.passkeys ?? 0) > 0 ? 'mt-4' : 'mt-10'} flex h-12 items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-5 shadow-soft focus-within:border-ink/30`}>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            aria-label="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          {askCode && (
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Код из приложения"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Код"
              className="w-16 bg-transparent text-center text-base tracking-widest outline-none placeholder:text-muted"
            />
          )}
          <Button type="submit" variant="primary" className="size-10 shrink-0 px-0" disabled={busy || !password || (askCode && code.length !== 6)} aria-label="Войти">
            {busy ? <Spinner /> : <ArrowRight className="size-5" />}
          </Button>
        </div>
        {askCode && <p className="mt-2 px-2 text-xs text-muted">Пароль и шестизначный код из приложения-аутентификатора.</p>}
        <div className="mt-3 px-2">
          <ErrorText error={error} />
        </div>
      </form>
    </div>
  );
}

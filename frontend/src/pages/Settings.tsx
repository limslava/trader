import { startRegistration } from '@simplewebauthn/browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ScanFace, ShieldCheck, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Button, Empty, ErrorText, Skeleton, Surface } from '../components/ui';
import { dateTime } from '../format';

/** Security settings, mirroring the password manager: app password → authenticator code → Face ID passkey. */

function PasswordField({ value, onChange, placeholder = 'Пароль приложения' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="password"
      autoComplete="current-password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-10 w-full max-w-xs rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-ink/30"
    />
  );
}

function CodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="Код"
      aria-label="Код из приложения"
      className="h-10 w-24 rounded-full border border-line bg-surface px-4 text-center text-sm tracking-widest outline-none focus:border-ink/30"
    />
  );
}

function TotpCard({ enabled, onChanged }: { enabled: boolean; onChanged: () => void }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const setup = useMutation({ mutationFn: () => api.totpSetup(password) });
  const enable = useMutation({
    mutationFn: () => api.totpEnable(code),
    onSuccess: () => {
      setup.reset();
      setPassword('');
      setCode('');
      onChanged();
    },
  });
  const reset = useMutation({
    mutationFn: api.totpReset,
    onSuccess: () => {
      setup.reset();
      setCode('');
    },
  });
  const disable = useMutation({
    mutationFn: () => api.totpDisable(password, code),
    onSuccess: () => {
      setPassword('');
      setCode('');
      onChanged();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (enabled) disable.mutate();
    else if (setup.data) enable.mutate();
    else setup.mutate();
  };

  return (
    <Surface className="p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${enabled ? 'bg-up/15 text-up' : 'bg-surface-2 text-muted'}`}>
          <KeyRound className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Код из приложения (2FA)</h2>
          <p className="mt-0.5 text-sm text-muted">
            {enabled
              ? 'Включено: при входе по паролю нужен шестизначный код, который меняется каждые 30 секунд.'
              : 'Второй пароль, который меняется каждые 30 секунд. Нужно приложение-аутентификатор: Google Authenticator, Яндекс Ключ, 1Password или «Пароли» в iOS.'}
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3">
        {!enabled && setup.data && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-2 p-4">
            <img src={setup.data.qr} alt="QR-код для приложения-аутентификатора" className="size-40 rounded-xl bg-white p-1" />
            <div className="min-w-0 text-sm">
              <p className="font-medium">Отсканируйте QR в приложении и введите код, который оно покажет.</p>
              <p className="mt-2 text-xs text-muted">Если камера недоступна, добавьте ключ вручную:</p>
              <code className="mt-1 block break-all text-xs">{setup.data.secret}</code>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {(enabled || !setup.data) && <PasswordField value={password} onChange={setPassword} />}
          {(enabled || setup.data) && <CodeField value={code} onChange={setCode} />}
          <Button type="submit" variant={enabled ? 'down' : 'primary'} disabled={setup.isPending || enable.isPending || disable.isPending || (!setup.data && !password) || ((enabled || !!setup.data) && code.length !== 6)}>
            {enabled ? 'Отключить' : setup.data ? 'Подтвердить и включить' : 'Включить'}
          </Button>
          {!enabled && setup.data && (
            <Button type="button" variant="ghost" onClick={() => reset.mutate()} disabled={reset.isPending} title="Сбросить ключ и показать новый QR">
              Начать заново
            </Button>
          )}
        </div>
        <ErrorText error={setup.error ?? enable.error ?? disable.error ?? reset.error} />
      </form>
    </Surface>
  );
}

function PasskeysCard() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['passkeys'], queryFn: api.passkeys });
  const [password, setPassword] = useState('');
  const [name, setName] = useState(() => (/iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Mac/.test(navigator.userAgent) ? 'Mac' : 'Устройство'));
  const [cancelled, setCancelled] = useState(false);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['passkeys'] });
    qc.invalidateQueries({ queryKey: ['authStatus'] });
  };
  const add = useMutation({
    mutationFn: async () => {
      setCancelled(false);
      const options = await api.passkeyRegisterOptions(password);
      let response;
      try {
        response = await startRegistration({ optionsJSON: options as never });
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          setCancelled(true);
          return;
        }
        throw err;
      }
      await api.passkeyRegisterVerify(name, response);
    },
    onSuccess: () => {
      setPassword('');
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: number) => api.passkeyRemove(id, password), onSuccess: refresh });
  const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  return (
    <Surface className="p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${list.data?.length ? 'bg-up/15 text-up' : 'bg-surface-2 text-muted'}`}>
          <ScanFace className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Face ID / Touch ID (passkey)</h2>
          <p className="mt-0.5 text-sm text-muted">
            Вход без пароля и кода: ключ хранится в Secure Enclave устройства и подтверждается лицом или отпечатком. Добавьте каждое устройство отдельно.
          </p>
        </div>
      </div>

      {list.isLoading && <Skeleton className="mt-4 h-10" />}
      {list.data && list.data.length > 0 && (
        <ul className="mt-4 divide-y divide-line/70">
          {list.data.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-muted">
                  добавлен {dateTime(p.createdAt)}
                  {p.lastUsedAt && ` · вход ${dateTime(p.lastUsedAt)}`}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => password && window.confirm(`Удалить passkey «${p.name}»?`) && remove.mutate(p.id)} disabled={!password || remove.isPending} title={password ? 'Удалить' : 'Введите пароль, чтобы удалить'}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {list.data?.length === 0 && <Empty>Passkey пока не добавлен.</Empty>}

      {supported ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <PasswordField value={password} onChange={setPassword} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название устройства" aria-label="Название устройства" className="h-10 w-40 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-ink/30" />
          <Button type="submit" variant="primary" disabled={!password || !name || add.isPending}>
            Добавить это устройство
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">Этот браузер не поддерживает passkey.</p>
      )}
      {cancelled && <p className="mt-2 text-sm text-muted">Запрос отменён.</p>}
      <ErrorText error={add.error ?? remove.error} />
    </Surface>
  );
}

export function Settings() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['authStatus'], queryFn: api.authStatus });
  return (
    <div className="space-y-5">
      <Surface className="px-5 py-4 md:px-7">
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-accent" aria-hidden />
          <div>
            <h1 className="text-base font-semibold">Безопасность</h1>
            <p className="text-sm text-muted">
              Домен для passkey: <span className="font-medium text-ink">{status.data?.rpId ?? '…'}</span>. Три слоя защиты, как в менеджере паролей: пароль, код из приложения, Face ID.
            </p>
          </div>
        </div>
      </Surface>
      {status.data ? <TotpCard enabled={status.data.totpEnabled} onChanged={() => qc.invalidateQueries({ queryKey: ['authStatus'] })} /> : <Skeleton className="h-40 rounded-[18px]" />}
      <PasskeysCard />
    </div>
  );
}

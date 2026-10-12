import { useMutation, useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { Button, ErrorText, Surface } from './ui';

/** Weekly Telegram digest: status, preview and a "send now" button. */
export function DigestCard() {
  const status = useQuery({ queryKey: ['digestStatus'], queryFn: api.digestStatus, staleTime: Infinity });
  const [preview, setPreview] = useState<string | null>(null);
  const load = useMutation({ mutationFn: api.digestPreview, onSuccess: (r) => setPreview(r.text) });
  const send = useMutation({ mutationFn: api.digestSend });
  const on = !!status.data?.configured;

  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <Send className="size-5 text-muted" aria-hidden />
        <div className="mr-auto">
          <h2 className="text-base font-semibold tracking-tight">Дайджест в Telegram</h2>
          <p className="text-sm text-muted">
            {on
              ? 'Каждый понедельник в 9:00: рынок, портфель, вотчлист, дивиденды, точность AI.'
              : 'Еженедельная сводка в Telegram. Чтобы включить, задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в backend/.env.'}
          </p>
        </div>
        <Button size="sm" onClick={() => load.mutate()} disabled={load.isPending}>
          {load.isPending ? 'Готовлю…' : 'Предпросмотр'}
        </Button>
        {on && (
          <Button size="sm" variant="primary" onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending ? 'Отправляю…' : send.isSuccess ? 'Отправлено' : 'Отправить сейчас'}
          </Button>
        )}
      </div>
      <ErrorText error={load.error ?? send.error} />
      {preview && (
        <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-surface-2 p-4 text-xs leading-relaxed whitespace-pre-wrap">
          {preview.replace(/<[^>]+>/g, '')}
        </pre>
      )}
    </Surface>
  );
}

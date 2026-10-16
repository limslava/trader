import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { api, ApiError, setUnauthorizedHandler } from './api';
import { Layout } from './components/Layout';
import { WindowProvider } from './components/Windows';
import { Spinner } from './components/ui';
import './index.css';
import { Arena } from './pages/Arena';
import { History } from './pages/History';
import { Home } from './pages/Home';
import { Instrument } from './pages/Instrument';
import { Learn } from './pages/Learn';
import { Market } from './pages/Market';
import { Portfolio } from './pages/Portfolio';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { ThemeProvider } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

// Any 401 (expired session) from any request sends the user back to the login screen.
setUnauthorizedHandler(() => queryClient.setQueryData(['me'], null));

/**
 * Like the password manager: the server session lives only a few minutes and is extended by requests, so the
 * app pings while it is on screen and in use. A killed or backgrounded app stops pinging, the session expires,
 * and the next open asks for Face ID or the password. Returning from the background after the grace period
 * (enough to fetch a code from the authenticator) locks right away, as does 15 minutes without any activity.
 * While hidden the content is blurred so the app switcher shows nothing readable.
 */
const HIDE_GRACE_MS = 60_000;
const IDLE_LOCK_MS = 15 * 60_000;
const HEARTBEAT_MS = 45_000;

function useAutoLock(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    let hiddenAt = 0;
    let lastActivity = Date.now();
    const lock = () => {
      root.classList.remove('privacy-blur');
      qc.clear();
      qc.setQueryData(['me'], null);
      void api.logout().catch(() => undefined);
    };
    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastActivity > IDLE_LOCK_MS) return lock();
      api.me().catch((err) => err instanceof ApiError && err.status === 401 && lock());
    };
    const onActivity = () => (lastActivity = Date.now());
    const onHide = () => {
      if (!hiddenAt) hiddenAt = Date.now();
      root.classList.add('privacy-blur');
    };
    const onShow = () => {
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      root.classList.remove('privacy-blur');
      if (away > HIDE_GRACE_MS || Date.now() - lastActivity > IDLE_LOCK_MS) lock();
      else heartbeat();
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? onHide() : onShow());
    const timer = setInterval(heartbeat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    for (const ev of ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const) window.addEventListener(ev, onActivity, { passive: true });
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
      for (const ev of ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const) window.removeEventListener(ev, onActivity);
      root.classList.remove('privacy-blur');
    };
  }, [enabled, qc]);
}

function App() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me().catch((err) => (err instanceof ApiError && err.status === 401 ? null : Promise.reject(err))),
    staleTime: Infinity,
  });

  useAutoLock(!!me.data);

  if (me.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }
  if (!me.data) return <Login onSuccess={() => qc.resetQueries()} />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="s/:secid" element={<Instrument />} />
        <Route path="market" element={<Market />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="arena" element={<Arena />} />
        <Route path="history" element={<History />} />
        <Route path="learn" element={<Learn />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WindowProvider>
            <App />
          </WindowProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);

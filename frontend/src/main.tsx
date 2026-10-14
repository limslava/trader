import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
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

function App() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me().catch((err) => (err instanceof ApiError && err.status === 401 ? null : Promise.reject(err))),
    staleTime: Infinity,
  });

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

import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router';
import { api, ApiError } from './api';
import { Layout, ListPage } from './components/Layout';
import { Spinner } from './components/ui';
import './index.css';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
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

// Any 401 (expired session) sends the user back to the login screen.
queryClient.getQueryCache().subscribe((event) => {
  const err = event.query.state.error;
  if (err instanceof ApiError && err.status === 401 && event.query.queryKey[0] !== 'me') {
    queryClient.setQueryData(['me'], null);
  }
});

/** Regular (non-terminal) pages: centered column with padding. */
function Page() {
  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-6">
      <Outlet />
    </div>
  );
}

/** The terminal opens on the first watchlist instrument, or SBER for an empty watchlist. */
function Home() {
  const { data, isLoading } = useQuery({ queryKey: ['watchlist'], queryFn: api.watchlist });
  if (isLoading) return null;
  return <Navigate to={`/s/${data?.[0]?.secid ?? 'SBER'}`} replace />;
}

function App() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api.me().catch((err) => (err instanceof ApiError && err.status === 401 ? null : Promise.reject(err))),
    staleTime: Infinity,
  });

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
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
        <Route path="list" element={<ListPage />} />
        <Route element={<Page />}>
          <Route path="watchlist" element={<Dashboard />} />
          <Route path="market" element={<Market />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="learn" element={<Learn />} />
          <Route path="history" element={<History />} />
          <Route path="*" element={<Market />} />
        </Route>
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);

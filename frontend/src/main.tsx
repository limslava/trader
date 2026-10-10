import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { api, ApiError } from './api';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import './index.css';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Instrument } from './pages/Instrument';
import { Login } from './pages/Login';

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
        <Route index element={<Dashboard />} />
        <Route path="s/:secid" element={<Instrument />} />
        <Route path="history" element={<History />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

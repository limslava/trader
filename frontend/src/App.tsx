import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container, Box, Snackbar, Alert, LinearProgress, ThemeProvider } from '@mui/material';

import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard.tsx';
import Market from './pages/Market.tsx';
import Analysis from './pages/Analysis.tsx';
import Portfolio from './pages/Portfolio.tsx';
import RiskManagement from './pages/RiskManagement.tsx';
import Analytics from './pages/Analytics.tsx';
import AssetAnalysis from './pages/AssetAnalysis.tsx';
import MLAnalytics from './pages/MLAnalytics.tsx';
import { AuthPage } from './components/Auth/AuthPage';
import { useAppStore } from './stores/appStore';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';


// Компонент для защищенных маршрутов
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LinearProgress sx={{ width: '50%' }} />
      </Box>
    );
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

function App() {
  const {
    loading,
    error,
    clearError,
    fetchPopularAssets,
    fetchBeginnerRecommendations,
    fetchPortfolios
  } = useAppStore();
  const { isAuthenticated, user, token } = useAuthStore();
  const { theme } = useThemeStore();

  // Отладочная информация
  useEffect(() => {
    console.log('App auth state:', { isAuthenticated, user: user?.email, hasToken: !!token });
  }, [isAuthenticated, user, token]);

  // Загружаем начальные данные при запуске приложения только если пользователь авторизован
  useEffect(() => {
    if (isAuthenticated) {
      // Добавляем небольшую задержку, чтобы убедиться, что состояние аутентификации полностью восстановлено
      const timer = setTimeout(() => {
        const loadInitialData = async () => {
          await Promise.all([
            fetchPopularAssets(),
            fetchBeginnerRecommendations(),
            fetchPortfolios()
          ]);
        };

        loadInitialData();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, fetchPopularAssets, fetchBeginnerRecommendations, fetchPortfolios]);

  const handleCloseError = () => {
    clearError();
  };

  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          backgroundColor: 'background.default' // Добавляем фон для всей страницы
        }}>
          
          {/* Индикатор загрузки */}
          {loading && (
            <LinearProgress 
              sx={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                right: 0, 
                zIndex: 9999 
              }} 
            />
          )}
          
          <Navigation />
          <Container 
            component="main" 
            maxWidth="xl" 
            sx={{ 
              flex: 1, 
              py: 3,
              mt: 8 // Отступ для фиксированной навигации
            }}
          >
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/market"
                element={
                  <ProtectedRoute>
                    <Market />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analysis"
                element={
                  <ProtectedRoute>
                    <Analysis />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portfolio"
                element={
                  <ProtectedRoute>
                    <Portfolio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/risk"
                element={
                  <ProtectedRoute>
                    <RiskManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/asset-analysis/:symbol?"
                element={
                  <ProtectedRoute>
                    <AssetAnalysis />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ml-analytics"
                element={
                  <ProtectedRoute>
                    <MLAnalytics />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Container>

          {/* Уведомление об ошибке */}
          <Snackbar
            open={!!error}
            autoHideDuration={6000}
            onClose={handleCloseError}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert 
              onClose={handleCloseError} 
              severity="error" 
              variant="filled"
              sx={{ width: '100%' }}
            >
              {error}
            </Alert>
          </Snackbar>
          </Box>
        </Router>
      </ThemeProvider>
  );
}

export default App;
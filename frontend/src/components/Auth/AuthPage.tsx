import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';

type AuthMode = 'login' | 'register' | 'forgot-password';

export const AuthPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleToggleMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  };

  const handleForgotPassword = () => {
    setAuthMode('forgot-password');
  };

  const handleBackToLogin = () => {
    setAuthMode('login');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4
          }}
        >
          {/* Левая часть - информация о приложении */}
          <Box
            sx={{
              flex: 1,
              maxWidth: isMobile ? '100%' : 400,
              textAlign: isMobile ? 'center' : 'left',
              color: 'white'
            }}
          >
            <Typography
              variant="h3"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 'bold',
                mb: 2
              }}
            >
              Russian Trader
            </Typography>
            
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              sx={{
                opacity: 0.9,
                mb: 3
              }}
            >
              Умная платформа для трейдинга на российском рынке
            </Typography>

            <Paper
              elevation={0}
              sx={{
                p: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: 2,
                mb: 3
              }}
            >
              <Typography variant="body1" sx={{ mb: 2 }}>
                🎯 <strong>Персональные рекомендации</strong><br />
                Аналитика для новичков и опытных трейдеров
              </Typography>
              
              <Typography variant="body1" sx={{ mb: 2 }}>
                📊 <strong>Реальные данные</strong><br />
                MOEX, СПБиржа, криптовалюты в реальном времени
              </Typography>
              
              <Typography variant="body1" sx={{ mb: 2 }}>
                🛡️ <strong>Риск-менеджмент</strong><br />
                Защита капитала для начинающих инвесторов
              </Typography>
              
              <Typography variant="body1">
                🇷🇺 <strong>Российская специфика</strong><br />
                Учет налогов и местных особенностей рынка
              </Typography>
            </Paper>

            <Typography
              variant="body2"
              sx={{
                opacity: 0.8,
                fontStyle: 'italic'
              }}
            >
              Начните свой путь в трейдинге с умной аналитикой
            </Typography>
          </Box>

          {/* Правая часть - форма аутентификации */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              maxWidth: isMobile ? '100%' : 500
            }}
          >
           {authMode === 'login' && (
             <LoginForm
               onToggleMode={handleToggleMode}
               onForgotPassword={handleForgotPassword}
             />
           )}
           {authMode === 'register' && (
             <RegisterForm onToggleMode={handleToggleMode} />
           )}
           {authMode === 'forgot-password' && (
             <ForgotPasswordForm onBackToLogin={handleBackToLogin} />
           )}
          </Box>
        </Box>

        {/* Футер */}
        <Box
          sx={{
            mt: 4,
            textAlign: 'center',
            color: 'white',
            opacity: 0.7
          }}
        >
          <Typography variant="body2">
            Russian Trader © 2025 | Для образовательных целей
          </Typography>
          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
            Инвестиции связаны с рисками. Перед началом торговли ознакомьтесь с рисками.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};
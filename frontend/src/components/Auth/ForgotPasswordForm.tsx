import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Link,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import { authApi } from '../../services/authApi';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const steps = [
    'Введите email',
    'Проверьте email и введите токен',
    'Установите новый пароль'
  ];

  const validateEmail = () => {
    if (!email) {
      setError('Email обязателен');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Некорректный формат email');
      return false;
    }
    return true;
  };

  const validateToken = () => {
    if (!resetToken) {
      setError('Токен обязателен');
      return false;
    }
    return true;
  };

  const validatePassword = () => {
    if (!newPassword) {
      setError('Новый пароль обязателен');
      return false;
    }
    if (newPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return false;
    }
    return true;
  };

  const handleRequestReset = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await authApi.forgotPassword(email);
      if (response.success) {
        setSuccessMessage('Инструкции по сбросу пароля отправлены на email');
        setEmailSent(true);
        setActiveStep(1);
      } else {
        setError(response.message || 'Ошибка при запросе сброса пароля');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при запросе сброса пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyToken = async () => {
    if (!validateToken()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.verifyResetToken(resetToken);
      if (response.success) {
        setSuccessMessage('Токен действителен');
        setActiveStep(2);
      } else {
        setError(response.message || 'Недействительный токен');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при проверке токена');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authApi.resetPassword(email, newPassword, resetToken);
      if (response.success) {
        setSuccessMessage('Пароль успешно изменен! Теперь вы можете войти с новым паролем.');
        // Автоматически перейти к форме входа через 3 секунды
        setTimeout(() => {
          onBackToLogin();
        }, 3000);
      } else {
        setError(response.message || 'Ошибка при сбросе пароля');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при сбросе пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Введите email, связанный с вашим аккаунтом. Мы отправим инструкции по сбросу пароля.
            </Typography>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={onBackToLogin} disabled={isLoading}>
                Назад к входу
              </Button>
              <Button
                variant="contained"
                onClick={handleRequestReset}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Отправить инструкции'}
              </Button>
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {emailSent
                ? `Демо-режим: Токен сброса пароля сгенерирован для ${email}. В реальном приложении он был бы отправлен по email. Токен можно получить из логов backend (смотрите терминал).`
                : 'Введите токен сброса пароля, полученный по email.'}
            </Typography>
            <TextField
              margin="normal"
              required
              fullWidth
              id="resetToken"
              label="Токен сброса пароля"
              name="resetToken"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              disabled={isLoading}
              placeholder="Введите токен из email"
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleStepBack} disabled={isLoading}>
                Назад
              </Button>
              <Button
                variant="contained"
                onClick={handleVerifyToken}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Проверить токен'}
              </Button>
            </Box>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Введите новый пароль для вашего аккаунта.
            </Typography>
            <TextField
              margin="normal"
              required
              fullWidth
              name="newPassword"
              label="Новый пароль"
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Подтвердите новый пароль"
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <Button onClick={handleStepBack} disabled={isLoading}>
                Назад
              </Button>
              <Button
                variant="contained"
                onClick={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Установить новый пароль'}
              </Button>
            </Box>
          </Box>
        );
      default:
        return 'Неизвестный шаг';
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Восстановление пароля
      </Typography>
      
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Следуйте инструкциям для восстановления доступа к вашему аккаунту
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 3 }}>
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
            <StepContent>
              {getStepContent(index)}
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {activeStep === steps.length && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Пароль успешно изменен! Вы будете перенаправлены на страницу входа...
        </Alert>
      )}

      <Box sx={{ textAlign: 'center', mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Вспомнили пароль?{' '}
          <Link
            component="button"
            type="button"
            variant="body2"
            onClick={onBackToLogin}
            sx={{ cursor: 'pointer' }}
          >
            Войти
          </Link>
        </Typography>
      </Box>
    </Paper>
  );
};
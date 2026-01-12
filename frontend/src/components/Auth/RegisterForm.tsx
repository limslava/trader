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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput
} from '@mui/material';
import { useAuthStore } from '../../stores/authStore';

interface RegisterFormProps {
  onToggleMode: () => void;
}

const experienceLevels = [
  { value: 'BEGINNER', label: 'Начинающий' },
  { value: 'INTERMEDIATE', label: 'Средний' },
  { value: 'ADVANCED', label: 'Продвинутый' }
];

const riskTolerances = [
  { value: 'LOW', label: 'Низкий' },
  { value: 'MEDIUM', label: 'Средний' },
  { value: 'HIGH', label: 'Высокий' }
];

const investmentGoals = [
  'Сбережения',
  'Пассивный доход',
  'Спекуляции',
  'Долгосрочные инвестиции',
  'Обучение трейдингу'
];

export const RegisterForm: React.FC<RegisterFormProps> = ({ onToggleMode }) => {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    experienceLevel: 'BEGINNER' as const,
    riskTolerance: 'MEDIUM' as const,
    investmentGoals: [] as string[]
  });
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const { register, isLoading, error } = useAuthStore();

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email) {
      newErrors.email = 'Email обязателен';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }

    if (!formData.username) {
      newErrors.username = 'Имя пользователя обязательно';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Имя пользователя должно содержать минимум 3 символа';
    }

    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен содержать минимум 6 символов';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Подтверждение пароля обязательно';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSelectChange = (field: string) => (event: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleGoalsChange = (event: any) => {
    const {
      target: { value },
    } = event;
    setFormData(prev => ({
      ...prev,
      investmentGoals: typeof value === 'string' ? value.split(',') : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const { confirmPassword, experienceLevel, riskTolerance, investmentGoals, ...registerData } = formData;
      await register({
        ...registerData,
        profile: {
          experienceLevel,
          riskTolerance,
          investmentGoals
        }
      });
    } catch (err) {
      // Ошибка обрабатывается в store
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Регистрация
      </Typography>
      
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
        Создайте аккаунт для доступа к Russian Trader
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label="Email"
          name="email"
          autoComplete="email"
          autoFocus
          value={formData.email}
          onChange={handleInputChange('email')}
          error={!!errors.email}
          helperText={errors.email}
          disabled={isLoading}
        />
        
        <TextField
          margin="normal"
          required
          fullWidth
          id="username"
          label="Имя пользователя"
          name="username"
          autoComplete="username"
          value={formData.username}
          onChange={handleInputChange('username')}
          error={!!errors.username}
          helperText={errors.username}
          disabled={isLoading}
        />
        
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label="Пароль"
          type="password"
          id="password"
          autoComplete="new-password"
          value={formData.password}
          onChange={handleInputChange('password')}
          error={!!errors.password}
          helperText={errors.password}
          disabled={isLoading}
        />

        <TextField
          margin="normal"
          required
          fullWidth
          name="confirmPassword"
          label="Подтверждение пароля"
          type="password"
          id="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleInputChange('confirmPassword')}
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword}
          disabled={isLoading}
        />

        <FormControl fullWidth margin="normal">
          <InputLabel id="experience-level-label">Уровень опыта</InputLabel>
          <Select
            labelId="experience-level-label"
            id="experienceLevel"
            value={formData.experienceLevel}
            label="Уровень опыта"
            onChange={handleSelectChange('experienceLevel')}
            disabled={isLoading}
          >
            {experienceLevels.map((level) => (
              <MenuItem key={level.value} value={level.value}>
                {level.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel id="risk-tolerance-label">Толерантность к риску</InputLabel>
          <Select
            labelId="risk-tolerance-label"
            id="riskTolerance"
            value={formData.riskTolerance}
            label="Толерантность к риску"
            onChange={handleSelectChange('riskTolerance')}
            disabled={isLoading}
          >
            {riskTolerances.map((risk) => (
              <MenuItem key={risk.value} value={risk.value}>
                {risk.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel id="investment-goals-label">Цели инвестирования</InputLabel>
          <Select
            labelId="investment-goals-label"
            id="investmentGoals"
            multiple
            value={formData.investmentGoals}
            onChange={handleGoalsChange}
            input={<OutlinedInput id="select-multiple-chip" label="Цели инвестирования" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
            disabled={isLoading}
          >
            {investmentGoals.map((goal) => (
              <MenuItem key={goal} value={goal}>
                {goal}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading}
          size="large"
        >
          {isLoading ? <CircularProgress size={24} /> : 'Зарегистрироваться'}
        </Button>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Уже есть аккаунт?{' '}
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={onToggleMode}
              sx={{ cursor: 'pointer' }}
            >
              Войти
            </Link>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};
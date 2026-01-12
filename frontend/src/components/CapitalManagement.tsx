import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  AccountBalanceWallet,
  Add,
  Remove,
  Settings,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import apiClient from '../services/api';

interface CapitalData {
  initialCapital: number;
  currentCapital: number;
  availableCapital: number;
  createdAt?: string;
  updatedAt?: string;
}

const CapitalManagement: React.FC = () => {
  const [capital, setCapital] = useState<CapitalData | null>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Диалоги
  const [initialDialogOpen, setInitialDialogOpen] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  
  // Формы
  const [initialAmount, setInitialAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Загрузка данных о капитале
  const loadCapital = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/capital');
      
      if (response.data.success) {
        setCapital(response.data.data);
      } else {
        setError('Не удалось загрузить данные о капитале');
      }
    } catch (err) {
      setError('Ошибка при загрузке данных о капитале');
      console.error('❌ Ошибка загрузки капитала:', err);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка данных портфеля
  const loadPortfolio = async () => {
    try {
      const response = await apiClient.get('/portfolio');
      if (response.data.success) {
        setPortfolio(response.data.data);
      }
    } catch (err) {
      console.error('❌ Ошибка загрузки портфеля:', err);
    }
  };

  useEffect(() => {
    loadCapital();
    loadPortfolio();
  }, []);

  // Установка стартового капитала
  const handleSetInitialCapital = async () => {
    try {
      const amount = parseFloat(initialAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Введите корректную сумму');
        return;
      }

      const response = await apiClient.post('/capital/initial', { amount });
      
      if (response.data.success) {
        setSuccess(`Стартовый капитал установлен: ${amount.toLocaleString('ru-RU')} ₽`);
        setInitialDialogOpen(false);
        setInitialAmount('');
        await loadCapital();
        await loadPortfolio();
      } else {
        setError(response.data.message || 'Ошибка установки капитала');
      }
    } catch (err) {
      setError('Ошибка при установке стартового капитала');
      console.error('❌ Ошибка установки капитала:', err);
    }
  };

  // Пополнение счета
  const handleDeposit = async () => {
    try {
      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Введите корректную сумму пополнения');
        return;
      }

      const response = await apiClient.post('/capital/deposit', { amount });
      
      if (response.data.success) {
        setSuccess(`Счет пополнен на ${amount.toLocaleString('ru-RU')} ₽`);
        setDepositDialogOpen(false);
        setDepositAmount('');
        await loadCapital();
        await loadPortfolio();
      } else {
        setError(response.data.message || 'Ошибка пополнения счета');
      }
    } catch (err) {
      setError('Ошибка при пополнении счета');
      console.error('❌ Ошибка пополнения:', err);
    }
  };

  // Вывод средств
  const handleWithdraw = async () => {
    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Введите корректную сумму вывода');
        return;
      }

      const response = await apiClient.post('/capital/withdraw', { amount });
      
      if (response.data.success) {
        setSuccess(`Средства выведены: ${amount.toLocaleString('ru-RU')} ₽`);
        setWithdrawDialogOpen(false);
        setWithdrawAmount('');
        await loadCapital();
        await loadPortfolio();
      } else {
        setError(response.data.message || 'Ошибка вывода средств');
      }
    } catch (err) {
      setError('Ошибка при выводе средств');
      console.error('❌ Ошибка вывода:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(amount);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Рассчитываем правильные значения на основе капитала и портфеля
  const calculateCorrectValues = () => {
    if (!capital) return null;

    const totalPortfolioValue = portfolio?.totalValue || 0;
    const totalProfitLoss = portfolio?.totalProfitLoss || 0;
    
    // Денежные средства = текущий капитал - стоимость портфеля - убыток (или + прибыль)
    const cashBalance = capital.currentCapital - totalPortfolioValue + totalProfitLoss;
    
    // Доступно для торговли = денежные средства (не может быть отрицательным)
    const availableForTrading = Math.max(0, cashBalance);
    
    // Текущий капитал = денежные средства + стоимость портфеля
    const currentCapital = cashBalance + totalPortfolioValue;

    return {
      cashBalance,
      availableForTrading,
      totalPortfolioValue,
      totalProfitLoss,
      currentCapital
    };
  };

  const calculatedValues = calculateCorrectValues();

  if (loading) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Управление капиталом</Typography>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
          Загрузка данных...
        </Typography>
      </Card>
    );
  }

  return (
    <Box>
      {/* Уведомления */}
      {error && (
        <Alert severity="error" onClose={clearMessages} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={clearMessages} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2">
            Управление капиталом
          </Typography>
          <Chip 
            icon={<AccountBalanceWallet />} 
            label="Капитал" 
            color="primary" 
            variant="outlined" 
          />
        </Box>

        {/* Статистика капитала */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 3, 
          mb: 3 
        }}>
          <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Стартовый капитал
            </Typography>
            <Typography variant="h4" color="primary">
              {capital ? formatCurrency(capital.initialCapital) : '0 ₽'}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setInitialDialogOpen(true)}
              sx={{ mt: 1 }}
            >
              Установить
            </Button>
          </Card>

          <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Текущий капитал
            </Typography>
            <Typography variant="h4" color="success.main">
              {calculatedValues ? formatCurrency(calculatedValues.currentCapital) : (capital ? formatCurrency(capital.currentCapital) : '0 ₽')}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={() => setDepositDialogOpen(true)}
              >
                Пополнить
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Remove />}
                onClick={() => setWithdrawDialogOpen(true)}
              >
                Вывести
              </Button>
            </Box>
          </Card>

          <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Денежные средства
            </Typography>
            <Typography variant="h4" color="primary">
              {calculatedValues ? formatCurrency(calculatedValues.cashBalance) : '0 ₽'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {calculatedValues && calculatedValues.totalPortfolioValue > 0 ?
                `В портфеле: ${formatCurrency(calculatedValues.totalPortfolioValue)}` :
                'Нет открытых позиций'
              }
            </Typography>
          </Card>

          <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Доступно для торговли
            </Typography>
            <Typography variant="h4" color="info.main">
              {calculatedValues ? formatCurrency(calculatedValues.availableForTrading) : '0 ₽'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {calculatedValues && capital && calculatedValues.availableForTrading < capital.currentCapital ?
                `Занято в позициях: ${formatCurrency(capital.currentCapital - calculatedValues.availableForTrading)}` :
                'Все средства доступны'
              }
            </Typography>
          </Card>
        </Box>

        {/* Информация о капитале и портфеле */}
        {capital && (
          <Box sx={{ p: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Сводка по капиталу и портфелю
            </Typography>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2
            }}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Изменение капитала:
                </Typography>
                <Typography
                  variant="h6"
                  color={calculatedValues?.currentCapital >= capital.initialCapital ? 'success.main' : 'error.main'}
                >
                  {calculatedValues?.currentCapital >= capital.initialCapital ? (
                    <TrendingUp sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  ) : (
                    <TrendingDown sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  )}
                  {formatCurrency((calculatedValues?.currentCapital || capital.currentCapital) - capital.initialCapital)}
                  {' '}
                  ({(((calculatedValues?.currentCapital || capital.currentCapital) - capital.initialCapital) / capital.initialCapital * 100).toFixed(2)}%)
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Прибыль/убыток портфеля:
                </Typography>
                <Typography
                  variant="h6"
                  color={calculatedValues?.totalProfitLoss >= 0 ? 'success.main' : 'error.main'}
                >
                  {calculatedValues?.totalProfitLoss >= 0 ? (
                    <TrendingUp sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  ) : (
                    <TrendingDown sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                  )}
                  {calculatedValues ? formatCurrency(calculatedValues.totalProfitLoss) : '0 ₽'}
                  {portfolio?.totalProfitLossPercentage && (
                    <Typography
                      component="span"
                      variant="body2"
                      color={calculatedValues?.totalProfitLoss >= 0 ? 'success.main' : 'error.main'}
                      sx={{ ml: 1 }}
                    >
                      ({portfolio.totalProfitLossPercentage > 0 ? '+' : ''}{portfolio.totalProfitLossPercentage.toFixed(2)}%)
                    </Typography>
                  )}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Обновлено: {capital.updatedAt ? new Date(capital.updatedAt).toLocaleString('ru-RU') : 'Недавно'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Кнопка инициализации для существующих пользователей */}
        {!capital && (
          <Box sx={{ textAlign: 'center', p: 3 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Капитал еще не настроен
            </Typography>
            <Button
              variant="contained"
              onClick={() => setInitialDialogOpen(true)}
              startIcon={<Settings />}
            >
              Настроить капитал
            </Button>
          </Box>
        )}
      </Card>

      {/* Диалог установки стартового капитала */}
      <Dialog open={initialDialogOpen} onClose={() => setInitialDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Установить стартовый капитал</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Введите сумму, которую вы готовы инвестировать в торговлю. Это будет ваш начальный капитал.
          </Typography>
          <TextField
            fullWidth
            label="Сумма капитала (₽)"
            type="number"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            placeholder="Например: 100000"
            InputProps={{
              inputProps: { min: 0, step: 1000 }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInitialDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={handleSetInitialCapital}
            variant="contained"
            disabled={!initialAmount || parseFloat(initialAmount) <= 0}
          >
            Установить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог пополнения счета */}
      <Dialog open={depositDialogOpen} onClose={() => setDepositDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Пополнить счет</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Введите сумму для пополнения торгового счета.
          </Typography>
          <TextField
            fullWidth
            label="Сумма пополнения (₽)"
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Например: 50000"
            InputProps={{
              inputProps: { min: 0, step: 1000 }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={handleDeposit}
            variant="contained"
            disabled={!depositAmount || parseFloat(depositAmount) <= 0}
          >
            Пополнить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог вывода средств */}
      <Dialog open={withdrawDialogOpen} onClose={() => setWithdrawDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Вывести средства</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Введите сумму для вывода с торгового счета.
          </Typography>
          <TextField
            fullWidth
            label="Сумма вывода (₽)"
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Например: 25000"
            InputProps={{
              inputProps: { 
                min: 0, 
                step: 1000,
                max: capital?.availableCapital || 0 
              }
            }}
          />
          {capital && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Доступно для вывода: {formatCurrency(capital.availableCapital)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={handleWithdraw}
            variant="contained"
            disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || 
                     (capital ? parseFloat(withdrawAmount) > capital.availableCapital : false)}
          >
            Вывести
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CapitalManagement;
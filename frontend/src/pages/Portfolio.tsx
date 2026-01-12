import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalanceWallet,
  Add,
  Delete
} from '@mui/icons-material';
import { usePortfolio } from '../stores/portfolioStore';
import { portfolioApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import AnimatedCard from '../components/AnimatedCard';
import CapitalManagement from '../components/CapitalManagement';

const Portfolio: React.FC = () => {
  const {
    portfolio,
    transactions,
    isLoading,
    error,
    loadPortfolio,
    loadTransactions,
    addTransaction,
    deleteTransaction,
    clearError
  } = usePortfolio();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    assetSymbol: '',
    assetType: 'stock' as 'stock' | 'crypto' | 'currency',
    transactionType: 'buy' as 'buy' | 'sell',
    quantity: 0,
    price: 0,
    commission: 0,
    notes: ''
  });

  // Функция для получения названия актива по символу
  const getAssetName = (symbol: string, assetType?: string) => {
    const assetNames: Record<string, string> = {
      // Российские акции
      'SBER': 'Сбербанк',
      'GAZP': 'Газпром',
      'LKOH': 'Лукойл',
      'ROSN': 'Роснефть',
      'NVTK': 'Новатэк',
      'GMKN': 'Норильский никель',
      'TATN': 'Татнефть',
      'MTSS': 'МТС',
      'MGNT': 'Магнит',
      'PHOR': 'ФосАгро',
      'PLZL': 'Полюс',
      'ALRS': 'АЛРОСА',
      'MOEX': 'Московская биржа',
      'YNDX': 'Яндекс',
      'OZON': 'Ozon',
      'TCSG': 'TCS Group',
      
      // Криптовалюты
      'BTCUSDT': 'Bitcoin',
      'ETHUSDT': 'Ethereum',
      'BNBUSDT': 'Binance Coin',
      'ADAUSDT': 'Cardano',
      'DOTUSDT': 'Polkadot',
      'LINKUSDT': 'Chainlink',
      'LTCUSDT': 'Litecoin',
      'BCHUSDT': 'Bitcoin Cash',
      'XRPUSDT': 'Ripple',
      'DOGEUSDT': 'Dogecoin'
    };

    return assetNames[symbol] || symbol;
  };

  // Функция для определения типа актива по символу
  const detectAssetType = (symbol: string): 'stock' | 'crypto' => {
    const cryptoPatterns = ['USDT', 'BTC', 'ETH', 'BNB', 'ADA', 'DOT', 'LINK', 'LTC', 'BCH', 'XRP', 'DOGE'];
    const isCrypto = cryptoPatterns.some(pattern => symbol.includes(pattern));
    return isCrypto ? 'crypto' : 'stock';
  };

  useEffect(() => {
    loadPortfolio();
    loadTransactions();
    
    // Автоматическое обновление цен портфеля при загрузке
    const updatePrices = async () => {
      try {
        await portfolioApi.updatePortfolioPrices();
        console.log('✅ Цены портфеля автоматически обновлены');
        // Перезагружаем портфель после обновления цен
        setTimeout(() => {
          loadPortfolio();
        }, 500);
      } catch (error) {
        console.error('❌ Ошибка автоматического обновления цен:', error);
      }
    };
    
    updatePrices();
    
    // Периодическое обновление цен каждые 30 секунд
    const interval = setInterval(() => {
      updatePrices();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadPortfolio, loadTransactions]);

  const handleAddTransaction = async () => {
    try {
      await addTransaction(newTransaction);
      setAddDialogOpen(false);
      setNewTransaction({
        assetSymbol: '',
        assetType: 'stock',
        transactionType: 'buy',
        quantity: 0,
        price: 0,
        commission: 0,
        notes: ''
      });
    } catch (error) {
      // Ошибка обрабатывается в store
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту транзакцию?')) {
      await deleteTransaction(transactionId);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(numAmount || 0);
  };

  // Функция для расчета стоимости позиции
  const calculatePositionValue = (position: any) => {
    // Стоимость = Текущая цена × Количество
    return (position.currentPrice || 0) * (position.quantity || 0);
  };

  // Функция для расчета прибыли/убытка
  const calculatePositionProfitLoss = (position: any) => {
    const currentValue = calculatePositionValue(position);
    const purchaseCost = (position.averagePrice || 0) * (position.quantity || 0);
    const commission = position.commission || 0;
    
    // Прибыль/Убыток = Стоимость - ((Количество × Цена покупки) + Комиссия)
    return currentValue - (purchaseCost + commission);
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || value === null) return '0.00%';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (isLoading && !portfolio) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Мой Портфель
        </Typography>
        <LoadingSpinner message="Загрузка данных портфеля..." />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Заголовок страницы */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Мой Портфель
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAddDialogOpen(true)}
        >
          Добавить транзакцию
        </Button>
      </Box>

      {/* Управление капиталом */}
      <Box sx={{ mb: 4 }}>
        <CapitalManagement />
      </Box>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Сводка портфеля */}
      {portfolio && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          <AnimatedCard animation="grow" delay={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AccountBalanceWallet sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Общая стоимость</Typography>
            </Box>
            <Typography variant="h4" color="primary">
              {formatCurrency(portfolio.totalValue)}
            </Typography>
          </AnimatedCard>

          <AnimatedCard animation="grow" delay={100}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TrendingUp sx={{ mr: 1, color: 'success.main' }} />
              <Typography variant="h6">Прибыль/Убыток</Typography>
            </Box>
            <Typography
              variant="h4"
              color={portfolio.totalProfitLoss >= 0 ? 'success.main' : 'error.main'}
            >
              {formatCurrency(portfolio.totalProfitLoss)}
            </Typography>
            <Typography
              variant="body2"
              color={portfolio.totalProfitLossPercentage >= 0 ? 'success.main' : 'error.main'}
            >
              {formatPercentage(portfolio.totalProfitLossPercentage)}
            </Typography>
          </AnimatedCard>


          <AnimatedCard animation="grow" delay={300}>
            <Typography variant="h6" sx={{ mb: 2 }}>Активов в портфеле</Typography>
            <Typography variant="h4" color="text.secondary">
              {portfolio.positions ? portfolio.positions.length : 0}
            </Typography>
          </AnimatedCard>
        </div>
      )}

      {/* Позиции портфеля */}
      {portfolio && portfolio.positions && portfolio.positions.length > 0 && (
        <AnimatedCard animation="slide" delay={400} direction="up">
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">Позиции портфеля</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Актив</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell align="right">Количество</TableCell>
                  <TableCell align="right">Цена покупки</TableCell>
                  <TableCell align="right">Текущая цена</TableCell>
                  <TableCell align="right">Стоимость</TableCell>
                  <TableCell align="right">Прибыль/Убыток</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolio.positions.map((position, index) => (
                  <TableRow
                    key={position.assetSymbol}
                    sx={{
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {getAssetName(position.assetSymbol, position.assetType)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {position.assetSymbol}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={position.assetType ? (position.assetType.toLowerCase() === 'crypto' ? 'Крипто' : 'Акция') : (detectAssetType(position.assetSymbol) === 'stock' ? 'Акция' : 'Крипто')}
                        size="small"
                        color={position.assetType ? (position.assetType.toLowerCase() === 'crypto' ? 'secondary' : 'primary') : (detectAssetType(position.assetSymbol) === 'stock' ? 'primary' : 'secondary')}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {position.quantity.toLocaleString('ru-RU')}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(position.averagePrice)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(position.currentPrice)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(calculatePositionValue(position))}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {calculatePositionProfitLoss(position) >= 0 ? (
                          <TrendingUp sx={{ color: 'success.main', mr: 0.5 }} />
                        ) : (
                          <TrendingDown sx={{ color: 'error.main', mr: 0.5 }} />
                        )}
                        <Typography
                          variant="body2"
                          color={calculatePositionProfitLoss(position) >= 0 ? 'success.main' : 'error.main'}
                        >
                          {formatCurrency(calculatePositionProfitLoss(position))}
                          <br />
                          {formatPercentage(position.profitLossPercentage)}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AnimatedCard>
      )}

      {/* История транзакций */}
      {transactions && transactions.length > 0 && (
        <AnimatedCard animation="slide" delay={500} direction="up">
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6">История транзакций</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Дата</TableCell>
                  <TableCell>Актив</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell align="right">Количество</TableCell>
                  <TableCell align="right">Цена</TableCell>
                  <TableCell align="right">Комиссия</TableCell>
                  <TableCell align="right">Сумма</TableCell>
                  <TableCell>Примечания</TableCell>
                  <TableCell align="center">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction, index) => (
                  <TableRow
                    key={`${transaction.id}-${index}`}
                    sx={{
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }}
                  >
                    <TableCell>
                      {transaction.timestamp ? new Date(transaction.timestamp).toLocaleDateString('ru-RU') : '-'}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {getAssetName(transaction.symbol || '')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {transaction.symbol || '-'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={transaction.type === 'buy' ? 'Покупка' : 'Продажа'}
                        size="small"
                        color={transaction.type === 'buy' ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {transaction.quantity ? transaction.quantity.toLocaleString('ru-RU') : '0'}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(transaction.price || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(transaction.fee || 0)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(transaction.totalAmount || 0)}
                    </TableCell>
                    <TableCell>{transaction.notes || '-'}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        sx={{
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.1)',
                          }
                        }}
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AnimatedCard>
      )}

      {/* Диалог добавления транзакции */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить транзакцию</DialogTitle>
        <DialogContent>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '8px'
          }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                label="Символ актива"
                value={newTransaction.assetSymbol}
                onChange={(e) => setNewTransaction({
                  ...newTransaction,
                  assetSymbol: e.target.value.toUpperCase()
                })}
                placeholder="Например: SBER, BTCUSDT"
              />
            </div>
            <div>
              <TextField
                fullWidth
                select
                label="Тип актива"
                value={newTransaction.assetType}
                onChange={(e) => setNewTransaction({
                  ...newTransaction,
                  assetType: e.target.value as 'stock' | 'crypto' | 'currency'
                })}
              >
                <MenuItem value="stock">Акция</MenuItem>
                <MenuItem value="crypto">Криптовалюта</MenuItem>
              </TextField>
            </div>
            <div>
              <TextField
                fullWidth
                select
                label="Тип операции"
                value={newTransaction.transactionType}
                onChange={(e) => setNewTransaction({
                  ...newTransaction,
                  transactionType: e.target.value as 'buy' | 'sell'
                })}
              >
                <MenuItem value="buy">Покупка</MenuItem>
                <MenuItem value="sell">Продажа</MenuItem>
              </TextField>
            </div>
            <div>
              <TextField
                fullWidth
                type="number"
                label="Количество"
                value={newTransaction.quantity}
                onChange={(e) => setNewTransaction({
                  ...newTransaction,
                  quantity: parseFloat(e.target.value) || 0
                })}
              />
            </div>
            <div>
              <TextField
                fullWidth
                type="number"
                label="Цена за единицу"
                value={newTransaction.price}
                onChange={(e) => setNewTransaction({
                  ...newTransaction,
                  price: parseFloat(e.target.value) || 0
                })}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                type="number"
                label="Комиссия"
                value={newTransaction.commission}
                onChange={(e) => setNewTransaction({
                  ...newTransaction,
                  commission: parseFloat(e.target.value) || 0
                })}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <TextField
                fullWidth
                label="Примечания"
                value={newTransaction.notes}
                onChange={(e) => setNewTransaction({
                  ...newTransaction,
                  notes: e.target.value
                })}
                multiline
                rows={2}
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={handleAddTransaction}
            variant="contained"
            disabled={!newTransaction.assetSymbol || newTransaction.quantity <= 0 || newTransaction.price <= 0}
          >
            Добавить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Portfolio;
import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Share,
  Print,
  Analytics,
  ShowChart,
  Assessment,
} from '@mui/icons-material';
import { useAppStore, appSelectors } from '../stores/appStore';
import AnalyticsReport from '../components/AnalyticsReport';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const AnalyticsReports: React.FC = () => {
  const {
    loading,
    error,
    beginnerRecommendations,
    fetchBeginnerRecommendations
  } = useAppStore();

  const topRecommendations = useAppStore(appSelectors.getTopRecommendations(10));
  const [tabValue, setTabValue] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => {
    fetchBeginnerRecommendations();
  }, [fetchBeginnerRecommendations]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    setTabValue(1); // Переключаем на вкладку детального отчета
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY':
      case 'STRONG_BUY':
        return 'success';
      case 'SELL':
      case 'STRONG_SELL':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY': return 'ПОКУПАТЬ';
      case 'STRONG_BUY': return 'СИЛЬНО ПОКУПАТЬ';
      case 'SELL': return 'ПРОДАВАТЬ';
      case 'STRONG_SELL': return 'СИЛЬНО ПРОДАВАТЬ';
      case 'HOLD': return 'ДЕРЖАТЬ';
      default: return recommendation;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'warning';
      case 'HIGH': return 'error';
      case 'VERY_HIGH': return 'error';
      default: return 'default';
    }
  };

  const getRiskText = (level: string) => {
    switch (level) {
      case 'LOW': return 'Низкий';
      case 'MEDIUM': return 'Средний';
      case 'HIGH': return 'Высокий';
      case 'VERY_HIGH': return 'Очень высокий';
      default: return 'Неизвестно';
    }
  };

  if (loading && beginnerRecommendations.length === 0) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Аналитические отчеты
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
        📈 Аналитические отчеты
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Вкладки аналитики */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Обзор рекомендаций" icon={<Analytics />} iconPosition="start" />
          <Tab label="Детальный отчет" icon={<Assessment />} iconPosition="start" />
          <Tab label="История отчетов" icon={<ShowChart />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Панель обзора рекомендаций */}
      <TabPanel value={tabValue} index={0}>
        <Box mb={4}>
          <Typography variant="h6" gutterBottom>
            Топ рекомендации для начинающих
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Рекомендации основаны на комплексном анализе технических, фундаментальных и новостных факторов
          </Typography>
        </Box>

        {topRecommendations.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Актив</TableCell>
                  <TableCell>Рекомендация</TableCell>
                  <TableCell align="right">Уверенность</TableCell>
                  <TableCell>Риск</TableCell>
                  <TableCell align="right">Цена входа</TableCell>
                  <TableCell align="right">Стоп-лосс</TableCell>
                  <TableCell align="right">Тейк-профит</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topRecommendations.map((rec) => (
                  <TableRow 
                    key={rec.symbol}
                    sx={{ 
                      '&:last-child td, &:last-child th': { border: 0 },
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' }
                    }}
                    onClick={() => handleSymbolSelect(rec.symbol)}
                  >
                    <TableCell component="th" scope="row">
                      <Typography variant="subtitle1" fontWeight="bold">
                        {rec.symbol}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getRecommendationText(rec.recommendation)}
                        color={getRecommendationColor(rec.recommendation)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                        <LinearProgress 
                          variant="determinate" 
                          value={rec.confidence} 
                          sx={{ width: 60 }}
                          color={rec.confidence >= 70 ? 'success' : rec.confidence >= 50 ? 'warning' : 'error'}
                        />
                        <Typography variant="body2" fontWeight="bold">
                          {Math.round(rec.confidence)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getRiskText(rec.riskLevel)}
                        color={getRiskColor(rec.riskLevel)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        {rec.priceTarget}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main">
                        {rec.stopLoss}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main">
                        {rec.takeProfit}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <IconButton size="small" onClick={() => handleSymbolSelect(rec.symbol)}>
                          <Analytics fontSize="small" />
                        </IconButton>
                        <IconButton size="small">
                          <Download fontSize="small" />
                        </IconButton>
                        <IconButton size="small">
                          <Share fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box textAlign="center" py={6}>
            <Analytics sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Анализ в процессе
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Система анализирует рыночные данные для формирования рекомендаций
            </Typography>
          </Box>
        )}

        {/* Статистика рынка */}
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={3} sx={{ mt: 4 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Всего рекомендаций
              </Typography>
              <Typography variant="h4" component="div">
                {topRecommendations.length}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Рекомендации ПОКУПАТЬ
              </Typography>
              <Typography variant="h4" component="div" color="success.main">
                {topRecommendations.filter(r => r.recommendation.includes('BUY')).length}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Средняя уверенность
              </Typography>
              <Typography variant="h4" component="div">
                {Math.round(topRecommendations.reduce((sum, r) => sum + r.confidence, 0) / topRecommendations.length)}%
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Панель детального отчета */}
      <TabPanel value={tabValue} index={1}>
        {selectedSymbol ? (
          <AnalyticsReport 
            symbol={selectedSymbol}
            analysis={useAppStore(appSelectors.getAnalysisBySymbol(selectedSymbol))}
            period="daily"
          />
        ) : (
          <Box textAlign="center" py={6}>
            <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Выберите актив для просмотра отчета
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Нажмите на любой актив в таблице рекомендаций для просмотра детального анализа
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => setTabValue(0)}
              startIcon={<Analytics />}
            >
              Перейти к рекомендациям
            </Button>
          </Box>
        )}
      </TabPanel>

      {/* Панель истории отчетов */}
      <TabPanel value={tabValue} index={2}>
        <Box textAlign="center" py={6}>
          <ShowChart sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            История отчетов
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Функция истории отчетов находится в разработке
          </Typography>
          <Box display="flex" gap={2} justifyContent="center">
            <Button variant="outlined" startIcon={<Download />}>
              Экспорт данных
            </Button>
            <Button variant="outlined" startIcon={<Print />}>
              Печать отчетов
            </Button>
          </Box>
        </Box>
      </TabPanel>
    </Box>
  );
};

export default AnalyticsReports;
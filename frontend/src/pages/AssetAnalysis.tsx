import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Equalizer,
  Security,
  Analytics,
  ShowChart,
  Assessment,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { useAppStore, appSelectors } from '../stores/appStore';
import TradingViewChart from '../components/TradingViewChart';

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
      id={`asset-analysis-tabpanel-${index}`}
      aria-labelledby={`asset-analysis-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const AssetAnalysis: React.FC = () => {
  const { symbol = '' } = useParams<{ symbol?: string }>();
  const {
    loading,
    error,
    analyses,
    fetchAssetAnalysis
  } = useAppStore();

  const analysis = useAppStore(appSelectors.getAnalysisBySymbol(symbol));
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (symbol && !analysis) {
      fetchAssetAnalysis(symbol);
    }
  }, [symbol, analysis, fetchAssetAnalysis]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
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

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY':
      case 'STRONG_BUY':
        return <TrendingUp />;
      case 'SELL':
      case 'STRONG_SELL':
        return <TrendingDown />;
      default:
        return <Equalizer />;
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

  if (loading && !analysis) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Анализ {symbol}
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error && !analysis) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Анализ {symbol}
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!analysis) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Анализ {symbol}
        </Typography>
        <Alert severity="info">
          Выберите актив для анализа
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
        Анализ {symbol}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Основная рекомендация */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3} alignItems="center">
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Typography variant="h5" component="div">
                  {symbol}
                </Typography>
                <Chip
                  icon={getRecommendationIcon(analysis.recommendation)}
                  label={getRecommendationText(analysis.recommendation)}
                  color={getRecommendationColor(analysis.recommendation)}
                  size="medium"
                />
              </Box>
              
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Уверенность анализа
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <LinearProgress 
                    variant="determinate" 
                    value={analysis.confidence} 
                    sx={{ flexGrow: 1 }}
                    color={analysis.confidence >= 70 ? 'success' : analysis.confidence >= 50 ? 'warning' : 'error'}
                  />
                  <Typography variant="body2" fontWeight="bold">
                    {Math.round(analysis.confidence)}%
                  </Typography>
                </Box>
              </Box>

              <Box display="flex" gap={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Риск
                  </Typography>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <Security sx={{ fontSize: 16, color: getRiskColor(analysis.riskLevel) }} />
                    <Typography variant="body2">
                      {getRiskText(analysis.riskLevel)}
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Оценка риска
                  </Typography>
                  <Typography variant="body2">
                    {analysis.riskLevel === 'LOW' ? '2/10' : analysis.riskLevel === 'MEDIUM' ? '5/10' : analysis.riskLevel === 'HIGH' ? '7/10' : '9/10'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box flex={1}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Ценовые цели
                </Typography>
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={1} mb={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Стоп-лосс
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="error.main">
                      {analysis.stopLoss}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Тейк-профит
                    </Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      {analysis.takeProfit}
                    </Typography>
                  </Box>
                </Box>
                <Box display="grid" gridTemplateColumns="1fr" gap={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Целевая цена
                    </Typography>
                    <Typography variant="body2">
                      {analysis.priceTarget}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="body1">
            {analysis.reasoning || 'Комплексный анализ технических и фундаментальных факторов'}
          </Typography>
        </CardContent>
      </Card>

      {/* Вкладки анализа */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="График" icon={<ShowChart />} iconPosition="start" />
          <Tab label="Технический анализ" icon={<Analytics />} iconPosition="start" />
          <Tab label="Фундаментальный анализ" icon={<Assessment />} iconPosition="start" />
          <Tab label="Риск-анализ" icon={<Security />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* Панель графика */}
      <TabPanel value={tabValue} index={0}>
        <TradingViewChart 
          symbol={symbol} 
          height={500}
        />
      </TabPanel>

      {/* Панель технического анализа */}
      <TabPanel value={tabValue} index={1}>
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Технические оценки
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Analytics color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Техническая оценка" 
                    secondary={`${analysis.technicalScore}/100`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Analytics color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Фундаментальная оценка" 
                    secondary={`${analysis.fundamentalScore.toFixed(1)}/100`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Analytics color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Сентимент оценка" 
                    secondary={`${analysis.sentimentScore.toFixed(1)}/100`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Общая оценка
              </Typography>
              <Box textAlign="center" py={4}>
                <Typography variant="h3" color="primary.main" gutterBottom>
                  {Math.round(analysis.confidence)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Общая уверенность анализа
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Панель фундаментального анализа */}
      <TabPanel value={tabValue} index={2}>
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Фундаментальные показатели
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Фундаментальная оценка" 
                    secondary={`${analysis.fundamentalScore.toFixed(1)}/100`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Техническая оценка" 
                    secondary={`${analysis.technicalScore}/100`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Сентимент оценка" 
                    secondary={`${analysis.sentimentScore.toFixed(1)}/100`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Общая оценка
              </Typography>
              <Box textAlign="center" py={4}>
                <Typography variant="h3" color="primary.main" gutterBottom>
                  {analysis.fundamentalScore.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Общая оценка фундаментальных показателей
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>

      {/* Панель риск-анализа */}
      <TabPanel value={tabValue} index={3}>
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Факторы риска
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <Warning color="warning" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Уровень риска"
                    secondary={`${getRiskText(analysis.riskLevel)}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Warning color="warning" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Волатильность"
                    secondary="Средняя"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Warning color="warning" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Рыночные условия"
                    secondary="Стабильные"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Рекомендации по управлению рисками
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Максимальный размер позиции"
                    secondary={`2% от депозита`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Стоп-лосс"
                    secondary={`Установите на уровне ${analysis.stopLoss}`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Диверсификация"
                    secondary="Включайте в портфель 5-7 различных активов"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>
      </TabPanel>
    </Box>
  );
};

export default AssetAnalysis;
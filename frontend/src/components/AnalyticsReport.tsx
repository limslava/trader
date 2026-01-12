import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Equalizer,
  Security,
} from '@mui/icons-material';

interface AnalyticsReportProps {
  symbol: string;
  analysis: any;
  period?: 'daily' | 'weekly' | 'monthly';
}

const AnalyticsReport: React.FC<AnalyticsReportProps> = ({ 
  symbol, 
  analysis, 
  period = 'daily' 
}) => {
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

  if (!analysis) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Аналитический отчет для {symbol}
          </Typography>
          <Alert severity="info">
            Данные для анализа загружаются...
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        📊 Аналитический отчет: {symbol}
      </Typography>

      {/* Основные метрики */}
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={3} mb={4}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Рекомендация
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              {getRecommendationIcon(analysis.recommendation)}
              <Chip
                label={getRecommendationText(analysis.recommendation)}
                color={getRecommendationColor(analysis.recommendation)}
                size="small"
              />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
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
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Уровень риска
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Security sx={{ color: getRiskColor(analysis.riskAssessment.level) }} />
              <Typography variant="body1" fontWeight="bold">
                {getRiskText(analysis.riskAssessment.level)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Детальный анализ */}
      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '2fr 1fr' }} gap={4}>
        {/* Технический и фундаментальный анализ */}
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Технический анализ
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Индикатор</TableCell>
                      <TableCell align="right">Значение</TableCell>
                      <TableCell align="right">Сигнал</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>RSI</TableCell>
                      <TableCell align="right">
                        {analysis.factors.technical.indicators.rsi.value.toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={analysis.factors.technical.indicators.rsi.signal} 
                          size="small"
                          color={
                            analysis.factors.technical.indicators.rsi.signal === 'OVERSOLD' ? 'success' :
                            analysis.factors.technical.indicators.rsi.signal === 'OVERBOUGHT' ? 'error' : 'default'
                          }
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>MACD</TableCell>
                      <TableCell align="right">
                        {analysis.factors.technical.indicators.macd.value.toFixed(4)}
                      </TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={analysis.factors.technical.indicators.macd.signal > 0 ? 'BULLISH' : 'BEARISH'} 
                          size="small"
                          color={analysis.factors.technical.indicators.macd.signal > 0 ? 'success' : 'error'}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Тренд</TableCell>
                      <TableCell align="right">-</TableCell>
                      <TableCell align="right">
                        <Chip 
                          label={analysis.factors.technical.trend} 
                          size="small"
                          color={
                            analysis.factors.technical.trend === 'UP' ? 'success' :
                            analysis.factors.technical.trend === 'DOWN' ? 'error' : 'default'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Фундаментальный анализ
              </Typography>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Общая оценка
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    {analysis.factors.fundamental.score.toFixed(0)}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    P/E Ratio
                  </Typography>
                  <Typography variant="h6">
                    {analysis.factors.fundamental.metrics.peRatio?.value?.toFixed(2) || 'Н/Д'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Ценовые цели и риски */}
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ценовые цели
              </Typography>
              <Box display="grid" gap={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Стоп-лосс
                  </Typography>
                  <Typography variant="body1" fontWeight="bold" color="error.main">
                    {analysis.priceTargets.stopLoss}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Тейк-профит
                  </Typography>
                  <Typography variant="body1" fontWeight="bold" color="success.main">
                    {analysis.priceTargets.takeProfit}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Целевая цена
                  </Typography>
                  <Typography variant="body1">
                    {analysis.priceTargets.targetPrice}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Управление рисками
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                <li>
                  <Typography variant="body2">
                    Максимальный размер позиции: 2% от депозита
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Стоп-лосс обязателен
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Диверсификация: 5-7 активов
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Соотношение риск/прибыль: 1:2
                  </Typography>
                </li>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Заключение */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📝 Заключение анализа
          </Typography>
          <Typography variant="body1" paragraph>
            На основе комплексного анализа технических и фундаментальных факторов, актив {symbol} 
            демонстрирует {analysis.confidence >= 70 ? 'высокий' : analysis.confidence >= 50 ? 'умеренный' : 'низкий'} 
            потенциал для {getRecommendationText(analysis.recommendation).toLowerCase()}.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Отчет сгенерирован: {new Date().toLocaleString('ru-RU')} | Период: {
              period === 'daily' ? 'дневной' : 
              period === 'weekly' ? 'недельный' : 
              'месячный'
            }
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AnalyticsReport;
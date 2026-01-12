import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress
} from '@mui/material';
import { TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import LoadingSpinner from '../components/LoadingSpinner';
import AnimatedCard from '../components/AnimatedCard';

interface MLPrediction {
  symbol: string;
  prediction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  predictedPrice: number;
  predictedChange: number;
  timeframe: string;
  reasoning: string;
  patterns: Array<{
    name: string;
    direction: 'bullish' | 'bearish' | 'neutral';
    strength: number;
    timeframe: string;
    probability: number;
  }>;
  sentiment: {
    score: number;
    label: 'bullish' | 'bearish' | 'neutral';
    sources: string[];
  };
}

const MLAnalytics: React.FC = () => {
  const [predictions, setPredictions] = useState<MLPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState('SBER');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1d');

  const symbols = ['SBER', 'GAZP', 'LKOH', 'VTBR', 'ROSN', 'BTCUSDT', 'ETHUSDT'];
  const timeframes = ['1h', '4h', '1d', '1w'];

  const fetchPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      // Используем относительный путь через прокси
      const response = await fetch(`/api/ml/prediction/${selectedSymbol}?timeframe=${selectedTimeframe}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.data) {
        setPredictions(prev => [data.data, ...prev.slice(0, 4)]);
      } else {
        throw new Error(data.error || 'Неизвестная ошибка сервера');
      }
    } catch (error) {
      console.error('Ошибка получения ML прогноза:', error);
      setError(`Ошибка получения прогноза: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      
      // Пробуем альтернативный маршрут с реальным ML
      try {
        const fallbackResponse = await fetch(`/api/ml/real-prediction/${selectedSymbol}?timeframe=${selectedTimeframe}`);
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.success && fallbackData.data) {
            setPredictions(prev => [fallbackData.data, ...prev.slice(0, 4)]);
            setError(null); // Очищаем ошибку если альтернативный маршрут сработал
          }
        }
      } catch (fallbackError) {
        console.error('Ошибка получения реального ML прогноза:', fallbackError);
        // Не показываем демо-данные - только реальные инструменты
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction();
    const interval = setInterval(fetchPrediction, 60000); // Обновление каждую минуту
    return () => clearInterval(interval);
  }, [selectedSymbol, selectedTimeframe]);

  const getPredictionColor = (prediction: string) => {
    switch (prediction) {
      case 'BUY': return 'success';
      case 'SELL': return 'error';
      case 'HOLD': return 'warning';
      default: return 'default';
    }
  };

  const getPredictionIcon = (prediction: string) => {
    switch (prediction) {
      case 'BUY': return <TrendingUp />;
      case 'SELL': return <TrendingDown />;
      case 'HOLD': return <TrendingFlat />;
      default: return undefined;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'success';
      case 'bearish': return 'error';
      case 'neutral': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
        🤖 ML Аналитика
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Система машинного обучения анализирует технические паттерны, фундаментальные показатели и рыночный сентимент для генерации прогнозов.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <br />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Убедитесь, что backend сервер запущен на порту 3001 и перезагрузите страницу.
          </Typography>
        </Alert>
      )}

      {/* Controls */}
      <AnimatedCard animation="slide" delay={0} direction="down">
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Актив</InputLabel>
            <Select
              value={selectedSymbol}
              label="Актив"
              onChange={(e) => setSelectedSymbol(e.target.value)}
            >
              {symbols.map(symbol => (
                <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel>Таймфрейм</InputLabel>
            <Select
              value={selectedTimeframe}
              label="Таймфрейм"
              onChange={(e) => setSelectedTimeframe(e.target.value)}
            >
              {timeframes.map(tf => (
                <MenuItem key={tf} value={tf}>{tf}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Typography variant="body2" color="text.secondary" sx={{ ml: { md: 'auto' } }}>
            Последнее обновление: {new Date().toLocaleTimeString('ru-RU')}
          </Typography>
        </Box>
      </AnimatedCard>

      {/* Current Prediction */}
      {predictions.length > 0 && (
        <AnimatedCard animation="grow" delay={100}>
          <Typography variant="h6" gutterBottom>
            Текущий прогноз: {selectedSymbol}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Chip
                  icon={getPredictionIcon(predictions[0].prediction)}
                  label={predictions[0].prediction}
                  color={getPredictionColor(predictions[0].prediction) as any}
                  size="medium"
                  sx={{ mr: 2 }}
                />
                <Typography variant="h6">
                  Уверенность: {predictions[0].confidence}%
                </Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Прогнозируемая цена: {predictions[0].predictedPrice.toFixed(2)}
                </Typography>
                <Typography
                  variant="body2"
                  color={predictions[0].predictedChange >= 0 ? 'success.main' : 'error.main'}
                >
                  Изменение: {predictions[0].predictedChange > 0 ? '+' : ''}{predictions[0].predictedChange.toFixed(2)}%
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Сентимент:
                </Typography>
                {predictions[0].sentiment && (
                  <>
                    <Chip
                      label={predictions[0].sentiment.label}
                      color={getSentimentColor(predictions[0].sentiment.label) as any}
                      size="small"
                    />
                    <LinearProgress
                      variant="determinate"
                      value={predictions[0].sentiment.score * 100}
                      sx={{ mt: 1 }}
                    />
                  </>
                )}
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" gutterBottom>
                Обоснование:
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                <Typography variant="body2">
                  {predictions[0].reasoning}
                </Typography>
              </Paper>
            </Box>
          </Box>
        </AnimatedCard>
      )}

      {/* Patterns Table */}
      {predictions.length > 0 && predictions[0].patterns && predictions[0].patterns.length > 0 && (
        <AnimatedCard animation="slide" delay={200} direction="up">
          <Typography variant="h6" gutterBottom>
            Технические паттерны
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Паттерн</TableCell>
                  <TableCell>Направление</TableCell>
                  <TableCell>Сила</TableCell>
                  <TableCell>Таймфрейм</TableCell>
                  <TableCell>Вероятность</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {predictions[0].patterns.map((pattern, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }}
                  >
                    <TableCell>{pattern.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={pattern.direction}
                        color={getSentimentColor(pattern.direction) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <LinearProgress
                        variant="determinate"
                        value={pattern.strength * 100}
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                    <TableCell>{pattern.timeframe}</TableCell>
                    <TableCell>{(pattern.probability * 100).toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AnimatedCard>
      )}

      {/* Loading State */}
      {loading && (
        <LoadingSpinner message="ML модель анализирует данные..." />
      )}
    </Box>
  );
};

export default MLAnalytics;
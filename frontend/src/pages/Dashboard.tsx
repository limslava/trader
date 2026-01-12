import React, { useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Alert,
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Equalizer,
  AccountBalance,
  Warning,
  Info,
  Security,
  Diversity3,
} from '@mui/icons-material'
import { useAppStore, appSelectors } from '../stores/appStore'
import LoadingSpinner from '../components/LoadingSpinner'
import AnimatedCard from '../components/AnimatedCard'

const Dashboard: React.FC = () => {
  const { 
    loading,
    error,
    selectedPortfolio,
    // @ts-ignore
    beginnerRecommendations,
    fetchBeginnerRecommendations,
    fetchPortfolios
  } = useAppStore()

  const assetsWithPrices = useAppStore(appSelectors.getAssetsWithPrices)
  const topRecommendations = useAppStore(appSelectors.getTopRecommendations(3))
  // @ts-ignore
  const websocketConnected = useAppStore(state => state.websocketConnected)
  // @ts-ignore
  const lastPriceUpdate = useAppStore(state => state.lastPriceUpdate)

  useEffect(() => {
    fetchBeginnerRecommendations()
    fetchPortfolios()
  }, [fetchBeginnerRecommendations, fetchPortfolios])

  // Расчет статистики портфеля
  const portfolioStats = {
    totalValue: selectedPortfolio?.currentValue || 105000,
    dailyReturn: selectedPortfolio?.performance?.dailyReturn || 150,
    dailyReturnPercent: selectedPortfolio?.performance?.dailyReturnPercent || 0.14,
    riskLevel: selectedPortfolio?.riskProfile?.level || 'MEDIUM',
    diversification: selectedPortfolio?.positions?.length || 2,
    maxRiskPerTrade: 1.8
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'success'
      case 'MEDIUM': return 'warning'
      case 'HIGH': return 'error'
      case 'VERY_HIGH': return 'error'
      default: return 'default'
    }
  }

  const getRiskText = (level: string) => {
    switch (level) {
      case 'LOW': return 'Низкий'
      case 'MEDIUM': return 'Средний'
      case 'HIGH': return 'Высокий'
      case 'VERY_HIGH': return 'Очень высокий'
      default: return 'Неизвестно'
    }
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY':
      case 'STRONG_BUY':
        return 'success'
      case 'SELL':
      case 'STRONG_SELL':
        return 'error'
      default:
        return 'warning'
    }
  }

  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY': return 'ПОКУПАТЬ'
      case 'STRONG_BUY': return 'СИЛЬНО ПОКУПАТЬ'
      case 'SELL': return 'ПРОДАВАТЬ'
      case 'STRONG_SELL': return 'СИЛЬНО ПРОДАВАТЬ'
      case 'HOLD': return 'ДЕРЖАТЬ'
      default: return recommendation
    }
  }

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY':
      case 'STRONG_BUY':
        return <TrendingUp />
      case 'SELL':
      case 'STRONG_SELL':
        return <TrendingDown />
      default:
        return <Equalizer />
    }
  }

  const riskAlerts = [
    { type: 'info' as const, message: 'Рекомендуется увеличить диверсификацию портфеля' },
    { type: 'warning' as const, message: 'Следите за волатильностью на рынке криптовалют' },
  ]

  if (loading && !selectedPortfolio) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Дашборд трейдера
        </Typography>
        <LoadingSpinner message="Загрузка данных портфеля..." />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
        Дашборд трейдера
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Статистика портфеля */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div>
          <AnimatedCard animation="grow" delay={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AccountBalance color="primary" sx={{ mr: 1 }} />
              <Typography color="textSecondary" gutterBottom>
                Общий портфель
              </Typography>
            </Box>
            <Typography variant="h4" component="div">
              {portfolioStats.totalValue.toLocaleString('ru-RU')} ₽
            </Typography>
            <Box display="flex" alignItems="center" mt={1}>
              {portfolioStats.dailyReturn >= 0 ? (
                <TrendingUp color="success" />
              ) : (
                <TrendingDown color="error" />
              )}
              <Typography
                variant="body2"
                color={portfolioStats.dailyReturn >= 0 ? 'success.main' : 'error.main'}
                ml={1}
              >
                {portfolioStats.dailyReturn >= 0 ? '+' : ''}{portfolioStats.dailyReturnPercent}% за сегодня
              </Typography>
            </Box>
          </AnimatedCard>
        </div>

        <div>
          <AnimatedCard animation="grow" delay={100}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Security sx={{ mr: 1, color: getRiskColor(portfolioStats.riskLevel) === 'success' ? 'success.main' : getRiskColor(portfolioStats.riskLevel) === 'warning' ? 'warning.main' : 'error.main' }} />
              <Typography color="textSecondary" gutterBottom>
                Уровень риска
              </Typography>
            </Box>
            <Chip
              label={getRiskText(portfolioStats.riskLevel)}
              color={getRiskColor(portfolioStats.riskLevel)}
              variant="outlined"
            />
          </AnimatedCard>
        </div>

        <div>
          <AnimatedCard animation="grow" delay={200}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Diversity3 sx={{ mr: 1, color: portfolioStats.diversification >= 5 ? 'success.main' : 'warning.main' }} />
              <Typography color="textSecondary" gutterBottom>
                Диверсификация
              </Typography>
            </Box>
            <Typography
              variant="h4"
              component="div"
              color={portfolioStats.diversification >= 5 ? 'success.main' : 'warning.main'}
            >
              {portfolioStats.diversification}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              активов (рекомендуется 5-10)
            </Typography>
          </AnimatedCard>
        </div>

        <div>
          <AnimatedCard animation="grow" delay={300}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Warning sx={{ mr: 1, color: portfolioStats.maxRiskPerTrade <= 2 ? 'success.main' : 'error.main' }} />
              <Typography color="textSecondary" gutterBottom>
                Макс. риск на сделку
              </Typography>
            </Box>
            <Typography
              variant="h4"
              component="div"
              color={portfolioStats.maxRiskPerTrade <= 2 ? 'success.main' : 'error.main'}
            >
              {portfolioStats.maxRiskPerTrade}%
            </Typography>
            <Typography variant="body2" color="textSecondary">
              лимит: 2%
            </Typography>
          </AnimatedCard>
        </div>
      </div>

      {/* Топ рекомендации */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div>
          <AnimatedCard animation="slide" delay={400} direction="right">
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              Топ рекомендации
            </Typography>
            {topRecommendations.length > 0 ? (
              topRecommendations.map((rec, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {rec.symbol}
                    </Typography>
                    <Chip
                      icon={getRecommendationIcon(rec.recommendation)}
                      label={getRecommendationText(rec.recommendation)}
                      color={getRecommendationColor(rec.recommendation)}
                      size="small"
                    />
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      Уверенность: {Math.round(rec.confidence)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Риск: {getRiskText(rec.riskLevel)}
                    </Typography>
                  </Box>
                </Box>
              ))
            ) : (
              <Box textAlign="center" py={3}>
                <Info color="disabled" sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  Загрузка рекомендаций...
                </Typography>
              </Box>
            )}
          </AnimatedCard>
        </div>

        {/* Быстрый обзор рынка */}
        <div>
          <AnimatedCard animation="slide" delay={500} direction="left">
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              Быстрый обзор рынка
            </Typography>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
              {assetsWithPrices.slice(0, 6).map((asset, index) => (
                <div key={asset.symbol}>
                  <Box
                    p={1.5}
                    border={1}
                    borderColor="divider"
                    borderRadius={1}
                    textAlign="center"
                    sx={{
                      backgroundColor: 'background.default',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                      }
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold" noWrap>
                      {asset.symbol}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {asset.name}
                    </Typography>
                    {asset.currentPrice && (
                      <>
                        <Typography variant="body2" fontWeight="bold" noWrap>
                          {asset.currentPrice.toLocaleString('ru-RU')} {asset.currency}
                        </Typography>
                        <Typography
                          variant="caption"
                          color={asset.changePercent && asset.changePercent >= 0 ? 'success.main' : 'error.main'}
                          noWrap
                        >
                          {asset.changePercent && asset.changePercent >= 0 ? '+' : ''}{asset.changePercent?.toFixed(2)}%
                        </Typography>
                      </>
                    )}
                  </Box>
                </div>
              ))}
            </div>
          </AnimatedCard>
        </div>
      </div>

      {/* Предупреждения о рисках */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <div>
          <Typography variant="h6" gutterBottom>
            Предупреждения о рисках
          </Typography>
          {riskAlerts.map((alert, index) => (
            <Alert 
              key={index}
              severity={alert.type}
              sx={{ mb: 1 }}
            >
              {alert.message}
            </Alert>
          ))}
        </div>
      </div>
    </Box>
  )
}

export default Dashboard
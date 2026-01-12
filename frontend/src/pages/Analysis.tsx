import React, { useEffect, useState } from 'react'
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
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Equalizer,
  Security,
  Analytics,
} from '@mui/icons-material'
import { useAppStore, appSelectors } from '../stores/appStore'
import LoadingSpinner from '../components/LoadingSpinner'
import AnimatedCard from '../components/AnimatedCard'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analysis-tabpanel-${index}`}
      aria-labelledby={`analysis-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

const Analysis: React.FC = () => {
  const { 
    loading,
    error,
    beginnerRecommendations,
    fetchBeginnerRecommendations
  } = useAppStore()

  const topRecommendations = useAppStore(appSelectors.getTopRecommendations(10))
  const [tabValue, setTabValue] = useState(0)

  useEffect(() => {
    fetchBeginnerRecommendations()
  }, [fetchBeginnerRecommendations])

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
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

  if (loading && beginnerRecommendations.length === 0) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Анализ рынка
        </Typography>
        <LoadingSpinner message="Анализируем рыночные данные..." />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
        Анализ рынка
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Вкладки анализа */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Рекомендации" />
          <Tab label="Технический анализ" />
          <Tab label="Фундаментальный анализ" />
          <Tab label="Риск-анализ" />
        </Tabs>
      </Box>

      {/* Панель рекомендаций */}
      <TabPanel value={tabValue} index={0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Typography variant="h6" gutterBottom>
              Топ рекомендации для начинающих
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Рекомендации основаны на комплексном анализе технических, фундаментальных и новостных факторов
            </Typography>
          </div>

          {topRecommendations.length > 0 ? (
            topRecommendations.map((rec, _index) => (
              <div key={rec.symbol}>
                <AnimatedCard animation="grow" delay={_index * 100}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" component="div">
                      {rec.symbol}
                    </Typography>
                    <Chip
                      icon={getRecommendationIcon(rec.recommendation)}
                      label={getRecommendationText(rec.recommendation)}
                      color={getRecommendationColor(rec.recommendation)}
                    />
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Уверенность анализа
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LinearProgress
                        variant="determinate"
                        value={rec.confidence}
                        sx={{ flexGrow: 1 }}
                        color={rec.confidence >= 70 ? 'success' : rec.confidence >= 50 ? 'warning' : 'error'}
                      />
                      <Typography variant="body2" fontWeight="bold">
                        {Math.round(rec.confidence)}%
                      </Typography>
                    </Box>
                  </Box>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                    <div>
                      <Typography variant="caption" color="text.secondary">
                        Риск
                      </Typography>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Security sx={{ fontSize: 16, color: getRiskColor(rec.riskLevel || 'MEDIUM') }} />
                        <Typography variant="body2">
                          {getRiskText(rec.riskLevel || 'MEDIUM')}
                        </Typography>
                      </Box>
                    </div>
                    <div>
                      <Typography variant="caption" color="text.secondary">
                        Оценка риска
                      </Typography>
                      <Typography variant="body2">
                        {rec.riskLevel === 'LOW' ? '2/10' : rec.riskLevel === 'MEDIUM' ? '5/10' : rec.riskLevel === 'HIGH' ? '7/10' : '9/10'}
                      </Typography>
                    </div>
                  </div>

                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Обоснование
                    </Typography>
                    <Typography variant="body2">
                      {rec.reasoning || 'Комплексный анализ технических и фундаментальных факторов'}
                    </Typography>
                  </Box>

                  <Box mt={2} p={1} sx={{ backgroundColor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Рекомендации по управлению рисками
                    </Typography>
                    <Typography variant="body2">
                      Установите стоп-лосс на уровне 2% от стоимости позиции
                    </Typography>
                  </Box>
                </AnimatedCard>
              </div>
            ))
          ) : (
            <div style={{ gridColumn: '1 / -1' }}>
              <Box textAlign="center" py={6}>
                <Analytics sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Анализ в процессе
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Система анализирует рыночные данные для формирования рекомендаций
                </Typography>
              </Box>
            </div>
          )}
        </div>
      </TabPanel>

      {/* Панель технического анализа */}
      <TabPanel value={tabValue} index={1}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Typography variant="h6" gutterBottom>
              Технический анализ
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Анализ графиков и технических индикаторов для определения точек входа и выхода
            </Typography>
          </div>

          <div>
            <AnimatedCard animation="slide" delay={0} direction="right">
              <Typography variant="h6" gutterBottom>
                📊 Основные индикаторы
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                <li><Typography variant="body2">RSI (Relative Strength Index)</Typography></li>
                <li><Typography variant="body2">MACD (Moving Average Convergence Divergence)</Typography></li>
                <li><Typography variant="body2">Скользящие средние (MA)</Typography></li>
                <li><Typography variant="body2">Уровни поддержки/сопротивления</Typography></li>
                <li><Typography variant="body2">Объемы торгов</Typography></li>
              </Box>
            </AnimatedCard>
          </div>

          <div>
            <AnimatedCard animation="slide" delay={100} direction="left">
              <Typography variant="h6" gutterBottom>
                🎯 Стратегии для новичков
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                <li><Typography variant="body2">Тренд - ваш друг (торгуйте по тренду)</Typography></li>
                <li><Typography variant="body2">Используйте подтверждение объема</Typography></li>
                <li><Typography variant="body2">Следите за ключевыми уровнями</Typography></li>
                <li><Typography variant="body2">Избегайте торговли против тренда</Typography></li>
              </Box>
            </AnimatedCard>
          </div>
        </div>
      </TabPanel>

      {/* Панель фундаментального анализа */}
      <TabPanel value={tabValue} index={2}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Typography variant="h6" gutterBottom>
              Фундаментальный анализ
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Оценка финансового состояния компаний и макроэкономических факторов
            </Typography>
          </div>

          <div>
            <AnimatedCard animation="slide" delay={0} direction="right">
              <Typography variant="h6" gutterBottom>
                📈 Ключевые метрики
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                <li><Typography variant="body2">P/E (Price-to-Earnings) ratio</Typography></li>
                <li><Typography variant="body2">P/B (Price-to-Book) ratio</Typography></li>
                <li><Typography variant="body2">Дивидендная доходность</Typography></li>
                <li><Typography variant="body2">Рост выручки и прибыли</Typography></li>
                <li><Typography variant="body2">Долговая нагрузка</Typography></li>
              </Box>
            </AnimatedCard>
          </div>

          <div>
            <AnimatedCard animation="slide" delay={100} direction="left">
              <Typography variant="h6" gutterBottom>
                🌍 Макроэкономика РФ
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                <li><Typography variant="body2">Ключевая ставка ЦБ РФ</Typography></li>
                <li><Typography variant="body2">Инфляция и ВВП</Typography></li>
                <li><Typography variant="body2">Курс рубля</Typography></li>
                <li><Typography variant="body2">Цены на нефть и газ</Typography></li>
              </Box>
            </AnimatedCard>
          </div>
        </div>
      </TabPanel>

      {/* Панель риск-анализа */}
      <TabPanel value={tabValue} index={3}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Typography variant="h6" gutterBottom>
              Анализ рисков
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Оценка потенциальных рисков и управление капиталом
            </Typography>
          </div>

          <div>
            <AnimatedCard animation="slide" delay={0} direction="right">
              <Typography variant="h6" gutterBottom>
                🛡️ Правила риск-менеджмента
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                <li><Typography variant="body2">Максимум 2% риска на сделку</Typography></li>
                <li><Typography variant="body2">Диверсификация 5-10 активов</Typography></li>
                <li><Typography variant="body2">Обязательный стоп-лосс</Typography></li>
                <li><Typography variant="body2">Соотношение риск/прибыль 1:2</Typography></li>
                <li><Typography variant="body2">Регулярный мониторинг портфеля</Typography></li>
              </Box>
            </AnimatedCard>
          </div>

          <div>
            <AnimatedCard animation="slide" delay={100} direction="left">
              <Typography variant="h6" gutterBottom>
                ⚠️ Основные риски
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                <li><Typography variant="body2">Рыночная волатильность</Typography></li>
                <li><Typography variant="body2">Геополитические факторы</Typography></li>
                <li><Typography variant="body2">Изменение регуляторной среды</Typography></li>
                <li><Typography variant="body2">Ликвидность активов</Typography></li>
                <li><Typography variant="body2">Валютные риски</Typography></li>
              </Box>
            </AnimatedCard>
          </div>
        </div>
      </TabPanel>
    </Box>
  )
}

export default Analysis
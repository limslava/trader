import React, { useEffect, useState } from 'react'
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
  TextField,
  InputAdornment,
  LinearProgress,
  Alert,
} from '@mui/material'
import { Search, TrendingUp, TrendingDown, Equalizer } from '@mui/icons-material'
import { useAppStore, appSelectors } from '../stores/appStore'
import LoadingSpinner from '../components/LoadingSpinner'
import AnimatedCard from '../components/AnimatedCard'

const Market: React.FC = () => {
  const {
    loading,
    error,
    assets,
    fetchPopularAssets,
  } = useAppStore()

  const assetsWithPrices = useAppStore(appSelectors.getAssetsWithPrices)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredAssets, setFilteredAssets] = useState(assetsWithPrices)

  useEffect(() => {
    fetchPopularAssets()
  }, [fetchPopularAssets])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAssets(assetsWithPrices)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = assetsWithPrices.filter(asset => 
        asset.symbol.toLowerCase().includes(query) ||
        asset.name.toLowerCase().includes(query) ||
        asset.exchange.toLowerCase().includes(query)
      )
      setFilteredAssets(filtered)
    }
  }, [searchQuery, assetsWithPrices])

  const getChangeIcon = (changePercent: number | undefined) => {
    if (!changePercent) return <Equalizer color="disabled" />
    return changePercent >= 0 ? <TrendingUp color="success" /> : <TrendingDown color="error" />
  }

  const getChangeColor = (changePercent: number | undefined) => {
    if (!changePercent) return 'text.secondary'
    return changePercent >= 0 ? 'success.main' : 'error.main'
  }

  const getAssetTypeColor = (type: string) => {
    switch (type) {
      case 'STOCK': return 'primary'
      case 'CRYPTO': return 'secondary'
      case 'ETF': return 'success'
      case 'BOND': return 'warning'
      default: return 'default'
    }
  }

  const getAssetTypeText = (type: string) => {
    switch (type) {
      case 'STOCK': return 'Акция'
      case 'CRYPTO': return 'Криптовалюта'
      case 'ETF': return 'ETF'
      case 'BOND': return 'Облигация'
      default: return type
    }
  }

  if (loading && assets.length === 0) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          Рынок
        </Typography>
        <LoadingSpinner message="Загрузка рыночных данных..." />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
        Рынок
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Поиск и фильтры */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        <div>
          <TextField
            fullWidth
            placeholder="Поиск по названию или тикеру..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </div>
        <div>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              label="Все активы"
              variant={searchQuery === '' ? 'filled' : 'outlined'}
              onClick={() => setSearchQuery('')}
              clickable
            />
            <Chip
              label="Акции"
              variant="outlined"
              onClick={() => setSearchQuery('акция')}
              clickable
            />
            <Chip
              label="Криптовалюта"
              variant="outlined"
              onClick={() => setSearchQuery('крипто')}
              clickable
            />
          </Box>
        </div>
      </div>

      {/* Статистика рынка */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        <AnimatedCard animation="grow" delay={0}>
          <Typography color="textSecondary" gutterBottom>
            Всего активов
          </Typography>
          <Typography variant="h4" component="div">
            {assets.length}
          </Typography>
        </AnimatedCard>
        <AnimatedCard animation="grow" delay={100}>
          <Typography color="textSecondary" gutterBottom>
            В росте
          </Typography>
          <Typography variant="h4" component="div" color="success.main">
            {assetsWithPrices.filter(a => a.changePercent && a.changePercent > 0).length}
          </Typography>
        </AnimatedCard>
        <AnimatedCard animation="grow" delay={200}>
          <Typography color="textSecondary" gutterBottom>
            В падении
          </Typography>
          <Typography variant="h4" component="div" color="error.main">
            {assetsWithPrices.filter(a => a.changePercent && a.changePercent < 0).length}
          </Typography>
        </AnimatedCard>
        <AnimatedCard animation="grow" delay={300}>
          <Typography color="textSecondary" gutterBottom>
            Без изменений
          </Typography>
          <Typography variant="h4" component="div" color="text.secondary">
            {assetsWithPrices.filter(a => !a.changePercent || a.changePercent === 0).length}
          </Typography>
        </AnimatedCard>
      </div>

      {/* Таблица активов */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Актив</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell>Биржа</TableCell>
              <TableCell align="right">Цена</TableCell>
              <TableCell align="right">Изменение</TableCell>
              <TableCell align="right">Объем</TableCell>
              <TableCell>Статус</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAssets.length > 0 ? (
              filteredAssets.map((asset) => (
                <TableRow 
                  key={asset.symbol} 
                  sx={{ 
                    '&:last-child td, &:last-child th': { border: 0 },
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' }
                  }}
                >
                  <TableCell component="th" scope="row">
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {asset.symbol}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {asset.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={getAssetTypeText(asset.type)} 
                      color={getAssetTypeColor(asset.type) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {asset.exchange}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {asset.currentPrice ? (
                      <Typography variant="body1" fontWeight="bold">
                        {asset.currentPrice.toLocaleString('ru-RU')} {asset.currency}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Нет данных
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                      {getChangeIcon(asset.changePercent)}
                      {asset.changePercent !== undefined ? (
                        <Typography 
                          variant="body1" 
                          color={getChangeColor(asset.changePercent)}
                          fontWeight="bold"
                        >
                          {asset.changePercent >= 0 ? '+' : ''}{asset.changePercent.toFixed(2)}%
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      -
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label="АНАЛИЗ"
                      color="info"
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    {searchQuery ? 'Активы не найдены' : 'Загрузка данных...'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Подсказки для новичка */}
      <Box mt={4}>
        <Typography variant="h6" gutterBottom>
          Советы для начинающих трейдеров
        </Typography>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px'
        }}>
         <AnimatedCard animation="slide" delay={0} direction="up">
           <Typography variant="subtitle1" gutterBottom>
             📊 Анализируйте объемы
           </Typography>
           <Typography variant="body2" color="text.secondary">
             Высокие объемы торгов подтверждают тренд. Низкие объемы могут сигнализировать о развороте.
           </Typography>
         </AnimatedCard>
          <AnimatedCard animation="slide" delay={100} direction="up">
            <Typography variant="subtitle1" gutterBottom>
              ⚖️ Диверсифицируйте
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Распределяйте капитал между разными типами активов (акции, крипта, облигации).
            </Typography>
          </AnimatedCard>
          <AnimatedCard animation="slide" delay={200} direction="up">
            <Typography variant="subtitle1" gutterBottom>
              🛡️ Используйте стоп-лосс
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Всегда устанавливайте стоп-лосс для ограничения потенциальных убытков.
            </Typography>
          </AnimatedCard>
        </div>
      </Box>
    </Box>
  )
}

export default Market
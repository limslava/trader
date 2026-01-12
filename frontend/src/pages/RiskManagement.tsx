import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
import { useRiskStore, getRiskLevelColor, getRiskLevelText, getSeverityColor, getPriorityColor } from '../stores/riskStore';

const RiskManagement: React.FC = () => {
  const {
    riskAssessment,
    riskStatistics,
    stopLossRecommendations,
    maxPositionSize,
    loading,
    error,
    loadRiskAssessment,
    loadRiskStatistics,
    loadStopLossRecommendations,
    loadMaxPositionSize,
    checkTradeRisk,
    clearError,
  } = useRiskStore();

  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [tradeData, setTradeData] = useState({
    assetSymbol: '',
    assetType: 'stock' as 'stock' | 'crypto' | 'currency',
    quantity: 0,
    price: 0,
    transactionType: 'buy' as 'buy' | 'sell',
  });

  useEffect(() => {
    loadRiskAssessment();
    loadRiskStatistics();
    loadStopLossRecommendations();
    loadMaxPositionSize();
  }, []);

  const handleTradeRiskCheck = async () => {
    await checkTradeRisk(tradeData);
    setTradeDialogOpen(false);
  };

  const handleRiskToleranceChange = (tolerance: 'low' | 'medium' | 'high') => {
    loadMaxPositionSize(tolerance);
  };

  if (loading && !riskAssessment) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          <SecurityIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Управление рисками
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Анализ рисков портфеля и рекомендации по управлению
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Общая статистика рисков */}
      {riskStatistics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Общий уровень риска
              </Typography>
              <Chip
                label={getRiskLevelText(riskStatistics.riskLevel)}
                sx={{
                  backgroundColor: getRiskLevelColor(riskStatistics.riskLevel),
                  color: 'white',
                  fontSize: '1rem',
                  padding: '8px 16px',
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Скор риска: {riskStatistics.riskScore}/100
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Диверсификация
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={riskStatistics.diversificationScore}
                  sx={{ flexGrow: 1, mr: 1 }}
                />
                <Typography variant="body2">
                  {riskStatistics.diversificationScore}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {riskStatistics.diversificationScore >= 70 ? 'Отлично' :
                 riskStatistics.diversificationScore >= 50 ? 'Хорошо' : 'Нужно улучшить'}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Концентрация
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={riskStatistics.concentrationRisk}
                  sx={{ flexGrow: 1, mr: 1 }}
                />
                <Typography variant="body2">
                  {riskStatistics.concentrationRisk}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {riskStatistics.concentrationRisk <= 30 ? 'Низкая' :
                 riskStatistics.concentrationRisk <= 50 ? 'Средняя' : 'Высокая'}
              </Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Предупреждения
              </Typography>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color={riskStatistics.criticalWarningsCount > 0 ? 'error' : 'success'}>
                  {riskStatistics.warningsCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {riskStatistics.criticalWarningsCount} критических
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px'
      }}>
        {/* Рекомендации и предупреждения */}
        <div>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Рекомендации по управлению рисками
              </Typography>
              {riskAssessment?.recommendations.length === 0 ? (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  Все рекомендации выполнены! Ваш портфель хорошо сбалансирован.
                </Alert>
              ) : (
                <List>
                  {riskAssessment?.recommendations.map((rec, index) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemIcon>
                          <InfoIcon sx={{ color: getPriorityColor(rec.priority) }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={rec.title}
                          secondary={
                            <Box component="div">
                              <Typography variant="body2" color="text.secondary" component="div">
                                {rec.description}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }} component="div">
                                Действие: {rec.action}
                              </Typography>
                              {rec.affectedAssets && (
                                <Typography variant="caption" color="text.secondary" component="div">
                                  Затронутые активы: {rec.affectedAssets.join(', ')}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Chip
                          label={rec.priority === 'high' ? 'Высокий' : rec.priority === 'medium' ? 'Средний' : 'Низкий'}
                          size="small"
                          color={rec.priority === 'high' ? 'error' : rec.priority === 'medium' ? 'warning' : 'success'}
                        />
                      </ListItem>
                      {index < riskAssessment.recommendations.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Предупреждения */}
          {riskAssessment?.warnings && riskAssessment.warnings.length > 0 && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error">
                  <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Предупреждения
                </Typography>
                <List>
                  {riskAssessment.warnings.map((warning, index) => (
                    <React.Fragment key={index}>
                      <ListItem>
                        <ListItemIcon>
                          <WarningIcon sx={{ color: getSeverityColor(warning.severity) }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={warning.title}
                          secondary={
                            <Box component="div">
                              <Typography variant="body2" color="text.secondary" component="div">
                                {warning.description}
                              </Typography>
                              {warning.affectedAsset && (
                                <Typography variant="caption" color="text.secondary" component="div">
                                  Актив: {warning.affectedAsset}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Chip
                          label={warning.severity === 'critical' ? 'Критично' : 'Внимание'}
                          size="small"
                          color={warning.severity === 'critical' ? 'error' : 'warning'}
                        />
                      </ListItem>
                      {index < riskAssessment.warnings.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Рекомендации по стоп-лоссам и проверка сделок */}
        <div>
          {/* Рекомендации по стоп-лоссам */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Рекомендации по стоп-лоссам
              </Typography>
              {stopLossRecommendations.length === 0 ? (
                <Alert severity="info">
                  Нет активов для расчета стоп-лоссов
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Актив</TableCell>
                        <TableCell align="right">Текущая цена</TableCell>
                        <TableCell align="right">Стоп-лосс</TableCell>
                        <TableCell align="center">Уровень риска</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stopLossRecommendations.map((rec) => (
                        <TableRow key={rec.assetSymbol}>
                          <TableCell>{rec.assetSymbol}</TableCell>
                          <TableCell align="right">{rec.currentPrice.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            {rec.recommendedStopLoss.toFixed(2)}
                            <Typography variant="caption" display="block" color="text.secondary">
                              ({rec.stopLossPercentage}%)
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={getRiskLevelText(rec.riskLevel)}
                              size="small"
                              sx={{
                                backgroundColor: getRiskLevelColor(rec.riskLevel),
                                color: 'white',
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* Максимальный размер позиции */}
          {maxPositionSize && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Максимальный размер позиции
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body1" gutterBottom>
                    {maxPositionSize.recommendation}
                  </Typography>
                  <Typography variant="h5" color="primary">
                    {Math.round(maxPositionSize.maxPositionSize).toLocaleString()} руб.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ({Math.round(maxPositionSize.maxPositionSize / maxPositionSize.totalPortfolioValue * 100)}% от портфеля)
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {(['low', 'medium', 'high'] as const).map((tolerance) => (
                    <Button
                      key={tolerance}
                      variant={maxPositionSize.riskTolerance === tolerance ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => handleRiskToleranceChange(tolerance)}
                    >
                      {tolerance === 'low' ? 'Консервативный' : 
                       tolerance === 'medium' ? 'Умеренный' : 'Агрессивный'}
                    </Button>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Проверка сделки */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Проверка риска сделки
              </Typography>
              <Button
                variant="outlined"
                startIcon={<CalculateIcon />}
                onClick={() => setTradeDialogOpen(true)}
                fullWidth
              >
                Проверить сделку
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Диалог проверки сделки */}
      <Dialog open={tradeDialogOpen} onClose={() => setTradeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Проверка риска сделки</DialogTitle>
        <DialogContent>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '8px'
          }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <TextField
                label="Символ актива"
                value={tradeData.assetSymbol}
                onChange={(e) => setTradeData({ ...tradeData, assetSymbol: e.target.value })}
                fullWidth
              />
            </div>
            <div>
              <TextField
                select
                label="Тип актива"
                value={tradeData.assetType}
                onChange={(e) => setTradeData({ ...tradeData, assetType: e.target.value as any })}
                fullWidth
              >
                <MenuItem value="stock">Акция</MenuItem>
                <MenuItem value="crypto">Криптовалюта</MenuItem>
                <MenuItem value="currency">Валюта</MenuItem>
              </TextField>
            </div>
            <div>
              <TextField
                select
                label="Тип сделки"
                value={tradeData.transactionType}
                onChange={(e) => setTradeData({ ...tradeData, transactionType: e.target.value as any })}
                fullWidth
              >
                <MenuItem value="buy">Покупка</MenuItem>
                <MenuItem value="sell">Продажа</MenuItem>
              </TextField>
            </div>
            <div>
              <TextField
                label="Количество"
                type="number"
                value={tradeData.quantity}
                onChange={(e) => setTradeData({ ...tradeData, quantity: Number(e.target.value) })}
                fullWidth
              />
            </div>
            <div>
              <TextField
                label="Цена"
                type="number"
                value={tradeData.price}
                onChange={(e) => setTradeData({ ...tradeData, price: Number(e.target.value) })}
                fullWidth
              />
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTradeDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleTradeRiskCheck} variant="contained">
            Проверить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default RiskManagement;
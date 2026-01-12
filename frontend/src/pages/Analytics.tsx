
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  TrendingUp,
  Assessment,
  Warning,
  CheckCircle,
  Refresh,
  Download,
  Delete,
  BarChart,
  PieChart,
  Timeline
} from '@mui/icons-material';
import { analyticsApi, AnalyticsReport, ReportRecommendation } from '../services/analyticsApi';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

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
}

const Analytics: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [reports, setReports] = useState<AnalyticsReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const reportsData = await analyticsApi.getReports();
      setReports(reportsData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка загрузки отчетов');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (type: 'daily' | 'weekly' | 'portfolio') => {
    setGenerating(type);
    setError(null);
    try {
      let newReport: AnalyticsReport;
      
      switch (type) {
        case 'daily':
          newReport = await analyticsApi.createDailyReport();
          break;
        case 'weekly':
          newReport = await analyticsApi.createWeeklyReport();
          break;
        case 'portfolio':
          newReport = await analyticsApi.createPortfolioReport();
          break;
        default:
          throw new Error('Неизвестный тип отчета');
      }

      setReports(prev => [newReport, ...prev]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка создания отчета');
    } finally {
      setGenerating(null);
    }
  };

  const deleteReport = async (reportId: string) => {
    try {
      await analyticsApi.deleteReport(reportId);
      setReports(prev => prev.filter(report => report.id !== reportId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка удаления отчета');
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'DAILY': return 'primary';
      case 'WEEKLY': return 'secondary';
      case 'PORTFOLIO': return 'success';
      default: return 'default';
    }
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case 'DAILY': return <Timeline />;
      case 'WEEKLY': return <BarChart />;
      case 'PORTFOLIO': return <PieChart />;
      default: return <Assessment />;
    }
  };

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'BUY': return 'success';
      case 'SELL': return 'error';
      case 'HOLD': return 'warning';
      case 'REBALANCE': return 'info';
      case 'DIVERSIFY': return 'secondary';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderRecommendations = (recommendations: ReportRecommendation[]) => {
    return (
      <List dense>
        {recommendations.map((rec, index) => (
          <ListItem key={index}>
            <ListItemIcon>
              {rec.type === 'BUY' && <CheckCircle color="success" />}
              {rec.type === 'SELL' && <Warning color="error" />}
              {rec.type === 'HOLD' && <TrendingUp color="warning" />}
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip 
                    label={rec.type} 
                    size="small" 
                    color={getRecommendationColor(rec.type) as any}
                  />
                  <Typography variant="subtitle2">
                    {rec.assetSymbol} - {rec.assetName}
                  </Typography>
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {rec.reason}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Действие: {rec.action} • Уверенность: {rec.confidence}% • Приоритет: {rec.priority}
                  </Typography>
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
    );
  };

  const renderReportCard = (report: AnalyticsReport) => (
    <Card key={report.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getReportTypeIcon(report.type)}
            <Typography variant="h6" component="h2">
              {report.title}
            </Typography>
          </Box>
          <Chip 
            label={report.type} 
            color={getReportTypeColor(report.type) as any}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          {report.summary}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Период: {formatDate(report.period.start)} - {formatDate(report.period.end)}
          </Typography>
        </Box>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div>
            <Typography variant="subtitle2" gutterBottom>
              📊 Эффективность портфеля
            </Typography>
            <Typography variant="body2">
              Общая стоимость: {report.performanceMetrics.portfolioValue.toLocaleString('ru-RU')} руб.
            </Typography>
            <Typography 
              variant="body2" 
              color={report.performanceMetrics.totalReturn >= 0 ? 'success.main' : 'error.main'}
            >
              Доходность: {report.performanceMetrics.totalReturn.toFixed(2)}%
            </Typography>
          </div>

          <div>
            <Typography variant="subtitle2" gutterBottom>
              ⚠️ Оценка рисков
            </Typography>
            <Typography variant="body2">
              Уровень риска: {report.riskAssessment.overallRiskLevel}
            </Typography>
            <Typography variant="body2">
              Скор риска: {report.riskAssessment.portfolioRiskScore}/100
            </Typography>
          </div>
        </div>

        {report.recommendations.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              💡 Рекомендации ({report.recommendations.length})
            </Typography>
            {renderRecommendations(report.recommendations)}
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Создан: {formatDate(report.createdAt)}
        </Typography>
        <Box>
          <Tooltip title="Скачать отчет">
            <IconButton size="small">
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="Удалить отчет">
            <IconButton 
              size="small" 
              color="error"
              onClick={() => deleteReport(report.id)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      </CardActions>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: (theme) => theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.primary' }}>
          📈 Аналитические отчеты
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Детальный анализ вашего портфеля и рыночной ситуации
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          aria-label="analytics tabs"
        >
          <Tab label="Все отчеты" />
          <Tab label="Создать отчет" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadReports}
            disabled={loading}
          >
            Обновить
          </Button>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {reports.length === 0 && !loading && (
          <Alert severity="info">
            У вас пока нет аналитических отчетов. Создайте первый отчет на вкладке "Создать отчет".
          </Alert>
        )}

        {reports.map(renderReportCard)}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Timeline color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Ежедневный отчет</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Анализ текущей рыночной ситуации и краткосрочных трендов. Идеально для ежедневного мониторинга.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Включает: обзор рынка, технический анализ, рекомендации на день
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => generateReport('daily')}
                  disabled={!!generating}
                  startIcon={generating === 'daily' ? null : <Assessment />}
                >
                  {generating === 'daily' ? 'Создание...' : 'Создать отчет'}
                </Button>
              </CardActions>
            </Card>
          </div>

          <div>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BarChart color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Недельный отчет</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Глубокий анализ эффективности портфеля за неделю. Среднесрочные прогнозы и стратегии.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Включает: анализ портфеля, рыночные инсайты, недельные рекомендации
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  onClick={() => generateReport('weekly')}
                  disabled={!!generating}
                  startIcon={generating === 'weekly' ? null : <TrendingUp />}
                >
                  {generating === 'weekly' ? 'Создание...' : 'Создать отчет'}
                </Button>
              </CardActions>
            </Card>
          </div>

          <div>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PieChart color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6">Анализ портфеля</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Полный анализ структуры портфеля, рисков и рекомендации по оптимизации.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Включает: полный анализ портфеля, оценку рисков, рекомендации по оптимизации
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  onClick={() => generateReport('portfolio')}
                  disabled={!!generating}
                  startIcon={generating === 'portfolio' ? null : <Assessment />}
                >
                  {generating === 'portfolio' ? 'Создание...' : 'Создать отчет'}
                </Button>
              </CardActions>
            </Card>
          </div>
        </div>

        <Box sx={{ mt: 4, p: 3, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            💡 Как использовать аналитические отчеты?
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            • <strong>Ежедневные отчеты</strong> - для оперативного принятия решений и отслеживания краткосрочных трендов
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            • <strong>Недельные отчеты</strong> - для анализа эффективности стратегии и среднесрочного планирования
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Анализ портфеля</strong> - для глубокой оптимизации структуры инвестиций и управления рисками
          </Typography>
        </Box>
      </TabPanel>
    </Container>
  );
};

export default Analytics;
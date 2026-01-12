import React, { useState, useEffect } from 'react';
import {
  Box,
  Snackbar,
  Alert,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Notifications,
  Close,
  TrendingUp,
  TrendingDown,
  Warning,
  Info,
  Settings,
} from '@mui/icons-material';
import { pushNotificationService } from '../services/pushNotificationService';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  symbol?: string;
  recommendation?: string;
}

interface NotificationSystemProps {
  notifications?: Notification[];
  onNotificationRead?: (id: string) => void;
  onClearAll?: () => void;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications = [],
  onNotificationRead,
  onClearAll,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [localNotifications, setLocalNotifications] = useState<Notification[]>(notifications);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  // Инициализация push-уведомлений
  useEffect(() => {
    const initPushNotifications = async () => {
      setPushPermission(Notification.permission);
      setPushEnabled(Notification.permission === 'granted');
    };

    initPushNotifications();
  }, []);

  // Мок-данные для демонстрации
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'success',
        title: 'Новая рекомендация',
        message: 'Акция SBER: СИЛЬНО ПОКУПАТЬ с уверенностью 85%',
        timestamp: new Date(Date.now() - 300000), // 5 минут назад
        read: false,
        symbol: 'SBER',
        recommendation: 'STRONG_BUY'
      },
      {
        id: '2',
        type: 'warning',
        title: 'Высокая волатильность',
        message: 'Криптовалюта BTCUSDT показывает повышенную волатильность',
        timestamp: new Date(Date.now() - 600000), // 10 минут назад
        read: false,
        symbol: 'BTCUSDT'
      },
      {
        id: '3',
        type: 'info',
        title: 'Обновление данных',
        message: 'Рыночные данные успешно обновлены',
        timestamp: new Date(Date.now() - 1800000), // 30 минут назад
        read: true
      }
    ];
    setLocalNotifications(mockNotifications);
  }, []);

  const unreadCount = localNotifications.filter(n => !n.read).length;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      setLocalNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
      onNotificationRead?.(notification.id);
    }
    handleMenuClose();
  };

  const handleClearAll = () => {
    setLocalNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onClearAll?.();
    handleMenuClose();
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await pushNotificationService.requestPermission();
      setPushEnabled(granted);
      setPushPermission(granted ? 'granted' : 'denied');
      
      if (granted) {
        // Тестовое уведомление при включении
        await pushNotificationService.sendNotification({
          title: 'Push-уведомления включены',
          body: 'Теперь вы будете получать важные алерты о рынке',
          tag: 'push_enabled'
        });
      }
    } else {
      setPushEnabled(false);
    }
  };

  const handleSettingsOpen = () => {
    setSettingsOpen(true);
    handleMenuClose();
  };

  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };

  const sendTestNotification = async () => {
    try {
      console.log('Отправка тестового уведомления...');
      await pushNotificationService.sendPriceAlertNotification(
        'SBER',
        280.50,
        2.5,
        'BUY'
      );
      console.log('Тестовое уведомление отправлено успешно');
    } catch (error) {
      console.error('Ошибка отправки тестового уведомления:', error);
      // Альтернативный метод для тестирования
      await pushNotificationService.sendNotification({
        title: 'Тестовое уведомление',
        body: 'Push-уведомления работают корректно!',
        tag: 'test_notification'
      });
    }
  };

  const getNotificationIcon = (type: string, recommendation?: string) => {
    if (recommendation === 'BUY' || recommendation === 'STRONG_BUY') {
      return <TrendingUp color="success" />;
    }
    if (recommendation === 'SELL' || recommendation === 'STRONG_SELL') {
      return <TrendingDown color="error" />;
    }
    
    switch (type) {
      case 'success':
        return <TrendingUp color="success" />;
      case 'error':
        return <TrendingDown color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      default:
        return <Info color="info" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    return `${diffDays} дн назад`;
  };

  const getRecommendationChip = (recommendation?: string) => {
    if (!recommendation) return null;

    const colors = {
      'BUY': 'success',
      'STRONG_BUY': 'success',
      'SELL': 'error',
      'STRONG_SELL': 'error',
      'HOLD': 'warning'
    } as const;

    const texts = {
      'BUY': 'ПОКУПАТЬ',
      'STRONG_BUY': 'СИЛЬНО ПОКУПАТЬ',
      'SELL': 'ПРОДАВАТЬ',
      'STRONG_SELL': 'СИЛЬНО ПРОДАВАТЬ',
      'HOLD': 'ДЕРЖАТЬ'
    } as const;

    return (
      <Chip
        label={texts[recommendation as keyof typeof texts]}
        color={colors[recommendation as keyof typeof colors]}
        size="small"
        sx={{ ml: 1 }}
      />
    );
  };

  return (
    <Box>
      {/* Кнопка уведомлений */}
      <IconButton
        color="inherit"
        onClick={handleMenuOpen}
        sx={{ position: 'relative' }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <Notifications />
        </Badge>
      </IconButton>

      {/* Меню уведомлений */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { width: 360, maxHeight: 480 }
        }}
      >
        {/* Заголовок */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Уведомления</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              {unreadCount > 0 && (
                <Chip
                  label={`${unreadCount} непрочитанных`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              <IconButton
                size="small"
                onClick={handleSettingsOpen}
                title="Настройки уведомлений"
              >
                <Settings fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>

        <Divider />

        {/* Список уведомлений */}
        <List sx={{ p: 0 }}>
          {localNotifications.length > 0 ? (
            localNotifications.map((notification) => (
              <ListItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: notification.read ? 'transparent' : 'action.hover',
                  '&:hover': {
                    backgroundColor: 'action.selected'
                  }
                }}
              >
                <ListItemIcon>
                  {getNotificationIcon(notification.type, notification.recommendation)}
                </ListItemIcon>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box display="flex" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
                      {notification.title}
                    </Typography>
                    {getRecommendationChip(notification.recommendation)}
                  </Box>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {notification.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatTimeAgo(notification.timestamp)}
                  </Typography>
                </Box>
              </ListItem>
            ))
          ) : (
            <ListItem>
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ width: '100%' }}>
                Нет уведомлений
              </Typography>
            </ListItem>
          )}
        </List>

        {/* Кнопка очистки и настройки */}
        <Divider />
        <Box sx={{ p: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Button
              size="small"
              onClick={handleClearAll}
              disabled={unreadCount === 0}
            >
              Очистить все
            </Button>
            <Button
              size="small"
              onClick={handleSettingsOpen}
              startIcon={<Settings />}
            >
              Настройки
            </Button>
          </Box>
        </Box>
      </Menu>

      {/* Всплывающее уведомление (Snackbar) */}
      <Snackbar
        open={openSnackbar}
        autoHideDuration={6000}
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setOpenSnackbar(false)}
          severity={currentNotification ? getNotificationColor(currentNotification.type) : 'info'}
          sx={{ width: '100%' }}
        >
          {currentNotification && (
            <Box component="div">
              <Typography variant="subtitle2" component="span" display="block">
                {currentNotification.title}
              </Typography>
              <Typography variant="body2" component="span" display="block">
                {currentNotification.message}
              </Typography>
            </Box>
          )}
        </Alert>
      </Snackbar>

      {/* Диалог настроек уведомлений */}
      <Dialog open={settingsOpen} onClose={handleSettingsClose} maxWidth="sm" fullWidth>
        <DialogTitle>Настройки уведомлений</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={pushEnabled}
                  onChange={(e) => handlePushToggle(e.target.checked)}
                  disabled={pushPermission === 'denied'}
                />
              }
              label={
                <Box component="div">
                  <Typography variant="body1" component="span" display="block">
                    Push-уведомления
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="span" display="block">
                    {pushPermission === 'granted'
                      ? 'Разрешены браузером'
                      : pushPermission === 'denied'
                        ? 'Заблокированы браузером'
                        : 'Требуется разрешение'}
                  </Typography>
                </Box>
              }
            />
            
            {pushPermission === 'denied' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Push-уведомления заблокированы в настройках браузера.
                Разрешите уведомления для этого сайта, чтобы получать алерты.
              </Alert>
            )}

            {pushEnabled && (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={sendTestNotification}
                >
                  Отправить тестовое уведомление
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotificationSystem;
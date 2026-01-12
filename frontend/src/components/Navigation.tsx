import React, { useState } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  useScrollTrigger,
  Slide,
  Menu,
  MenuItem,
  Avatar,
  Chip,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  TrendingUp as MarketIcon,
  Analytics as AnalysisIcon,
  AccountBalance as PortfolioIcon,
  Security as RiskIcon,
  Assessment as AnalyticsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  ShowChart,
  LightMode,
  DarkMode,
  Psychology as MLIcon,
} from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import NotificationSystem from './NotificationSystem'

interface Props {
  children: React.ReactElement
}

function HideOnScroll(props: Props) {
  const { children } = props
  const trigger = useScrollTrigger()

  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  )
}

const Navigation: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const menuItems = [
    { path: '/', label: 'Дашборд', icon: <DashboardIcon /> },
    { path: '/market', label: 'Рынок', icon: <MarketIcon /> },
    { path: '/analysis', label: 'Анализ', icon: <AnalysisIcon /> },
    { path: '/asset-analysis', label: 'Графики', icon: <ShowChart /> },
    { path: '/portfolio', label: 'Портфель', icon: <PortfolioIcon /> },
    { path: '/risk', label: 'Риски', icon: <RiskIcon /> },
    { path: '/analytics', label: 'Отчеты', icon: <AnalyticsIcon /> },
    { path: '/ml-analytics', label: 'ML Аналитика', icon: <MLIcon /> },
  ]

  const { user, logout } = useAuthStore()
  const { mode, toggleTheme } = useThemeStore()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    logout()
    handleMenuClose()
    navigate('/auth')
  }

  return (
    <HideOnScroll>
      <AppBar 
        position="fixed" 
        sx={{ 
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 2px 20px rgba(0,0,0,0.1)'
        }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 0,
              mr: 4,
              fontWeight: 700,
              background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Russian Trader
          </Typography>

          <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
            {menuItems.map((item) => (
              <Button
                key={item.path}
                startIcon={item.icon}
                onClick={() => navigate(item.path)}
                sx={{
                  color: location.pathname === item.path ? 'primary.main' : (theme) =>
                    theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.87)' : 'text.secondary',
                  backgroundColor: location.pathname === item.path ? 'action.selected' : 'transparent',
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {user ? (
              <>
                {/* Переключатель темы */}
                <IconButton
                  onClick={toggleTheme}
                  size="small"
                  color="inherit"
                  title={mode === 'light' ? 'Темная тема' : 'Светлая тема'}
                >
                  {mode === 'light' ? <DarkMode /> : <LightMode />}
                </IconButton>

                {/* Уведомления */}
                <NotificationSystem />
                
                {/* Статус пользователя */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                  <Chip
                    label="Новичок"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary">
                    {user.username}
                  </Typography>
                </Box>
                
                {/* Аватар пользователя */}
                <IconButton
                  onClick={handleMenuOpen}
                  size="small"
                  aria-controls={anchorEl ? 'user-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={anchorEl ? 'true' : undefined}
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  id="user-menu"
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                  MenuListProps={{
                    'aria-labelledby': 'user-button',
                  }}
                >
                  <MenuItem onClick={handleMenuClose}>
                    <PersonIcon sx={{ mr: 1 }} fontSize="small" />
                    Профиль
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>
                    <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
                    Выйти
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
                  Для начинающих трейдеров
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ borderRadius: 20 }}
                  onClick={() => navigate('/auth')}
                >
                  Войти
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>
    </HideOnScroll>
  )
}

export default Navigation
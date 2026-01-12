import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTheme, Theme } from '@mui/material/styles';

// Светлая тема для трейдинг-приложения
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
    },
    error: {
      main: '#d32f2f',
      light: '#f44336',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 20px 0 rgba(0,0,0,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
});

// Темная тема для трейдинг-приложения
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
      light: '#e3f2fd',
      dark: '#42a5f5',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    success: {
      main: '#66bb6a',
      light: '#81c784',
    },
    error: {
      main: '#f44336',
      light: '#e57373',
    },
    warning: {
      main: '#ffa726',
      light: '#ffb74d',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 20px 0 rgba(0,0,0,0.3)',
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          backgroundImage: 'none',
        },
      },
    },
  },
});

export interface ThemeState {
  mode: 'light' | 'dark';
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      theme: lightTheme,
      
      toggleTheme: () => {
        const { mode } = get();
        const newMode = mode === 'light' ? 'dark' : 'light';
        const newTheme = newMode === 'light' ? lightTheme : darkTheme;
        
        set({ 
          mode: newMode,
          theme: newTheme
        });
      },
      
      setTheme: (mode: 'light' | 'dark') => {
        const newTheme = mode === 'light' ? lightTheme : darkTheme;
        set({ 
          mode,
          theme: newTheme
        });
      }
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({
        mode: state.mode
      })
    }
  )
);

// Автоматическое определение системной темы
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const { setTheme } = useThemeStore.getState();
  
  // Установить тему на основе системных настроек при первом запуске
  const storedMode = localStorage.getItem('theme-storage');
  if (!storedMode) {
    setTheme(mediaQuery.matches ? 'dark' : 'light');
  }
  
  // Слушатель изменений системной темы
  mediaQuery.addEventListener('change', (e) => {
    const { mode } = useThemeStore.getState();
    // Меняем тему только если пользователь не выбрал тему вручную
    if (!localStorage.getItem('theme-storage')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}
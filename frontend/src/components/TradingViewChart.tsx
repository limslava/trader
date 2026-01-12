import React, { useEffect, useRef } from 'react';
import { Box, Typography, Alert } from '@mui/material';

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
  interval?: string;
  height?: number;
  width?: number;
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  exchange = 'MOEX',
  interval = '1D',
  height = 400,
  width = '100%'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    // Очистка предыдущего виджета
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Создание нового виджета TradingView
    const createWidget = () => {
      if (window.TradingView && containerRef.current) {
        new window.TradingView.widget({
          autosize: true,
          symbol: getTradingViewSymbol(symbol, exchange),
          interval: interval,
          timezone: "Europe/Moscow",
          theme: "light",
          style: "1",
          locale: "ru",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: containerRef.current.id,
          height: height,
          width: width,
          studies: [
            "RSI@tv-basicstudies",
            "MACD@tv-basicstudies",
            "MAExp@tv-basicstudies",
            "Volume@tv-basicstudies"
          ],
          show_popup_button: true,
          popup_width: "1000",
          popup_height: "650",
        });
      }
    };

    // Загрузка скрипта TradingView если еще не загружен
    if (!scriptRef.current) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = createWidget;
      
      scriptRef.current = script;
      document.head.appendChild(script);
    } else {
      createWidget();
    }

    return () => {
      // Очистка при размонтировании
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, exchange, interval, height, width]);

  const getTradingViewSymbol = (symbol: string, exchange: string): string => {
    // Маппинг символов для TradingView
    const symbolMap: { [key: string]: string } = {
      'SBER': 'MOEX:SBER',
      'GAZP': 'MOEX:GAZP',
      'LKOH': 'MOEX:LKOH',
      'ROSN': 'MOEX:ROSN',
      'VTBR': 'MOEX:VTBR',
      'GMKN': 'MOEX:GMKN',
      'NLMK': 'MOEX:NLMK',
      'PLZL': 'MOEX:PLZL',
      'TATN': 'MOEX:TATN',
      'MGNT': 'MOEX:MGNT',
      'BTCUSDT': 'BINANCE:BTCUSDT',
      'ETHUSDT': 'BINANCE:ETHUSDT',
      'BNBUSDT': 'BINANCE:BNBUSDT',
      'ADAUSDT': 'BINANCE:ADAUSDT',
      'DOTUSDT': 'BINANCE:DOTUSDT',
      'LINKUSDT': 'BINANCE:LINKUSDT',
      'LTCUSDT': 'BINANCE:LTCUSDT',
      'BCHUSDT': 'BINANCE:BCHUSDT',
      'XRPUSDT': 'BINANCE:XRPUSDT',
      'EOSUSDT': 'BINANCE:EOSUSDT'
    };

    return symbolMap[symbol] || `${exchange}:${symbol}`;
  };

  const containerId = `tradingview-${symbol}-${Date.now()}`;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          График {symbol}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Реальный график с TradingView - {exchange}
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Для работы графиков требуется подключение к интернету. Графики загружаются напрямую с TradingView.
      </Alert>

      <Box
        ref={containerRef}
        id={containerId}
        sx={{
          width: '100%',
          height: `${height}px`,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden'
        }}
      >
        {/* Fallback если TradingView не загрузился */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            backgroundColor: 'background.default'
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Загрузка графика TradingView...
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Данные предоставлены TradingView. График обновляется в реальном времени.
        </Typography>
      </Box>
    </Box>
  );
};

// Добавляем тип для window.TradingView
declare global {
  interface Window {
    TradingView: any;
  }
}

export default TradingViewChart;
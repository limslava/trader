import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { MarketDataService } from './MarketDataService';

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private marketDataService: MarketDataService;

  constructor() {
    this.marketDataService = new MarketDataService();
  }

  initialize(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupEventHandlers();
    this.startPriceUpdates();
    
    console.log('🔌 WebSocket сервер запущен');
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`📡 Клиент подключен: ${socket.id}`);

      // Подписка на обновления цен
      socket.on('subscribe-prices', (symbols: string[]) => {
        console.log(`📊 Клиент ${socket.id} подписался на:`, symbols);
        socket.join('price-updates');
      });

      // Отписка от обновлений
      socket.on('unsubscribe-prices', () => {
        socket.leave('price-updates');
        console.log(`📊 Клиент ${socket.id} отписался от обновлений`);
      });

      // Запрос текущих цен
      socket.on('get-prices', async (symbols: string[], callback: Function) => {
        try {
          const prices = await this.marketDataService.getMultiplePrices(symbols);
          callback({ success: true, data: prices });
        } catch (error) {
          console.error('Ошибка получения цен:', error);
          callback({ success: false, error: 'Не удалось получить цены' });
        }
      });

      socket.on('disconnect', () => {
        console.log(`📡 Клиент отключен: ${socket.id}`);
      });
    });
  }

  private startPriceUpdates() {
    // Обновление цен каждые 5 секунд (для демонстрации)
    setInterval(async () => {
      try {
        const popularAssets = [
          'SBER', 'GAZP', 'LKOH', 'VTBR', 'ROSN', // Российские акции
          'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT' // Криптовалюты
        ];

        const pricesMap = await this.marketDataService.getMultiplePrices(popularAssets);
        
        if (this.io) {
          // Преобразуем Map в массив для frontend
          const priceUpdates = Array.from(pricesMap.entries()).map(([symbol, price]) => ({
            symbol,
            currentPrice: price.price || 0,
            change: price.change || 0,
            changePercent: price.changePercent || 0,
            timestamp: price.timestamp || new Date().toISOString()
          }));

          this.io.to('price-updates').emit('price-update', {
            timestamp: new Date().toISOString(),
            prices: priceUpdates
          });
        }
      } catch (error) {
        console.error('Ошибка обновления цен через WebSocket:', error);
      }
    }, 5000); // 5 секунд
  }

  // Метод для отправки пользовательских событий
  broadcastPriceUpdate(symbol: string, priceData: any) {
    if (this.io) {
      this.io.to('price-updates').emit('price-update-single', {
        symbol,
        ...priceData,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Метод для отправки уведомлений о рисках
  broadcastRiskAlert(alert: any) {
    if (this.io) {
      this.io.emit('risk-alert', {
        ...alert,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Метод для отправки рекомендаций
  broadcastRecommendation(recommendation: any) {
    if (this.io) {
      this.io.emit('new-recommendation', {
        ...recommendation,
        timestamp: new Date().toISOString()
      });
    }
  }

  getConnectedClientsCount(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }
}

export default WebSocketService;
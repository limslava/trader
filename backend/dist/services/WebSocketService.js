"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const MarketDataService_1 = require("./MarketDataService");
class WebSocketService {
    constructor() {
        this.io = null;
        this.marketDataService = new MarketDataService_1.MarketDataService();
    }
    initialize(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });
        this.setupEventHandlers();
        this.startPriceUpdates();
        console.log('🔌 WebSocket сервер запущен');
    }
    setupEventHandlers() {
        if (!this.io)
            return;
        this.io.on('connection', (socket) => {
            console.log(`📡 Клиент подключен: ${socket.id}`);
            socket.on('subscribe-prices', (symbols) => {
                console.log(`📊 Клиент ${socket.id} подписался на:`, symbols);
                socket.join('price-updates');
            });
            socket.on('unsubscribe-prices', () => {
                socket.leave('price-updates');
                console.log(`📊 Клиент ${socket.id} отписался от обновлений`);
            });
            socket.on('get-prices', async (symbols, callback) => {
                try {
                    const prices = await this.marketDataService.getMultiplePrices(symbols);
                    callback({ success: true, data: prices });
                }
                catch (error) {
                    console.error('Ошибка получения цен:', error);
                    callback({ success: false, error: 'Не удалось получить цены' });
                }
            });
            socket.on('disconnect', () => {
                console.log(`📡 Клиент отключен: ${socket.id}`);
            });
        });
    }
    startPriceUpdates() {
        setInterval(async () => {
            try {
                const popularAssets = [
                    'SBER', 'GAZP', 'LKOH', 'VTBR', 'ROSN',
                    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'
                ];
                const pricesMap = await this.marketDataService.getMultiplePrices(popularAssets);
                if (this.io) {
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
            }
            catch (error) {
                console.error('Ошибка обновления цен через WebSocket:', error);
            }
        }, 5000);
    }
    broadcastPriceUpdate(symbol, priceData) {
        if (this.io) {
            this.io.to('price-updates').emit('price-update-single', {
                symbol,
                ...priceData,
                timestamp: new Date().toISOString()
            });
        }
    }
    broadcastRiskAlert(alert) {
        if (this.io) {
            this.io.emit('risk-alert', {
                ...alert,
                timestamp: new Date().toISOString()
            });
        }
    }
    broadcastRecommendation(recommendation) {
        if (this.io) {
            this.io.emit('new-recommendation', {
                ...recommendation,
                timestamp: new Date().toISOString()
            });
        }
    }
    getConnectedClientsCount() {
        if (!this.io)
            return 0;
        return this.io.engine.clientsCount;
    }
}
exports.WebSocketService = WebSocketService;
exports.default = WebSocketService;
//# sourceMappingURL=WebSocketService.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataService = void 0;
const MOEXDataSource_1 = require("../data-sources/MOEXDataSource");
const BinanceDataSource_1 = require("../data-sources/BinanceDataSource");
const TradingViewDataSource_1 = require("../data-sources/TradingViewDataSource");
class MarketDataService {
    constructor() {
        this.cache = new Map();
        this.moexDataSource = new MOEXDataSource_1.MOEXDataSource();
        this.binanceDataSource = new BinanceDataSource_1.BinanceDataSource();
        this.tradingViewDataSource = new TradingViewDataSource_1.TradingViewDataSource();
    }
    async getPrice(symbol, exchange) {
        const cacheKey = `${symbol}:${exchange || 'default'}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp.getTime() < 30000) {
            return cached;
        }
        try {
            let priceData = null;
            if (exchange === 'MOEX' || this.isRussianStock(symbol)) {
                priceData = await this.moexDataSource.getPrice(symbol);
            }
            else if (exchange === 'BINANCE' || this.isCrypto(symbol)) {
                priceData = await this.binanceDataSource.getPrice(symbol);
            }
            else {
                priceData = await this.moexDataSource.getPrice(symbol) ||
                    await this.binanceDataSource.getPrice(symbol) ||
                    await this.tradingViewDataSource.getPrice(symbol);
            }
            if (priceData) {
                this.cache.set(cacheKey, priceData);
            }
            return priceData;
        }
        catch (error) {
            console.error(`Ошибка получения цены для ${symbol}:`, error);
            return null;
        }
    }
    async getMultiplePrices(symbols) {
        const results = new Map();
        const promises = symbols.map(async (symbol) => {
            const priceData = await this.getPrice(symbol);
            if (priceData) {
                results.set(symbol, priceData);
            }
        });
        await Promise.all(promises);
        return results;
    }
    async getTechnicalIndicators(symbol) {
        try {
            return await this.tradingViewDataSource.getTechnicalIndicators(symbol);
        }
        catch (error) {
            console.error(`Ошибка получения технических индикаторов для ${symbol}:`, error);
            return null;
        }
    }
    async getPopularRussianStocks() {
        const popularStocks = [
            { symbol: 'SBER', name: 'Сбербанк' },
            { symbol: 'GAZP', name: 'Газпром' },
            { symbol: 'LKOH', name: 'Лукойл' },
            { symbol: 'ROSN', name: 'Роснефть' },
            { symbol: 'VTBR', name: 'ВТБ' },
            { symbol: 'GMKN', name: 'Норникель' },
            { symbol: 'NLMK', name: 'НЛМК' },
            { symbol: 'PLZL', name: 'Полюс' },
            { symbol: 'TATN', name: 'Татнефть' },
            { symbol: 'MGNT', name: 'Магнит' }
        ];
        const pricePromises = popularStocks.map(async (stock) => {
            const priceData = await this.getPrice(stock.symbol, 'MOEX');
            return {
                id: `MOEX:${stock.symbol}`,
                symbol: stock.symbol,
                name: stock.name,
                type: 'STOCK',
                exchange: 'MOEX',
                currentPrice: priceData?.price || 0,
                priceChange: priceData?.change || 0,
                priceChangePercent: priceData?.changePercent || 0,
                volume: priceData?.volume || 0,
                lastUpdated: priceData?.timestamp || new Date()
            };
        });
        return Promise.all(pricePromises);
    }
    async getPopularCryptos() {
        const popularCryptos = [
            { symbol: 'BTCUSDT', name: 'Bitcoin' },
            { symbol: 'ETHUSDT', name: 'Ethereum' },
            { symbol: 'BNBUSDT', name: 'Binance Coin' },
            { symbol: 'ADAUSDT', name: 'Cardano' },
            { symbol: 'DOTUSDT', name: 'Polkadot' },
            { symbol: 'LINKUSDT', name: 'Chainlink' },
            { symbol: 'LTCUSDT', name: 'Litecoin' },
            { symbol: 'BCHUSDT', name: 'Bitcoin Cash' },
            { symbol: 'XRPUSDT', name: 'Ripple' },
            { symbol: 'EOSUSDT', name: 'EOS' }
        ];
        const pricePromises = popularCryptos.map(async (crypto) => {
            const priceData = await this.getPrice(crypto.symbol, 'BINANCE');
            return {
                id: `BINANCE:${crypto.symbol}`,
                symbol: crypto.symbol,
                name: crypto.name,
                type: 'CRYPTO',
                exchange: 'BINANCE',
                currentPrice: priceData?.price || 0,
                priceChange: priceData?.change || 0,
                priceChangePercent: priceData?.changePercent || 0,
                volume: priceData?.volume || 0,
                lastUpdated: priceData?.timestamp || new Date()
            };
        });
        return Promise.all(pricePromises);
    }
    async updateMarketData() {
        const popularStocks = await this.getPopularRussianStocks();
        const popularCryptos = await this.getPopularCryptos();
        const allSymbols = [
            ...popularStocks.map(stock => stock.symbol),
            ...popularCryptos.map(crypto => crypto.symbol)
        ];
        await this.getMultiplePrices(allSymbols);
        console.log(`Обновлены данные для ${allSymbols.length} активов`);
    }
    isRussianStock(symbol) {
        const russianSymbols = ['SBER', 'GAZP', 'LKOH', 'ROSN', 'VTBR', 'GMKN', 'NLMK', 'PLZL', 'TATN', 'MGNT'];
        return russianSymbols.includes(symbol.toUpperCase());
    }
    isCrypto(symbol) {
        return symbol.includes('USDT') || symbol.includes('BTC') || symbol.includes('ETH');
    }
}
exports.MarketDataService = MarketDataService;
//# sourceMappingURL=MarketDataService.js.map
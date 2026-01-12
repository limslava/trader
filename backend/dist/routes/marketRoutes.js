"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MarketDataService_1 = require("../services/MarketDataService");
const AnalysisService_1 = require("../services/AnalysisService");
const router = express_1.default.Router();
const marketDataService = new MarketDataService_1.MarketDataService();
const analysisService = new AnalysisService_1.AnalysisService();
router.get('/price/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { exchange } = req.query;
        if (!symbol) {
            return res.status(400).json({
                error: 'Не указан символ актива',
                message: 'Параметр symbol обязателен'
            });
        }
        const priceData = await marketDataService.getPrice(symbol.toUpperCase(), exchange);
        if (!priceData) {
            return res.status(404).json({
                error: 'Актив не найден',
                symbol,
                message: 'Не удалось получить данные для указанного символа'
            });
        }
        return res.json({
            success: true,
            data: priceData
        });
    }
    catch (error) {
        console.error('Ошибка получения цены:', error);
        return res.status(500).json({
            error: 'Ошибка сервера',
            message: 'Не удалось получить данные цены'
        });
    }
});
router.post('/prices', async (req, res) => {
    try {
        const { symbols } = req.body;
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return res.status(400).json({
                error: 'Неверный формат запроса',
                message: 'Параметр symbols должен быть массивом символов'
            });
        }
        if (symbols.length > 50) {
            return res.status(400).json({
                error: 'Слишком много символов',
                message: 'Максимальное количество символов в одном запросе: 50'
            });
        }
        const prices = await marketDataService.getMultiplePrices(symbols);
        const pricesArray = Array.from(prices.entries()).map(([symbol, data]) => ({
            ...data,
            symbol
        }));
        return res.json({
            success: true,
            data: pricesArray,
            count: pricesArray.length
        });
    }
    catch (error) {
        console.error('Ошибка получения цен:', error);
        return res.status(500).json({
            error: 'Ошибка сервера',
            message: 'Не удалось получить данные цен'
        });
    }
});
router.get('/indicators/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol) {
            return res.status(400).json({
                error: 'Не указан символ актива'
            });
        }
        const indicators = await marketDataService.getTechnicalIndicators(symbol.toUpperCase());
        if (!indicators) {
            return res.status(404).json({
                error: 'Не удалось получить индикаторы',
                symbol
            });
        }
        return res.json({
            success: true,
            data: indicators
        });
    }
    catch (error) {
        console.error('Ошибка получения индикаторов:', error);
        return res.status(500).json({
            error: 'Ошибка сервера',
            message: 'Не удалось получить технические индикаторы'
        });
    }
});
router.get('/stocks/popular', async (req, res) => {
    try {
        const stocks = await marketDataService.getPopularRussianStocks();
        const prices = await marketDataService.getMultiplePrices(stocks.map(stock => stock.symbol));
        const stocksWithPrices = stocks.map(stock => {
            const priceData = prices.get(stock.symbol);
            return {
                ...stock,
                currentPrice: priceData?.price || null,
                change: priceData?.change || null,
                changePercent: priceData?.changePercent || null
            };
        });
        return res.json({
            success: true,
            data: stocksWithPrices,
            count: stocksWithPrices.length
        });
    }
    catch (error) {
        console.error('Ошибка получения популярных акций:', error);
        return res.status(500).json({
            error: 'Ошибка сервера',
            message: 'Не удалось получить список популярных акций'
        });
    }
});
router.get('/crypto/popular', async (req, res) => {
    try {
        const cryptos = await marketDataService.getPopularCryptos();
        const prices = await marketDataService.getMultiplePrices(cryptos.map(crypto => crypto.symbol));
        const cryptosWithPrices = cryptos.map(crypto => {
            const priceData = prices.get(crypto.symbol);
            return {
                ...crypto,
                currentPrice: priceData?.price || null,
                change: priceData?.change || null,
                changePercent: priceData?.changePercent || null
            };
        });
        return res.json({
            success: true,
            data: cryptosWithPrices,
            count: cryptosWithPrices.length
        });
    }
    catch (error) {
        console.error('Ошибка получения популярных криптовалют:', error);
        return res.status(500).json({
            error: 'Ошибка сервера',
            message: 'Не удалось получить список популярных криптовалют'
        });
    }
});
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: 'Не указан поисковый запрос',
                message: 'Параметр query обязателен'
            });
        }
        const searchTerm = query.toLowerCase();
        const stocks = await marketDataService.getPopularRussianStocks();
        const cryptos = await marketDataService.getPopularCryptos();
        const allAssets = [...stocks, ...cryptos];
        const results = allAssets.filter(asset => asset.name.toLowerCase().includes(searchTerm) ||
            asset.symbol.toLowerCase().includes(searchTerm));
        return res.json({
            success: true,
            data: results,
            count: results.length
        });
    }
    catch (error) {
        console.error('Ошибка поиска активов:', error);
        return res.status(500).json({
            error: 'Ошибка сервера',
            message: 'Не удалось выполнить поиск'
        });
    }
});
router.get('/analysis/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol) {
            return res.status(400).json({
                error: 'Не указан символ актива'
            });
        }
        const analysis = await analysisService.analyzeAsset(symbol.toUpperCase());
        if (!analysis) {
            return res.status(404).json({
                error: 'Не удалось проанализировать актив',
                symbol
            });
        }
        return res.json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        console.error('Ошибка анализа актива:', error);
        return res.status(500).json({
            error: 'Ошибка сервера',
            message: 'Не удалось проанализировать актив'
        });
    }
});
exports.default = router;
//# sourceMappingURL=marketRoutes.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const CachedMarketDataService_1 = require("../services/CachedMarketDataService");
const MemoryCacheService_1 = require("../services/MemoryCacheService");
const router = express_1.default.Router();
router.get('/stats', async (req, res) => {
    try {
        const cacheStats = await CachedMarketDataService_1.cachedMarketDataService.getCacheStats();
        const memoryStats = MemoryCacheService_1.memoryCacheService.getStats();
        res.json({
            success: true,
            data: {
                cacheStats,
                memoryStats,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Ошибка получения статистики кэша:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения статистики кэша'
        });
    }
});
router.delete('/symbol/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        await CachedMarketDataService_1.cachedMarketDataService.invalidateSymbolCache(symbol);
        res.json({
            success: true,
            message: `Кэш для ${symbol} очищен`,
            data: { symbol }
        });
    }
    catch (error) {
        console.error('Ошибка очистки кэша символа:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка очистки кэша символа'
        });
    }
});
router.delete('/market', async (req, res) => {
    try {
        await CachedMarketDataService_1.cachedMarketDataService.invalidateAllCache();
        res.json({
            success: true,
            message: 'Весь кэш рыночных данных очищен',
            data: { timestamp: new Date().toISOString() }
        });
    }
    catch (error) {
        console.error('Ошибка очистки кэша рыночных данных:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка очистки кэша рыночных данных'
        });
    }
});
router.get('/ttl/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const ttl = await MemoryCacheService_1.memoryCacheService.ttl(key);
        res.json({
            success: true,
            data: {
                key,
                ttl,
                exists: ttl > -2
            }
        });
    }
    catch (error) {
        console.error('Ошибка получения TTL:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения TTL'
        });
    }
});
router.get('/keys', async (req, res) => {
    try {
        const { pattern = '*' } = req.query;
        const keys = await MemoryCacheService_1.memoryCacheService.keys(pattern);
        res.json({
            success: true,
            data: {
                pattern,
                keys,
                count: keys.length
            }
        });
    }
    catch (error) {
        console.error('Ошибка получения ключей:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения ключей'
        });
    }
});
router.delete('/clear', async (req, res) => {
    try {
        await MemoryCacheService_1.memoryCacheService.clear();
        res.json({
            success: true,
            message: 'Весь кэш приложения очищен',
            data: { timestamp: new Date().toISOString() }
        });
    }
    catch (error) {
        console.error('Ошибка очистки кэша:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка очистки кэша'
        });
    }
});
exports.default = router;
//# sourceMappingURL=cacheRoutes.js.map
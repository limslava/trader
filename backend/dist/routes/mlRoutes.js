"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const MLPredictionService_1 = require("../services/MLPredictionService");
const RealMLPredictionService_1 = require("../services/RealMLPredictionService");
const router = express_1.default.Router();
router.get('/prediction/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { timeframe = '1d' } = req.query;
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'Не указан символ актива'
            });
        }
        const prediction = await MLPredictionService_1.mlPredictionService.getPrediction(symbol.toUpperCase(), timeframe);
        if (!prediction) {
            return res.status(404).json({
                success: false,
                error: `Прогноз для ${symbol} не найден`
            });
        }
        res.json({
            success: true,
            data: prediction
        });
    }
    catch (error) {
        console.error('Ошибка получения ML прогноза:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения ML прогноза'
        });
    }
});
router.get('/real-prediction/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { timeframe = '1d' } = req.query;
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'Не указан символ актива'
            });
        }
        const realMLService = new RealMLPredictionService_1.RealMLPredictionService();
        const prediction = await realMLService.getPrediction(symbol.toUpperCase(), timeframe);
        if (!prediction) {
            return res.status(404).json({
                success: false,
                error: `Реальный прогноз для ${symbol} не найден`
            });
        }
        res.json({
            success: true,
            data: prediction,
            metadata: {
                type: 'REAL_ML_PREDICTION',
                algorithm: 'Enhanced Technical Analysis',
                features: ['RSI', 'MACD', 'Moving Averages', 'Volume Analysis', 'Pattern Recognition'],
                cacheStatus: 'ACTIVE'
            }
        });
    }
    catch (error) {
        console.error('Ошибка получения реального ML прогноза:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения реального ML прогноза'
        });
    }
});
router.get('/patterns/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'Не указан символ актива'
            });
        }
        const patterns = await MLPredictionService_1.mlPredictionService.getTechnicalPatterns(symbol.toUpperCase());
        res.json({
            success: true,
            data: {
                symbol: symbol.toUpperCase(),
                patterns,
                count: patterns.length,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Ошибка получения технических паттернов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения технических паттернов'
        });
    }
});
router.get('/sentiment/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'Не указан символ актива'
            });
        }
        const sentiment = await MLPredictionService_1.mlPredictionService.analyzeSentiment(symbol.toUpperCase());
        res.json({
            success: true,
            data: {
                symbol: symbol.toUpperCase(),
                sentiment,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Ошибка анализа сентимента:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка анализа сентимента'
        });
    }
});
router.get('/recommendations/beginner', async (req, res) => {
    try {
        const recommendations = await MLPredictionService_1.mlPredictionService.getBeginnerRecommendations();
        res.json({
            success: true,
            data: {
                recommendations,
                count: recommendations.length,
                timestamp: new Date().toISOString(),
                description: 'ML рекомендации для начинающих трейдеров (фильтр по уверенности > 60%)'
            }
        });
    }
    catch (error) {
        console.error('Ошибка получения ML рекомендаций:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения ML рекомендаций'
        });
    }
});
router.get('/analysis/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { timeframe = '1d' } = req.query;
        if (!symbol) {
            return res.status(400).json({
                success: false,
                error: 'Не указан символ актива'
            });
        }
        const upperSymbol = symbol.toUpperCase();
        const [prediction, patterns, sentiment] = await Promise.all([
            MLPredictionService_1.mlPredictionService.getPrediction(upperSymbol, timeframe),
            MLPredictionService_1.mlPredictionService.getTechnicalPatterns(upperSymbol),
            MLPredictionService_1.mlPredictionService.analyzeSentiment(upperSymbol)
        ]);
        const analysis = {
            symbol: upperSymbol,
            timeframe,
            prediction,
            technicalAnalysis: {
                patterns,
                patternCount: patterns.length,
                bullishPatterns: patterns.filter(p => p.direction === 'BULLISH').length,
                bearishPatterns: patterns.filter(p => p.direction === 'BEARISH').length,
                neutralPatterns: patterns.filter(p => p.direction === 'NEUTRAL').length
            },
            sentimentAnalysis: sentiment,
            overallScore: calculateOverallScore(prediction, patterns, sentiment),
            timestamp: new Date().toISOString()
        };
        res.json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        console.error('Ошибка расширенного анализа:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка расширенного анализа'
        });
    }
});
router.delete('/cache', async (req, res) => {
    try {
        const { symbol } = req.query;
        if (symbol) {
            await MLPredictionService_1.mlPredictionService.invalidateMLCache(symbol);
            res.json({
                success: true,
                message: `ML кэш для ${symbol} очищен`,
                data: { symbol }
            });
        }
        else {
            await MLPredictionService_1.mlPredictionService.invalidateMLCache();
            res.json({
                success: true,
                message: 'Весь ML кэш очищен',
                data: { timestamp: new Date().toISOString() }
            });
        }
    }
    catch (error) {
        console.error('Ошибка очистки ML кэша:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка очистки ML кэша'
        });
    }
});
router.get('/status', async (req, res) => {
    try {
        const testPrediction = await MLPredictionService_1.mlPredictionService.getPrediction('SBER', '1d');
        res.json({
            success: true,
            data: {
                status: 'ACTIVE',
                service: 'ML Prediction Service',
                version: '1.0.0',
                testPrediction: testPrediction ? 'OK' : 'ERROR',
                timestamp: new Date().toISOString(),
                features: [
                    'ML прогнозы цен',
                    'Анализ технических паттернов',
                    'Сентимент анализ',
                    'Рекомендации для начинающих',
                    'Кэширование результатов'
                ]
            }
        });
    }
    catch (error) {
        console.error('Ошибка проверки статуса ML сервиса:', error);
        res.status(500).json({
            success: false,
            error: 'ML сервис недоступен'
        });
    }
});
function calculateOverallScore(prediction, patterns, sentiment) {
    if (!prediction)
        return 0;
    let score = prediction.confidence / 100 * 0.5;
    const patternScore = patterns.reduce((sum, pattern) => {
        return sum + (pattern.strength * pattern.probability *
            (pattern.direction === 'BULLISH' ? 1 : pattern.direction === 'BEARISH' ? -1 : 0));
    }, 0) / Math.max(patterns.length, 1);
    score += patternScore * 0.3;
    score += sentiment.overall * 0.2;
    return Math.max(-1, Math.min(1, score));
}
exports.default = router;
//# sourceMappingURL=mlRoutes.js.map
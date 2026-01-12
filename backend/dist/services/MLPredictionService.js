"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlPredictionService = exports.MLPredictionService = void 0;
const MemoryCacheService_1 = require("./MemoryCacheService");
class MLPredictionService {
    constructor() {
        this.cacheTtl = 300;
    }
    async getPrediction(symbol, timeframe = '1d') {
        const cacheKey = `ml_prediction:${symbol}:${timeframe}`;
        const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
        if (cached) {
            console.log(`🤖 ML прогноз ${symbol} (${timeframe}) получен из кэша`);
            return cached;
        }
        const prediction = await this.generateMLPrediction(symbol, timeframe);
        if (!prediction) {
            return null;
        }
        await MemoryCacheService_1.memoryCacheService.set(cacheKey, prediction, { ttl: this.cacheTtl });
        console.log(`🤖 ML прогноз ${symbol} (${timeframe}) сохранен в кэш`);
        return prediction;
    }
    async getTechnicalPatterns(symbol) {
        const cacheKey = `technical_patterns:${symbol}`;
        const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
        if (cached) {
            console.log(`📈 Технические паттерны ${symbol} получены из кэша`);
            return cached;
        }
        const patterns = await this.analyzeTechnicalPatterns(symbol);
        await MemoryCacheService_1.memoryCacheService.set(cacheKey, patterns, { ttl: 600 });
        console.log(`📈 Технические паттерны ${symbol} сохранены в кэш`);
        return patterns;
    }
    async analyzeSentiment(symbol) {
        const cacheKey = `sentiment:${symbol}`;
        const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
        if (cached) {
            console.log(`🎭 Сентимент анализ ${symbol} получен из кэша`);
            return cached;
        }
        const sentiment = await this.calculateSentiment(symbol);
        await MemoryCacheService_1.memoryCacheService.set(cacheKey, sentiment, { ttl: 900 });
        console.log(`🎭 Сентимент анализ ${symbol} сохранен в кэш`);
        return sentiment;
    }
    async getBeginnerRecommendations() {
        const cacheKey = 'ml_recommendations:beginner';
        const cached = await MemoryCacheService_1.memoryCacheService.get(cacheKey);
        if (cached) {
            console.log('🎯 ML рекомендации для начинающих получены из кэша');
            return cached;
        }
        const popularSymbols = ['SBER', 'GAZP', 'LKOH', 'BTCUSDT', 'ETHUSDT'];
        const recommendations = [];
        for (const symbol of popularSymbols) {
            const prediction = await this.getPrediction(symbol, '1d');
            if (prediction && prediction.confidence > 60) {
                recommendations.push(prediction);
            }
        }
        recommendations.sort((a, b) => b.confidence - a.confidence);
        await MemoryCacheService_1.memoryCacheService.set(cacheKey, recommendations, { ttl: 600 });
        console.log('🎯 ML рекомендации для начинающих сохранены в кэш');
        return recommendations;
    }
    async generateMLPrediction(symbol, timeframe) {
        try {
            const basePrice = this.getBasePrice(symbol);
            if (!basePrice)
                return null;
            const technicalScore = this.calculateTechnicalScore(symbol);
            const sentiment = await this.analyzeSentiment(symbol);
            const combinedScore = (technicalScore * 0.6 +
                sentiment.overall * 0.3 +
                sentiment.volume * 0.1);
            let prediction;
            let confidence;
            let riskLevel;
            if (combinedScore > 0.3) {
                prediction = 'BUY';
                confidence = Math.min(95, Math.round((combinedScore + 0.3) * 100));
                riskLevel = combinedScore > 0.6 ? 'LOW' : 'MEDIUM';
            }
            else if (combinedScore < -0.3) {
                prediction = 'SELL';
                confidence = Math.min(95, Math.round((Math.abs(combinedScore) + 0.3) * 100));
                riskLevel = combinedScore < -0.6 ? 'LOW' : 'MEDIUM';
            }
            else {
                prediction = 'HOLD';
                confidence = Math.round((0.5 - Math.abs(combinedScore)) * 100);
                riskLevel = 'MEDIUM';
            }
            const volatility = this.getVolatility(symbol);
            const predictedChange = combinedScore * volatility * 0.1;
            const predictedPrice = basePrice * (1 + predictedChange);
            const reasoning = this.generateReasoning(symbol, prediction, technicalScore, sentiment);
            return {
                symbol,
                prediction,
                confidence,
                predictedPrice: Number(predictedPrice.toFixed(2)),
                predictedChange: Number((predictedChange * 100).toFixed(2)),
                timeframe: timeframe,
                reasoning,
                riskLevel,
                timestamp: new Date()
            };
        }
        catch (error) {
            console.error(`Ошибка генерации ML прогноза для ${symbol}:`, error);
            return null;
        }
    }
    async analyzeTechnicalPatterns(symbol) {
        const patterns = [];
        const possiblePatterns = [
            { name: 'Поддержка', direction: 'BULLISH' },
            { name: 'Сопротивление', direction: 'BEARISH' },
            { name: 'Двойное дно', direction: 'BULLISH' },
            { name: 'Голова и плечи', direction: 'BEARISH' },
            { name: 'Треугольник', direction: 'NEUTRAL' },
            { name: 'Флаг', direction: 'BULLISH' },
            { name: 'Вымпел', direction: 'NEUTRAL' }
        ];
        const numPatterns = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < numPatterns; i++) {
            const pattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];
            const selectedPattern = possiblePatterns[Math.floor(Math.random() * possiblePatterns.length)];
            if (selectedPattern) {
                patterns.push({
                    name: selectedPattern.name,
                    direction: selectedPattern.direction,
                    strength: Math.random() * 0.5 + 0.5,
                    timeframe: ['1h', '4h', '1d'][Math.floor(Math.random() * 3)],
                    probability: Math.random() * 0.3 + 0.7
                });
            }
        }
        return patterns;
    }
    async calculateSentiment(symbol) {
        const baseScore = Math.random() * 0.4 - 0.2;
        return {
            overall: baseScore,
            news: baseScore + (Math.random() * 0.2 - 0.1),
            social: baseScore + (Math.random() * 0.3 - 0.15),
            technical: baseScore + (Math.random() * 0.4 - 0.2),
            volume: Math.random() * 0.5 + 0.5
        };
    }
    getBasePrice(symbol) {
        const basePrices = {
            'SBER': 280,
            'GAZP': 160,
            'LKOH': 7200,
            'VTBR': 0.025,
            'ROSN': 560,
            'BTCUSDT': 35000,
            'ETHUSDT': 1800,
            'BNBUSDT': 230,
            'ADAUSDT': 0.35,
            'DOTUSDT': 4.2
        };
        return basePrices[symbol] || 100;
    }
    calculateTechnicalScore(symbol) {
        return Math.random() * 0.8 - 0.4;
    }
    getVolatility(symbol) {
        const volatilities = {
            'SBER': 0.02,
            'GAZP': 0.015,
            'LKOH': 0.025,
            'BTCUSDT': 0.08,
            'ETHUSDT': 0.06
        };
        return volatilities[symbol] || 0.03;
    }
    generateReasoning(symbol, prediction, technicalScore, sentiment) {
        const reasons = [
            `Технический анализ показывает ${technicalScore > 0 ? 'положительную' : 'отрицательную'} динамику`,
            `Сентимент рынка ${sentiment.overall > 0 ? 'оптимистичный' : 'пессимистичный'}`,
            `Объем торгов ${sentiment.volume > 0.7 ? 'выше среднего' : 'в пределах нормы'}`,
            `Новостной фон ${sentiment.news > 0 ? 'благоприятный' : 'негативный'}`,
            `Социальные настроения ${sentiment.social > 0 ? 'позитивные' : 'осторожные'}`
        ];
        return reasons.slice(0, 3).join('. ') + '.';
    }
    async invalidateMLCache(symbol) {
        if (symbol) {
            const patterns = [
                `ml_prediction:${symbol}:*`,
                `technical_patterns:${symbol}`,
                `sentiment:${symbol}`
            ];
            for (const pattern of patterns) {
                await MemoryCacheService_1.memoryCacheService.clearPattern(pattern);
            }
            console.log(`🗑️ ML кэш для ${symbol} очищен`);
        }
        else {
            await MemoryCacheService_1.memoryCacheService.clearPattern('ml_prediction:*');
            await MemoryCacheService_1.memoryCacheService.clearPattern('technical_patterns:*');
            await MemoryCacheService_1.memoryCacheService.clearPattern('sentiment:*');
            await MemoryCacheService_1.memoryCacheService.clearPattern('ml_recommendations:*');
            console.log('🗑️ Весь ML кэш очищен');
        }
    }
}
exports.MLPredictionService = MLPredictionService;
exports.mlPredictionService = new MLPredictionService();
//# sourceMappingURL=MLPredictionService.js.map
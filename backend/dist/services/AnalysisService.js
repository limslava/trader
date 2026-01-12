"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisService = void 0;
const MarketDataService_1 = require("./MarketDataService");
var Recommendation;
(function (Recommendation) {
    Recommendation["STRONG_BUY"] = "STRONG_BUY";
    Recommendation["BUY"] = "BUY";
    Recommendation["HOLD"] = "HOLD";
    Recommendation["SELL"] = "SELL";
    Recommendation["STRONG_SELL"] = "STRONG_SELL";
})(Recommendation || (Recommendation = {}));
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["VERY_LOW"] = "VERY_LOW";
    RiskLevel["LOW"] = "LOW";
    RiskLevel["MEDIUM"] = "MEDIUM";
    RiskLevel["HIGH"] = "HIGH";
    RiskLevel["VERY_HIGH"] = "VERY_HIGH";
})(RiskLevel || (RiskLevel = {}));
var Signal;
(function (Signal) {
    Signal["STRONG_BUY"] = "STRONG_BUY";
    Signal["BUY"] = "BUY";
    Signal["NEUTRAL"] = "NEUTRAL";
    Signal["SELL"] = "SELL";
    Signal["STRONG_SELL"] = "STRONG_SELL";
})(Signal || (Signal = {}));
var Rating;
(function (Rating) {
    Rating["EXCELLENT"] = "EXCELLENT";
    Rating["GOOD"] = "GOOD";
    Rating["AVERAGE"] = "AVERAGE";
    Rating["POOR"] = "POOR";
    Rating["VERY_POOR"] = "VERY_POOR";
})(Rating || (Rating = {}));
var RiskFactorType;
(function (RiskFactorType) {
    RiskFactorType["VOLATILITY"] = "VOLATILITY";
    RiskFactorType["LIQUIDITY"] = "LIQUIDITY";
    RiskFactorType["LEVERAGE"] = "LEVERAGE";
    RiskFactorType["MARKET"] = "MARKET";
})(RiskFactorType || (RiskFactorType = {}));
class AnalysisService {
    constructor() {
        this.marketDataService = new MarketDataService_1.MarketDataService();
    }
    async analyzeAsset(symbol) {
        try {
            const priceData = await this.marketDataService.getPrice(symbol);
            const technicalIndicators = await this.marketDataService.getTechnicalIndicators(symbol);
            if (!priceData) {
                throw new Error(`Не удалось получить данные для ${symbol}`);
            }
            const technicalAnalysis = await this.performTechnicalAnalysis(technicalIndicators, priceData);
            const fundamentalAnalysis = await this.performFundamentalAnalysis(symbol);
            const sentimentAnalysis = await this.performSentimentAnalysis(symbol);
            const weightedScore = this.calculateWeightedScore(technicalAnalysis.score, fundamentalAnalysis.score, sentimentAnalysis.score);
            const recommendation = this.generateRecommendation(weightedScore);
            const confidence = this.calculateConfidence(technicalAnalysis, fundamentalAnalysis, sentimentAnalysis);
            const priceTargets = this.calculatePriceTargets(priceData, technicalIndicators, recommendation);
            const riskAssessment = this.assessRisk(symbol, priceData, technicalIndicators);
            const explanation = this.generateExplanation(symbol, recommendation, technicalAnalysis, fundamentalAnalysis, sentimentAnalysis);
            return {
                symbol,
                recommendation: recommendation,
                confidence,
                reasoning: explanation,
                technicalScore: technicalAnalysis.score,
                fundamentalScore: fundamentalAnalysis.score,
                sentimentScore: sentimentAnalysis.score,
                priceTarget: priceTargets.target1,
                stopLoss: priceTargets.stopLoss,
                takeProfit: priceTargets.takeProfit,
                riskLevel: this.mapRiskLevelToSimple(riskAssessment.level),
                timestamp: new Date()
            };
        }
        catch (error) {
            console.error(`Ошибка анализа актива ${symbol}:`, error);
            return null;
        }
    }
    async performTechnicalAnalysis(indicators, priceData) {
        let score = 50;
        if (indicators) {
            if (indicators.rsi) {
                if (indicators.rsi < 30)
                    score += 20;
                else if (indicators.rsi > 70)
                    score -= 20;
                else if (indicators.rsi > 40 && indicators.rsi < 60)
                    score += 10;
            }
            if (indicators.macd) {
                if (indicators.macd.macd > indicators.macd.signal)
                    score += 15;
                else
                    score -= 10;
            }
            if (indicators.movingAverages) {
                const { sma20, sma50, sma200 } = indicators.movingAverages;
                if (sma20 > sma50 && sma50 > sma200)
                    score += 20;
                else if (sma20 < sma50 && sma50 < sma200)
                    score -= 15;
            }
        }
        score = Math.max(0, Math.min(100, score));
        return {
            score,
            indicators: {
                rsi: { value: indicators?.rsi || 50, signal: this.getRSISignal(indicators?.rsi), weight: 0.3 },
                macd: { value: indicators?.macd?.macd || 0, signal: this.getMACDSignal(indicators?.macd), weight: 0.25 },
                movingAverages: { value: this.getMAScore(indicators?.movingAverages), signal: this.getMASignal(indicators?.movingAverages), weight: 0.25 },
                supportResistance: { value: this.getSupportResistanceScore(priceData, indicators), signal: Signal.NEUTRAL, weight: 0.1 },
                volume: { value: this.getVolumeScore(priceData), signal: Signal.NEUTRAL, weight: 0.1 }
            },
            trend: this.determineTrend(indicators),
            momentum: this.determineMomentum(indicators)
        };
    }
    async performFundamentalAnalysis(symbol) {
        const baseScore = 60 + (Math.random() - 0.5) * 20;
        return {
            score: Math.max(0, Math.min(100, baseScore)),
            metrics: {
                peRatio: { value: 15 + (Math.random() - 0.5) * 10, rating: this.getPERating(15), weight: 0.3 },
                dividendYield: { value: 5 + (Math.random() - 0.5) * 4, rating: this.getDividendRating(5), weight: 0.2 },
                marketCap: { value: 1000000000 + Math.random() * 9000000000, rating: Rating.GOOD, weight: 0.2 },
                revenueGrowth: { value: 10 + (Math.random() - 0.5) * 15, rating: Rating.GOOD, weight: 0.15 },
                profitMargin: { value: 15 + (Math.random() - 0.5) * 10, rating: Rating.GOOD, weight: 0.15 }
            },
            sectorComparison: 50 + (Math.random() - 0.5) * 30
        };
    }
    async performSentimentAnalysis(symbol) {
        const newsSentiment = (Math.random() - 0.5) * 100;
        const socialSentiment = (Math.random() - 0.5) * 80;
        const marketSentiment = (Math.random() - 0.5) * 60;
        const score = (newsSentiment + socialSentiment + marketSentiment) / 3 + 50;
        return {
            score: Math.max(0, Math.min(100, score)),
            newsSentiment,
            socialSentiment,
            marketSentiment,
            recentNews: [
                {
                    title: 'Компания показывает стабильный рост',
                    source: 'RBC',
                    publishedAt: new Date(Date.now() - 3600000),
                    sentiment: 70
                },
                {
                    title: 'Аналитики повышают целевые цены',
                    source: 'Коммерсант',
                    publishedAt: new Date(Date.now() - 7200000),
                    sentiment: 80
                }
            ]
        };
    }
    calculateWeightedScore(technical, fundamental, sentiment) {
        return technical * 0.4 + fundamental * 0.3 + sentiment * 0.3;
    }
    generateRecommendation(weightedScore) {
        if (weightedScore >= 80)
            return Recommendation.STRONG_BUY;
        if (weightedScore >= 65)
            return Recommendation.BUY;
        if (weightedScore >= 45)
            return Recommendation.HOLD;
        if (weightedScore >= 30)
            return Recommendation.SELL;
        return Recommendation.STRONG_SELL;
    }
    calculateConfidence(technical, fundamental, sentiment) {
        const technicalConfidence = Math.abs(technical.score - 50) / 50 * 100;
        const fundamentalConfidence = Math.abs(fundamental.score - 50) / 50 * 100;
        const sentimentConfidence = Math.abs(sentiment.score - 50) / 50 * 100;
        return (technicalConfidence * 0.4 + fundamentalConfidence * 0.3 + sentimentConfidence * 0.3);
    }
    getRSISignal(rsi) {
        if (!rsi)
            return 'NEUTRAL';
        if (rsi < 30)
            return 'STRONG_BUY';
        if (rsi < 40)
            return 'BUY';
        if (rsi > 70)
            return 'STRONG_SELL';
        if (rsi > 60)
            return 'SELL';
        return 'NEUTRAL';
    }
    getMACDSignal(macd) {
        if (!macd)
            return 'NEUTRAL';
        return macd.macd > macd.signal ? 'BUY' : 'SELL';
    }
    getMAScore(ma) {
        if (!ma)
            return 50;
        return (ma.sma20 > ma.sma50 && ma.sma50 > ma.sma200) ? 80 : 40;
    }
    getMASignal(ma) {
        if (!ma)
            return 'NEUTRAL';
        return (ma.sma20 > ma.sma50 && ma.sma50 > ma.sma200) ? 'BUY' : 'SELL';
    }
    getSupportResistanceScore(priceData, indicators) {
        return 50;
    }
    getVolumeScore(priceData) {
        return priceData.volume > 500000 ? 70 : 50;
    }
    determineTrend(indicators) {
        if (!indicators?.movingAverages)
            return 'SIDEWAYS';
        const { sma20, sma50, sma200 } = indicators.movingAverages;
        if (sma20 > sma50 && sma50 > sma200)
            return 'STRONG_UP';
        if (sma20 > sma50)
            return 'UP';
        if (sma20 < sma50 && sma50 < sma200)
            return 'STRONG_DOWN';
        if (sma20 < sma50)
            return 'DOWN';
        return 'SIDEWAYS';
    }
    determineMomentum(indicators) {
        if (!indicators?.macd)
            return 'NEUTRAL';
        return indicators.macd.macd > indicators.macd.signal ? 'BULLISH' : 'BEARISH';
    }
    getPERating(pe) {
        if (pe < 10)
            return 'EXCELLENT';
        if (pe < 15)
            return 'GOOD';
        if (pe < 20)
            return 'AVERAGE';
        if (pe < 25)
            return 'POOR';
        return 'VERY_POOR';
    }
    getDividendRating(dividend) {
        if (dividend > 8)
            return 'EXCELLENT';
        if (dividend > 6)
            return 'GOOD';
        if (dividend > 4)
            return 'AVERAGE';
        if (dividend > 2)
            return 'POOR';
        return 'VERY_POOR';
    }
    calculatePriceTargets(priceData, indicators, recommendation) {
        const currentPrice = priceData.price;
        let stopLoss, takeProfit, target1, target2, target3;
        switch (recommendation) {
            case Recommendation.STRONG_BUY:
            case Recommendation.BUY:
                stopLoss = currentPrice * 0.95;
                takeProfit = currentPrice * 1.1;
                target1 = currentPrice * 1.05;
                target2 = currentPrice * 1.08;
                target3 = currentPrice * 1.12;
                break;
            case Recommendation.SELL:
            case Recommendation.STRONG_SELL:
                stopLoss = currentPrice * 1.05;
                takeProfit = currentPrice * 0.9;
                target1 = currentPrice * 0.95;
                target2 = currentPrice * 0.92;
                target3 = currentPrice * 0.88;
                break;
            default:
                stopLoss = currentPrice * 0.98;
                takeProfit = currentPrice * 1.02;
                target1 = currentPrice;
                target2 = currentPrice;
                target3 = currentPrice;
        }
        return {
            stopLoss: Math.round(stopLoss * 100) / 100,
            takeProfit: Math.round(takeProfit * 100) / 100,
            target1: Math.round(target1 * 100) / 100,
            target2: Math.round(target2 * 100) / 100,
            target3: Math.round(target3 * 100) / 100
        };
    }
    assessRisk(symbol, priceData, indicators) {
        const volatility = Math.abs(priceData.changePercent);
        let riskScore = 30;
        if (volatility > 8)
            riskScore += 40;
        else if (volatility > 5)
            riskScore += 30;
        else if (volatility > 3)
            riskScore += 20;
        else if (volatility > 1)
            riskScore += 10;
        if (priceData.volume < 50000)
            riskScore += 25;
        else if (priceData.volume < 200000)
            riskScore += 15;
        else if (priceData.volume < 500000)
            riskScore += 5;
        const isCrypto = symbol.includes('USDT');
        if (isCrypto)
            riskScore += 15;
        if (indicators?.rsi) {
            if (indicators.rsi < 20 || indicators.rsi > 80)
                riskScore += 10;
        }
        riskScore = Math.max(10, Math.min(100, riskScore));
        let riskLevel;
        if (riskScore >= 75)
            riskLevel = RiskLevel.VERY_HIGH;
        else if (riskScore >= 60)
            riskLevel = RiskLevel.HIGH;
        else if (riskScore >= 40)
            riskLevel = RiskLevel.MEDIUM;
        else if (riskScore >= 25)
            riskLevel = RiskLevel.LOW;
        else
            riskLevel = RiskLevel.VERY_LOW;
        return {
            level: riskLevel,
            score: riskScore,
            factors: [
                { type: RiskFactorType.VOLATILITY, description: `Волатильность: ${volatility.toFixed(2)}%`, impact: Math.min(volatility * 8, 100) },
                { type: RiskFactorType.LIQUIDITY, description: `Объем: ${priceData.volume.toLocaleString()}`, impact: priceData.volume < 100000 ? 70 : 30 },
                { type: RiskFactorType.MARKET, description: `Тип: ${isCrypto ? 'Криптовалюта' : 'Акция'}`, impact: isCrypto ? 60 : 20 }
            ],
            maxPositionSize: Math.max(1, 5 - (riskScore - 30) / 15)
        };
    }
    mapRiskLevelToSimple(riskLevel) {
        switch (riskLevel) {
            case RiskLevel.VERY_LOW:
            case RiskLevel.LOW:
                return 'LOW';
            case RiskLevel.MEDIUM:
                return 'MEDIUM';
            case RiskLevel.HIGH:
            case RiskLevel.VERY_HIGH:
                return 'HIGH';
            default:
                return 'MEDIUM';
        }
    }
    generateExplanation(symbol, recommendation, technical, fundamental, sentiment) {
        const reasons = [];
        if (technical.score > 60)
            reasons.push('технические индикаторы показывают позитивную динамику');
        else if (technical.score < 40)
            reasons.push('технические индикаторы демонстрируют слабость');
        if (fundamental.score > 60)
            reasons.push('фундаментальные показатели выглядят привлекательно');
        else if (fundamental.score < 40)
            reasons.push('фундаментальные показатели вызывают опасения');
        if (sentiment.score > 60)
            reasons.push('рыночные настроения позитивные');
        else if (sentiment.score < 40)
            reasons.push('рыночные настроения негативные');
        const reasonText = reasons.length > 0 ? reasons.join(', ') : 'рынок находится в нейтральной зоне';
        return `Для актива ${symbol} рекомендуется ${this.getRecommendationText(recommendation)}. ${reasonText.charAt(0).toUpperCase() + reasonText.slice(1)}.`;
    }
    getRecommendationText(recommendation) {
        switch (recommendation) {
            case Recommendation.STRONG_BUY: return 'сильная покупка';
            case Recommendation.BUY: return 'покупка';
            case Recommendation.HOLD: return 'удержание';
            case Recommendation.SELL: return 'продажа';
            case Recommendation.STRONG_SELL: return 'сильная продажа';
            default: return 'нейтральная позиция';
        }
    }
}
exports.AnalysisService = AnalysisService;
//# sourceMappingURL=AnalysisService.js.map
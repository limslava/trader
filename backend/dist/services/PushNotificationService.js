"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushNotificationService = void 0;
class PushNotificationService {
    constructor(webSocketService, marketDataService, analysisService, riskManagementService) {
        this.webSocketService = webSocketService;
        this.marketDataService = marketDataService;
        this.analysisService = analysisService;
        this.riskManagementService = riskManagementService;
        this.setupNotificationTriggers();
    }
    setupNotificationTriggers() {
        this.setupPriceAlertTriggers();
        this.setupAnalysisTriggers();
        this.setupRiskTriggers();
    }
    setupPriceAlertTriggers() {
        setInterval(async () => {
            await this.checkMarketPriceAlerts();
        }, 30000);
    }
    setupAnalysisTriggers() {
        setInterval(async () => {
            await this.checkAnalysisAlerts();
        }, 60000);
    }
    setupRiskTriggers() {
        setInterval(async () => {
            await this.checkRiskAlerts();
        }, 45000);
    }
    async checkMarketPriceAlerts() {
        try {
            const popularAssets = ['SBER', 'GAZP', 'LKOH', 'BTCUSDT', 'ETHUSDT'];
            for (const symbol of popularAssets) {
                const priceData = await this.marketDataService.getPrice(symbol);
                if (priceData) {
                    await this.checkPriceAlertsForSymbol({
                        symbol,
                        price: priceData.price,
                        changePercent: priceData.changePercent,
                        volume: priceData.volume
                    });
                }
            }
        }
        catch (error) {
            console.error('Ошибка проверки рыночных алертов:', error);
        }
    }
    async checkAnalysisAlerts() {
        try {
            const symbols = ['SBER', 'GAZP', 'BTCUSDT'];
            for (const symbol of symbols) {
                const analysis = await this.analysisService.analyzeAsset(symbol);
                if (analysis) {
                    await this.checkAnalysisAlertsForSymbol(symbol, analysis);
                }
            }
        }
        catch (error) {
            console.error('Ошибка проверки алертов анализа:', error);
        }
    }
    async checkRiskAlerts() {
        try {
            const testUserId = 'test-user-123';
            const riskAssessment = await this.riskManagementService.assessPortfolioRisk(testUserId);
            if (riskAssessment.warnings.length > 0) {
                for (const warning of riskAssessment.warnings) {
                    await this.checkRiskAlertsForWarning(warning);
                }
            }
        }
        catch (error) {
            console.error('Ошибка проверки рисковых алертов:', error);
        }
    }
    async checkPriceAlertsForSymbol(data) {
        const { symbol, price, changePercent, volume } = data;
        if (Math.abs(changePercent) > 5) {
            const direction = changePercent > 0 ? 'рост' : 'падение';
            const notification = {
                symbol,
                type: 'price_alert',
                title: `Значительное изменение цены: ${symbol}`,
                body: `${symbol}: ${direction} на ${Math.abs(changePercent).toFixed(2)}% до ${price}`,
                priority: 'high',
                data: {
                    symbol,
                    currentPrice: price,
                    changePercent,
                    volume,
                    alertType: 'price_movement'
                }
            };
            await this.triggerNotification(notification);
        }
        const avgVolume = await this.getAverageVolume(symbol);
        if (volume > avgVolume * 3) {
            const notification = {
                symbol,
                type: 'price_alert',
                title: `Аномальный объем: ${symbol}`,
                body: `${symbol}: объем торгов в ${(volume / avgVolume).toFixed(1)}x выше среднего`,
                priority: 'medium',
                data: {
                    symbol,
                    currentVolume: volume,
                    averageVolume: avgVolume,
                    volumeRatio: volume / avgVolume,
                    alertType: 'volume_spike'
                }
            };
            await this.triggerNotification(notification);
        }
    }
    async checkAnalysisAlertsForSymbol(symbol, analysis) {
        const { recommendation, confidence, reasoning } = analysis;
        if (confidence > 70) {
            const action = this.getRecommendationAction(recommendation);
            const notification = {
                symbol,
                type: 'recommendation',
                title: `Сильная рекомендация: ${symbol}`,
                body: `${symbol}: ${action} с уверенностью ${confidence}% - ${reasoning}`,
                priority: 'high',
                data: {
                    symbol,
                    recommendation,
                    confidence,
                    reasoning,
                    alertType: 'strong_recommendation'
                }
            };
            await this.triggerNotification(notification);
        }
        const previousAnalysis = await this.getPreviousAnalysis(symbol);
        if (previousAnalysis && previousAnalysis.recommendation !== recommendation) {
            const notification = {
                symbol,
                type: 'recommendation',
                title: `Смена рекомендации: ${symbol}`,
                body: `${symbol}: ${this.getRecommendationAction(previousAnalysis.recommendation)} → ${this.getRecommendationAction(recommendation)}`,
                priority: 'medium',
                data: {
                    symbol,
                    previousRecommendation: previousAnalysis.recommendation,
                    currentRecommendation: recommendation,
                    confidence,
                    alertType: 'recommendation_change'
                }
            };
            await this.triggerNotification(notification);
        }
    }
    async checkRiskAlertsForWarning(warning) {
        const { type, severity, title, description, affectedAsset } = warning;
        if (severity === 'critical') {
            const notification = {
                symbol: affectedAsset || 'PORTFOLIO',
                type: 'risk_alert',
                title: `Высокий риск: ${affectedAsset || 'Портфель'}`,
                body: `${title}: ${description}`,
                priority: 'high',
                data: {
                    symbol: affectedAsset,
                    riskLevel: severity,
                    message: description,
                    alertType: 'high_risk'
                }
            };
            await this.triggerNotification(notification);
        }
        if (type === 'stop_loss_breach' || type === 'position_size') {
            const notification = {
                symbol: affectedAsset || 'PORTFOLIO',
                type: 'risk_alert',
                title: `Превышение лимита риска: ${affectedAsset || 'Портфель'}`,
                body: `${title}: ${description}`,
                priority: 'high',
                data: {
                    symbol: affectedAsset,
                    riskType: type,
                    message: description,
                    alertType: 'risk_limit_exceeded'
                }
            };
            await this.triggerNotification(notification);
        }
    }
    async triggerNotification(notification) {
        try {
            this.webSocketService.broadcastRecommendation({
                symbol: notification.symbol,
                type: 'push_notification',
                title: notification.title,
                message: notification.body,
                priority: notification.priority,
                data: notification.data
            });
            console.log(`Push notification triggered: ${notification.title}`, {
                symbol: notification.symbol,
                type: notification.type,
                priority: notification.priority
            });
        }
        catch (error) {
            console.error('Error triggering push notification:', error);
        }
    }
    getRecommendationAction(recommendation) {
        const actions = {
            'STRONG_BUY': 'СИЛЬНО ПОКУПАТЬ',
            'BUY': 'ПОКУПАТЬ',
            'HOLD': 'ДЕРЖАТЬ',
            'SELL': 'ПРОДАВАТЬ',
            'STRONG_SELL': 'СИЛЬНО ПРОДАВАТЬ'
        };
        return actions[recommendation] || recommendation;
    }
    async getAverageVolume(symbol) {
        const defaultVolumes = {
            'SBER': 1000000,
            'GAZP': 2000000,
            'LKOH': 500000,
            'BTCUSDT': 50000,
            'ETHUSDT': 30000
        };
        return defaultVolumes[symbol] || 100000;
    }
    async getPreviousAnalysis(symbol) {
        return null;
    }
    async sendManualNotification(notification) {
        const fullNotification = {
            ...notification,
            type: 'price_alert'
        };
        await this.triggerNotification(fullNotification);
    }
}
exports.PushNotificationService = PushNotificationService;
//# sourceMappingURL=PushNotificationService.js.map
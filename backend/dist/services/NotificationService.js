"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const MarketDataService_1 = require("./MarketDataService");
const RiskManagementService_1 = require("./RiskManagementService");
const PortfolioService_1 = require("./PortfolioService");
class NotificationService {
    constructor() {
        this.notifications = new Map();
        this.priceAlerts = new Map();
        this.marketDataService = new MarketDataService_1.MarketDataService();
        this.riskManagementService = new RiskManagementService_1.RiskManagementService();
        this.portfolioService = new PortfolioService_1.PortfolioService();
    }
    async getUserNotifications(userId) {
        const userNotifications = this.notifications.get(userId) || [];
        const validNotifications = userNotifications.filter(notification => !notification.expiresAt || notification.expiresAt > new Date());
        this.notifications.set(userId, validNotifications);
        return validNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async createNotification(userId, notification) {
        const newNotification = {
            id: this.generateId(),
            userId,
            ...notification,
            read: false,
            createdAt: new Date(),
        };
        const userNotifications = this.notifications.get(userId) || [];
        userNotifications.push(newNotification);
        this.notifications.set(userId, userNotifications);
        return newNotification;
    }
    async markAsRead(userId, notificationId) {
        const userNotifications = this.notifications.get(userId);
        if (userNotifications) {
            const notification = userNotifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
            }
        }
    }
    async deleteNotification(userId, notificationId) {
        const userNotifications = this.notifications.get(userId);
        if (userNotifications) {
            const filtered = userNotifications.filter(n => n.id !== notificationId);
            this.notifications.set(userId, filtered);
        }
    }
    async createPriceAlert(userId, alert) {
        const newAlert = {
            ...alert,
            triggered: false,
        };
        const userAlerts = this.priceAlerts.get(userId) || [];
        userAlerts.push(newAlert);
        this.priceAlerts.set(userId, userAlerts);
        return newAlert;
    }
    async getUserPriceAlerts(userId) {
        return this.priceAlerts.get(userId) || [];
    }
    async deletePriceAlert(userId, assetSymbol) {
        const userAlerts = this.priceAlerts.get(userId);
        if (userAlerts) {
            const filtered = userAlerts.filter(alert => alert.assetSymbol !== assetSymbol);
            this.priceAlerts.set(userId, filtered);
        }
    }
    async checkRiskNotifications(userId) {
        try {
            const riskAssessment = await this.riskManagementService.assessPortfolioRisk(userId);
            const criticalWarnings = riskAssessment.warnings.filter(w => w.severity === 'critical');
            for (const warning of criticalWarnings) {
                await this.createNotification(userId, {
                    type: 'risk_warning',
                    title: `Критическое предупреждение: ${warning.title}`,
                    message: warning.description,
                    severity: 'error',
                    data: warning,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                });
            }
            const highPriorityRecommendations = riskAssessment.recommendations.filter(r => r.priority === 'high');
            for (const recommendation of highPriorityRecommendations) {
                await this.createNotification(userId, {
                    type: 'risk_warning',
                    title: `Важная рекомендация: ${recommendation.title}`,
                    message: recommendation.description,
                    severity: 'warning',
                    data: recommendation,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                });
            }
            if (riskAssessment.diversificationScore < 0.5) {
                await this.createNotification(userId, {
                    type: 'portfolio_change',
                    title: 'Низкая диверсификация портфеля',
                    message: `Уровень диверсификации: ${Math.round(riskAssessment.diversificationScore * 100)}%. Рекомендуется добавить больше активов.`,
                    severity: 'warning',
                    data: { diversificationScore: riskAssessment.diversificationScore },
                    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                });
            }
        }
        catch (error) {
            console.error('Ошибка проверки уведомлений рисков:', error);
        }
    }
    async checkPriceAlerts(userId) {
        try {
            const userAlerts = this.priceAlerts.get(userId) || [];
            const alertSymbols = userAlerts.map(alert => alert.assetSymbol);
            const priceData = await this.marketDataService.getMultiplePrices(alertSymbols);
            for (const alert of userAlerts) {
                if (alert.triggered)
                    continue;
                const currentPriceData = priceData.get(alert.assetSymbol);
                if (!currentPriceData)
                    continue;
                const currentPrice = currentPriceData.price;
                let shouldTrigger = false;
                switch (alert.condition) {
                    case 'above':
                        shouldTrigger = currentPrice > alert.threshold;
                        break;
                    case 'below':
                        shouldTrigger = currentPrice < alert.threshold;
                        break;
                    case 'change_percent':
                        const changePercent = Math.abs((currentPrice - alert.currentPrice) / alert.currentPrice * 100);
                        shouldTrigger = changePercent >= alert.threshold;
                        break;
                }
                if (shouldTrigger) {
                    alert.triggered = true;
                    await this.createNotification(userId, {
                        type: 'price_alert',
                        title: `Алерт по цене: ${alert.assetSymbol}`,
                        message: this.getPriceAlertMessage(alert, currentPrice),
                        severity: 'info',
                        data: { alert, currentPrice },
                        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    });
                }
            }
            this.priceAlerts.set(userId, userAlerts);
        }
        catch (error) {
            console.error('Ошибка проверки алертов по ценам:', error);
        }
    }
    async checkPortfolioChanges(userId) {
        try {
            const portfolio = await this.portfolioService.getPortfolio(userId);
            for (const position of portfolio.positions) {
                if (Math.abs(position.profitLossPercentage) > 10) {
                    const isProfit = position.profitLossPercentage > 0;
                    await this.createNotification(userId, {
                        type: 'portfolio_change',
                        title: `${isProfit ? 'Прибыль' : 'Убыток'} по позиции: ${position.assetSymbol}`,
                        message: `${position.assetSymbol}: ${isProfit ? '+' : ''}${position.profitLossPercentage.toFixed(1)}% (${isProfit ? '+' : ''}${position.profitLoss.toFixed(0)} руб.)`,
                        severity: isProfit ? 'success' : 'error',
                        data: position,
                        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
                    });
                }
            }
        }
        catch (error) {
            console.error('Ошибка проверки изменений портфеля:', error);
        }
    }
    async checkAllNotifications(userId) {
        await Promise.all([
            this.checkRiskNotifications(userId),
            this.checkPriceAlerts(userId),
            this.checkPortfolioChanges(userId),
        ]);
    }
    getPriceAlertMessage(alert, currentPrice) {
        switch (alert.condition) {
            case 'above':
                return `${alert.assetSymbol} достиг цены ${currentPrice.toFixed(2)}, что выше порога ${alert.threshold.toFixed(2)}`;
            case 'below':
                return `${alert.assetSymbol} достиг цены ${currentPrice.toFixed(2)}, что ниже порога ${alert.threshold.toFixed(2)}`;
            case 'change_percent':
                const changePercent = ((currentPrice - alert.currentPrice) / alert.currentPrice * 100).toFixed(1);
                return `${alert.assetSymbol} изменился на ${changePercent}% с ${alert.currentPrice.toFixed(2)} до ${currentPrice.toFixed(2)}`;
            default:
                return `Алерт по ${alert.assetSymbol} сработал`;
        }
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    async cleanupOldNotifications() {
        const now = new Date();
        for (const [userId, notifications] of this.notifications.entries()) {
            const validNotifications = notifications.filter(notification => !notification.expiresAt || notification.expiresAt > now);
            this.notifications.set(userId, validNotifications);
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=NotificationService.js.map
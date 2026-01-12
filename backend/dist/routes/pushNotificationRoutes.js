"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PushNotificationService_1 = require("../services/PushNotificationService");
const WebSocketService_1 = require("../services/WebSocketService");
const MarketDataService_1 = require("../services/MarketDataService");
const AnalysisService_1 = require("../services/AnalysisService");
const RiskManagementService_1 = require("../services/RiskManagementService");
const router = express_1.default.Router();
const webSocketService = new WebSocketService_1.WebSocketService();
const marketDataService = new MarketDataService_1.MarketDataService();
const analysisService = new AnalysisService_1.AnalysisService();
const riskManagementService = new RiskManagementService_1.RiskManagementService();
const pushNotificationService = new PushNotificationService_1.PushNotificationService(webSocketService, marketDataService, analysisService, riskManagementService);
router.post('/test', async (req, res) => {
    try {
        const { type, symbol, message } = req.body;
        let notification;
        switch (type) {
            case 'price_alert':
                notification = {
                    symbol: symbol || 'SBER',
                    title: 'Тестовое уведомление о цене',
                    body: message || `Акция ${symbol || 'SBER'} показала значительное изменение`,
                    priority: 'high',
                    data: {
                        symbol: symbol || 'SBER',
                        currentPrice: 280.50,
                        changePercent: 5.2,
                        alertType: 'test_price_movement'
                    }
                };
                break;
            case 'recommendation':
                notification = {
                    symbol: symbol || 'GAZP',
                    title: 'Тестовая рекомендация',
                    body: message || `Рекомендация для ${symbol || 'GAZP'}: ПОКУПАТЬ с уверенностью 85%`,
                    priority: 'medium',
                    data: {
                        symbol: symbol || 'GAZP',
                        recommendation: 'BUY',
                        confidence: 85,
                        alertType: 'test_recommendation'
                    }
                };
                break;
            case 'risk_alert':
                notification = {
                    symbol: symbol || 'PORTFOLIO',
                    title: 'Тестовое предупреждение о риске',
                    body: message || 'Обнаружен высокий уровень риска в портфеле',
                    priority: 'high',
                    data: {
                        symbol: symbol || 'PORTFOLIO',
                        riskLevel: 'HIGH',
                        alertType: 'test_risk_warning'
                    }
                };
                break;
            default:
                notification = {
                    symbol: 'TEST',
                    title: 'Тестовое уведомление',
                    body: message || 'Это тестовое push-уведомление',
                    priority: 'low',
                    data: {
                        alertType: 'test_general'
                    }
                };
        }
        await pushNotificationService.sendManualNotification(notification);
        res.json({
            success: true,
            message: 'Тестовое уведомление отправлено',
            notification
        });
    }
    catch (error) {
        console.error('Ошибка отправки тестового уведомления:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось отправить тестовое уведомление'
        });
    }
});
router.get('/status', (req, res) => {
    res.json({
        pushNotifications: {
            enabled: true,
            service: 'WebSocket + Browser Notifications',
            features: [
                'Price alerts (>5% changes)',
                'Volume spike alerts',
                'Strong recommendations (>70% confidence)',
                'Risk warnings',
                'Portfolio alerts'
            ],
            monitoring: {
                priceChecks: 'Every 30 seconds',
                analysisChecks: 'Every minute',
                riskChecks: 'Every 45 seconds'
            }
        }
    });
});
exports.default = router;
//# sourceMappingURL=pushNotificationRoutes.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const RiskManagementService_1 = require("../services/RiskManagementService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
const riskService = new RiskManagementService_1.RiskManagementService();
router.get('/assessment', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const assessment = await riskService.assessPortfolioRisk(userId);
        res.json({
            success: true,
            data: assessment
        });
    }
    catch (error) {
        console.error('Ошибка оценки рисков:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось оценить риски портфеля'
        });
    }
});
router.get('/stop-loss-recommendations', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const recommendations = await riskService.getStopLossRecommendations(userId);
        res.json({
            success: true,
            data: recommendations
        });
    }
    catch (error) {
        console.error('Ошибка получения рекомендаций по стоп-лоссам:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить рекомендации по стоп-лоссам'
        });
    }
});
router.get('/max-position-size', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { riskTolerance } = req.query;
        const userId = req.user.userId;
        const portfolioService = new (await Promise.resolve().then(() => __importStar(require('../services/PortfolioService')))).PortfolioService();
        const portfolio = await portfolioService.getPortfolio(userId);
        const maxSize = riskService.calculateMaxPositionSize(portfolio.totalValue, riskTolerance || 'low');
        res.json({
            success: true,
            data: {
                maxPositionSize: maxSize,
                totalPortfolioValue: portfolio.totalValue,
                riskTolerance: riskTolerance || 'low',
                recommendation: `Максимальный размер позиции: ${Math.round(maxSize)} руб. (${Math.round(maxSize / portfolio.totalValue * 100)}% портфеля)`
            }
        });
    }
    catch (error) {
        console.error('Ошибка расчета максимального размера позиции:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось рассчитать максимальный размер позиции'
        });
    }
});
router.post('/trade-risk-check', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { assetSymbol, assetType, quantity, price, transactionType } = req.body;
        const userId = req.user.userId;
        if (!assetSymbol || !assetType || !quantity || !price || !transactionType) {
            return res.status(400).json({
                success: false,
                message: 'Необходимы все параметры: assetSymbol, assetType, quantity, price, transactionType'
            });
        }
        const portfolioService = new (await Promise.resolve().then(() => __importStar(require('../services/PortfolioService')))).PortfolioService();
        const portfolio = await portfolioService.getPortfolio(userId);
        const tradeValue = quantity * price;
        const maxPositionSize = riskService.calculateMaxPositionSize(portfolio.totalValue, 'low');
        const riskCheck = {
            tradeValue,
            maxPositionSize,
            isWithinLimits: tradeValue <= maxPositionSize,
            portfolioPercentage: (tradeValue / portfolio.totalValue) * 100,
            recommendation: tradeValue <= maxPositionSize
                ? 'Сделка соответствует рекомендациям риск-менеджмента'
                : `Сделка превышает рекомендуемый размер. Уменьшите количество до ${Math.floor(maxPositionSize / price)}`
        };
        return res.json({
            success: true,
            data: riskCheck
        });
    }
    catch (error) {
        console.error('Ошибка проверки риска сделки:', error);
        return res.status(500).json({
            success: false,
            message: 'Не удалось проверить риск сделки'
        });
    }
});
router.get('/statistics', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const assessment = await riskService.assessPortfolioRisk(userId);
        const stopLossRecommendations = await riskService.getStopLossRecommendations(userId);
        const portfolioService = new (await Promise.resolve().then(() => __importStar(require('../services/PortfolioService')))).PortfolioService();
        const portfolio = await portfolioService.getPortfolio(userId);
        const statistics = {
            riskLevel: assessment.overallRiskLevel,
            riskScore: assessment.portfolioRiskScore,
            diversificationScore: Math.round(assessment.diversificationScore * 100),
            concentrationRisk: Math.round(assessment.concentrationRisk * 100),
            volatilityRisk: Math.round(assessment.volatilityRisk * 100),
            recommendationsCount: assessment.recommendations.length,
            warningsCount: assessment.warnings.length,
            criticalWarningsCount: assessment.warnings.filter(w => w.severity === 'critical').length,
            stopLossCoverage: Math.round((stopLossRecommendations.length / portfolio.positions.length || 1) * 100)
        };
        res.json({
            success: true,
            data: statistics
        });
    }
    catch (error) {
        console.error('Ошибка получения статистики рисков:', error);
        res.status(500).json({
            success: false,
            message: 'Не удалось получить статистику рисков'
        });
    }
});
exports.default = router;
//# sourceMappingURL=riskRoutes.js.map
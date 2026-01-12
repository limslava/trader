"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskManagementService = void 0;
const PortfolioService_1 = require("./PortfolioService");
const MarketDataService_1 = require("./MarketDataService");
class RiskManagementService {
    constructor() {
        this.portfolioService = new PortfolioService_1.PortfolioService();
        this.marketDataService = new MarketDataService_1.MarketDataService();
    }
    async assessPortfolioRisk(userId) {
        try {
            const portfolio = await this.portfolioService.getPortfolio(userId);
            const recommendations = [];
            const warnings = [];
            const diversificationScore = this.calculateDiversificationScore(portfolio);
            if (diversificationScore < 0.6) {
                recommendations.push(this.createDiversificationRecommendation(portfolio));
            }
            const concentrationRisk = this.calculateConcentrationRisk(portfolio);
            if (concentrationRisk > 0.3) {
                warnings.push(this.createConcentrationWarning(portfolio, concentrationRisk));
            }
            const stopLossWarnings = await this.checkStopLosses(portfolio, userId);
            warnings.push(...stopLossWarnings);
            const positionSizeWarnings = this.checkPositionSizes(portfolio);
            warnings.push(...positionSizeWarnings);
            const overallRiskLevel = this.calculateOverallRiskLevel(diversificationScore, concentrationRisk, warnings);
            return {
                overallRiskLevel,
                portfolioRiskScore: this.calculateRiskScore(portfolio, warnings),
                diversificationScore,
                concentrationRisk,
                volatilityRisk: this.calculateVolatilityRisk(portfolio),
                recommendations,
                warnings
            };
        }
        catch (error) {
            console.error('Ошибка оценки рисков портфеля:', error);
            throw new Error('Не удалось оценить риски портфеля');
        }
    }
    async getStopLossRecommendations(userId) {
        try {
            const portfolio = await this.portfolioService.getPortfolio(userId);
            const recommendations = [];
            for (const position of portfolio.positions) {
                const stopLossPercentage = this.calculateStopLossPercentage(position);
                const recommendedStopLoss = position.currentPrice * (1 - stopLossPercentage / 100);
                recommendations.push({
                    assetSymbol: position.assetSymbol,
                    currentPrice: position.currentPrice,
                    recommendedStopLoss,
                    stopLossPercentage,
                    riskLevel: this.getAssetRiskLevel(position)
                });
            }
            return recommendations;
        }
        catch (error) {
            console.error('Ошибка расчета стоп-лоссов:', error);
            throw new Error('Не удалось рассчитать стоп-лоссы');
        }
    }
    calculateMaxPositionSize(totalPortfolioValue, riskTolerance = 'low') {
        const riskMultipliers = {
            low: 0.02,
            medium: 0.05,
            high: 0.1
        };
        return totalPortfolioValue * riskMultipliers[riskTolerance];
    }
    calculateStopLossPercentage(position) {
        const baseStopLosses = {
            stock: 10,
            crypto: 15,
            currency: 5
        };
        let adjustment = 0;
        if (position.profitLossPercentage > 20) {
            adjustment = -2;
        }
        else if (position.profitLossPercentage < -10) {
            adjustment = 2;
        }
        return baseStopLosses[position.assetType] + adjustment;
    }
    getAssetRiskLevel(position) {
        const riskFactors = {
            stock: position.assetSymbol.includes('SBER') || position.assetSymbol.includes('GAZP') ? 'low' : 'medium',
            crypto: 'high',
            currency: 'low'
        };
        return riskFactors[position.assetType] || 'medium';
    }
    calculateDiversificationScore(portfolio) {
        if (portfolio.positions.length === 0)
            return 0;
        const positionCountScore = Math.min(portfolio.positions.length / 7, 1);
        const assetTypes = new Set(portfolio.positions.map(p => p.assetType));
        const typeDiversityScore = assetTypes.size / 2;
        return (positionCountScore * 0.6 + typeDiversityScore * 0.4);
    }
    calculateConcentrationRisk(portfolio) {
        if (portfolio.positions.length === 0)
            return 0;
        const maxPosition = Math.max(...portfolio.positions.map(p => p.currentValue / portfolio.totalValue));
        return maxPosition;
    }
    calculateVolatilityRisk(portfolio) {
        let volatilityScore = 0;
        let totalWeight = 0;
        for (const position of portfolio.positions) {
            const weight = position.currentValue / portfolio.totalValue;
            const assetVolatility = position.assetType === 'crypto' ? 0.8 : 0.4;
            volatilityScore += weight * assetVolatility;
            totalWeight += weight;
        }
        return totalWeight > 0 ? volatilityScore / totalWeight : 0;
    }
    async checkStopLosses(portfolio, userId) {
        const warnings = [];
        const recommendations = await this.getStopLossRecommendations(userId);
        for (const position of portfolio.positions) {
            const recommendation = recommendations.find(r => r.assetSymbol === position.assetSymbol);
            if (recommendation) {
                const currentDrawdown = (position.currentPrice - position.averagePrice) / position.averagePrice * 100;
                if (currentDrawdown < -recommendation.stopLossPercentage * 0.8) {
                    warnings.push({
                        type: 'stop_loss_breach',
                        severity: 'critical',
                        title: 'Приближение к стоп-лоссу',
                        description: `${position.assetSymbol} приближается к рекомендуемому стоп-лоссу`,
                        affectedAsset: position.assetSymbol,
                        currentValue: position.currentPrice,
                        threshold: recommendation.recommendedStopLoss
                    });
                }
            }
        }
        return warnings;
    }
    checkPositionSizes(portfolio) {
        const warnings = [];
        const maxPositionSize = this.calculateMaxPositionSize(portfolio.totalValue, 'low');
        for (const position of portfolio.positions) {
            if (position.currentValue > maxPositionSize) {
                warnings.push({
                    type: 'position_size',
                    severity: 'warning',
                    title: 'Слишком большая позиция',
                    description: `${position.assetSymbol} превышает рекомендуемый размер позиции`,
                    affectedAsset: position.assetSymbol,
                    currentValue: position.currentValue,
                    threshold: maxPositionSize
                });
            }
        }
        return warnings;
    }
    calculateOverallRiskLevel(diversificationScore, concentrationRisk, warnings) {
        let riskScore = 0;
        riskScore += (1 - diversificationScore) * 40;
        riskScore += concentrationRisk * 40;
        const criticalWarnings = warnings.filter(w => w.severity === 'critical').length;
        riskScore += criticalWarnings * 20;
        if (riskScore < 30)
            return 'low';
        if (riskScore < 60)
            return 'medium';
        return 'high';
    }
    calculateRiskScore(portfolio, warnings) {
        const diversificationScore = this.calculateDiversificationScore(portfolio);
        const concentrationRisk = this.calculateConcentrationRisk(portfolio);
        const criticalWarnings = warnings.filter(w => w.severity === 'critical').length;
        return Math.round((1 - diversificationScore) * 40 +
            concentrationRisk * 40 +
            criticalWarnings * 20);
    }
    createDiversificationRecommendation(portfolio) {
        return {
            type: 'diversification',
            priority: portfolio.positions.length < 3 ? 'high' : 'medium',
            title: 'Увеличить диверсификацию портфеля',
            description: `В вашем портфеле ${portfolio.positions.length} активов. Рекомендуется иметь 5-7 активов для снижения рисков.`,
            action: 'Добавить новые активы в портфель',
            affectedAssets: portfolio.positions.map(p => p.assetSymbol)
        };
    }
    createConcentrationWarning(portfolio, concentrationRisk) {
        const largestPosition = portfolio.positions.reduce((max, p) => p.currentValue > max.currentValue ? p : max);
        return {
            type: 'concentration',
            severity: concentrationRisk > 0.5 ? 'critical' : 'warning',
            title: 'Высокая концентрация риска',
            description: `${largestPosition.assetSymbol} составляет ${Math.round(concentrationRisk * 100)}% портфеля`,
            affectedAsset: largestPosition.assetSymbol,
            currentValue: concentrationRisk,
            threshold: 0.3
        };
    }
}
exports.RiskManagementService = RiskManagementService;
//# sourceMappingURL=RiskManagementService.js.map
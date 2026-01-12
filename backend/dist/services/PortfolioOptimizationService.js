"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioOptimizationService = void 0;
const MemoryCacheService_1 = require("./MemoryCacheService");
class PortfolioOptimizationService {
    constructor() {
        this.cacheService = new MemoryCacheService_1.MemoryCacheService();
    }
    async optimizePortfolio(currentPositions, totalPortfolioValue, riskTolerance = 'MEDIUM', optimizationMethod = 'MARKOWITZ') {
        const cacheKey = `portfolio_optimization_${riskTolerance}_${optimizationMethod}_${totalPortfolioValue}`;
        try {
            const cached = await this.cacheService.get(cacheKey);
            if (cached) {
                console.log('📊 Оптимизация портфеля загружена из кэша');
                return cached;
            }
            const historicalData = await this.getHistoricalDataForAssets(currentPositions.map(p => p.symbol));
            let optimizationResult;
            switch (optimizationMethod) {
                case 'MARKOWITZ':
                    optimizationResult = await this.markowitzOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance);
                    break;
                case 'BLACK_LITTERMAN':
                    optimizationResult = await this.blackLittermanOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance);
                    break;
                case 'RISK_PARITY':
                    optimizationResult = await this.riskParityOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance);
                    break;
                default:
                    optimizationResult = await this.markowitzOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance);
            }
            this.cacheService.set(cacheKey, optimizationResult, { ttl: 3600 });
            console.log(`✅ Портфель оптимизирован: ожидаемая доходность ${optimizationResult.expectedPortfolioReturn.toFixed(2)}%, риск ${optimizationResult.expectedPortfolioRisk.toFixed(2)}%`);
            return optimizationResult;
        }
        catch (error) {
            console.error('❌ Ошибка оптимизации портфеля:', error);
            throw new Error('Не удалось оптимизировать портфель');
        }
    }
    async markowitzOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance) {
        const covarianceMatrix = this.calculateCovarianceMatrix(historicalData);
        const expectedReturns = historicalData.map(data => data.averageReturn);
        const targetReturn = this.getTargetReturn(riskTolerance);
        const optimizedWeights = this.solveMarkowitzOptimization(expectedReturns, covarianceMatrix, targetReturn);
        return this.buildOptimizationResult(currentPositions, totalPortfolioValue, historicalData, optimizedWeights);
    }
    async blackLittermanOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance) {
        const equilibriumReturns = historicalData.map(data => data.averageReturn);
        const investorViews = this.generateInvestorViews(historicalData);
        const blendedReturns = this.blendEquilibriumAndViews(equilibriumReturns, investorViews, historicalData);
        const covarianceMatrix = this.calculateCovarianceMatrix(historicalData);
        const optimizedWeights = this.solveMarkowitzOptimization(blendedReturns, covarianceMatrix, this.getTargetReturn(riskTolerance));
        return this.buildOptimizationResult(currentPositions, totalPortfolioValue, historicalData, optimizedWeights);
    }
    async riskParityOptimization(currentPositions, totalPortfolioValue, historicalData, riskTolerance) {
        const volatilities = historicalData.map(data => data.volatility);
        const correlationMatrix = this.calculateCorrelationMatrix(historicalData);
        const riskParityWeights = this.calculateRiskParityWeights(volatilities, correlationMatrix);
        return this.buildOptimizationResult(currentPositions, totalPortfolioValue, historicalData, riskParityWeights);
    }
    calculateCovarianceMatrix(historicalData) {
        const n = historicalData.length;
        const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const dataI = historicalData[i];
                const dataJ = historicalData[j];
                if (i === j) {
                    matrix[i][j] = Math.pow(dataI.volatility, 2);
                }
                else {
                    const correlation = this.getAssetCorrelation(dataI.symbol, dataJ.symbol);
                    matrix[i][j] = correlation * dataI.volatility * dataJ.volatility;
                }
            }
        }
        return matrix;
    }
    calculateCorrelationMatrix(historicalData) {
        const n = historicalData.length;
        const matrix = Array(n).fill(0).map(() => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const dataI = historicalData[i];
                const dataJ = historicalData[j];
                if (i === j) {
                    matrix[i][j] = 1;
                }
                else {
                    matrix[i][j] = this.getAssetCorrelation(dataI.symbol, dataJ.symbol);
                }
            }
        }
        return matrix;
    }
    solveMarkowitzOptimization(expectedReturns, covarianceMatrix, targetReturn) {
        const n = expectedReturns.length;
        const weights = Array(n).fill(1 / n);
        for (let i = 0; i < n; i++) {
            const expectedReturn = expectedReturns[i];
            const covariance = covarianceMatrix[i][i];
            const sharpeRatio = expectedReturn / Math.sqrt(covariance);
            weights[i] = sharpeRatio * 0.5 + 0.5 / n;
        }
        const sum = weights.reduce((acc, w) => acc + w, 0);
        return weights.map(w => w / sum);
    }
    calculateRiskParityWeights(volatilities, correlationMatrix) {
        const n = volatilities.length;
        const weights = Array(n).fill(0);
        const inverseVolatilities = volatilities.map(v => 1 / v);
        const sum = inverseVolatilities.reduce((acc, iv) => acc + iv, 0);
        return inverseVolatilities.map(iv => iv / sum);
    }
    buildOptimizationResult(currentPositions, totalPortfolioValue, historicalData, optimizedWeights) {
        const allocation = [];
        let totalExpectedReturn = 0;
        let totalRisk = 0;
        currentPositions.forEach((position, index) => {
            const currentValue = position.quantity * position.currentPrice;
            const currentWeight = currentValue / totalPortfolioValue;
            const targetWeight = optimizedWeights[index];
            const historicalDataItem = historicalData[index];
            const expectedReturn = historicalDataItem.averageReturn;
            const risk = historicalDataItem.volatility;
            const sharpeRatio = expectedReturn / risk;
            let recommendedAction;
            const weightDifference = targetWeight - currentWeight;
            if (Math.abs(weightDifference) < 0.01) {
                recommendedAction = 'HOLD';
            }
            else if (weightDifference > 0) {
                recommendedAction = 'BUY';
            }
            else {
                recommendedAction = 'SELL';
            }
            const targetValue = totalPortfolioValue * targetWeight;
            const quantityToTrade = recommendedAction === 'BUY'
                ? Math.floor((targetValue - currentValue) / position.currentPrice)
                : Math.floor((currentValue - targetValue) / position.currentPrice);
            allocation.push({
                symbol: position.symbol,
                targetWeight: targetWeight * 100,
                currentWeight: currentWeight * 100,
                recommendedAction,
                quantityToTrade: Math.abs(quantityToTrade),
                expectedReturn: expectedReturn * 100,
                risk: risk * 100,
                sharpeRatio
            });
            totalExpectedReturn += expectedReturn * targetWeight;
            totalRisk += Math.pow(risk * targetWeight, 2);
        });
        totalRisk = Math.sqrt(totalRisk);
        const efficientFrontier = this.generateEfficientFrontier(historicalData);
        return {
            optimizedAllocation: allocation,
            expectedPortfolioReturn: totalExpectedReturn * 100,
            expectedPortfolioRisk: totalRisk * 100,
            sharpeRatio: totalExpectedReturn / totalRisk,
            efficientFrontier,
            rebalancingNeeded: allocation.some(a => a.recommendedAction !== 'HOLD'),
            totalRebalancingCost: this.calculateRebalancingCost(allocation, totalPortfolioValue)
        };
    }
    getTargetReturn(riskTolerance) {
        const returns = {
            'LOW': 0.08,
            'MEDIUM': 0.12,
            'HIGH': 0.18
        };
        return returns[riskTolerance] || 0.12;
    }
    getAssetCorrelation(symbol1, symbol2) {
        const correlations = {
            'SBER_GAZP': 0.6,
            'SBER_LKOH': 0.5,
            'SBER_VTBR': 0.7,
            'GAZP_LKOH': 0.4,
            'GAZP_VTBR': 0.3,
            'LKOH_VTBR': 0.2
        };
        const key = [symbol1, symbol2].sort().join('_');
        return correlations[key] || 0.3;
    }
    async getHistoricalDataForAssets(symbols) {
        return symbols.map(symbol => ({
            symbol,
            returns: Array(100).fill(0).map(() => (Math.random() - 0.5) * 0.1),
            prices: Array(100).fill(0).map((_, i) => 100 + i * 0.1 + (Math.random() - 0.5) * 10),
            volatility: 0.02 + Math.random() * 0.03,
            averageReturn: 0.0005 + Math.random() * 0.001
        }));
    }
    generateInvestorViews(historicalData) {
        return historicalData.map(data => ({
            symbol: data.symbol,
            expectedReturn: data.averageReturn * (1 + (Math.random() - 0.5) * 0.5),
            confidence: 0.7 + Math.random() * 0.3
        }));
    }
    blendEquilibriumAndViews(equilibriumReturns, views, historicalData) {
        return equilibriumReturns.map((eqReturn, index) => {
            const view = views[index];
            const blendWeight = view.confidence;
            return eqReturn * (1 - blendWeight) + view.expectedReturn * blendWeight;
        });
    }
    generateEfficientFrontier(historicalData) {
        const points = [];
        for (let i = 0; i <= 10; i++) {
            const returnVal = 0.05 + i * 0.02;
            const risk = 0.1 + i * 0.03;
            points.push({ return: returnVal * 100, risk: risk * 100 });
        }
        return points;
    }
    calculateRebalancingCost(allocation, totalPortfolioValue) {
        const commissionRate = 0.001;
        const slippageRate = 0.0005;
        const totalTradedValue = allocation
            .filter(a => a.recommendedAction !== 'HOLD')
            .reduce((sum, a) => sum + (a.quantityToTrade * this.getCurrentPrice(a.symbol)), 0);
        return totalTradedValue * (commissionRate + slippageRate);
    }
    getCurrentPrice(symbol) {
        const prices = {
            'SBER': 280.50,
            'GAZP': 162.30,
            'LKOH': 7480.25,
            'VTBR': 0.0248,
            'ROSN': 548.75
        };
        return prices[symbol] || 100;
    }
}
exports.PortfolioOptimizationService = PortfolioOptimizationService;
//# sourceMappingURL=PortfolioOptimizationService.js.map
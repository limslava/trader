export interface MLPrediction {
    symbol: string;
    prediction: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    predictedPrice: number;
    predictedChange: number;
    timeframe: string;
    reasoning: string;
    patterns: Array<{
        name: string;
        direction: 'bullish' | 'bearish' | 'neutral';
        strength: number;
        timeframe: string;
        probability: number;
    }>;
    sentiment: {
        score: number;
        label: 'bullish' | 'bearish' | 'neutral';
        sources: string[];
    };
    technicalIndicators: {
        rsi: number;
        macd: number;
        signal: number;
        histogram: number;
        sma20: number;
        sma50: number;
        ema12: number;
        volume: number;
        volatility: number;
    };
}
export declare class RealMLPredictionService {
    private cacheService;
    constructor();
    getPrediction(symbol: string, timeframe?: '1h' | '4h' | '1d' | '1w'): Promise<MLPrediction | null>;
    private getRealMarketData;
    private generateHistoricalData;
    private getVolatility;
    private generateRealPrediction;
    private performAdvancedTechnicalAnalysis;
    private calculateRealRSI;
    private calculateRealMACD;
    private calculateRealMovingAverages;
    private calculateSMA;
    private calculateEMA;
    private calculateVolatilityFromData;
    private identifyRealPatterns;
    private calculateAdvancedPrediction;
    private generateDetailedReasoning;
    private getTimeframeMultiplier;
    private calculatePatternConsistency;
    private analyzeRealSentiment;
    private generateFallbackPrediction;
}
//# sourceMappingURL=RealMLPredictionService.d.ts.map
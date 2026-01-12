export interface MLPrediction {
    symbol: string;
    prediction: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    predictedPrice: number;
    predictedChange: number;
    timeframe: '1h' | '4h' | '1d' | '1w';
    reasoning: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: Date;
}
export interface TechnicalPattern {
    name: string;
    strength: number;
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    timeframe: string;
    probability: number;
}
export interface SentimentAnalysis {
    overall: number;
    news: number;
    social: number;
    technical: number;
    volume: number;
}
export declare class MLPredictionService {
    private cacheTtl;
    getPrediction(symbol: string, timeframe?: '1h' | '4h' | '1d' | '1w'): Promise<MLPrediction | null>;
    getTechnicalPatterns(symbol: string): Promise<TechnicalPattern[]>;
    analyzeSentiment(symbol: string): Promise<SentimentAnalysis>;
    getBeginnerRecommendations(): Promise<MLPrediction[]>;
    private generateMLPrediction;
    private analyzeTechnicalPatterns;
    private calculateSentiment;
    private getBasePrice;
    private calculateTechnicalScore;
    private getVolatility;
    private generateReasoning;
    invalidateMLCache(symbol?: string): Promise<void>;
}
export declare const mlPredictionService: MLPredictionService;
//# sourceMappingURL=MLPredictionService.d.ts.map
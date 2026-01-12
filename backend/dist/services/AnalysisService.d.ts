import { AnalysisResult } from '../types/market';
export declare class AnalysisService {
    private marketDataService;
    constructor();
    analyzeAsset(symbol: string): Promise<AnalysisResult | null>;
    private performTechnicalAnalysis;
    private performFundamentalAnalysis;
    private performSentimentAnalysis;
    private calculateWeightedScore;
    private generateRecommendation;
    private calculateConfidence;
    private getRSISignal;
    private getMACDSignal;
    private getMAScore;
    private getMASignal;
    private getSupportResistanceScore;
    private getVolumeScore;
    private determineTrend;
    private determineMomentum;
    private getPERating;
    private getDividendRating;
    private calculatePriceTargets;
    private assessRisk;
    private mapRiskLevelToSimple;
    private generateExplanation;
    private getRecommendationText;
}
//# sourceMappingURL=AnalysisService.d.ts.map
import { WebSocketService } from './WebSocketService';
import { MarketDataService } from './MarketDataService';
import { AnalysisService } from './AnalysisService';
import { RiskManagementService } from './RiskManagementService';
export interface PushNotificationTrigger {
    symbol: string;
    type: 'price_alert' | 'recommendation' | 'risk_alert' | 'portfolio_update';
    title: string;
    body: string;
    priority: 'low' | 'medium' | 'high';
    data?: Record<string, any>;
}
export declare class PushNotificationService {
    private webSocketService;
    private marketDataService;
    private analysisService;
    private riskManagementService;
    constructor(webSocketService: WebSocketService, marketDataService: MarketDataService, analysisService: AnalysisService, riskManagementService: RiskManagementService);
    private setupNotificationTriggers;
    private setupPriceAlertTriggers;
    private setupAnalysisTriggers;
    private setupRiskTriggers;
    private checkMarketPriceAlerts;
    private checkAnalysisAlerts;
    private checkRiskAlerts;
    private checkPriceAlertsForSymbol;
    private checkAnalysisAlertsForSymbol;
    private checkRiskAlertsForWarning;
    private triggerNotification;
    private getRecommendationAction;
    private getAverageVolume;
    private getPreviousAnalysis;
    sendManualNotification(notification: Omit<PushNotificationTrigger, 'type'>): Promise<void>;
}
//# sourceMappingURL=PushNotificationService.d.ts.map
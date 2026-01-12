import { Server as HttpServer } from 'http';
export declare class WebSocketService {
    private io;
    private marketDataService;
    constructor();
    initialize(server: HttpServer): void;
    private setupEventHandlers;
    private startPriceUpdates;
    broadcastPriceUpdate(symbol: string, priceData: any): void;
    broadcastRiskAlert(alert: any): void;
    broadcastRecommendation(recommendation: any): void;
    getConnectedClientsCount(): number;
}
export default WebSocketService;
//# sourceMappingURL=WebSocketService.d.ts.map
export interface BrokerAccount {
    id: string;
    broker: string;
    accountNumber: string;
    balance: number;
    currency: string;
    available: number;
    blocked: number;
}
export interface BrokerOrder {
    id: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
    createdAt: Date;
    executedAt?: Date;
}
export interface BrokerPosition {
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
}
export declare class AdvancedBrokerIntegrationService {
    private cacheService;
    constructor();
    connectTinkoff(apiKey: string, accountId?: string): Promise<BrokerAccount[]>;
    connectVTB(apiKey: string, accountId?: string): Promise<BrokerAccount[]>;
    connectSber(apiKey: string, accountId?: string): Promise<BrokerAccount[]>;
    placeOrder(broker: string, accountId: string, symbol: string, type: 'BUY' | 'SELL', quantity: number, price?: number): Promise<BrokerOrder>;
    getPositions(broker: string, accountId: string): Promise<BrokerPosition[]>;
    getOrderHistory(broker: string, accountId: string, limit?: number): Promise<BrokerOrder[]>;
    executeRecommendation(broker: string, accountId: string, symbol: string, recommendation: 'BUY' | 'SELL' | 'HOLD', confidence: number, currentPrice: number, portfolioValue: number): Promise<BrokerOrder | null>;
    private calculatePositionSize;
    private getCurrentPrice;
    getAvailableBrokers(): Array<{
        id: string;
        name: string;
        supported: boolean;
    }>;
}
//# sourceMappingURL=AdvancedBrokerIntegrationService.d.ts.map
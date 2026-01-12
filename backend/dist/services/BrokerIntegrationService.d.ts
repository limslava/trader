export interface BrokerAccount {
    id: string;
    brokerName: string;
    accountNumber: string;
    balance: number;
    currency: string;
    status: 'active' | 'inactive' | 'pending';
}
export interface BrokerOrder {
    id: string;
    symbol: string;
    type: 'buy' | 'sell';
    quantity: number;
    price: number;
    status: 'pending' | 'executed' | 'cancelled' | 'rejected';
    timestamp: Date;
    brokerOrderId?: string;
}
export interface BrokerPosition {
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    profitLoss: number;
    profitLossPercent: number;
}
export interface BrokerTrade {
    id: string;
    symbol: string;
    type: 'buy' | 'sell';
    quantity: number;
    price: number;
    timestamp: Date;
    commission: number;
}
export declare class BrokerIntegrationService {
    private tinkoffConfig?;
    private sberInvestConfig?;
    private vtbConfig?;
    constructor();
    private loadBrokerConfigurations;
    getConnectedAccounts(): Promise<BrokerAccount[]>;
    getBrokerPositions(brokerAccountId: string): Promise<BrokerPosition[]>;
    placeOrder(brokerAccountId: string, symbol: string, type: 'buy' | 'sell', quantity: number, price?: number): Promise<BrokerOrder>;
    cancelOrder(brokerAccountId: string, orderId: string): Promise<boolean>;
    getTradeHistory(brokerAccountId: string, days?: number): Promise<BrokerTrade[]>;
    getAvailableFunds(brokerAccountId: string): Promise<number>;
    validateOrder(brokerAccountId: string, symbol: string, type: 'buy' | 'sell', quantity: number, price?: number): Promise<{
        valid: boolean;
        message?: string;
        availableFunds?: number;
    }>;
    private getMockPrice;
    private simulateOrderExecution;
    getBrokerCommissions(brokerAccountId: string): {
        stockCommission: number;
        minCommission: number;
        currency: string;
    } | {
        stockCommission: number;
        minCommission: number;
        currency: string;
    } | {
        stockCommission: number;
        minCommission: number;
        currency: string;
    };
}
export default BrokerIntegrationService;
//# sourceMappingURL=BrokerIntegrationService.d.ts.map
export interface ITransactionInput {
    userId: string;
    assetSymbol: string;
    assetType: string;
    transactionType: 'buy' | 'sell';
    quantity: number;
    price: number;
    commission?: number;
    timestamp: Date;
    status: string;
    notes?: string;
}
export interface SimpleTransaction {
    _id: string;
    userId: string;
    assetSymbol: string;
    assetType: 'stock' | 'crypto' | 'currency';
    transactionType: 'buy' | 'sell';
    quantity: number;
    price: number;
    totalAmount: number;
    commission: number;
    timestamp: Date;
    status: 'completed' | 'pending' | 'cancelled';
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface PortfolioPosition {
    assetSymbol: string;
    assetType: 'stock' | 'crypto' | 'currency';
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    totalCost: number;
    currentValue: number;
    profitLoss: number;
    profitLossPercentage: number;
}
export interface PortfolioSummary {
    totalValue: number;
    totalCost: number;
    totalProfitLoss: number;
    totalProfitLossPercentage: number;
    positions: PortfolioPosition[];
    cashBalance: number;
}
export declare class PortfolioService {
    private marketDataService;
    constructor();
    getPortfolio(userId: string): Promise<PortfolioSummary>;
    getUserTransactions(userId: string): Promise<SimpleTransaction[]>;
    addTransaction(transactionData: ITransactionInput): Promise<SimpleTransaction>;
    private calculatePortfolioPositions;
    private calculatePortfolioSummary;
    getTransactionHistory(userId: string, limit?: number): Promise<SimpleTransaction[]>;
    private getMockTransactions;
    getPortfolioStats(userId: string): Promise<{
        portfolio: PortfolioSummary;
        transactionCount: number;
        totalTrades: number;
        winningTrades: number;
    }>;
}
//# sourceMappingURL=PortfolioService.d.ts.map
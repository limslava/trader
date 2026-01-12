export interface PortfolioItem {
    id: string;
    userId: string;
    assetId: string;
    symbol: string;
    assetType: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    totalValue: number;
    profitLoss: number;
    profitLossPercentage: number;
    createdAt: Date;
    updatedAt: Date;
    assetSymbol: string;
    currentValue: number;
    totalCost: number;
}
export interface Transaction {
    id: string;
    userId: string;
    assetId: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    totalAmount: number;
    fee: number;
    timestamp: Date;
    status: 'COMPLETED' | 'PENDING' | 'CANCELLED';
}
export declare class PostgresPortfolioService {
    private capitalService;
    constructor();
    getUserPortfolio(userId: string): Promise<PortfolioItem[]>;
    addToPortfolio(userId: string, assetId: string, symbol: string, quantity: number, price: number, type: 'BUY' | 'SELL', assetType?: string, notes?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getUserTransactions(userId: string): Promise<Transaction[]>;
    updatePortfolioPrices(): Promise<void>;
    getPortfolioSummary(userId: string): Promise<{
        totalValue: number;
        totalProfitLoss: number;
        totalProfitLossPercentage: number;
        assetCount: number;
    }>;
    calculateCashBalance(userId: string): Promise<number>;
}
export default PostgresPortfolioService;
//# sourceMappingURL=PostgresPortfolioService.d.ts.map
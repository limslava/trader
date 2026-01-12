export interface Notification {
    id: string;
    userId: string;
    type: 'price_alert' | 'risk_warning' | 'portfolio_change' | 'market_news' | 'system';
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'success';
    data?: any;
    read: boolean;
    createdAt: Date;
    expiresAt?: Date;
}
export interface PriceAlert {
    assetSymbol: string;
    condition: 'above' | 'below' | 'change_percent';
    threshold: number;
    currentPrice: number;
    triggered: boolean;
}
export declare class NotificationService {
    private marketDataService;
    private riskManagementService;
    private portfolioService;
    private notifications;
    private priceAlerts;
    constructor();
    getUserNotifications(userId: string): Promise<Notification[]>;
    createNotification(userId: string, notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>): Promise<Notification>;
    markAsRead(userId: string, notificationId: string): Promise<void>;
    deleteNotification(userId: string, notificationId: string): Promise<void>;
    createPriceAlert(userId: string, alert: Omit<PriceAlert, 'triggered'>): Promise<PriceAlert>;
    getUserPriceAlerts(userId: string): Promise<PriceAlert[]>;
    deletePriceAlert(userId: string, assetSymbol: string): Promise<void>;
    checkRiskNotifications(userId: string): Promise<void>;
    checkPriceAlerts(userId: string): Promise<void>;
    checkPortfolioChanges(userId: string): Promise<void>;
    checkAllNotifications(userId: string): Promise<void>;
    private getPriceAlertMessage;
    private generateId;
    cleanupOldNotifications(): Promise<void>;
}
//# sourceMappingURL=NotificationService.d.ts.map
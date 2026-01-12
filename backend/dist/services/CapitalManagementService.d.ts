export interface UserCapital {
    id: string;
    userId: string;
    initialCapital: number;
    currentCapital: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class CapitalManagementService {
    getUserCapital(userId: string): Promise<UserCapital | null>;
    setInitialCapital(userId: string, amount: number): Promise<{
        success: boolean;
        message: string;
    }>;
    deposit(userId: string, amount: number): Promise<{
        success: boolean;
        message: string;
        newBalance: number;
    }>;
    withdraw(userId: string, amount: number): Promise<{
        success: boolean;
        message: string;
        newBalance: number;
    }>;
    getAvailableCapital(userId: string): Promise<number>;
    initializeUserCapital(userId: string): Promise<void>;
}
export default CapitalManagementService;
//# sourceMappingURL=CapitalManagementService.d.ts.map
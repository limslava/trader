export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    username: string;
    password: string;
    profile: Partial<UserProfile>;
}
export interface AuthResponse {
    user: Omit<User, 'passwordHash'>;
    token: string;
    refreshToken: string;
}
export interface TokenPayload {
    userId: string;
    email: string;
    username: string;
    iat: number;
}
export interface User {
    id: string;
    email: string;
    username: string;
    passwordHash: string;
    profile: UserProfile;
    preferences: UserPreferences;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}
export interface UserProfile {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatar?: string;
    bio?: string;
    experienceLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
    riskTolerance: 'LOW' | 'MEDIUM' | 'HIGH';
    investmentGoals: string[];
}
export interface UserPreferences {
    notifications: {
        email: boolean;
        push: boolean;
        priceAlerts: boolean;
        riskAlerts: boolean;
    };
    theme: 'LIGHT' | 'DARK' | 'AUTO';
    language: 'RU' | 'EN';
    currency: 'RUB' | 'USD' | 'EUR';
    defaultExchange: 'MOEX' | 'BINANCE' | 'SPB';
}
export declare const mockUsers: User[];
//# sourceMappingURL=auth.d.ts.map
import { LoginRequest, RegisterRequest, AuthResponse, User } from '../types/auth';
export declare class PostgresAuthService {
    private jwtSecret;
    constructor();
    register(userData: RegisterRequest): Promise<AuthResponse>;
    login(credentials: LoginRequest): Promise<AuthResponse>;
    getUserById(userId: string): Promise<User | null>;
    verifyToken(token: string): Promise<{
        userId: string;
        email: string;
        username: string;
    } | null>;
    initializeTestUser(): Promise<void>;
}
export default PostgresAuthService;
//# sourceMappingURL=PostgresAuthService.d.ts.map
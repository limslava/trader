export interface CacheOptions {
    ttl?: number;
    prefix?: string;
}
export declare class CacheService {
    private redis;
    private prefix;
    constructor(redisUrl?: string);
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
    delete(key: string): Promise<void>;
    mget<T>(keys: string[]): Promise<(T | null)[]>;
    mset<T>(keyValuePairs: Array<{
        key: string;
        value: T;
    }>, options?: CacheOptions): Promise<void>;
    exists(key: string): Promise<boolean>;
    incr(key: string, by?: number): Promise<number>;
    decr(key: string, by?: number): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    clearPattern(pattern: string): Promise<void>;
    ttl(key: string): Promise<number>;
    expire(key: string, ttl: number): Promise<void>;
    private getFullKey;
    disconnect(): Promise<void>;
}
export declare const cacheService: CacheService;
//# sourceMappingURL=CacheService.d.ts.map
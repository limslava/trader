export interface CacheOptions {
    ttl?: number;
    prefix?: string;
}
export declare class MemoryCacheService {
    private cache;
    private prefix;
    constructor(prefix?: string);
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
    private cleanup;
    private getFullKey;
    private removePrefix;
    getStats(): {
        size: number;
        keys: string[];
    };
    clear(): Promise<void>;
}
export declare const memoryCacheService: MemoryCacheService;
//# sourceMappingURL=MemoryCacheService.d.ts.map
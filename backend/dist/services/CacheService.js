"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
class CacheService {
    constructor(redisUrl) {
        this.redis = new ioredis_1.default(redisUrl || 'redis://localhost:6379');
        this.prefix = 'trader:';
        this.redis.on('error', (error) => {
            console.error('Redis connection error:', error);
        });
    }
    async get(key) {
        try {
            const fullKey = this.getFullKey(key);
            const value = await this.redis.get(fullKey);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        }
        catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }
    async set(key, value, options = {}) {
        try {
            const fullKey = this.getFullKey(key);
            const serializedValue = JSON.stringify(value);
            if (options.ttl) {
                await this.redis.setex(fullKey, options.ttl, serializedValue);
            }
            else {
                await this.redis.set(fullKey, serializedValue);
            }
        }
        catch (error) {
            console.error('Cache set error:', error);
        }
    }
    async delete(key) {
        try {
            const fullKey = this.getFullKey(key);
            await this.redis.del(fullKey);
        }
        catch (error) {
            console.error('Cache delete error:', error);
        }
    }
    async mget(keys) {
        try {
            const fullKeys = keys.map(key => this.getFullKey(key));
            const values = await this.redis.mget(fullKeys);
            return values.map(value => {
                if (value) {
                    return JSON.parse(value);
                }
                return null;
            });
        }
        catch (error) {
            console.error('Cache mget error:', error);
            return keys.map(() => null);
        }
    }
    async mset(keyValuePairs, options = {}) {
        try {
            const pipeline = this.redis.pipeline();
            keyValuePairs.forEach(({ key, value }) => {
                const fullKey = this.getFullKey(key);
                const serializedValue = JSON.stringify(value);
                if (options.ttl) {
                    pipeline.setex(fullKey, options.ttl, serializedValue);
                }
                else {
                    pipeline.set(fullKey, serializedValue);
                }
            });
            await pipeline.exec();
        }
        catch (error) {
            console.error('Cache mset error:', error);
        }
    }
    async exists(key) {
        try {
            const fullKey = this.getFullKey(key);
            const result = await this.redis.exists(fullKey);
            return result === 1;
        }
        catch (error) {
            console.error('Cache exists error:', error);
            return false;
        }
    }
    async incr(key, by = 1) {
        try {
            const fullKey = this.getFullKey(key);
            return await this.redis.incrby(fullKey, by);
        }
        catch (error) {
            console.error('Cache incr error:', error);
            return 0;
        }
    }
    async decr(key, by = 1) {
        try {
            const fullKey = this.getFullKey(key);
            return await this.redis.decrby(fullKey, by);
        }
        catch (error) {
            console.error('Cache decr error:', error);
            return 0;
        }
    }
    async keys(pattern) {
        try {
            const fullPattern = this.getFullKey(pattern);
            return await this.redis.keys(fullPattern);
        }
        catch (error) {
            console.error('Cache keys error:', error);
            return [];
        }
    }
    async clearPattern(pattern) {
        try {
            const keys = await this.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        }
        catch (error) {
            console.error('Cache clearPattern error:', error);
        }
    }
    async ttl(key) {
        try {
            const fullKey = this.getFullKey(key);
            return await this.redis.ttl(fullKey);
        }
        catch (error) {
            console.error('Cache ttl error:', error);
            return -2;
        }
    }
    async expire(key, ttl) {
        try {
            const fullKey = this.getFullKey(key);
            await this.redis.expire(fullKey, ttl);
        }
        catch (error) {
            console.error('Cache expire error:', error);
        }
    }
    getFullKey(key) {
        return `${this.prefix}${key}`;
    }
    async disconnect() {
        await this.redis.quit();
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
//# sourceMappingURL=CacheService.js.map
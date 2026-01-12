"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryCacheService = exports.MemoryCacheService = void 0;
class MemoryCacheService {
    constructor(prefix = 'trader:') {
        this.cache = new Map();
        this.prefix = prefix;
        setInterval(() => this.cleanup(), 60000);
    }
    async get(key) {
        try {
            const fullKey = this.getFullKey(key);
            const entry = this.cache.get(fullKey);
            if (!entry) {
                return null;
            }
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
                this.cache.delete(fullKey);
                return null;
            }
            return entry.value;
        }
        catch (error) {
            console.error('Memory cache get error:', error);
            return null;
        }
    }
    async set(key, value, options = {}) {
        try {
            const fullKey = this.getFullKey(key);
            const expiresAt = options.ttl ? Date.now() + options.ttl * 1000 : 0;
            this.cache.set(fullKey, {
                value,
                expiresAt
            });
        }
        catch (error) {
            console.error('Memory cache set error:', error);
        }
    }
    async delete(key) {
        try {
            const fullKey = this.getFullKey(key);
            this.cache.delete(fullKey);
        }
        catch (error) {
            console.error('Memory cache delete error:', error);
        }
    }
    async mget(keys) {
        try {
            return Promise.all(keys.map(key => this.get(key)));
        }
        catch (error) {
            console.error('Memory cache mget error:', error);
            return keys.map(() => null);
        }
    }
    async mset(keyValuePairs, options = {}) {
        try {
            await Promise.all(keyValuePairs.map(({ key, value }) => this.set(key, value, options)));
        }
        catch (error) {
            console.error('Memory cache mset error:', error);
        }
    }
    async exists(key) {
        try {
            const fullKey = this.getFullKey(key);
            const entry = this.cache.get(fullKey);
            if (!entry) {
                return false;
            }
            if (entry.expiresAt && Date.now() > entry.expiresAt) {
                this.cache.delete(fullKey);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Memory cache exists error:', error);
            return false;
        }
    }
    async incr(key, by = 1) {
        try {
            const current = await this.get(key) || 0;
            const newValue = current + by;
            await this.set(key, newValue);
            return newValue;
        }
        catch (error) {
            console.error('Memory cache incr error:', error);
            return 0;
        }
    }
    async decr(key, by = 1) {
        try {
            const current = await this.get(key) || 0;
            const newValue = current - by;
            await this.set(key, newValue);
            return newValue;
        }
        catch (error) {
            console.error('Memory cache decr error:', error);
            return 0;
        }
    }
    async keys(pattern) {
        try {
            const fullPattern = this.getFullKey(pattern);
            const keys = [];
            for (const [key, entry] of this.cache.entries()) {
                if (entry.expiresAt && Date.now() > entry.expiresAt) {
                    this.cache.delete(key);
                    continue;
                }
                if (fullPattern.endsWith('*')) {
                    const prefix = fullPattern.slice(0, -1);
                    if (key.startsWith(prefix)) {
                        keys.push(key);
                    }
                }
                else if (key === fullPattern) {
                    keys.push(key);
                }
            }
            return keys;
        }
        catch (error) {
            console.error('Memory cache keys error:', error);
            return [];
        }
    }
    async clearPattern(pattern) {
        try {
            const keys = await this.keys(pattern);
            await Promise.all(keys.map(key => this.delete(this.removePrefix(key))));
        }
        catch (error) {
            console.error('Memory cache clearPattern error:', error);
        }
    }
    async ttl(key) {
        try {
            const fullKey = this.getFullKey(key);
            const entry = this.cache.get(fullKey);
            if (!entry || !entry.expiresAt) {
                return -1;
            }
            const remaining = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
            return remaining;
        }
        catch (error) {
            console.error('Memory cache ttl error:', error);
            return -2;
        }
    }
    async expire(key, ttl) {
        try {
            const fullKey = this.getFullKey(key);
            const entry = this.cache.get(fullKey);
            if (entry) {
                entry.expiresAt = Date.now() + ttl * 1000;
            }
        }
        catch (error) {
            console.error('Memory cache expire error:', error);
        }
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.cache.delete(key);
            }
        }
    }
    getFullKey(key) {
        return `${this.prefix}${key}`;
    }
    removePrefix(fullKey) {
        return fullKey.replace(this.prefix, '');
    }
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
    async clear() {
        this.cache.clear();
    }
}
exports.MemoryCacheService = MemoryCacheService;
exports.memoryCacheService = new MemoryCacheService();
//# sourceMappingURL=MemoryCacheService.js.map
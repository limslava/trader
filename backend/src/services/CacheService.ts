import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheService {
  private redis: Redis;
  private prefix: string;

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
    this.prefix = 'trader:';
    
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });
  }

  /**
   * Получить значение из кэша
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.get(fullKey);
      
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Сохранить значение в кэш
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValue = JSON.stringify(value);
      
      if (options.ttl) {
        await this.redis.setex(fullKey, options.ttl, serializedValue);
      } else {
        await this.redis.set(fullKey, serializedValue);
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Удалить значение из кэша
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.redis.del(fullKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Получить несколько значений из кэша
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(key => this.getFullKey(key));
      const values = await this.redis.mget(fullKeys);
      
      return values.map(value => {
        if (value) {
          return JSON.parse(value) as T;
        }
        return null;
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Сохранить несколько значений в кэш
   */
  async mset<T>(keyValuePairs: Array<{ key: string; value: T }>, options: CacheOptions = {}): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      keyValuePairs.forEach(({ key, value }) => {
        const fullKey = this.getFullKey(key);
        const serializedValue = JSON.stringify(value);
        
        if (options.ttl) {
          pipeline.setex(fullKey, options.ttl, serializedValue);
        } else {
          pipeline.set(fullKey, serializedValue);
        }
      });
      
      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }

  /**
   * Проверить существование ключа в кэше
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Увеличить значение счетчика
   */
  async incr(key: string, by = 1): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.incrby(fullKey, by);
    } catch (error) {
      console.error('Cache incr error:', error);
      return 0;
    }
  }

  /**
   * Уменьшить значение счетчика
   */
  async decr(key: string, by = 1): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.decrby(fullKey, by);
    } catch (error) {
      console.error('Cache decr error:', error);
      return 0;
    }
  }

  /**
   * Получить все ключи по шаблону
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = this.getFullKey(pattern);
      return await this.redis.keys(fullPattern);
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  }

  /**
   * Очистить все ключи по шаблону
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clearPattern error:', error);
    }
  }

  /**
   * Получить TTL ключа
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      console.error('Cache ttl error:', error);
      return -2; // Key doesn't exist
    }
  }

  /**
   * Установить TTL для ключа
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.redis.expire(fullKey, ttl);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  }

  /**
   * Получить полный ключ с префиксом
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Закрыть соединение с Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Глобальный экземпляр сервиса кэширования
export const cacheService = new CacheService();
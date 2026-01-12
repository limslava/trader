export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  prefix?: string;
}

export class MemoryCacheService {
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();
  private prefix: string;

  constructor(prefix: string = 'trader:') {
    this.prefix = prefix;
    
    // Очистка устаревших записей каждую минуту
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Получить значение из кэша
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const entry = this.cache.get(fullKey);
      
      if (!entry) {
        return null;
      }
      
      // Проверить срок действия
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(fullKey);
        return null;
      }
      
      return entry.value as T;
    } catch (error) {
      console.error('Memory cache get error:', error);
      return null;
    }
  }

  /**
   * Сохранить значение в кэш
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const expiresAt = options.ttl ? Date.now() + options.ttl * 1000 : 0;
      
      this.cache.set(fullKey, {
        value,
        expiresAt
      });
    } catch (error) {
      console.error('Memory cache set error:', error);
    }
  }

  /**
   * Удалить значение из кэша
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      this.cache.delete(fullKey);
    } catch (error) {
      console.error('Memory cache delete error:', error);
    }
  }

  /**
   * Получить несколько значений из кэша
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      return Promise.all(keys.map(key => this.get<T>(key)));
    } catch (error) {
      console.error('Memory cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Сохранить несколько значений в кэш
   */
  async mset<T>(keyValuePairs: Array<{ key: string; value: T }>, options: CacheOptions = {}): Promise<void> {
    try {
      await Promise.all(
        keyValuePairs.map(({ key, value }) => this.set(key, value, options))
      );
    } catch (error) {
      console.error('Memory cache mset error:', error);
    }
  }

  /**
   * Проверить существование ключа в кэше
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const entry = this.cache.get(fullKey);
      
      if (!entry) {
        return false;
      }
      
      // Проверить срок действия
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(fullKey);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Memory cache exists error:', error);
      return false;
    }
  }

  /**
   * Увеличить значение счетчика
   */
  async incr(key: string, by = 1): Promise<number> {
    try {
      const current = await this.get<number>(key) || 0;
      const newValue = current + by;
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      console.error('Memory cache incr error:', error);
      return 0;
    }
  }

  /**
   * Уменьшить значение счетчика
   */
  async decr(key: string, by = 1): Promise<number> {
    try {
      const current = await this.get<number>(key) || 0;
      const newValue = current - by;
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      console.error('Memory cache decr error:', error);
      return 0;
    }
  }

  /**
   * Получить все ключи по шаблону
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys: string[] = [];
      
      for (const [key, entry] of this.cache.entries()) {
        // Проверить срок действия
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
          this.cache.delete(key);
          continue;
        }
        
        // Простая проверка шаблона (поддержка только * в конце)
        if (fullPattern.endsWith('*')) {
          const prefix = fullPattern.slice(0, -1);
          if (key.startsWith(prefix)) {
            keys.push(key);
          }
        } else if (key === fullPattern) {
          keys.push(key);
        }
      }
      
      return keys;
    } catch (error) {
      console.error('Memory cache keys error:', error);
      return [];
    }
  }

  /**
   * Очистить все ключи по шаблону
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.keys(pattern);
      await Promise.all(keys.map(key => this.delete(this.removePrefix(key))));
    } catch (error) {
      console.error('Memory cache clearPattern error:', error);
    }
  }

  /**
   * Получить TTL ключа
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const entry = this.cache.get(fullKey);
      
      if (!entry || !entry.expiresAt) {
        return -1; // No TTL
      }
      
      const remaining = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
      return remaining;
    } catch (error) {
      console.error('Memory cache ttl error:', error);
      return -2; // Key doesn't exist
    }
  }

  /**
   * Установить TTL для ключа
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const entry = this.cache.get(fullKey);
      
      if (entry) {
        entry.expiresAt = Date.now() + ttl * 1000;
      }
    } catch (error) {
      console.error('Memory cache expire error:', error);
    }
  }

  /**
   * Очистка устаревших записей
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Получить полный ключ с префиксом
   */
  private getFullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Удалить префикс из ключа
   */
  private removePrefix(fullKey: string): string {
    return fullKey.replace(this.prefix, '');
  }

  /**
   * Получить статистику кэша
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Очистить весь кэш
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }
}

// Глобальный экземпляр сервиса кэширования в памяти
export const memoryCacheService = new MemoryCacheService();
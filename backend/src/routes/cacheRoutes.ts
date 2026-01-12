import express from 'express';
import { cachedMarketDataService } from '../services/CachedMarketDataService';
import { memoryCacheService } from '../services/MemoryCacheService';

const router = express.Router();

/**
 * Получить статистику кэша
 */
router.get('/stats', async (req, res) => {
  try {
    const cacheStats = await cachedMarketDataService.getCacheStats();
    const memoryStats = memoryCacheService.getStats();
    
    res.json({
      success: true,
      data: {
        cacheStats,
        memoryStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка получения статистики кэша:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статистики кэша'
    });
  }
});

/**
 * Очистить кэш для конкретного символа
 */
router.delete('/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    await cachedMarketDataService.invalidateSymbolCache(symbol);
    
    res.json({
      success: true,
      message: `Кэш для ${symbol} очищен`,
      data: { symbol }
    });
  } catch (error) {
    console.error('Ошибка очистки кэша символа:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка очистки кэша символа'
    });
  }
});

/**
 * Очистить весь кэш рыночных данных
 */
router.delete('/market', async (req, res) => {
  try {
    await cachedMarketDataService.invalidateAllCache();
    
    res.json({
      success: true,
      message: 'Весь кэш рыночных данных очищен',
      data: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Ошибка очистки кэша рыночных данных:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка очистки кэша рыночных данных'
    });
  }
});

/**
 * Получить TTL для ключа
 */
router.get('/ttl/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const ttl = await memoryCacheService.ttl(key);
    
    res.json({
      success: true,
      data: {
        key,
        ttl,
        exists: ttl > -2
      }
    });
  } catch (error) {
    console.error('Ошибка получения TTL:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения TTL'
    });
  }
});

/**
 * Получить все ключи по шаблону
 */
router.get('/keys', async (req, res) => {
  try {
    const { pattern = '*' } = req.query;
    const keys = await memoryCacheService.keys(pattern as string);
    
    res.json({
      success: true,
      data: {
        pattern,
        keys,
        count: keys.length
      }
    });
  } catch (error) {
    console.error('Ошибка получения ключей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения ключей'
    });
  }
});

/**
 * Очистить весь кэш приложения
 */
router.delete('/clear', async (req, res) => {
  try {
    await memoryCacheService.clear();
    
    res.json({
      success: true,
      message: 'Весь кэш приложения очищен',
      data: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Ошибка очистки кэша:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка очистки кэша'
    });
  }
});

export default router;
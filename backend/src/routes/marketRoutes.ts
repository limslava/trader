import express from 'express';
import { MarketDataService } from '../services/MarketDataService';
import { AnalysisService } from '../services/AnalysisService';

const router = express.Router();
const marketDataService = new MarketDataService();
const analysisService = new AnalysisService();

// Получение цены актива
router.get('/price/:symbol', async (req: express.Request, res: express.Response) => {
  try {
    const { symbol } = req.params;
    const { exchange } = req.query;

    if (!symbol) {
      return res.status(400).json({
        error: 'Не указан символ актива',
        message: 'Параметр symbol обязателен'
      });
    }

    const priceData = await marketDataService.getPrice(
      symbol.toUpperCase(), 
      exchange as string
    );

    if (!priceData) {
      return res.status(404).json({
        error: 'Актив не найден',
        symbol,
        message: 'Не удалось получить данные для указанного символа'
      });
    }

    return res.json({
      success: true,
      data: priceData
    });

  } catch (error) {
    console.error('Ошибка получения цены:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить данные цены'
    });
  }
});

// Получение цен нескольких активов
router.post('/prices', async (req: express.Request, res: express.Response) => {
  try {
    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        error: 'Неверный формат запроса',
        message: 'Параметр symbols должен быть массивом символов'
      });
    }

    if (symbols.length > 50) {
      return res.status(400).json({
        error: 'Слишком много символов',
        message: 'Максимальное количество символов в одном запросе: 50'
      });
    }

    const prices = await marketDataService.getMultiplePrices(symbols);
    const pricesArray = Array.from(prices.entries()).map(([symbol, data]) => ({
      ...data,
      symbol
    }));

    return res.json({
      success: true,
      data: pricesArray,
      count: pricesArray.length
    });

  } catch (error) {
    console.error('Ошибка получения цен:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить данные цен'
    });
  }
});

// Получение технических индикаторов
router.get('/indicators/:symbol', async (req: express.Request, res: express.Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        error: 'Не указан символ актива'
      });
    }

    const indicators = await marketDataService.getTechnicalIndicators(symbol.toUpperCase());

    if (!indicators) {
      return res.status(404).json({
        error: 'Не удалось получить индикаторы',
        symbol
      });
    }

    return res.json({
      success: true,
      data: indicators
    });

  } catch (error) {
    console.error('Ошибка получения индикаторов:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить технические индикаторы'
    });
  }
});

// Получение популярных российских акций
router.get('/stocks/popular', async (req: express.Request, res: express.Response) => {
  try {
    const stocks = await marketDataService.getPopularRussianStocks();
    
    // Получаем текущие цены для всех акций
    const prices = await marketDataService.getMultiplePrices(
      stocks.map(stock => stock.symbol)
    );

    const stocksWithPrices = stocks.map(stock => {
      const priceData = prices.get(stock.symbol);
      return {
        ...stock,
        currentPrice: priceData?.price || null,
        change: priceData?.change || null,
        changePercent: priceData?.changePercent || null
      };
    });

    return res.json({
      success: true,
      data: stocksWithPrices,
      count: stocksWithPrices.length
    });

  } catch (error) {
    console.error('Ошибка получения популярных акций:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить список популярных акций'
    });
  }
});

// Получение популярных криптовалют
router.get('/crypto/popular', async (req: express.Request, res: express.Response) => {
  try {
    const cryptos = await marketDataService.getPopularCryptos();
    
    // Получаем текущие цены для всех криптовалют
    const prices = await marketDataService.getMultiplePrices(
      cryptos.map(crypto => crypto.symbol)
    );

    const cryptosWithPrices = cryptos.map(crypto => {
      const priceData = prices.get(crypto.symbol);
      return {
        ...crypto,
        currentPrice: priceData?.price || null,
        change: priceData?.change || null,
        changePercent: priceData?.changePercent || null
      };
    });

    return res.json({
      success: true,
      data: cryptosWithPrices,
      count: cryptosWithPrices.length
    });

  } catch (error) {
    console.error('Ошибка получения популярных криптовалют:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось получить список популярных криптовалют'
    });
  }
});

// Поиск активов
router.get('/search', async (req: express.Request, res: express.Response) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Не указан поисковый запрос',
        message: 'Параметр query обязателен'
      });
    }

    const searchTerm = query.toLowerCase();
    
    // Получаем все популярные активы
    const stocks = await marketDataService.getPopularRussianStocks();
    const cryptos = await marketDataService.getPopularCryptos();
    
    const allAssets = [...stocks, ...cryptos];
    
    // Фильтруем по названию или символу
    const results = allAssets.filter(asset => 
      asset.name.toLowerCase().includes(searchTerm) ||
      asset.symbol.toLowerCase().includes(searchTerm)
    );

    return res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('Ошибка поиска активов:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось выполнить поиск'
    });
  }
});

// Получение анализа актива
router.get('/analysis/:symbol', async (req: express.Request, res: express.Response) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        error: 'Не указан символ актива'
      });
    }

    const analysis = await analysisService.analyzeAsset(symbol.toUpperCase());

    if (!analysis) {
      return res.status(404).json({
        error: 'Не удалось проанализировать актив',
        symbol
      });
    }

    return res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Ошибка анализа актива:', error);
    return res.status(500).json({
      error: 'Ошибка сервера',
      message: 'Не удалось проанализировать актив'
    });
  }
});

export default router;
-- PostgreSQL инициализация для трейдинг-приложения
-- Создание таблиц для портфеля, транзакций и пользовательских данных

-- Таблица пользователей (уже создана в auth)
-- CREATE TABLE IF NOT EXISTS users (
--     id SERIAL PRIMARY KEY,
--     username VARCHAR(50) UNIQUE NOT NULL,
--     email VARCHAR(100) UNIQUE NOT NULL,
--     password_hash VARCHAR(255) NOT NULL,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Таблица портфеля
CREATE TABLE IF NOT EXISTS portfolio (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('STOCK', 'CRYPTO', 'ETF', 'BOND')),
    quantity DECIMAL(15, 8) NOT NULL DEFAULT 0,
    average_price DECIMAL(15, 8) NOT NULL,
    current_price DECIMAL(15, 8),
    total_value DECIMAL(15, 8),
    profit_loss DECIMAL(15, 8),
    profit_loss_percent DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, symbol)
);

-- Таблица транзакций
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('STOCK', 'CRYPTO', 'ETF', 'BOND')),
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
    quantity DECIMAL(15, 8) NOT NULL,
    price DECIMAL(15, 8) NOT NULL,
    total_amount DECIMAL(15, 8) NOT NULL,
    fee DECIMAL(15, 8) DEFAULT 0,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Таблица управления капиталом пользователя
CREATE TABLE IF NOT EXISTS user_capital (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    initial_capital DECIMAL(15, 2) DEFAULT 0.00,
    current_capital DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Таблица настроек пользователя
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    risk_tolerance VARCHAR(20) DEFAULT 'MEDIUM' CHECK (risk_tolerance IN ('LOW', 'MEDIUM', 'HIGH')),
    max_position_size_percent DECIMAL(5, 2) DEFAULT 10.00,
    stop_loss_percent DECIMAL(5, 2) DEFAULT 2.00,
    take_profit_percent DECIMAL(5, 2) DEFAULT 4.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Таблица избранных активов
CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('STOCK', 'CRYPTO', 'ETF', 'BOND')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, symbol)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_symbol ON portfolio(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_user_capital_user_id ON user_capital(user_id);

-- Вставка начальных настроек для существующих пользователей
INSERT INTO user_settings (user_id, risk_tolerance, max_position_size_percent, stop_loss_percent, take_profit_percent)
SELECT id, 'MEDIUM', 10.00, 2.00, 4.00
FROM users
WHERE NOT EXISTS (SELECT 1 FROM user_settings WHERE user_settings.user_id = users.id);

-- Комментарии к таблицам
COMMENT ON TABLE portfolio IS 'Портфель пользователя с текущими позициями';
COMMENT ON TABLE transactions IS 'История транзакций пользователя';
COMMENT ON TABLE user_settings IS 'Настройки пользователя для риск-менеджмента';
COMMENT ON TABLE watchlist IS 'Избранные активы пользователя';
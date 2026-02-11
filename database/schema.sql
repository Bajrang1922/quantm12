-- Quantum Alpha India - Database Schema
-- Database: quantumalphaindiadb
-- Created: February 10, 2026

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  role ENUM('master', 'trader', 'follower', 'admin') NOT NULL DEFAULT 'trader',
  auth_method ENUM('local', 'oauth', 'api_key') NOT NULL DEFAULT 'local',
  name VARCHAR(255),
  status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_username (username),
  INDEX idx_role (role),
  INDEX idx_auth_method (auth_method)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- OAUTH TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMP NULL,
  scope TEXT,
  provider VARCHAR(100) DEFAULT 'aliceblue',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_account (user_id, account_id, provider),
  INDEX idx_user_id (user_id),
  INDEX idx_account_id (account_id),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- OAUTH CONFIGURATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS oauth_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  provider VARCHAR(100) DEFAULT 'aliceblue',
  app_code VARCHAR(255),
  client_id VARCHAR(255),
  client_secret TEXT,
  redirect_uri VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_config (user_id, provider),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- FOLLOWERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS followers (
  id VARCHAR(255) PRIMARY KEY,
  master_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  follower_name VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive', 'paused', 'disconnected') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (master_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_master_id (master_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- FOLLOWER CREDENTIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS follower_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  follower_id VARCHAR(255) NOT NULL,
  login_username VARCHAR(255) UNIQUE NOT NULL,
  login_password_hash VARCHAR(255) NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  lot_multiplier DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  max_quantity INT,
  max_order_value DECIMAL(15, 2),
  max_daily_loss DECIMAL(15, 2),
  allowed_instruments TEXT,
  allowed_product_types VARCHAR(255) DEFAULT 'MIS,CNC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_follower (follower_id),
  INDEX idx_login_username (login_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- RISK CONFIGURATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS risk_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  follower_id VARCHAR(255) NOT NULL,
  lot_multiplier DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
  max_quantity INT,
  max_order_value DECIMAL(15, 2),
  max_daily_loss DECIMAL(15, 2),
  daily_loss_current DECIMAL(15, 2) DEFAULT 0,
  daily_loss_date DATE,
  stop_trading_if_loss_exceeded BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_follower (follower_id),
  INDEX idx_follower_id (follower_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COPY TRADES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS copy_trades (
  id VARCHAR(255) PRIMARY KEY,
  master_id VARCHAR(255) NOT NULL,
  follower_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  side ENUM('BUY', 'SELL') NOT NULL,
  master_qty INT NOT NULL,
  follower_qty INT NOT NULL,
  price DECIMAL(15, 4) NOT NULL,
  status ENUM('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'PARTIALLY_FILLED') NOT NULL DEFAULT 'PENDING',
  reason TEXT,
  order_id VARCHAR(255),
  execution_price DECIMAL(15, 4),
  executed_qty INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (master_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE,
  INDEX idx_master_id (master_id),
  INDEX idx_follower_id (follower_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MASTER TRADES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS master_trades (
  id VARCHAR(255) PRIMARY KEY,
  master_id VARCHAR(255) NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  side ENUM('BUY', 'SELL') NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(15, 4) NOT NULL,
  executed_qty INT,
  status VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_master_id (master_id),
  INDEX idx_symbol (symbol),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (master_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TRADE EVENTS TABLE (For real-time tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS trade_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  copy_trade_id VARCHAR(255),
  follower_id VARCHAR(255),
  event_type ENUM('CREATED', 'PENDING', 'EXECUTING', 'SUCCESS', 'FAILED', 'CANCELLED', 'AMENDED', 'FILLED') NOT NULL,
  event_data JSON,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (copy_trade_id) REFERENCES copy_trades(id) ON DELETE CASCADE,
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE,
  INDEX idx_copy_trade_id (copy_trade_id),
  INDEX idx_follower_id (follower_id),
  INDEX idx_event_type (event_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type ENUM('info', 'warning', 'error', 'success') NOT NULL DEFAULT 'info',
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_read_at (read_at),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PERFORMANCE METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS performance_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  follower_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  total_trades INT DEFAULT 0,
  successful_trades INT DEFAULT 0,
  failed_trades INT DEFAULT 0,
  total_qty INT DEFAULT 0,
  realized_pnl DECIMAL(15, 2) DEFAULT 0,
  pnl_percentage DECIMAL(10, 2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE,
  UNIQUE KEY unique_follower_date (follower_id, date),
  INDEX idx_follower_id (follower_id),
  INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SYSTEM SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_copy_trades_date_range ON copy_trades(created_at DESC);
CREATE INDEX idx_copy_trades_follower_status ON copy_trades(follower_id, status);
CREATE INDEX idx_followers_master_status ON followers(master_id, status);
CREATE INDEX idx_audit_logs_timestamp_range ON audit_logs(created_at DESC);

-- ============================================
-- INSERT SAMPLE SYSTEM SETTINGS
-- ============================================
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('app_name', 'Quantum Alpha India', 'string', 'Application Name'),
('app_version', '1.0.0', 'string', 'Current Application Version'),
('copy_trading_enabled', 'true', 'boolean', 'Enable/Disable Copy Trading Feature'),
('polling_interval', '5000', 'number', 'Polling interval in milliseconds'),
('max_followers_per_master', '100', 'number', 'Maximum followers per master account'),
('session_timeout', '3600', 'number', 'Session timeout in seconds')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- ============================================
-- CREATE VIEWS FOR REPORTING
-- ============================================

-- Active followers view
CREATE OR REPLACE VIEW v_active_followers AS
SELECT 
  f.id,
  f.follower_name,
  f.master_id,
  f.status,
  fc.lot_multiplier,
  COUNT(ct.id) as total_copy_trades,
  SUM(CASE WHEN ct.status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_trades,
  SUM(CASE WHEN ct.status = 'FAILED' THEN 1 ELSE 0 END) as failed_trades,
  MAX(ct.created_at) as last_trade_time
FROM followers f
LEFT JOIN follower_credentials fc ON f.id = fc.follower_id
LEFT JOIN copy_trades ct ON f.id = ct.follower_id
WHERE f.status = 'active'
GROUP BY f.id, f.follower_name, f.master_id, f.status, fc.lot_multiplier;

-- Daily trading summary view
CREATE OR REPLACE VIEW v_daily_trading_summary AS
SELECT 
  DATE(ct.created_at) as trading_date,
  ct.master_id,
  COUNT(DISTINCT ct.follower_id) as unique_followers,
  COUNT(*) as total_copy_trades,
  SUM(CASE WHEN ct.status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_trades,
  SUM(CASE WHEN ct.status = 'FAILED' THEN 1 ELSE 0 END) as failed_trades,
  COUNT(DISTINCT ct.symbol) as unique_symbols,
  SUM(ct.master_qty) as total_master_qty,
  SUM(ct.follower_qty) as total_follower_qty
FROM copy_trades ct
GROUP BY DATE(ct.created_at), ct.master_id;

-- Follower performance view
CREATE OR REPLACE VIEW v_follower_performance AS
SELECT 
  f.id,
  f.follower_name,
  f.master_id,
  COUNT(*) as total_trades,
  SUM(CASE WHEN ct.status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_trades,
  ROUND((SUM(CASE WHEN ct.status = 'SUCCESS' THEN 1 ELSE 0 END) / COUNT(*) * 100), 2) as success_rate,
  SUM(CASE WHEN ct.side = 'BUY' THEN 1 ELSE 0 END) as buy_trades,
  SUM(CASE WHEN ct.side = 'SELL' THEN 1 ELSE 0 END) as sell_trades,
  MAX(ct.created_at) as last_trade_time
FROM followers f
LEFT JOIN copy_trades ct ON f.id = ct.follower_id
GROUP BY f.id, f.follower_name, f.master_id;

-- ============================================
-- END OF SCHEMA
-- ============================================

-- Quantum app SQL schema (MySQL / MariaDB compatible)
-- Create the database (run as a user with CREATE DATABASE privileges or create it from CloudPanel UI)
-- Example: CREATE DATABASE quantum_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Switch to the database you created
-- USE quantum_db;

-- Followers (accounts)
CREATE TABLE IF NOT EXISTS followers (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(120) UNIQUE,
  password VARCHAR(255),
  telegram_id VARCHAR(120),
  initial_balance DECIMAL(20,2) NOT NULL DEFAULT 0,
  risk_profile ENUM('Conservative','Moderate','Aggressive') NOT NULL DEFAULT 'Moderate',
  lot_multiplier DECIMAL(10,4) NOT NULL DEFAULT 1,
  per_account_cap DECIMAL(20,2) NOT NULL DEFAULT 0,
  daily_loss_limit DECIMAL(20,2) NOT NULL DEFAULT 0,
  max_exposure_per_symbol DECIMAL(20,2) NOT NULL DEFAULT 0,
  current_pl DECIMAL(20,2) NOT NULL DEFAULT 0,
  status ENUM('Active','Paused','Disconnected') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trades
CREATE TABLE IF NOT EXISTS trades (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  timestamp VARCHAR(50) NOT NULL,
  account VARCHAR(50) NOT NULL,
  symbol VARCHAR(80) NOT NULL,
  type ENUM('Market','Limit','Stop') NOT NULL,
  side ENUM('Buy','Sell') NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  price DECIMAL(20,4) NOT NULL DEFAULT 0,
  status ENUM('Filled','Partial Fill','Cancelled','Pending') NOT NULL DEFAULT 'Pending',
  is_new TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_account (account),
  CONSTRAINT fk_trades_follower FOREIGN KEY (account) REFERENCES followers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Logs
CREATE TABLE IF NOT EXISTS logs (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  level ENUM('Info','Warning','Error','Intervention') NOT NULL DEFAULT 'Info',
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed followers (from src/lib/data.ts)
INSERT INTO followers (id, name, username, password, telegram_id, initial_balance, risk_profile, lot_multiplier, per_account_cap, daily_loss_limit, max_exposure_per_symbol, current_pl, status)
VALUES
('ZERODHA-001', 'Follower One', 'follower1', 'password1', '@followerone', 10000.00, 'Moderate', 1.0000, 100000.00, 5000.00, 25000.00, 1250.75, 'Active'),
('UPSTOX-002', 'Follower Two', 'follower2', 'password2', NULL, 25000.00, 'Aggressive', 2.0000, 250000.00, 20000.00, 75000.00, -850.00, 'Active'),
('ANGEL-003', 'Follower Three', 'follower3', 'password3', NULL, 5000.00, 'Conservative', 0.5000, 50000.00, 2500.00, 10000.00, 450.20, 'Paused')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), username = VALUES(username), password = VALUES(password), initial_balance = VALUES(initial_balance), current_pl = VALUES(current_pl), status = VALUES(status);

-- Seed trades (from src/lib/data.ts)
INSERT INTO trades (id, timestamp, account, symbol, type, side, quantity, price, status, is_new)
VALUES
('T001','10:30:05','Master','RELIANCE','Market','Buy',100,2850.50,'Filled',0),
('T002','10:32:15','Master','TCS','Limit','Sell',50,3900.00,'Pending',0),
('T003','10:35:40','Master','INFY','Market','Buy',200,1650.25,'Filled',0),
('T004','10:45:10','Master','HDFCBANK','Market','Sell',75,1550.80,'Filled',0),
('T101','11:01:15','ZERODHA-001','WIPRO','Market','Buy',50,480.10,'Filled',0),
('T102','11:05:20','UPSTOX-002','RELIANCE','Market','Sell',200,2855.00,'Filled',0)
ON DUPLICATE KEY UPDATE
  timestamp = VALUES(timestamp), account = VALUES(account), symbol = VALUES(symbol), price = VALUES(price), status = VALUES(status);

-- Seed logs (from src/lib/data.ts)
INSERT INTO logs (id, timestamp, level, message)
VALUES
('L001', '2024-07-30 10:30:05', 'Info', 'Master order placed: BUY 100 RELIANCE @ Market'),
('L002', '2024-07-30 10:30:06', 'Info', 'Mirrored order to FA-001: BUY 100 RELIANCE @ Market'),
('L003', '2024-07-30 10:30:06', 'Info', 'Mirrored order to FA-002: BUY 200 RELIANCE @ Market'),
('L004', '2024-07-30 10:30:07', 'Info', 'Mirrored order to FA-003: BUY 50 RELIANCE @ Market'),
('L005', '2024-07-30 11:15:20', 'Info', 'Master order placed: SELL 50 TCS @ Limit 3900.00'),
('L006', '2024-07-30 12:05:10', 'Warning', 'FA-002 approaching daily loss limit. Current loss: -18,540.00'),
('L007', '2024-07-30 12:10:00', 'Intervention', 'Trading paused for FA-002. Daily loss limit of 20,000 exceeded.')
ON DUPLICATE KEY UPDATE level = VALUES(level), message = VALUES(message), timestamp = VALUES(timestamp);

-- Master-Follower Trade Replication Tables

-- Follower Credentials (Alice Blue API access)
CREATE TABLE IF NOT EXISTS follower_credentials (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  follower_id VARCHAR(50) NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  broker_session_id VARCHAR(255),
  status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(follower_id),
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Follower Risk Configuration (per-account trading rules)
CREATE TABLE IF NOT EXISTS follower_risk_config (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  follower_id VARCHAR(50) NOT NULL,
  lot_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  max_quantity INT NOT NULL DEFAULT 100,
  max_order_value DECIMAL(15,2),
  max_daily_loss DECIMAL(15,2),
  allowed_instruments JSON,
  allowed_product_types JSON,
  allowed_order_types JSON,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(follower_id),
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Mapping (master_order_id ↔ follower_order_ids)
CREATE TABLE IF NOT EXISTS order_mappings (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  master_order_id VARCHAR(255) NOT NULL,
  follower_id VARCHAR(50) NOT NULL,
  follower_order_id VARCHAR(255),
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10),
  side ENUM('BUY', 'SELL') NOT NULL,
  quantity INT NOT NULL,
  executed_quantity INT DEFAULT 0,
  product_type VARCHAR(10),
  status ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE,
  INDEX idx_master_order (master_order_id),
  INDEX idx_follower (follower_id),
  INDEX idx_follower_order (follower_order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Trade Events (audit log for master trades)
CREATE TABLE IF NOT EXISTS trade_events (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  master_order_id VARCHAR(255) NOT NULL,
  follower_id VARCHAR(50),
  event_type ENUM('PLACE', 'MODIFY', 'EXIT', 'CANCEL') NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  exchange VARCHAR(10),
  side ENUM('BUY', 'SELL') NOT NULL,
  quantity INT NOT NULL,
  product_type VARCHAR(10),
  order_type VARCHAR(10),
  price DECIMAL(10,2),
  status ENUM('success', 'warning', 'error') NOT NULL DEFAULT 'success',
  message TEXT,
  risk_validated BOOLEAN DEFAULT TRUE,
  total_followers INT DEFAULT 0,
  successful_followers INT DEFAULT 0,
  failed_followers INT DEFAULT 0,
  skipped_followers INT DEFAULT 0,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_master_order (master_order_id),
  INDEX idx_follower (follower_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Follower Consent & Permissions
CREATE TABLE IF NOT EXISTS follower_consents (
  id VARCHAR(50) NOT NULL PRIMARY KEY,
  follower_id VARCHAR(50) NOT NULL,
  trade_replication_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  copy_trading_active BOOLEAN NOT NULL DEFAULT TRUE,
  consent_given_at TIMESTAMP,
  consent_token VARCHAR(255),
  copy_trading_stopped_at TIMESTAMP,
  copy_trading_stopped_by VARCHAR(100),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE(follower_id),
  FOREIGN KEY (follower_id) REFERENCES followers(id) ON DELETE CASCADE,
  INDEX idx_copy_trading_active (copy_trading_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Master Settings (Risk Management & Lots Configuration)
CREATE TABLE IF NOT EXISTS master_settings (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  max_quantity_per_trade INT NOT NULL DEFAULT 1000,
  max_daily_loss_percentage DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  min_lot_size INT NOT NULL DEFAULT 1,
  default_lot_multiplier DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
  auto_liquidate_on_loss BOOLEAN NOT NULL DEFAULT FALSE,
  max_concurrent_trades INT NOT NULL DEFAULT 10,
  auto_replicate_new_trades BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Helpful quick queries
-- List followers: SELECT * FROM followers ORDER BY name;
-- Recent trades: SELECT * FROM trades ORDER BY created_at DESC LIMIT 100;
-- Recent logs: SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100;
-- Active follower credentials: SELECT fc.*, rc.* FROM follower_credentials fc LEFT JOIN follower_risk_config rc ON fc.follower_id = rc.follower_id WHERE fc.status = 'ACTIVE';
-- Order mappings for master order: SELECT * FROM order_mappings WHERE master_order_id = 'MASTER_ORDER_ID' ORDER BY created_at DESC;

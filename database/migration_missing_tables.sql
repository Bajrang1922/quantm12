-- Migration: Add missing tables to CloudPanel database
-- This script adds all missing tables that should exist but don't
-- Run this on your CloudPanel database if the main schema wasn't fully applied

-- Follower Consent & Permissions (CRITICAL - required by stop-copy-trading API)
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

-- Add follower_consents for existing followers (initialize copy trading as enabled by default)
INSERT IGNORE INTO follower_consents 
(id, follower_id, trade_replication_enabled, copy_trading_active, copy_trading_stopped_at, copy_trading_stopped_by, created_at, updated_at)
SELECT 
  CONCAT(f.id, '_consent_', UNIX_TIMESTAMP()),
  f.id,
  TRUE,
  TRUE,
  NULL,
  NULL,
  NOW(),
  NOW()
FROM followers f
WHERE id NOT IN (SELECT DISTINCT follower_id FROM follower_consents);

-- Initialize master_settings if not exists
INSERT IGNORE INTO master_settings (id) VALUES (1);

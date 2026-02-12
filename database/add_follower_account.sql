-- ================================================================================
-- ADD FOLLOWER ACCOUNT FOR COPY TRADING
-- ================================================================================
-- Execute these 3 INSERT statements in order to add your follower account
-- 
-- Follower Details:
--   - Client ID: 2587092
--   - API Key: qaCHOxg5DjVU9iHM7IJ450cVSzXJ7HTrvPGcrd0CJ1XLWuFS4kFUx1GTrN7DFujAN849mpgX1hWqVEB26VqEvt4kPr2g7LiozaZuBUEKhOG7F3JNtitiiE0PILPpI0Ml
--   - Master ID: 2548613
-- ================================================================================

-- STEP 1: Add follower to followers table
INSERT INTO followers (master_id, follower_name, status, created_at) 
VALUES ('2548613', 'Test Follower 1', 'active', NOW());

-- After executing STEP 1, get the follower_id from the result
-- Then use that ID for the next statements below

-- ================================================================================
-- REPLACE {follower_id_from_step_1} with the actual ID returned from STEP 1
-- For example, if STEP 1 inserted and returned ID 1, then use 1 below
-- ================================================================================

-- STEP 2: Add credentials for the follower
INSERT INTO follower_credentials (follower_id, client_id, api_key, lot_multiplier, max_quantity, created_at) 
VALUES ({follower_id_from_step_1}, '2587092', 'qaCHOxg5DjVU9iHM7IJ450cVSzXJ7HTrvPGcrd0CJ1XLWuFS4kFUx1GTrN7DFujAN849mpgX1hWqVEB26VqEvt4kPr2g7LiozaZuBUEKhOG7F3JNtitiiE0PILPpI0Ml', 1.0, 10000, NOW());

-- STEP 3: Enable copy trading for this follower
INSERT INTO follower_consents (follower_id, copy_trading_active, created_at) 
VALUES ({follower_id_from_step_1}, true, NOW());

-- ================================================================================
-- VERIFY: Run this query to confirm follower was added correctly
-- ================================================================================
SELECT 
  f.id,
  f.master_id,
  f.follower_name,
  f.status,
  fc.client_id,
  fc.lot_multiplier,
  fc.max_quantity,
  fcon.copy_trading_active
FROM followers f
LEFT JOIN follower_credentials fc ON f.id = fc.follower_id
LEFT JOIN follower_consents fcon ON f.id = fcon.follower_id
WHERE f.master_id = '2548613'
ORDER BY f.created_at DESC;

-- ================================================================================
-- EXAMPLE EXECUTION (if follower_id from step 1 is 1):
-- ================================================================================
/*
STEP 1: Insert follower
INSERT INTO followers (master_id, follower_name, status, created_at) 
VALUES ('2548613', 'Test Follower 1', 'active', NOW());
-- Result: New record inserted with ID = 1

STEP 2: Use ID 1 from step 1
INSERT INTO follower_credentials (follower_id, client_id, api_key, lot_multiplier, max_quantity, created_at) 
VALUES (1, '2587092', 'qaCHOxg5DjVU9iHM7IJ450cVSzXJ7HTrvPGcrd0CJ1XLWuFS4kFUx1GTrN7DFujAN849mpgX1hWqVEB26VqEvt4kPr2g7LiozaZuBUEKhOG7F3JNtitiiE0PILPpI0Ml', 1.0, 10000, NOW());

STEP 3: Use ID 1 from step 1
INSERT INTO follower_consents (follower_id, copy_trading_active, created_at) 
VALUES (1, true, NOW());

VERIFY:
SELECT 
  f.id, f.master_id, f.follower_name, f.status,
  fc.client_id, fc.lot_multiplier, fc.max_quantity,
  fcon.copy_trading_active
FROM followers f
LEFT JOIN follower_credentials fc ON f.id = fc.follower_id
LEFT JOIN follower_consents fcon ON f.id = fcon.follower_id
WHERE f.master_id = '2548613'
ORDER BY f.created_at DESC;

Expected Result:
| id | master_id | follower_name   | status | client_id | lot_multiplier | max_quantity | copy_trading_active |
|----|-----------|-----------------|--------|-----------|----------------|--------------|                 |
| 1  | 2548613   | Test Follower 1 | active | 2587092   | 1.0            | 10000        | 1 (true)            |
*/

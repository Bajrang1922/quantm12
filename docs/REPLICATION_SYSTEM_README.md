# Master-Follower Trade Replication System - Implementation Guide

## ✅ What's Been Implemented

The complete master-follower trade replication system is now ready to use! Here's what's included:

### 📊 Database
- **5 New Tables** with full audit trail
  - `follower_credentials` — Store Alice Blue API access (encrypted)
  - `follower_risk_config` — Per-follower trading rules
  - `order_mappings` — Track master ↔ follower order relationships
  - `trade_events` — Audit log of all replication events
  - `follower_consents` — Compliance & consent tracking

### 🔧 Backend Engine
- **Trade Replication Engine** (`src/lib/replication-engine.ts`)
  - Risk validation (symbols, quantities, order values)
  - Automatic quantity adjustment (multipliers)
  - Order mapping and tracking
  - Exit/modification sync
  - Encrypted credential management

### 📡 API Endpoints (6 Groups)
1. **Follower Management**
   - Register followers with Alice Blue credentials
   - Configure per-follower risk rules
   - Record compliance consent

2. **Trade Operations**
   - Replicate master orders to all followers
   - Exit all positions for a master order
   - Modify SL/targets across followers

3. **Monitoring & Queries**
   - Query trade events
   - Track order mappings
   - Monitor replication status

### 📚 Documentation
- [MASTER_FOLLOWER_ARCHITECTURE.md](MASTER_FOLLOWER_ARCHITECTURE.md) — Complete system design
- [API_USAGE_GUIDE.md](API_USAGE_GUIDE.md) — Full API reference with curl examples
- [SETUP_REPLICATION_SYSTEM.md](SETUP_REPLICATION_SYSTEM.md) — Setup & configuration guide

### 🧪 Testing
- `test-replication.js` — Complete integration test suite

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Setup Database

```bash
# Create database
mysql -u root -p -e "CREATE DATABASE quantum_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Apply schema
mysql -u root -p quantum_db < database/quantum_schema.sql
```

### Step 2: Configure Environment

Create `.env.local`:
```env
QUANTUM_ALPHA_SECRET=your-secret-key-here
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
DATABASE_URL=mysql://root:password@localhost:3306/quantum_db
```

### Step 3: Start Server

```bash
npm run dev
```

### Step 4: Run Integration Test

```bash
node test-replication.js http://localhost:3000 your-secret-key-here
```

Expected: All 10 tests should pass ✓

---

## 📖 API Overview

### 1️⃣ Register a Follower

```bash
curl -X POST http://localhost:3000/api/followers/credentials \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{
    "followerId": "ZERODHA-001",
    "clientId": "ABC123",
    "apiKey": "your-api-key",
    "accessToken": "your-access-token"
  }'
```

### 2️⃣ Set Risk Rules

```bash
curl -X POST http://localhost:3000/api/followers/risk-config \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{
    "followerId": "ZERODHA-001",
    "lot_multiplier": 0.5,
    "max_quantity": 50,
    "max_order_value": 50000,
    "allowed_instruments": ["SBIN", "RELIANCE"],
    "enabled": true
  }'
```

### 3️⃣ Replicate a Trade

```bash
curl -X POST http://localhost:3000/api/trades/replicate \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{
    "trade": {
      "id": "M-ORDER-001",
      "symbol": "SBIN",
      "side": "BUY",
      "quantity": 100,
      "price": 500.50
    }
  }'
```

Response:
```json
{
  "ok": true,
  "eventId": "1739876543210-abc123",
  "summary": {
    "total_followers": 3,
    "successful": 2,
    "failed": 0,
    "skipped": 1
  },
  "results": [
    {
      "follower_id": "ZERODHA-001",
      "status": "SUCCESS",
      "executed_quantity": 50
    }
  ]
}
```

### 4️⃣ Exit All Positions

```bash
curl -X POST http://localhost:3000/api/trades/exit \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{"masterOrderId": "M-ORDER-001"}'
```

### 5️⃣ Monitor Status

```bash
# Get order mappings
curl -X GET "http://localhost:3000/api/trades/replicate?masterOrderId=M-ORDER-001" \
  -H "x-qa-secret: your-secret"

# Get all trade events
curl -X GET "http://localhost:3000/api/trades/events?limit=10" \
  -H "x-qa-secret: your-secret"
```

For complete API reference, see [API_USAGE_GUIDE.md](API_USAGE_GUIDE.md)

---

## 🛡️ Security Features Implemented

✅ **Encrypted Credentials**
- Follower API keys and access tokens encrypted with AES-256-CBC
- Encryption key from `ENCRYPTION_KEY` env var
- Only last 4 characters returned in API responses

✅ **Request Authentication**
- All trade endpoints require `x-qa-secret` header
- Secret must match `QUANTUM_ALPHA_SECRET` env var
- Prevents unauthorized trade operations

✅ **Consent Tracking**
- `follower_consents` table tracks compliance
- Records timestamp, IP address, user agent
- Full audit trail for regulatory compliance

✅ **Audit Logging**
- `trade_events` table logs all replication events
- Success/failure counts per event
- Detailed mappings in `order_mappings` table

---

## 📊 How It Works

### Trade Replication Flow

```
Master places order (SBIN, 100 qty, BUY)
        ↓
POST /api/trades/replicate
        ↓
Risk Engine validates each follower:
  - Is follower enabled?
  - Is symbol allowed?
  - Calculate qty: 100 * 0.5 multiplier = 50
  - Check 50 qty ≤ max_quantity (100)? ✓
  - Check order value ≤ max_order_value? ✓
        ↓
Create order mapping:
  Master Order ID → Follower Order ID
        ↓
Place follower orders (via Alice Blue API):
  - ZERODHA-001: 50 qty (success) ✓
  - UPSTOX-002: 100 qty (success) ✓
  - ANGEL-003: (skipped - disabled)
        ↓
Return results:
  2 successful, 0 failed, 1 skipped
        ↓
When master EXITS:
  POST /api/trades/exit with masterOrderId
        ↓
Exit all follower positions
```

### Risk Engine Logic

**Per Follower:**
1. **Validation** — Check symbol, order type, product type
2. **Calculation** — Apply quantity multiplier: `follower_qty = master_qty * multiplier`
3. **Limits** — Check:
   - `follower_qty ≤ max_quantity`
   - `follower_qty * price ≤ max_order_value`
   - Daily loss doesn't exceed `max_daily_loss`
4. **Execute** — Place order or skip with reason

**If all checks pass** → Order placed, mapping recorded
**If any check fails** → Order skipped, reason logged

---

## 📁 File Structure

```
/workspaces/quantum
├── database/
│   └── quantum_schema.sql          ← New tables for replication
├── src/
│   ├── lib/
│   │   └── replication-engine.ts   ← Core replication logic
│   └── app/api/
│       ├── followers/              ← Follower management
│       │   ├── route.ts
│       │   ├── credentials/
│       │   ├── risk-config/
│       │   └── consent/
│       └── trades/                 ← Trade operations
│           ├── replicate/
│           ├── exit/
│           ├── modify/
│           ├── events/
│           └── mappings/
├── docs/
│   ├── MASTER_FOLLOWER_ARCHITECTURE.md    ← System design
│   ├── API_USAGE_GUIDE.md                 ← API reference
│   └── SETUP_REPLICATION_SYSTEM.md        ← Setup guide
└── test-replication.js                    ← Integration tests
```

---

## 🔄 Complete Trade Lifecycle Example

### Scenario: Master buys 100 SBIN, Followers adjust

**Setup:**
- ZERODHA-001: 0.5x multiplier = 50 qty max
- UPSTOX-002: 1.0x multiplier = 100 qty max (but max_quantity=80)
- ANGEL-003: Disabled

**Event 1: Master places BUY 100 SBIN**
```
POST /api/trades/replicate
{
  "trade": {
    "id": "M1",
    "symbol": "SBIN",
    "side": "BUY",
    "quantity": 100,
    "price": 500
  }
}
```

Result:
- ZERODHA-001: SUCCESS (qty 50)
- UPSTOX-002: SUCCESS (qty 80 - capped by max_quantity)
- ANGEL-003: SKIPPED (account disabled)

Mappings created:
- M1 → F1 (ZERODHA: 50)
- M1 → F2 (UPSTOX: 80)

**Event 2: Master modifies SL to 495**
```
POST /api/trades/modify
{
  "masterOrderId": "M1",
  "modification": {
    "type": "STOPLOSS",
    "value": 495
  }
}
```

Action: Update SL on F1 and F2 orders

**Event 3: Master exits position**
```
POST /api/trades/exit
{
  "masterOrderId": "M1"
}
```

Action: Exit F1 (50 qty) and F2 (80 qty)
- Mark mappings as CANCELLED
- Record in trade_events

---

## ⚙️ Configuration Examples

### Conservative Follower (0.5x multiplier, strict limits)
```json
{
  "followerId": "CONSERVATIVE",
  "lot_multiplier": 0.5,
  "max_quantity": 50,
  "max_order_value": 25000,
  "max_daily_loss": 5000,
  "allowed_instruments": ["SBIN", "RELIANCE", "INFY"],
  "allowed_product_types": ["MIS"],
  "allowed_order_types": ["MARKET"]
}
```

### Aggressive Follower (1.5x multiplier, relaxed limits)
```json
{
  "followerId": "AGGRESSIVE",
  "lot_multiplier": 1.5,
  "max_quantity": 200,
  "max_order_value": 100000,
  "max_daily_loss": 25000,
  "allowed_instruments": ["SBIN", "RELIANCE", "INFY", "TCS", "WIPRO"],
  "allowed_product_types": ["MIS", "CNC", "NRML"],
  "allowed_order_types": ["MARKET", "LIMIT"]
}
```

---

## 🐛 Troubleshooting

### "Unauthorized" error
**Cause:** Missing or incorrect `x-qa-secret` header
**Fix:** Add header: `-H "x-qa-secret: $(echo $QUANTUM_ALPHA_SECRET)"`

### "Database connection failed"
**Cause:** Database not running or credentials wrong
**Fix:** Check `DATABASE_URL` in `.env.local`

### Trades not replicating
**Cause:** Follower not registered or risk validation failed
**Fix:** Check logs in `trade_events` table for skip reasons

### "Credentials not found"
**Cause:** Follower ID mismatch
**Fix:** Use exact same `followerId` in all endpoints

---

## 📈 Monitoring Queries

### Orders replicated today
```sql
SELECT COUNT(*) as total_orders, SUM(quantity) as total_qty
FROM order_mappings 
WHERE DATE(created_at) = CURDATE() AND status != 'FAILED';
```

### Replication success rate
```sql
SELECT 
  ROUND(successful_followers / total_followers * 100, 2) as success_rate
FROM trade_events 
ORDER BY processed_at DESC LIMIT 10;
```

### Failed followers
```sql
SELECT DISTINCT follower_id, COUNT(*) as failures
FROM order_mappings 
WHERE status = 'FAILED'
GROUP BY follower_id
ORDER BY failures DESC;
```

---

## 🚨 Important Notes

- ⚠️ **Order Mapping is Critical** — Exit orders MUST use correct masterOrderId or positions won't be closed
- ⚠️ **Risk Limits are Hard Stops** — No order is placed if it exceeds follower limits
- ⚠️ **Quantity Multipliers Apply to Exits** — If follower had 0.5x, exit also uses 0.5x
- ⚠️ **API Rate Limits** — Alice Blue has rate limits; implement backoff in production
- ✅ **Encryption** — API keys are encrypted at rest; always use HTTPS in production

---

## 🔗 Resources

- [Complete Architecture Design](MASTER_FOLLOWER_ARCHITECTURE.md)
- [Full API Reference](API_USAGE_GUIDE.md)
- [Setup & Configuration](SETUP_REPLICATION_SYSTEM.md)
- [Integration Test](test-replication.js)

---

## ✨ Next Steps

1. **Deploy Database** — Run schema on your MySQL instance
2. **Configure Env Vars** — Set credentials and encryption key
3. **Test Locally** — Run `node test-replication.js`
4. **Register Followers** — Use API to add follower accounts
5. **Go Live** — Start replicating master trades!

**Ready to use!** 🎉

For detailed setup instructions, see [SETUP_REPLICATION_SYSTEM.md](SETUP_REPLICATION_SYSTEM.md)

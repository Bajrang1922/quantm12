# Master-Follower Trade Replication Architecture

## How It Works Conceptually (Master → Followers)

### 1. Master Account

Your website already:

- ✅ Connects to master Alice Blue account
- ✅ Fetches trade/order events (place, modify, exit)
- ✅ Listens to trade book updates

**Good — that's step one done.**

---

### 2. Followers Setup (Critical)

Each follower must provide:

- **Client ID** — Unique identifier for their Alice Blue account
- **API Key** — Authentication credential for API calls
- **User Consent** — ⚠️ VERY important for compliance and trust
- **Session Token** — Generated via Alice Blue OAuth/login flow

⚠️ **Important**: You cannot place trades on a follower account without their explicit login/session.

#### Best Practice Data Storage

For each follower, store:

```json
{
  "follower_id": "string",
  "client_id": "string",
  "access_token": "string",
  "api_key": "string",
  "broker_session_id": "string",
  "risk_config": {
    "lot_multiplier": 0.5,
    "max_quantity": 100,
    "max_order_value": 100000,
    "enabled": true,
    "allowed_instruments": ["NIFTY", "BANKNIFTY"],
    "allowed_product_types": ["MIS", "CNC"]
  },
  "created_at": "timestamp",
  "last_active": "timestamp"
}
```

---

### 3. Trade Mirroring Logic (Core Feature)

#### When Master Places a Trade

Your backend captures:

| Field | Required | Example |
|-------|----------|---------|
| Symbol | Yes | SBIN, RELIANCE |
| Exchange | Yes | NSE, MCX |
| Side | Yes | BUY / SELL |
| Product Type | Yes | MIS / CNC / NRML |
| Quantity | Yes | 1, 10, 100 |
| Order Type | Yes | MARKET / LIMIT |
| Price | Conditional | Required for LIMIT orders |
| Tag/Comment | Optional | "Master order for follower replication" |

#### For Each Active Follower

Apply follower-specific rules:

1. **Validate** — Check if symbol/quantity is within follower limits
2. **Calculate** — Apply quantity multiplier (e.g., 0.5x, 1x, fixed lot)
3. **Check Limits** — Verify order doesn't exceed max order value
4. **Place Order** — Execute via follower's Alice Blue API

📌 **Critical**: You must loop per follower — no bulk endpoint exists.

#### Order Placement Flow

```
Master Order Event
        ↓
Backend Listener (Webhook / Polling)
        ↓
Trade Normalizer
        ↓
Risk Engine (Apply per-follower rules)
        ↓
Follower Order Executor (Place order via Alice Blue API)
        ↓
Order Mapping Storage (Store master_order_id → follower_order_id)
```

---

### 4. Exit & Modification Sync

#### Exit Logic

- **When master exits** → exit all active follower positions
- **Apply exit rules** → Same risk multipliers apply to exit quantities
- **Handle failures** → Retry failed exit orders with exponential backoff

#### Modification Logic

If master modifies SL/target → modify follower orders

**You must map orders:**

```
master_order_id → [follower_order_id_1, follower_order_id_2, ...]
```

**Store this mapping in DB**, otherwise exits will break:

```json
{
  "master_order_id": "string",
  "follower_orders": [
    {
      "follower_id": "string",
      "follower_order_id": "string",
      "status": "ACTIVE|COMPLETED|CANCELLED",
      "created_at": "timestamp",
      "updated_at": "timestamp"
    }
  ]
}
```

---

## System Architecture

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   MASTER ACCOUNT                             │
│  (Alice Blue Connection - Place/Modify/Exit Trades)         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
        │   TRADE EVENT LISTENER   │
        │  (Webhook / Polling)     │
        └─ ─ ─ ─ ─ ┬─ ─ ─ ─ ─ ─ ─┘
                   │
                   ▼
        ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
        │  TRADE NORMALIZER        │
        │ (Parse/Validate Events)  │
        └─ ─ ─ ─ ─ ┬─ ─ ─ ─ ─ ─ ─┘
                   │
                   ▼
        ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
        │   RISK ENGINE             │
        │ (Per-Follower Rules)      │
        │ • Qty Multiplier          │
        │ • Max Order Value         │
        │ • Allowed Instruments     │
        └─ ─ ─ ─ ─ ┬─ ─ ─ ─ ─ ─ ─┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   Follower 1            Follower N
   Order Executor        Order Executor
        │                     │
        ▼                     ▼
   Alice Blue API        Alice Blue API
   Place Order           Place Order
        │                     │
        ▼                     ▼
   Store Mapping         Store Mapping
   (master → follower)   (master → follower)
```

---

## Database Schema

### Followers Table

```sql
CREATE TABLE followers (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  broker_session_id VARCHAR(255),
  status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED'),
  
  -- Risk Configuration
  lot_multiplier DECIMAL(5,2) DEFAULT 1.0,
  max_quantity INT DEFAULT 100,
  max_order_value DECIMAL(15,2),
  enabled BOOLEAN DEFAULT TRUE,
  allowed_instruments JSON,
  allowed_product_types JSON,
  
  -- Metadata
  first_active_at TIMESTAMP,
  last_active_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, client_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Order Mapping Table

```sql
CREATE TABLE order_mappings (
  id UUID PRIMARY KEY,
  master_order_id VARCHAR(255) NOT NULL,
  follower_id UUID NOT NULL,
  follower_order_id VARCHAR(255),
  
  -- Trade Details
  symbol VARCHAR(20),
  exchange VARCHAR(10),
  side ENUM('BUY', 'SELL'),
  quantity INT,
  product_type VARCHAR(10),
  
  -- Status Tracking
  status ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED'),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (follower_id) REFERENCES followers(id),
  INDEX (master_order_id),
  INDEX (follower_id)
);
```

### Trade Events Table (Audit)

```sql
CREATE TABLE trade_events (
  id UUID PRIMARY KEY,
  event_type ENUM('PLACE', 'MODIFY', 'EXIT', 'CANCEL'),
  master_order_id VARCHAR(255),
  
  -- Trade Details
  symbol VARCHAR(20),
  exchange VARCHAR(10),
  side ENUM('BUY', 'SELL'),
  quantity INT,
  product_type VARCHAR(10),
  order_type VARCHAR(10),
  price DECIMAL(10,2),
  
  -- Processing
  total_followers INT DEFAULT 0,
  successful_followers INT DEFAULT 0,
  failed_followers INT DEFAULT 0,
  
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX (master_order_id),
  INDEX (created_at)
);
```

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Follower authentication (OAuth with Alice Blue)
- [ ] Store follower credentials securely (encrypted)
- [ ] Implement consent tracking
- [ ] Create order mapping database schema

### Phase 2: Core Replication
- [ ] Master trade event listener
- [ ] Trade normalizer (parse master account trades)
- [ ] Risk engine (per-follower rule validation)
- [ ] Follower order executor (Alice Blue API calls)
- [ ] Error handling & retry logic

### Phase 3: Sync & Management
- [ ] Exit/cancellation sync
- [ ] Modification sync (SL/target updates)
- [ ] Order status polling
- [ ] Audit logging

### Phase 4: Safety & Monitoring
- [ ] Rate limiting (Alice Blue API limits)
- [ ] Circuit breakers (fail-safe stops)
- [ ] Monitoring & alerts
- [ ] Manual override controls
- [ ] Compliance logging

---

## Important Considerations

### Security

- 🔐 **Never store raw API keys** — Use encryption at rest
- 🔐 **Use HTTPS for all API calls**
- 🔐 **Implement request signing** where required by Alice Blue
- 🔐 **Rotate tokens periodically**
- 🔐 **Audit all trade placements** — Log who did what and when

### Reliability

- ⚡ **Handle API rate limits** — Implement exponential backoff
- ⚡ **Idempotent operations** — Use unique request IDs
- ⚡ **Order mapping must be atomic** — Prevent orphaned orders
- ⚡ **Graceful degradation** — If a follower API fails, continue with others

### Compliance

- 📋 **Maintain audit trail** — All orders, modifications, exits
- 📋 **Risk limits per follower** — Hard stop at max order value
- 📋 **User consent tracking** — Document follower permissions
- 📋 **PnL tracking** — Calculate per-follower performance
- 📋 **Regulatory reporting** — Ready for audits

### Monitoring

Monitor these metrics:

- Order placement success rate per follower
- API response times (Alice Blue)
- Order latency (master → follower)
- Failed orders and retry attempts
- Follower account status changes
- Risk threshold violations

---

## Example: Master Places a BUY Order

```
Event: Master places BUY 100 shares of SBIN @ MARKET

Step 1: Parse Event
{
  "symbol": "SBIN",
  "exchange": "NSE",
  "side": "BUY",
  "quantity": 100,
  "product_type": "MIS",
  "order_type": "MARKET",
  "price": null
}

Step 2: For Each Follower
  
  Follower 1 (Client ID: ABC123):
  - Risk config: 0.5x multiplier, max_quantity: 50, max_order_value: 50000
  - Calculation: quantity = 100 * 0.5 = 50 (within max_quantity)
  - Check: 50 * current_price should be < 50000
  - Decision: ✅ PLACE ORDER
  
  Follower 2 (Client ID: XYZ789):
  - Risk config: 1x multiplier, max_order_value: 100000, SBIN NOT in allowed instruments
  - Decision: ❌ SKIP (instrument not allowed)
  
  Follower 3 (Client ID: DEF456):
  - Risk config: disabled
  - Decision: ❌ SKIP (account disabled)

Step 3: Place Follower Orders
  
  Call Alice Blue API for Follower 1:
  POST /alice/api/place_order
  {
    "symbol": "SBIN",
    "exchange": "NSE",
    "side": "BUY",
    "quantity": 50,
    "product_type": "MIS",
    "order_type": "MARKET"
  }
  
  Response: {"order_id": "F1-ORD-12345"}

Step 4: Store Mappings
  
  order_mappings:
  {
    "master_order_id": "M-ORD-67890",
    "follower_id": "follower_1_uuid",
    "follower_order_id": "F1-ORD-12345",
    "status": "ACTIVE"
  }

Step 5: Log Event
  
  trade_events:
  {
    "event_type": "PLACE",
    "master_order_id": "M-ORD-67890",
    "symbol": "SBIN",
    "quantity": 100,
    "total_followers": 3,
    "successful_followers": 1,
    "failed_followers": 0
  }
```

---

## API Integration Example (Node.js)

```typescript
async function replicateTradeToFollowers(masterTrade: MasterTrade) {
  const followers = await db.query(
    'SELECT * FROM followers WHERE enabled = true'
  );
  
  const results = [];
  
  for (const follower of followers) {
    try {
      // Apply risk rules
      const followerQuantity = applyRiskRules(
        masterTrade.quantity,
        follower.risk_config
      );
      
      if (!followerQuantity) {
        console.log(`Skipped ${follower.client_id} - risk rules`);
        continue;
      }
      
      // Place order via Alice Blue API
      const followerOrder = await aliceBlueApi.placeOrder({
        clientId: follower.client_id,
        accessToken: follower.access_token,
        symbol: masterTrade.symbol,
        side: masterTrade.side,
        quantity: followerQuantity,
        productType: masterTrade.product_type,
        orderType: masterTrade.order_type,
        price: masterTrade.price
      });
      
      // Store mapping
      await db.query(
        'INSERT INTO order_mappings (master_order_id, follower_id, follower_order_id, status) VALUES (?, ?, ?, ?)',
        [masterTrade.order_id, follower.id, followerOrder.order_id, 'ACTIVE']
      );
      
      results.push({
        follower_id: follower.id,
        status: 'SUCCESS',
        follower_order_id: followerOrder.order_id
      });
    } catch (error) {
      console.error(`Failed for ${follower.client_id}:`, error);
      results.push({
        follower_id: follower.id,
        status: 'FAILED',
        error: error.message
      });
    }
  }
  
  return results;
}
```

---

## Next Steps

1. **Implement follower authentication** — Support Alice Blue OAuth
2. **Build risk engine** — Enforce per-follower limits
3. **Integrate order mapping** — Track master ↔ follower orders
4. **Implement exit/mod sync** — Mirror order modifications
5. **Add monitoring** — Track success rates and failures
6. **Test with small quantities** — Validate with paper trading first
7. **Deploy with circuit breakers** — Safety first!

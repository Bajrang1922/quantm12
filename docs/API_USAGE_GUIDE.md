# Master-Follower Trade Replication - API Usage Guide

## Overview

This guide shows how to use the trade replication system via API calls.

## Prerequisites

- Database tables created (see `database/quantum_schema.sql`)
- Server running and accessible
- Secret header configured: `x-qa-secret: {QUANTUM_ALPHA_SECRET}`

---

## Step 1: Register Follower with Credentials

### Endpoint
```
POST /api/followers/credentials
```

### Request Example
```bash
curl -X POST http://localhost:3000/api/followers/credentials \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{
    "followerId": "ZERODHA-001",
    "clientId": "ABC123",
    "apiKey": "your-api-key",
    "accessToken": "your-access-token",
    "brokerSessionId": "session-123"
  }'
```

### Response
```json
{
  "ok": true,
  "message": "Credentials saved successfully",
  "credentialId": "1739876543210-a1b2c3d4"
}
```

---

## Step 2: Configure Risk Rules

### Endpoint
```
POST /api/followers/risk-config
```

### Request Example
```bash
curl -X POST http://localhost:3000/api/followers/risk-config \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{
    "followerId": "ZERODHA-001",
    "lot_multiplier": 0.5,
    "max_quantity": 50,
    "max_order_value": 50000,
    "max_daily_loss": 10000,
    "allowed_instruments": ["SBIN", "RELIANCE", "INFY", "TCS"],
    "allowed_product_types": ["MIS", "CNC"],
    "allowed_order_types": ["MARKET", "LIMIT"],
    "enabled": true
  }'
```

### Response
```json
{
  "ok": true,
  "message": "Risk config updated successfully",
  "configId": "1739876543210-x7y8z9w0"
}
```

---

## Step 3: Record Follower Consent

### Endpoint
```
POST /api/followers/consent
```

### Request Example
```bash
curl -X POST http://localhost:3000/api/followers/consent \
  -H "Content-Type: application/json" \
  -d '{
    "followerId": "ZERODHA-001",
    "consentToken": "consent-abc123"
  }'
```

### Response
```json
{
  "ok": true,
  "message": "Consent recorded successfully",
  "consentId": "1739876543210-p9q8r7s6"
}
```

---

## Step 4: Replicate Master Trade

### Endpoint
```
POST /api/trades/replicate
```

### Request Example
```bash
curl -X POST http://localhost:3000/api/trades/replicate \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{
    "trade": {
      "id": "M-ORDER-001",
      "symbol": "SBIN",
      "exchange": "NSE",
      "side": "BUY",
      "quantity": 100,
      "price": 500.50,
      "product_type": "MIS",
      "order_type": "MARKET",
      "timestamp": "2026-02-06T10:30:00Z"
    },
    "eventType": "PLACE"
  }'
```

### Response
```json
{
  "ok": true,
  "message": "Trade replicated successfully",
  "eventId": "1739876543210-e1f2g3h4",
  "master_order_id": "M-ORDER-001",
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
      "follower_order_id": "F-ZERODHA-001-1739876543210",
      "executed_quantity": 50
    },
    {
      "follower_id": "UPSTOX-002",
      "status": "SUCCESS",
      "follower_order_id": "F-UPSTOX-002-1739876543210",
      "executed_quantity": 100
    },
    {
      "follower_id": "ANGEL-003",
      "status": "SKIPPED",
      "reason": "Account is disabled"
    }
  ]
}
```

---

## Step 5: Query Replication Status

### Get Mappings for a Master Order
```bash
curl -X GET "http://localhost:3000/api/trades/replicate?masterOrderId=M-ORDER-001" \
  -H "x-qa-secret: your-secret"
```

### Response
```json
{
  "ok": true,
  "masterOrderId": "M-ORDER-001",
  "mappings": [
    {
      "id": "mapping-001",
      "follower_id": "ZERODHA-001",
      "follower_order_id": "F-ZERODHA-001-1739876543210",
      "symbol": "SBIN",
      "side": "BUY",
      "quantity": 50,
      "executed_quantity": 50,
      "status": "ACTIVE",
      "created_at": "2026-02-06T10:30:00Z",
      "updated_at": "2026-02-06T10:30:01Z"
    },
    {
      "id": "mapping-002",
      "follower_id": "UPSTOX-002",
      "follower_order_id": "F-UPSTOX-002-1739876543210",
      "symbol": "SBIN",
      "side": "BUY",
      "quantity": 100,
      "executed_quantity": 100,
      "status": "ACTIVE",
      "created_at": "2026-02-06T10:30:00Z",
      "updated_at": "2026-02-06T10:30:01Z"
    }
  ]
}
```

---

## Step 6: Exit All Positions

### Endpoint
```
POST /api/trades/exit
```

### Request Example
```bash
curl -X POST http://localhost:3000/api/trades/exit \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{
    "masterOrderId": "M-ORDER-001"
  }'
```

### Response
```json
{
  "ok": true,
  "message": "Exit order processed successfully",
  "masterOrderId": "M-ORDER-001",
  "summary": {
    "total_followers": 2,
    "successful": 2,
    "failed": 0
  },
  "results": [
    {
      "follower_id": "ZERODHA-001",
      "status": "SUCCESS",
      "reason": "Exit order processed"
    },
    {
      "follower_id": "UPSTOX-002",
      "status": "SUCCESS",
      "reason": "Exit order processed"
    }
  ]
}
```

---

## Step 7: Modify Follower Orders

### Endpoint
```
POST /api/trades/modify
```

### Request Example (Update SL/Target)
```bash
curl -X POST http://localhost:3000/api/trades/modify \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: your-secret" \
  -d '{
    "masterOrderId": "M-ORDER-001",
    "modification": {
      "type": "STOPLOSS",
      "value": 495.00
    }
  }'
```

### Response
```json
{
  "ok": true,
  "message": "Order modifications processed",
  "masterOrderId": "M-ORDER-001",
  "summary": {
    "total_orders": 2,
    "successful": 2,
    "failed": 0
  },
  "results": [
    {
      "follower_id": "ZERODHA-001",
      "follower_order_id": "F-ZERODHA-001-1739876543210",
      "status": "SUCCESS",
      "message": "Order modification recorded"
    },
    {
      "follower_id": "UPSTOX-002",
      "follower_order_id": "F-UPSTOX-002-1739876543210",
      "status": "SUCCESS",
      "message": "Order modification recorded"
    }
  ]
}
```

---

## Step 8: Query Trade Events

### Endpoint
```
GET /api/trades/events
```

### Request Example
```bash
curl -X GET "http://localhost:3000/api/trades/events?limit=10&eventType=PLACE" \
  -H "x-qa-secret: your-secret"
```

### Response
```json
{
  "ok": true,
  "events": [
    {
      "id": "1739876543210-e1f2g3h4",
      "master_order_id": "M-ORDER-001",
      "event_type": "PLACE",
      "symbol": "SBIN",
      "side": "BUY",
      "quantity": 100,
      "total_followers": 3,
      "successful_followers": 2,
      "failed_followers": 0,
      "skipped_followers": 1,
      "processed_at": "2026-02-06T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Step 9: Query Order Mappings

### Endpoint
```
GET /api/trades/mappings
```

### Request Examples

**Get all mappings for a master order:**
```bash
curl -X GET "http://localhost:3000/api/trades/mappings?masterOrderId=M-ORDER-001&limit=50" \
  -H "x-qa-secret: your-secret"
```

**Get all mappings for a specific follower:**
```bash
curl -X GET "http://localhost:3000/api/trades/mappings?followerId=ZERODHA-001&limit=50" \
  -H "x-qa-secret: your-secret"
```

**Get failed orders:**
```bash
curl -X GET "http://localhost:3000/api/trades/mappings?status=FAILED&limit=50" \
  -H "x-qa-secret: your-secret"
```

### Response
```json
{
  "ok": true,
  "mappings": [
    {
      "id": "mapping-001",
      "master_order_id": "M-ORDER-001",
      "follower_id": "ZERODHA-001",
      "follower_order_id": "F-ZERODHA-001-1739876543210",
      "symbol": "SBIN",
      "side": "BUY",
      "quantity": 50,
      "executed_quantity": 50,
      "status": "ACTIVE",
      "error_message": null,
      "created_at": "2026-02-06T10:30:00Z",
      "updated_at": "2026-02-06T10:30:01Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "ok": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad request (missing fields, invalid data)
- `401` - Unauthorized (invalid secret)
- `404` - Not found
- `500` - Server error

---

## Complete Trade Flow Example (Node.js)

```javascript
const BASE_URL = 'http://localhost:3000';
const SECRET = 'your-secret';

async function completeTradeFlow() {
  // 1. Add follower credentials
  const credResp = await fetch(`${BASE_URL}/api/followers/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-qa-secret': SECRET },
    body: JSON.stringify({
      followerId: 'ZERODHA-001',
      clientId: 'ABC123',
      apiKey: 'key123',
      accessToken: 'token123'
    })
  });

  // 2. Configure risk rules
  const riskResp = await fetch(`${BASE_URL}/api/followers/risk-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-qa-secret': SECRET },
    body: JSON.stringify({
      followerId: 'ZERODHA-001',
      lot_multiplier: 0.5,
      max_quantity: 50
    })
  });

  // 3. Record consent
  const consentResp = await fetch(`${BASE_URL}/api/followers/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      followerId: 'ZERODHA-001'
    })
  });

  // 4. Place master trade and replicate
  const tradeResp = await fetch(`${BASE_URL}/api/trades/replicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-qa-secret': SECRET },
    body: JSON.stringify({
      trade: {
        id: 'M-ORDER-001',
        symbol: 'SBIN',
        side: 'BUY',
        quantity: 100,
        price: 500.50
      }
    })
  });

  const result = await tradeResp.json();
  console.log('Trade replicated:', result);

  // 5. Query status
  const statusResp = await fetch(
    `${BASE_URL}/api/trades/replicate?masterOrderId=M-ORDER-001`,
    { headers: { 'x-qa-secret': SECRET } }
  );
  const status = await statusResp.json();
  console.log('Replication status:', status);

  // 6. Exit when done
  const exitResp = await fetch(`${BASE_URL}/api/trades/exit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-qa-secret': SECRET },
    body: JSON.stringify({ masterOrderId: 'M-ORDER-001' })
  });

  const exitResult = await exitResp.json();
  console.log('Exit confirmed:', exitResult);
}

completeTradeFlow().catch(console.error);
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Use pagination for large datasets (limit ≤ 200)
- Order mappings include executed_quantity for partial fills
- Always include the `x-qa-secret` header for trade operations
- Credentials are encrypted at rest; APIs only return the last 4 characters
- Followers can have different risk configurations (multiplier, max qty, etc.)

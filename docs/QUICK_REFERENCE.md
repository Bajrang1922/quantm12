# Trade Replication System - Quick Reference Card

## 🚀 Quick Start Commands

### Database Setup
```bash
mysql -u root -p quantum_db < database/quantum_schema.sql
```

### Test Everything
```bash
node test-replication.js http://localhost:3000 your-secret
```

---

## 💻 API Quick Commands

### 1. Register Follower
```bash
curl -X POST http://localhost:3000/api/followers/credentials \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: SECRET" \
  -d '{"followerId":"USER-001","clientId":"ABC123","apiKey":"key","accessToken":"token"}'
```

### 2. Set Risk Rules
```bash
curl -X POST http://localhost:3000/api/followers/risk-config \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: SECRET" \
  -d '{"followerId":"USER-001","lot_multiplier":0.5,"max_quantity":50,"enabled":true}'
```

### 3. Record Consent
```bash
curl -X POST http://localhost:3000/api/followers/consent \
  -H "Content-Type: application/json" \
  -d '{"followerId":"USER-001"}'
```

### 4. Replicate Trade
```bash
curl -X POST http://localhost:3000/api/trades/replicate \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: SECRET" \
  -d '{"trade":{"id":"M1","symbol":"SBIN","side":"BUY","quantity":100,"price":500}}'
```

### 5. Exit Position
```bash
curl -X POST http://localhost:3000/api/trades/exit \
  -H "Content-Type: application/json" \
  -H "x-qa-secret: SECRET" \
  -d '{"masterOrderId":"M1"}'
```

### 6. Check Status
```bash
curl -X GET "http://localhost:3000/api/trades/replicate?masterOrderId=M1" \
  -H "x-qa-secret: SECRET"
```

### 7. View Events
```bash
curl -X GET "http://localhost:3000/api/trades/events?limit=10" \
  -H "x-qa-secret: SECRET"
```

### 8. View Mappings
```bash
curl -X GET "http://localhost:3000/api/trades/mappings?followerId=USER-001" \
  -H "x-qa-secret: SECRET"
```

---

## 🗄️ Database Quick Queries

### Active Followers
```sql
SELECT f.name, fc.status, rc.lot_multiplier 
FROM follower_credentials fc
LEFT JOIN follower_risk_config rc ON fc.follower_id = rc.follower_id
LEFT JOIN followers f ON fc.follower_id = f.id
WHERE fc.status = 'ACTIVE';
```

### Order Status
```sql
SELECT * FROM order_mappings 
WHERE master_order_id = 'M1';
```

### Replication Summary
```sql
SELECT event_type, COUNT(*) as count, 
  SUM(successful_followers) as success
FROM trade_events 
GROUP BY event_type;
```

### Failed Orders
```sql
SELECT * FROM order_mappings 
WHERE status = 'FAILED' 
LIMIT 10;
```

### Today's Activity
```sql
SELECT DATE(created_at) as date, COUNT(*) as orders
FROM order_mappings 
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 📋 Endpoint Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/followers/credentials` | Add follower |
| GET | `/api/followers/credentials?followerId=X` | Get credential info |
| POST | `/api/followers/risk-config` | Set risk rules |
| GET | `/api/followers/risk-config?followerId=X` | Get risk rules |
| POST | `/api/followers/consent` | Record consent |
| GET | `/api/followers/consent?followerId=X` | Check consent |
| POST | `/api/trades/replicate` | Replicate trade |
| GET | `/api/trades/replicate?masterOrderId=X` | Get mappings |
| POST | `/api/trades/exit` | Exit positions |
| POST | `/api/trades/modify` | Modify orders |
| GET | `/api/trades/events` | View events |
| GET | `/api/trades/mappings` | View mappings |

---

## ⚙️ Environment Variables

```env
QUANTUM_ALPHA_SECRET=your-secret-key
ENCRYPTION_KEY=32-char-hex-string
DATABASE_URL=mysql://user:pass@host:3306/quantum_db
ALICE_API_BASE_URL=https://api.aliceblue.com
ALICE_API_KEY=your-key
ALICE_API_SECRET=your-secret
```

---

## 🔑 Generate Encryption Key

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Python:**
```bash
python -c "import os; print(os.urandom(16).hex())"
```

---

## 📊 Order Status Values

| Status | Meaning |
|--------|---------|
| PENDING | Awaiting placement |
| ACTIVE | Order placed & active |
| COMPLETED | Order filled completely |
| PARTIAL | Partially filled |
| CANCELLED | Cancelled/exited |
| FAILED | Failed to place |

---

## 🎯 Common Workflows

### Add New Follower
1. POST `/api/followers/credentials` (add creds)
2. POST `/api/followers/risk-config` (set rules)
3. POST `/api/followers/consent` (record consent)

### Replicate & Exit
1. POST `/api/trades/replicate` (place master trade)
2. GET `/api/trades/replicate?masterOrderId=X` (monitor)
3. POST `/api/trades/exit` (when done)

### Monitor Activity
1. GET `/api/trades/events?limit=10` (recent)
2. GET `/api/trades/mappings?status=FAILED` (issues)
3. `SELECT * FROM trade_events` (summary)

---

## 🐛 Troubleshooting Checklist

- [ ] Database running? `mysql -u root -p -e "SELECT 1"`
- [ ] Tables exist? `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='quantum_db'`
- [ ] Secret matches? Check `x-qa-secret` header vs `QUANTUM_ALPHA_SECRET`
- [ ] Follower registered? Check `follower_credentials` table
- [ ] Risk config set? Check `follower_risk_config` table
- [ ] Consent recorded? Check `follower_consents` table
- [ ] Trade event logged? Check `trade_events` table
- [ ] Order mapping created? Check `order_mappings` table

---

## 🔗 Full Documentation

- **Architecture:** [MASTER_FOLLOWER_ARCHITECTURE.md](MASTER_FOLLOWER_ARCHITECTURE.md)
- **API Guide:** [API_USAGE_GUIDE.md](API_USAGE_GUIDE.md)
- **Setup:** [SETUP_REPLICATION_SYSTEM.md](SETUP_REPLICATION_SYSTEM.md)
- **README:** [REPLICATION_SYSTEM_README.md](REPLICATION_SYSTEM_README.md)

---

## 🎯 Response Format

### Success
```json
{
  "ok": true,
  "message": "...",
  "data": {...}
}
```

### Error
```json
{
  "ok": false,
  "message": "Error description"
}
```

---

## 📍 Key Features

✅ Encrypted credentials storage
✅ Per-follower risk limits
✅ Automatic quantity adjustment
✅ Order mapping & tracking
✅ Exit/modification sync
✅ Audit trail
✅ Compliance consent tracking
✅ Success/failure monitoring
✅ Full REST API
✅ Database persistence

---

Print this card and keep it handy! 📌

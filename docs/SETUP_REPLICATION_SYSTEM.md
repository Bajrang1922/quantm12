# Trade Replication System - Setup & Configuration

## Environment Variables

Add these to your `.env.local` file:

```env
# Secret for API calls (trade replication endpoints)
QUANTUM_ALPHA_SECRET=your-secret-key-here

# Encryption key for storing sensitive follower credentials (32-char hex)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef

# Alice Blue API Configuration
ALICE_API_BASE_URL=https://api.aliceblue.com
ALICE_TRADES_ENDPOINT=https://api.aliceblue.com/v1/trades
ALICE_ORDER_ENDPOINT=https://api.aliceblue.com/v1/orders
ALICE_API_KEY=your-master-api-key
ALICE_API_SECRET=your-master-api-secret
ALICE_AUTH_METHOD=bearer
ALICE_MASTER_ACCOUNT=Master

# Database Configuration
DATABASE_URL=mysql://user:password@localhost:3306/quantum_db
DB_HOST=localhost
DB_PORT=3306
DB_NAME=quantum_db
DB_USER=root
DB_PASSWORD=password

# OAuth Token Files (optional)
ALICE_OAUTH_TOKEN_FILE=.alice.token
ALICE_OAUTH_TOKENS_FILE=.alice.tokens.json
```

---

## Database Setup

### 1. Create Database

```bash
mysql -u root -p -e "CREATE DATABASE quantum_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. Apply Schema

```bash
mysql -u root -p quantum_db < database/quantum_schema.sql
```

### 3. Verify Tables

```bash
mysql -u root -p quantum_db -e "SHOW TABLES;"
```

Expected output:
```
followers
trades
logs
follower_credentials
follower_risk_config
order_mappings
trade_events
follower_consents
```

---

## Encryption Key Generation

Generate a secure 32-character hex string for `ENCRYPTION_KEY`:

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Using OpenSSL:**
```bash
openssl rand -hex 16
```

**Using Python:**
```python
import os
print(os.urandom(16).hex())
```

---

## Testing the System

### 1. Start the development server

```bash
npm run dev
```

### 2. Run the integration test

```bash
node test-replication.js http://localhost:3000 your-secret-key
```

Expected output:
```
[PASS] ✓ Add Follower Credentials
[PASS] ✓ Configure Risk Rules
[PASS] ✓ Record Follower Consent
[PASS] ✓ Replicate Master Trade
[PASS] ✓ Query Replication Status
[PASS] ✓ Query Trade Events
[PASS] ✓ Query Order Mappings
[PASS] ✓ Modify Follower Orders
[PASS] ✓ Exit All Positions
[PASS] ✓ Verify Exit Status

=== All tests passed! ===
```

---

## API Endpoints Quick Reference

### Follower Management
- `POST /api/followers/credentials` — Add/update follower credentials
- `GET /api/followers/credentials?followerId=XXX` — Get credential info (masked)
- `POST /api/followers/risk-config` — Configure risk rules
- `GET /api/followers/risk-config?followerId=XXX` — Get risk config
- `POST /api/followers/consent` — Record follower consent
- `GET /api/followers/consent?followerId=XXX` — Check consent status

### Trade Operations
- `POST /api/trades/replicate` — Replicate master trade to followers
- `GET /api/trades/replicate?masterOrderId=XXX` — Get replication status
- `POST /api/trades/exit` — Exit all follower positions
- `POST /api/trades/modify` — Modify follower orders

### Monitoring & Queries
- `GET /api/trades/events` — Query trade events
- `GET /api/trades/mappings` — Query order mappings

---

## Database Query Cheat Sheet

### View Active Followers with Credentials

```sql
SELECT 
  fc.follower_id, 
  f.name,
  fc.status,
  rc.lot_multiplier,
  rc.max_quantity,
  rc.enabled
FROM follower_credentials fc
LEFT JOIN followers f ON fc.follower_id = f.id
LEFT JOIN follower_risk_config rc ON fc.follower_id = rc.follower_id
WHERE fc.status = 'ACTIVE'
ORDER BY f.name;
```

### View Order Mappings for a Master Order

```sql
SELECT * FROM order_mappings 
WHERE master_order_id = 'M-ORDER-001' 
ORDER BY created_at DESC;
```

### View Trade Event Summary

```sql
SELECT 
  event_type,
  COUNT(*) as total,
  SUM(successful_followers) as successful,
  SUM(failed_followers) as failed,
  SUM(skipped_followers) as skipped
FROM trade_events
GROUP BY event_type
ORDER BY MAX(processed_at) DESC;
```

### Count Followers by Status

```sql
SELECT status, COUNT(*) as count 
FROM follower_credentials 
GROUP BY status;
```

### Find Failed Order Mappings

```sql
SELECT * FROM order_mappings 
WHERE status = 'FAILED' 
ORDER BY created_at DESC LIMIT 10;
```

### View Follower Consent Status

```sql
SELECT 
  f.id,
  f.name,
  fc.trade_replication_enabled,
  fc.consent_given_at
FROM followers f
LEFT JOIN follower_consents fc ON f.id = fc.follower_id
ORDER BY f.name;
```

---

## Monitoring & Logging

### Check Recent Trade Events

```bash
curl -X GET "http://localhost:3000/api/trades/events?limit=10" \
  -H "x-qa-secret: your-secret"
```

### Monitor Order Failures

```bash
curl -X GET "http://localhost:3000/api/trades/mappings?status=FAILED&limit=20" \
  -H "x-qa-secret: your-secret"
```

### Track Specific Master Order

```bash
curl -X GET "http://localhost:3000/api/trades/replicate?masterOrderId=M-ORDER-001" \
  -H "x-qa-secret: your-secret"
```

---

## Troubleshooting

### Issue: "Database connection failed"

**Solution:**
1. Check database is running: `mysql -u root -p -e "SELECT 1"`
2. Verify `DATABASE_URL` in `.env.local`
3. Check credentials match MySQL setup

### Issue: "Unauthorized" error

**Solution:**
- Ensure `x-qa-secret` header matches `QUANTUM_ALPHA_SECRET` env var
- Headers are case-sensitive: `x-qa-secret` (not `X-QA-Secret`)

### Issue: "Credentials not found"

**Solution:**
- Create credentials first: `POST /api/followers/credentials`
- Check follower ID matches what you registered

### Issue: Trades not replicating

**Solution:**
1. Check follower is active: `SELECT * FROM follower_credentials WHERE status = 'ACTIVE'`
2. Check risk config exists: `SELECT * FROM follower_risk_config`
3. Review trade_events table for skip reasons: `SELECT * FROM trade_events ORDER BY processed_at DESC LIMIT 5`
4. Check server logs for error messages

---

## Performance Tips

### For High-Volume Trading

1. **Database Indexes** — Already optimized in schema
2. **Batch Operations** — Replicate multiple trades together
3. **Connection Pooling** — Use connection pools in production
4. **Cache Risk Configs** — Load follower configs periodically, not per trade

### Monitoring Checklist

- [ ] Order mapping latency (should be < 100ms)
- [ ] Failed replication rate (should be < 1%)
- [ ] Database query performance (check slow query log)
- [ ] Encryption/decryption overhead
- [ ] API response times

---

## Security Checklist

- [ ] `ENCRYPTION_KEY` is strong and unique
- [ ] `QUANTUM_ALPHA_SECRET` is strong (32+ chars)
- [ ] Database credentials are not in git
- [ ] HTTPS is enabled in production
- [ ] API endpoints are behind authentication (implement if needed)
- [ ] Follower credentials are encrypted at rest (✓ implemented)
- [ ] Audit logging is enabled
- [ ] Rate limiting is configured (implement if needed)

---

## Next Steps

1. **Setup databases** — Run schema setup commands above
2. **Configure env vars** — Copy template to `.env.local`
3. **Test locally** — Run `node test-replication.js`
4. **Deploy to production** — Set real credentials and keys
5. **Monitor operations** — Check logs and metrics regularly
6. **Implement additional security** — Add rate limiting, request signing, etc.

See [API_USAGE_GUIDE.md](API_USAGE_GUIDE.md) for complete API documentation.

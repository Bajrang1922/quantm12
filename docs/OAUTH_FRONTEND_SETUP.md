# OAuth Frontend Setup Guide

## Overview

Your website now has a complete OAuth frontend implementation for AliceBlue connections. Users can:

✅ Connect/disconnect with one click  
✅ Master can configure OAuth keys from frontend  
✅ View connection status in real-time  
✅ Manage multiple connected accounts  

---

## User Flows

### 1. Master Account OAuth Setup

**Goal:** Master configures OAuth keys and connects their own master account

**Steps:**
1. Go to **Connections** page in sidebar
2. See "OAuth Configuration" card
3. Click **"Edit Keys"** button
4. Enter from AliceBlue Developer Portal:
   - App Code
   - Client ID
   - Client Secret
   - Redirect URI
   - Auth Method
5. Click **"Save Configuration"**
6. Click **"Connect to AliceBlue"** button
7. Redirected to AliceBlue login
8. Authorize the application
9. Redirected back to dashboard
10. ✅ Account appears in "Connected Accounts"

### 2. Follower Account OAuth Connection

**Goal:** Followers connect their own AliceBlue accounts

**Steps:**
1. Follower goes to **Connections** page
2. See "Connect to AliceBlue" button
3. Click **"Connect to AliceBlue"**
4. Redirected to AliceBlue login
5. Authorize the application
6. Redirected back
7. ✅ Account connected and ready for copy-trading

### 3. Quick Connection from Dashboard

**Goal:** Master can fast-connect from main dashboard

**Steps:**
1. On **Dashboard** page (left side of header)
2. See **"AliceBlue Connection"** button
3. Click to open dialog
4. If not connected:
   - Click "Connect to AliceBlue"
   - Follow OAuth flow
5. If already connected:
   - See account details
   - Can click "Disconnect" to revoke

---

## Components

### 1. OAuthConnectDialog
**File:** `src/app/(main)/components/oauth-connect-dialog.tsx`

**Props:** None (uses context)

**Features:**
- Shows connection status
- Connect button with loading state
- Disconnect button with confirmation
- Account ID display
- Connected timestamps

**Usage:**
```tsx
import { OAuthConnectDialog } from '@/app/(main)/components/oauth-connect-dialog';

export function MyComponent() {
  return <OAuthConnectDialog />;
}
```

### 2. OAuthKeyManagement
**File:** `src/app/(main)/components/oauth-key-management.tsx`

**Features:**
- Edit OAuth configuration
- View masked secrets
- Copy redirect URI
- List all connected accounts
- Master-only access

**Usage:**
```tsx
import { OAuthKeyManagement } from '@/app/(main)/components/oauth-key-management';

export default function SettingsPage() {
  return <OAuthKeyManagement />;
}
```

### 3. Connections Page
**File:** `src/app/(main)/connections/page.tsx`

**Features:**
- OAuth key management for master
- Connection status for all users
- Security information
- Quick start guide

**Route:** `/connections`

---

## Backend Endpoints

### 1. GET /api/alice/oauth-config
Get current OAuth configuration (masked)

**Response:**
```json
{
  "ok": true,
  "config": {
    "appCode": "abc1...8901",
    "clientId": "xyz1...7890",
    "redirectUri": "https://domain.com/aliceblue/callback",
    "authMethod": "headers",
    "configured": true,
    "lastUpdated": "2026-02-10T..."
  }
}
```

### 2. POST /api/alice/oauth-config
Update OAuth configuration

**Request:**
```json
{
  "appCode": "your_app_code",
  "clientId": "your_client_id",
  "clientSecret": "your_secret",
  "redirectUri": "https://domain.com/aliceblue/callback",
  "authMethod": "headers"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Configuration updated",
  "config": { ... }
}
```

### 3. GET /api/alice/oauth-status?accountId=USER_ID
Check if user is connected

**Response:**
```json
{
  "ok": true,
  "connection": {
    "accountId": "master@example.com",
    "connected": true,
    "status": "connected",
    "connectedAt": "2026-02-10T..."
  }
}
```

### 4. POST /api/alice/oauth-disconnect
Disconnect an OAuth account

**Request:**
```json
{
  "accountId": "master@example.com"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Account disconnected successfully"
}
```

### 5. GET /api/alice/oauth-connections
List all connected accounts

**Response:**
```json
{
  "ok": true,
  "connections": [
    {
      "accountId": "master@example.com",
      "connected": true,
      "isMaster": true,
      "tradeCount": 5,
      "status": "connected"
    }
  ],
  "totalConnected": 1,
  "masterAccount": "master@example.com"
}
```

### 6. GET /api/alice/oauth/start?accountId=ID&isMaster=true
Start OAuth flow

**Response:**
```json
{
  "ok": true,
  "redirectUrl": "https://ant.aliceblueonline.com/?appcode=..."
}
```

**Note:** Frontend must redirect to `redirectUrl`

---

## File Structure

```
src/app/(main)/
├── components/
│   ├── oauth-connect-dialog.tsx       # Connection UI dialog
│   ├── oauth-key-management.tsx       # Key management for master
│   └── nav-items.tsx                  # Updated with Connections link
├── connections/
│   └── page.tsx                       # Connections page
├── dashboard/
│   └── components/
│       └── master-dashboard.tsx       # Updated with OAuth button
└── ...

src/app/api/alice/
├── oauth-config/route.ts              # GET/POST config
├── oauth-status/route.ts              # Check connection
├── oauth-disconnect/route.ts          # Revoke connection
├── oauth-connections/route.ts         # List all connections
├── oauth/start/route.ts               # Updated - returns redirect URL
└── ...
```

---

## Configuration Files

### .alice.oauth-config.json
Stores OAuth configuration

```json
{
  "appCode": "your_app_code_here",
  "clientId": "your_client_id",
  "clientSecret": "your_secret",
  "redirectUri": "https://yourdomain.com/aliceblue/callback",
  "authMethod": "headers",
  "lastUpdated": "2026-02-10T..."
}
```

### .alice.tokens.json
Stores OAuth tokens for all accounts

```json
{
  "master@example.com": "token_master_xyz...",
  "follower1@example.com": "token_follower1_abc...",
  "follower2@example.com": "token_follower2_def..."
}
```

---

## Setup Instructions

### 1. Get OAuth Credentials from AliceBlue Dev Portal

Visit: https://developer.aliceblueonline.com

Create an OAuth App and get:
- App Code
- Client ID
- Client Secret
- Note your Redirect URI: `https://yourdomain.com/aliceblue/callback`

### 2. First Time Setup

**Option A: Via Frontend (Recommended)**

1. Log in as Master
2. Go to `/connections` page
3. Click "Edit Keys"
4. Paste credentials
5. Click "Save Configuration"
6. Click "Connect to AliceBlue"
7. ✅ Done!

**Option B: Via Environment Variables**

```bash
ALICE_APP_CODE=your_app_code
ALICE_CLIENT_ID=your_client_id
ALICE_CLIENT_SECRET=your_secret
ALICE_REDIRECT_URI=https://yourdomain.com/aliceblue/callback
```

### 3. Verify Setup

1. Go to `/api/alice/oauth-config` in browser
   - Should see your config (masked secrets)
2. Click "Connect to AliceBlue"
   - Should redirect to AliceBlue login

---

## Security Best Practices

✅ **DO:**
- Store secrets in env vars or secure config files
- Use HTTPS in production
- Limit redirect URIs
- Rotate credentials periodically
- Monitor connected accounts
- Use strong OAuth scopes

❌ **DON'T:**
- Commit secrets to git
- Share credentials in emails
- Use same credentials across environments
- Trust unverified redirect URIs
- Allow unrestricted access scopes

---

## Troubleshooting

### Issue: "OAuth credentials not configured"

**Solution:**
1. Go to `/connections` page
2. Click "Edit Keys"
3. Add App Code or Client ID
4. Save

### Issue: Redirect loop after OAuth

**Solution:**
- Check `/api/alice/oauth-config` - verify redirect URI matches
- OAuth redirect URI on AliceBlue must be: `https://yourdomain.com/aliceblue/callback`
- Check browser console for errors

### Issue: "Account not connected" but was connected

**Solution:**
1. Token may have expired
2. Try disconnecting and reconnecting
3. Check `.alice.tokens.json` file exists
4. Verify file permissions

### Issue: Connection button doesn't appear

**Solution:**
- Go to `/connections` page instead
- Or click "AliceBlue Connection" button on dashboard
- Check if you're logged in as master or follower

---

## Testing

### 1. Test Configuration Endpoint

```bash
curl http://localhost:3000/api/alice/oauth-config
```

### 2. Test Connection Status

```bash
curl "http://localhost:3000/api/alice/oauth-status?accountId=test@example.com"
```

### 3. Test List Connections

```bash
curl http://localhost:3000/api/alice/oauth-connections
```

### 4. Test Manual Connection

1. Visit: http://localhost:3000/api/alice/oauth/start?accountId=test@example.com
2. Should return redirect URL
3. Inspect browser console for the URL

---

## Next Steps

✅ Master configures OAuth keys  
✅ Master connects their account  
✅ Followers connect via OAuth  
✅ Dashboard shows real trades  
✅ Copy-trading is enabled  

Then you can:
- Set risk limits per follower
- Configure trade filtering
- Enable auto-replication
- Monitor P&L tracking

---

## Support

For issues:
1. Check browser console (F12)
2. Check server logs
3. Verify `.alice.oauth-config.json` exists
4. Verify `.alice.tokens.json` exists with tokens
5. Check `/connections` page status


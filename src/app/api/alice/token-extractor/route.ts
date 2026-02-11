import { NextResponse, NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alice Blue Token Extractor</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-top: 0; }
    .section {
      margin: 20px 0;
      padding: 15px;
      background: #f9f9f9;
      border-left: 4px solid #007bff;
      border-radius: 4px;
    }
    .code {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      margin: 10px 0;
    }
    button {
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin: 5px 0;
    }
    button:hover { background: #0056b3; }
    input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      box-sizing: border-box;
      margin: 10px 0;
    }
    .success { color: #28a745; }
    .error { color: #dc3545; }
    textarea {
      width: 100%;
      height: 100px;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .step {
      margin: 15px 0;
      padding: 10px;
      background: #e7f3ff;
      border-left: 3px solid #007bff;
      border-radius: 3px;
    }
    .step strong { color: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Alice Blue OAuth Token Extractor</h1>
    
    <div class="section">
      <h2>Step 1: Extract Token from Alice Blue</h2>
      <div class="step">
        <strong>Method A: From Browser DevTools</strong>
        <ol>
          <li>Open <a href="https://ant.aliceblueonline.com" target="_blank">Alice Blue</a> in your browser</li>
          <li>Open DevTools (F12 or Right-click → Inspect)</li>
          <li>Go to <strong>Application</strong> → <strong>Local Storage</strong></li>
          <li>Find and copy your auth token (usually something like "eyJhbGc...")</li>
          <li>Paste it below</li>
        </ol>
      </div>
      
      <div class="step">
        <strong>Method B: Run this in Browser Console</strong>
        <div class="code">
// Copy this and paste in Alice Blue's browser console
console.log(localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('access_token') || 'Token not found');
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Step 2: Submit Token to System</h2>
      <input type="text" id="token" placeholder="Paste your OAuth token here (starts with eyJ...)" />
      <input type="text" id="accountId" placeholder="Account ID (default: 2548613)" value="2548613" />
      <button onclick="submitToken()">💾 Save Token</button>
      <div id="result"></div>
    </div>

    <div class="section">
      <h2>Step 3: Fetch Your Live Trades</h2>
      <button onclick="fetchTrades()">📊 Fetch Live Trades from Alice Blue</button>
      <textarea id="trades" placeholder="Your trades will appear here..." readonly></textarea>
    </div>

    <div class="section">
      <h3>Troubleshooting</h3>
      <ul>
        <li>Token not found in localStorage? Check if you're logged into Alice Blue</li>
        <li>Token rejected? It may have expired, try logging out and back in</li>
        <li>Still no trades? Check if you have completed orders in Alice Blue Trade Book</li>
      </ul>
    </div>
  </div>

  <script>
    const SECRET = 'your-secret-key-for-api-endpoints';
    
    async function submitToken() {
      const token = document.getElementById('token').value.trim();
      const accountId = document.getElementById('accountId').value.trim() || '2548613';
      const result = document.getElementById('result');
      
      if (!token) {
        result.innerHTML = '<span class="error">❌ Please paste your token</span>';
        return;
      }
      
      if (!token.startsWith('eyJ')) {
        result.innerHTML = '<span class="error">❌ Token should start with "eyJ" (JWT format)</span>';
        return;
      }
      
      result.innerHTML = '⏳ Saving token...';
      
      try {
        const res = await fetch('/api/alice/token-manage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-qa-secret': SECRET,
          },
          body: JSON.stringify({ accountId, token }),
        });
        
        const data = await res.json();
        
        if (data.ok) {
          result.innerHTML = \`<span class="success">✅ Token saved! (\${data.tokenMasked})</span>\`;
          document.getElementById('token').value = '';
        } else {
          result.innerHTML = \`<span class="error">❌ \${data.error}</span>\`;
        }
      } catch (err) {
        result.innerHTML = \`<span class="error">❌ Error: \${err.message}</span>\`;
      }
    }
    
    async function fetchTrades() {
      const tradesArea = document.getElementById('trades');
      const accountId = document.getElementById('accountId').value.trim() || '2548613';
      
      tradesArea.value = '⏳ Fetching trades from Alice Blue...';
      
      try {
        const res = await fetch('/api/alice/fetch-live', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-qa-secret': SECRET,
          },
          body: JSON.stringify({ accountId }),
        });
        
        const data = await res.json();
        
        if (data.error) {
          tradesArea.value = \`ERROR: \${data.error}\\n\\nHint: \${data.hint || 'Check your token'}\`;
          return;
        }
        
        if (data.trades && data.trades.length > 0) {
          const summary = \`✅ SUCCESS!
Account: \${accountId}
Total Trades Cached: \${data.tradeCount}
Message: \${data.message}

Recent Trades:
\${JSON.stringify(data.recentTrades, null, 2)}

All trades are now saved and will show in your Dashboard!
\`;
          tradesArea.value = summary;
        } else {
          tradesArea.value = \`⚠️ No trades found. 
Check:
1. Token is valid and not expired
2. You have completed orders in Alice Blue
3. Account ID is correct\`;
        }
      } catch (err) {
        tradesArea.value = \`ERROR: \${err.message}\`;
      }
    }
    
    // Allow Enter key to submit token
    document.getElementById('token').onkeypress = (e) => {
      if (e.key === 'Enter') submitToken();
    };
  </script>
</body>
</html>
  `;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

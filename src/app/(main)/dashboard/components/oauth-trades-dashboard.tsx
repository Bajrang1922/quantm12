'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executedAt: string;
  accountId?: string;
  orderStatus?: string;
}

export function OAuthTradesDashboard() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user || user.role !== 'trader') return;

    // Fetch trades for this account from API
    const fetchTrades = async () => {
      try {
        setError(null);
        console.log(`[OAuth Dashboard] Fetching trades for account: ${user.id}`);
        const response = await fetch(`/api/alice/trades?accountId=${encodeURIComponent(user.id)}`);
        const data = await response.json();
        
        if (data.error) {
          console.error('[OAuth Dashboard] API returned error:', data.error);
          setError(data.error);
          setTrades([]);
        } else if (data.trades && Array.isArray(data.trades)) {
          console.log(`[OAuth Dashboard] Fetched ${data.trades.length} trades for ${user.id}`);
          setTrades(data.trades);
        } else {
          console.warn('[OAuth Dashboard] Unexpected response structure:', data);
          setTrades([]);
        }
      } catch (error) {
        console.error('[OAuth Dashboard] Failed to fetch trades:', error);
        setError((error as any)?.message || 'Failed to fetch trades');
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();

    // Connect to SSE for live updates and only accept events for this account
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/alice/trades-stream');

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          // payload may be initial batch ({ type: 'initial', trades: [...] }) or single trade
          if (payload && payload.type === 'initial' && Array.isArray(payload.trades)) {
            const mine = payload.trades.filter((t: any) => String(t.account) === String(user.id));
            if (mine.length) {
              console.log(`[OAuth Dashboard] Received ${mine.length} initial trades via SSE`);
              setTrades(prev => [...mine, ...prev]);
            }
            return;
          }

          const newTrade = payload;
          if (newTrade && String(newTrade.account) === String(user.id)) {
            console.log(`[OAuth Dashboard] Received new trade via SSE:`, newTrade);
            setTrades(prev => [newTrade, ...prev]);
          }
        } catch (error) {
          console.error('[OAuth Dashboard] Failed to parse trade update:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.warn('[OAuth Dashboard] SSE connection error');
        if (eventSource) eventSource.close();
      };
    } catch (e) {
      console.error('[OAuth Dashboard] Failed to connect SSE:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [user, retryCount]);

  if (loading) {
    return <div className="text-center py-8">Loading trades...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Alice Blue Trades</h2>
          <p className="text-sm text-muted-foreground">
            Live trading activity from your Alice Blue account ({user?.id})
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setRetryCount(c => c + 1)}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-semibold">Error fetching trades</p>
              <p className="text-red-700 text-sm">{error}</p>
              <p className="text-red-600 text-xs mt-2">
                ℹ️ If you just connected via OAuth, wait a moment and try refreshing. 
                Check browser console for debugging info.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
          <CardDescription>
            {trades.length} trade{trades.length !== 1 ? 's' : ''} loaded
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Executed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No trades yet
                    </TableCell>
                  </TableRow>
                ) : (
                  trades.map((trade) => (
                    <TableRow key={trade.id} className="hover:bg-muted/50">
                      <TableCell className="font-semibold">{trade.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={trade.side === 'BUY' ? 'default' : 'secondary'}>
                          {trade.side}
                        </Badge>
                      </TableCell>
                      <TableCell>{trade.quantity}</TableCell>
                      <TableCell className="font-mono">₹{trade.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{trade.orderStatus || 'EXECUTED'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(trade.executedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

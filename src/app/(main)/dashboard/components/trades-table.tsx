"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy } from "lucide-react";
import { CopyTradeDialog } from "./copy-trade-dialog";

interface TradesTableProps {
  showAccount?: boolean;
  refreshTrigger?: number;
  accountId?: string;
}

type RemoteTrade = {
  id: string;
  timestamp: string;
  account: string;
  symbol: string;
  type: string;
  side: string;
  quantity: number;
  tradedQty: number;
  price: number;
  status: string;
};

export function TradesTable({ showAccount = true, refreshTrigger = 0, accountId }: TradesTableProps) {
  const [loading, setLoading] = useState(true);
  const [masterTrades, setMasterTrades] = useState<RemoteTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<RemoteTrade | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  const fetchTrades = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_BASE || '');
      let fetchUrl: string;

      if (apiBase) {
        const base = apiBase.replace(/\/$/, '');
        fetchUrl = `${base}/api/alice/trades`;
        if (accountId) fetchUrl += `?accountId=${encodeURIComponent(accountId)}`;
      } else {
        const url = new URL("/api/alice/trades", window.location.origin);
        if (accountId) url.searchParams.append("accountId", accountId);
        fetchUrl = url.toString();
      }
      console.debug('[TRADES] fetching', fetchUrl);

      // Abort the fetch after 10s to avoid indefinite hangs
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const tradeRes = await fetch(fetchUrl, { signal: controller.signal }).finally(() => clearTimeout(timeout));
      if (!tradeRes.ok) throw new Error(`Status ${tradeRes.status}`);

      const payload = await tradeRes.json().catch(() => ({}));
      const incoming = payload.trades ?? [];

      console.debug('[TRADES] Received trades:', incoming);

      const mapped: RemoteTrade[] = incoming.map((t: any) => {
        const symbol = t.symbol || t.instrument || t.scrip || "";
        const quantity = Number(t.quantity ?? t.qty ?? 0);
        const price = Number(t.price ?? t.fillPrice ?? 0);
        const timestamp = t.timestamp || new Date().toISOString();
        const side = t.side || t.buySell || "Buy";

        const baseId =
          t.id ||
          `${t.account || "A"}-${symbol}-${price}-${quantity}-${side}-${timestamp}`;

        return {
          id: baseId.replace(/\s+/g, ""),
          timestamp,
          account: t.account || t.accountName || "Master",
          symbol,
          type: t.type || t.product || "Market",
          side,
          quantity,
          tradedQty: Number(t.tradedQty ?? t.filledQty ?? quantity),
          price,
          status: t.status || "Filled",
        };
      });

      console.debug('[TRADES] Mapped trades:', mapped);

      // Remove duplicates
      const uniqueMap = new Map<string, RemoteTrade>();
      for (const trade of mapped) {
        uniqueMap.set(trade.id, trade);
      }

      const sorted = Array.from(uniqueMap.values()).sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime()
      );

      setMasterTrades(sorted);
    } catch (e: any) {
      console.error("Failed to fetch trades", e);
      setError(e?.message ?? "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, [refreshTrigger]);

  function formatTime(ts: string) {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) {
        console.warn('[TRADES] Invalid timestamp format:', ts);
        return 'Invalid';
      }
      if (d.getTime() === 0) {
        return 'No Time Data';
      }
      // Convert UTC to IST for display
      const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5:30 hours in milliseconds
      const istTime = new Date(d.getTime() + istOffsetMs);
      // Debug: Show UTC and IST times
      console.debug('[TRADES] formatTime input:', ts, 'UTC:', d.toISOString(), 'IST:', istTime.toISOString());
      const hours24 = istTime.getUTCHours();
      const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
      const seconds = istTime.getUTCSeconds().toString().padStart(2, '0');
      const hours12 = hours24 % 12 || 12;
      const ampm = hours24 >= 12 ? 'pm' : 'am';
      const hoursStr = hours12.toString().padStart(2, '0');
      return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
    } catch (e) {
      console.error('[TRADES] Error formatting timestamp:', e);
      return 'Error';
    }
  }

  return (
    <div className="w-full overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchTrades}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : error ? (
        <div className="text-sm text-destructive">
          Error loading trades: {error}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Instrument</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Traded Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {masterTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No trades found.
                </TableCell>
              </TableRow>
            ) : (
              masterTrades.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell>{formatTime(trade.timestamp)}</TableCell>
                  <TableCell>
                    <span
                      className={
                        trade.side === "Buy"
                          ? "inline-block bg-green-100 text-green-800 px-3 py-1 rounded text-sm"
                          : "inline-block bg-red-100 text-red-800 px-3 py-1 rounded text-sm"
                      }
                    >
                      {trade.side}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{trade.symbol}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {trade.type}
                  </TableCell>
                  <TableCell className="text-right">{trade.quantity}</TableCell>
                  <TableCell className="text-right">{trade.tradedQty}</TableCell>
                  <TableCell className="text-right">
                    ₹{trade.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTrade(trade);
                        setCopyDialogOpen(true);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <CopyTradeDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        trade={selectedTrade}
      />
    </div>
  );
}

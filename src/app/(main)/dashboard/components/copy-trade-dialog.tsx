'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAccount } from '@/context/account-context';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RemoteTrade {
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
}

interface CopyTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trade: RemoteTrade | null;
}

export function CopyTradeDialog({ open, onOpenChange, trade }: CopyTradeDialogProps) {
  const { followerAccounts } = useAccount();
  const { toast } = useToast();
  const [selectedFollowers, setSelectedFollowers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleFollower = (followerId: string) => {
    const updated = new Set(selectedFollowers);
    if (updated.has(followerId)) {
      updated.delete(followerId);
    } else {
      updated.add(followerId);
    }
    setSelectedFollowers(updated);
  };

  const handleSelectAll = () => {
    if (selectedFollowers.size === followerAccounts.length) {
      setSelectedFollowers(new Set());
    } else {
      setSelectedFollowers(new Set(followerAccounts.map(f => f.id)));
    }
  };

  const handleCopy = async () => {
    if (!trade || selectedFollowers.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one follower',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/trades/copy-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade: {
            id: trade.id,
            symbol: trade.symbol,
            side: trade.side === 'Buy' ? 'BUY' : 'SELL',
            quantity: trade.quantity,
            price: trade.price,
            order_type: trade.type === 'Market' ? 'MARKET' : 'LIMIT',
            product_type: 'MIS',
            timestamp: trade.timestamp,
          },
          follower_ids: Array.from(selectedFollowers),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to copy trade');
      }

      const summary = data.summary || {};
      toast({
        title: 'Trade Copied',
        description: `✅ ${summary.successful || 0} successful, ⚠️ ${summary.skipped || 0} skipped, ❌ ${summary.failed || 0} failed`,
      });

      setSelectedFollowers(new Set());
      onOpenChange(false);
    } catch (error: any) {
      console.error('Copy error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to copy trade',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!trade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Copy Trade to Followers</DialogTitle>
          <DialogDescription>
            Select which followers should receive this trade copy
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Trade Summary */}
          <div className="bg-muted p-3 rounded-md space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Symbol:</span>
                <p className="font-medium">{trade.symbol}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Side:</span>
                <p className={`font-medium ${trade.side === 'Buy' ? 'text-green-600' : 'text-red-600'}`}>
                  {trade.side}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Quantity:</span>
                <p className="font-medium">{trade.quantity}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Price:</span>
                <p className="font-medium">₹{trade.price.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Followers List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Select Followers</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedFollowers.size === followerAccounts.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {followerAccounts.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No follower accounts available. Add followers first.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                {followerAccounts.map(follower => (
                  <div key={follower.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={follower.id}
                      checked={selectedFollowers.has(follower.id)}
                      onCheckedChange={() => handleToggleFollower(follower.id)}
                      disabled={isLoading}
                    />
                    <Label
                      htmlFor={follower.id}
                      className="cursor-pointer flex-1 font-medium"
                    >
                      {follower.name || follower.id}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {follower.lotMultiplier}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selection Summary */}
          <div className="text-sm text-muted-foreground">
            {selectedFollowers.size} of {followerAccounts.length} selected
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCopy}
            disabled={isLoading || selectedFollowers.size === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Copying...
              </>
            ) : (
              'Copy to Selected'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

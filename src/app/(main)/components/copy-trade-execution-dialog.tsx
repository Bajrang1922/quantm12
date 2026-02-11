'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Zap, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

export function CopyTradeExecutionDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [selectedFollowers, setSelectedFollowers] = useState<string[]>([]);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    symbol: '',
    side: 'BUY' as 'BUY' | 'SELL',
    masterQty: '',
    price: '',
    productType: 'MIS',
    orderType: 'REGULAR',
  });

  useEffect(() => {
    if (open) {
      fetchFollowers();
    }
  }, [open]);

  const fetchFollowers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/followers');
      const data = await res.json();

      if (data.ok) {
        const activeFollowers = (data.followers || []).filter(
          (f: any) => f.status === 'active' && f.copyTradingEnabled
        );
        setFollowers(activeFollowers);

        if (activeFollowers.length === 0) {
          toast({
            variant: 'destructive',
            title: 'No Active Followers',
            description: 'No followers with copy trading enabled found',
          });
        }
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch followers' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFollowers(followers.map(f => f.id));
    } else {
      setSelectedFollowers([]);
    }
  };

  const handleSelectFollower = (followerId: string, checked: boolean) => {
    if (checked) {
      setSelectedFollowers([...selectedFollowers, followerId]);
    } else {
      setSelectedFollowers(selectedFollowers.filter(id => id !== followerId));
    }
  };

  const handleExecute = async () => {
    if (!formData.symbol || !formData.masterQty || !formData.price) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Please fill all trade details',
      });
      return;
    }

    if (selectedFollowers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Followers Selected',
        description: 'Select at least one follower to copy trade to',
      });
      return;
    }

    setExecuting(true);
    try {
      // Generate unique trade ID to prevent duplicates
      const tradeId = `master_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const res = await fetch('/api/followers/execute-copy-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId, // ⭐ NEW: Pass unique trade ID for duplicate prevention
          symbol: formData.symbol.toUpperCase(),
          side: formData.side,
          masterQty: parseInt(formData.masterQty),
          price: parseFloat(formData.price),
          productType: formData.productType,
          orderType: formData.orderType,
          listenerFollowers: selectedFollowers,
        }),
      });

      const data = await res.json();
      
      if (data.ok) {
        setResults(data);
        toast({ title: 'Success', description: data.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.message });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" size="lg">
          <Zap className="h-5 w-5" />
          Copy Trade Now
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execute Copy Trade</DialogTitle>
          <DialogDescription>
            Copy a trade from your master account to selected followers
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-6">
            {/* Trade Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Trade Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol <span className="text-red-500">*</span></Label>
                  <Input
                    id="symbol"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    placeholder="e.g., INFY"
                    disabled={executing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="side">Side <span className="text-red-500">*</span></Label>
                  <Select value={formData.side} onValueChange={(val) => setFormData({ ...formData, side: val as 'BUY' | 'SELL' })}>
                    <SelectTrigger id="side" disabled={executing}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qty">Master Qty <span className="text-red-500">*</span></Label>
                  <Input
                    id="qty"
                    type="number"
                    value={formData.masterQty}
                    onChange={(e) => setFormData({ ...formData, masterQty: e.target.value })}
                    placeholder="1"
                    disabled={executing}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price <span className="text-red-500">*</span></Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    disabled={executing}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product">Product Type</Label>
                  <Select value={formData.productType} onValueChange={(val) => setFormData({ ...formData, productType: val })}>
                    <SelectTrigger id="product" disabled={executing}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MIS">MIS (Intraday)</SelectItem>
                      <SelectItem value="CNC">CNC (Delivery)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Followers Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Select Followers</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(selectedFollowers.length < followers.length)}
                  disabled={executing || followers.length === 0}
                >
                  {selectedFollowers.length === followers.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : followers.length === 0 ? (
                <div className="flex items-center gap-3 border-l-4 border-yellow-400 bg-yellow-50 p-4 rounded">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="font-semibold text-yellow-800">No Active Followers</p>
                    <p className="text-sm text-yellow-700">Add followers with copy trading enabled to start</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                  {followers.map((follower) => (
                    <div key={follower.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`follower-${follower.id}`}
                        checked={selectedFollowers.includes(follower.id)}
                        onCheckedChange={(checked) => handleSelectFollower(follower.id, checked as boolean)}
                        disabled={executing}
                      />
                      <label
                        htmlFor={`follower-${follower.id}`}
                        className="flex items-center gap-2 cursor-pointer flex-1 text-sm"
                      >
                        <span className="font-medium">{follower.name}</span>
                        <span className="text-muted-foreground text-xs">({follower.id})</span>
                        <span className="ml-auto text-muted-foreground">
                          {follower.lotMultiplier}x multiplier
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" disabled={executing}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={handleExecute}
                disabled={executing || followers.length === 0 || selectedFollowers.length === 0}
              >
                {executing ? 'Executing...' : 'Execute Copy Trade'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Results View
          <div className="space-y-4">
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded">
              <p className="font-semibold text-green-800">Copy Trade Executed Successfully!</p>
              <p className="text-sm text-green-700">{results.message}</p>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">
                      <span className="font-semibold text-green-600">{results.summary?.successCount || 0}</span> Successful
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="text-sm">
                      <span className="font-semibold text-red-600">{results.summary?.failedCount || 0}</span> Failed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="text-sm">
                      <span className="font-semibold text-blue-600">{results.summary?.totalFollowers || 0}</span> followers
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {results.results && results.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Details</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {results.results.map((result: any, idx: number) => (
                    <Card key={idx} className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{result.followerName}</p>
                            <p className="text-xs text-muted-foreground">{result.followerId}</p>
                          </div>
                          <Badge
                            variant={
                              result.status === 'SUCCESS'
                                ? 'default'
                                : result.status === 'SKIPPED'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {result.status}
                          </Badge>
                        </div>
                        {result.followerQty && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Qty: {result.followerQty}
                          </p>
                        )}
                        {result.reason && (
                          <p className="text-sm text-red-600 mt-2">{result.reason}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={() => {
                  setResults(null);
                  setFormData({ symbol: '', side: 'BUY', masterQty: '', price: '', productType: 'MIS', orderType: 'REGULAR' });
                  setSelectedFollowers([]);
                }}
              >
                New Trade
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

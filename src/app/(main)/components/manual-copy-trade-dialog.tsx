'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
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
import { AlertCircle, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ManualCopyTradeDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    symbol: '',
    side: 'BUY',
    masterQty: '',
    price: '',
  });

  const handleSubmit = async () => {
    if (!formData.symbol || !formData.masterQty || !formData.price) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Please fill all required fields',
      });
      return;
    }

    setLoading(true);
    try {
      // Get followers list
      const followersResponse = await fetch('/api/followers/list');
      const followersData = await followersResponse.json();

      if (!followersData.ok || followersData.followers.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Followers',
          description: 'No followers registered yet. Add a follower first.',
        });
        setLoading(false);
        return;
      }

      // Log copy trades for each follower
      const masterId = 'master_account'; // Default master ID
      let successCount = 0;

      for (const follower of followersData.followers) {
        const response = await fetch('/api/followers/copy-trades-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            masterId,
            followerId: follower.id,
            symbol: formData.symbol.toUpperCase(),
            side: formData.side.toUpperCase(),
            masterQty: parseInt(formData.masterQty),
            followerQty: Math.floor(parseInt(formData.masterQty) * (follower.lotMultiplier || 1)),
            price: parseFloat(formData.price),
            status: 'SUCCESS',
          }),
        });

        if (response.ok) {
          successCount++;
        }
      }

      toast({
        title: 'Copy Trades Created',
        description: `${successCount} copy trade(s) logged for all followers`,
      });

      setFormData({ symbol: '', side: 'BUY', masterQty: '', price: '' });
      setOpen(false);
    } catch (error) {
      console.error('Error creating copy trades:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create copy trades',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4" />
            Manual Copy Trade (Testing)
          </CardTitle>
          <CardDescription>
            Manually trigger copy trades to all followers for testing purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                Test Copy Trade
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Test Copy Trade</DialogTitle>
                <DialogDescription>
                  This will create a copy trade entry for all registered followers
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Symbol *</Label>
                  <Input
                    id="symbol"
                    placeholder="e.g., RELIANCE"
                    value={formData.symbol}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        symbol: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="side">Side *</Label>
                  <Select
                    value={formData.side}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, side: value }))
                    }
                  >
                    <SelectTrigger id="side">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">Buy</SelectItem>
                      <SelectItem value="SELL">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="masterQty">Master Quantity *</Label>
                  <Input
                    id="masterQty"
                    type="number"
                    placeholder="e.g., 100"
                    value={formData.masterQty}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        masterQty: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹) *</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="e.g., 2850.50"
                    step="0.05"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, price: e.target.value }))
                    }
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900">
                    Follower quantities will be calculated based on their lot multiplier
                  </p>
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Copy Trade'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}

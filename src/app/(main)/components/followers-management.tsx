'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2, ToggleRight, Loader2, AlertCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Follower {
  id: string;
  name: string;
  status: string;
  clientId: string;
  lotMultiplier: number;
  maxOrderQuantity: number;
  copyTradingEnabled: boolean;
  createdAt: string;
}

export function FollowersManagement() {
  const { toast } = useToast();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingFollower, setUpdatingFollower] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchFollowers();
  }, []);

  const fetchFollowers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/followers');
      const data = await res.json();

      if (data.ok) {
        setFollowers(data.followers || []);
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.message });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch followers' });
    } finally {
      setLoading(false);
    }
  };

  const toggleCopyTrading = async (followerId: string, enabled: boolean) => {
    try {
      setUpdatingFollower(followerId);
      const res = await fetch('/api/followers/toggle-copy-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId, enabled: !enabled }),
      });

      const data = await res.json();
      if (data.ok) {
        setFollowers(followers.map(f => 
          f.id === followerId ? { ...f, copyTradingEnabled: !enabled } : f
        ));
        toast({ title: 'Success', description: data.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.message });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update copy trading status' });
    } finally {
      setUpdatingFollower(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Followers Management</CardTitle>
        <CardDescription>Manage your followers and copy trading settings</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : followers.length === 0 ? (
          <div className="flex items-center gap-3 py-8 border-l-4 border-yellow-400 bg-yellow-50 px-4 rounded">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-800">No followers yet</p>
              <p className="text-sm text-yellow-700">Add a follower from the configuration page to start copy trading</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {followers.map((follower) => (
              <Card key={follower.id} className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Account ID</p>
                      <p className="text-lg font-mono">{follower.id}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Name</p>
                      <p className="text-lg">{follower.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Status</p>
                      <Badge variant={follower.status === 'active' ? 'default' : 'secondary'}>
                        {follower.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Lot Multiplier</p>
                      <p className="text-lg">{follower.lotMultiplier}x</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Max Order Qty</p>
                      <p className="text-lg">{follower.maxOrderQuantity}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Copy Trading</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Switch
                          checked={follower.copyTradingEnabled}
                          onCheckedChange={() => toggleCopyTrading(follower.id, follower.copyTradingEnabled)}
                          disabled={updatingFollower === follower.id}
                        />
                        <span className="text-sm">
                          {follower.copyTradingEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <EditFollowerDialog follower={follower} onUpdate={fetchFollowers} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditFollowerDialog({ follower, onUpdate }: { follower: Follower; onUpdate: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [lotMultiplier, setLotMultiplier] = useState(follower.lotMultiplier.toString());
  const [maxOrderQuantity, setMaxOrderQuantity] = useState(follower.maxOrderQuantity.toString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!lotMultiplier || !maxOrderQuantity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all fields' });
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/followers/update-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId: follower.id,
          lotMultiplier: parseFloat(lotMultiplier),
          maxOrderQuantity: parseInt(maxOrderQuantity),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Success', description: 'Follower settings updated' });
        setOpen(false);
        onUpdate();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: data.message });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update follower' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit className="h-4 w-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {follower.name}</DialogTitle>
          <DialogDescription>Update risk configuration for this follower</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="lot-multiplier">Lot Multiplier</Label>
              <Input
                id="lot-multiplier"
                type="number"
                step="0.1"
                min="0.1"
                value={lotMultiplier}
                onChange={(e) => setLotMultiplier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-quantity">Max Order Qty</Label>
              <Input
                id="max-quantity"
                type="number"
                min="1"
                value={maxOrderQuantity}
                onChange={(e) => setMaxOrderQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded text-sm text-blue-700">
            <p>Using Client ID + API Key from Alice Blue Trading Account</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

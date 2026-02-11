"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from '@/context/account-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, Loader2 } from 'lucide-react';

export function FollowersManager() {
  const { followerAccounts } = useAccount();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [copyTradingStatus, setCopyTradingStatus] = useState<Record<string, boolean>>({});
  const [loadingFollower, setLoadingFollower] = useState<string | null>(null);

  // Load copy trading status for all followers
  useEffect(() => {
    const loadStatus = async () => {
      for (const follower of followerAccounts) {
        try {
          const res = await fetch(`/api/followers/stop-copy-trading?followerId=${encodeURIComponent(follower.id)}`);
          const data = await res.json();
          if (data.ok) {
            setCopyTradingStatus(prev => ({ ...prev, [follower.id]: data.copyTradingActive }));
          }
        } catch (error) {
          console.error(`Failed to load status for ${follower.id}:`, error);
        }
      }
    };
    if (followerAccounts.length > 0) {
      loadStatus();
    }
  }, [followerAccounts]);

  const generateOauthLink = (id: string) => {
    const url = `${window.location.origin}/api/alice/oauth/vendor/start?accountId=${encodeURIComponent(id)}`;
    navigator.clipboard?.writeText(url).then(() => toast({ title: 'Link copied', description: `OAuth link for ${id} copied to clipboard.` }));
  };

  const openPasteDialog = (id: string) => {
    setSelected(id);
    setTokenInput('');
    setOpen(true);
  };

  const submitToken = async () => {
    if (!selected) return;
    try {
      const res = await fetch('/api/followers/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: selected, clientId: selected, apiKey: '', accessToken: tokenInput }),
      });
      const body = await res.json();
      if (body.ok) {
        toast({ title: 'Saved', description: `Token saved for ${selected}` });
        setOpen(false);
      } else {
        toast({ title: 'Failed', description: body.message || 'Unable to save token' });
      }
    } catch (e) {
      toast({ title: 'Error', description: String(e) });
    }
  };

  const testConnect = async (id: string) => {
    try {
      const res = await fetch(`/api/followers/test-connect?followerId=${encodeURIComponent(id)}`);
      const body = await res.json();
      if (body.ok) toast({ title: 'Connected', description: `${id} connection OK (${body.sampleCount} items)` });
      else toast({ title: 'Connection failed', description: body.message || 'Check token' });
    } catch (e) {
      toast({ title: 'Error', description: String(e) });
    }
  };

  const toggleCopyTrading = async (id: string, action: 'stop' | 'resume') => {
    setLoadingFollower(id);
    try {
      const res = await fetch('/api/followers/stop-copy-trading', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followerId: id, action }),
      });
      const data = await res.json();
      if (data.ok) {
        setCopyTradingStatus(prev => ({ ...prev, [id]: data.consent.copyTradingActive }));
        toast({
          title: action === 'stop' ? 'Copy Trading Stopped' : 'Copy Trading Resumed',
          description: `${action === 'stop' ? 'This follower will no longer' : 'This follower will now'} receive copy trades`,
        });
      } else {
        toast({ title: 'Error', description: data.message || 'Failed to update status', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    } finally {
      setLoadingFollower(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary">Manage Followers</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste follower token</DialogTitle>
            <DialogDescription>Paste an OAuth access_token or session token for the selected follower.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <div>Follower: {selected}</div>
            <Input value={tokenInput} onChange={e => setTokenInput((e.target as HTMLInputElement).value)} placeholder="Paste access_token / sessionToken here" />
            <div className="flex gap-2">
              <Button onClick={submitToken}>Save Token</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-2">
        {followerAccounts.map(f => (
          <div key={f.id} className="flex items-center justify-between p-3 border rounded">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-medium">{f.name || f.id}</div>
                <Badge
                  variant={copyTradingStatus[f.id] !== false ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {copyTradingStatus[f.id] !== false ? '🟢 Active' : '🔴 Stopped'}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{f.id}</div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button size="sm" onClick={() => generateOauthLink(f.id)}>Generate OAuth Link</Button>
              <Button size="sm" onClick={() => openPasteDialog(f.id)}>Paste/Update Token</Button>
              <Button size="sm" variant="outline" onClick={() => testConnect(f.id)}>Test Connect</Button>
              {copyTradingStatus[f.id] !== false ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={loadingFollower === f.id}
                  onClick={() => toggleCopyTrading(f.id, 'stop')}
                >
                  {loadingFollower === f.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  <Pause className="w-3 h-3 mr-1" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={loadingFollower === f.id}
                  onClick={() => toggleCopyTrading(f.id, 'resume')}
                >
                  {loadingFollower === f.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  <Play className="w-3 h-3 mr-1" />
                  Resume
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default FollowersManager;

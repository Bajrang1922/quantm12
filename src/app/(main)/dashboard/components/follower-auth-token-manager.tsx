"use client";

import React, { useState, useEffect } from 'react';
import { useAccount } from '@/context/account-context';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Copy, Loader2, Key, Zap, AlertCircle } from 'lucide-react';

interface FollowerTokenStatus {
  followerId: string;
  followerName: string;
  hasToken: boolean;
  copyTradingEnabled: boolean;
  tokenLastUpdated?: string;
  status: 'active' | 'paused' | 'error';
}

export function FollowerAuthTokenManager() {
  const { followerAccounts } = useAccount();
  const { toast } = useToast();
  const [followerStates, setFollowerStates] = useState<Record<string, FollowerTokenStatus>>({});
  const [loading, setLoading] = useState(true);
  const [selectedFollower, setSelectedFollower] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [processingFollower, setProcessingFollower] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load initial state for all followers
  useEffect(() => {
    loadFollowerStates();
  }, [followerAccounts]);

  const loadFollowerStates = async () => {
    setLoading(true);
    const states: Record<string, FollowerTokenStatus> = {};

    for (const follower of followerAccounts) {
      try {
        // Fetch token status
        const tokenRes = await fetch(`/api/followers/oauth-token?followerId=${encodeURIComponent(follower.id)}`);
        const tokenData = await tokenRes.json();

        // Fetch copy trading status
        const copyTradingRes = await fetch(`/api/followers/stop-copy-trading?followerId=${encodeURIComponent(follower.id)}`);
        const copyTradingData = await copyTradingRes.json();

        states[follower.id] = {
          followerId: follower.id,
          followerName: follower.name,
          hasToken: tokenData.ok && !!tokenData.token,
          copyTradingEnabled: copyTradingData.ok ? copyTradingData.copyTradingActive : false,
          tokenLastUpdated: tokenData.token?.updated_at || undefined,
          status: follower.status?.toLowerCase() || 'active',
        };
      } catch (error) {
        console.error(`Failed to load state for ${follower.id}:`, error);
        states[follower.id] = {
          followerId: follower.id,
          followerName: follower.name,
          hasToken: false,
          copyTradingEnabled: false,
          status: 'error',
        };
      }
    }

    setFollowerStates(states);
    setLoading(false);
  };

  const openTokenDialog = (followerId: string) => {
    setSelectedFollower(followerId);
    setTokenInput('');
    setTokenDialogOpen(true);
  };

  const saveToken = async () => {
    if (!selectedFollower || !tokenInput.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an auth token',
        variant: 'destructive',
      });
      return;
    }

    setProcessingFollower(selectedFollower);

    try {
      const response = await fetch('/api/followers/oauth-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId: selectedFollower,
          accessToken: tokenInput.trim(),
          provider: 'alice',
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: 'Success',
          description: `Auth token saved for ${followerStates[selectedFollower]?.followerName}`,
        });
        setTokenDialogOpen(false);
        setTokenInput('');
        await loadFollowerStates();
      } else {
        toast({
          title: 'Failed',
          description: result.message || 'Could not save token',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error saving token: ${String(error)}`,
        variant: 'destructive',
      });
    } finally {
      setProcessingFollower(null);
    }
  };

  const testTokenConnection = async (followerId: string) => {
    setProcessingFollower(followerId);

    try {
      const response = await fetch(`/api/followers/test-oauth-token?followerId=${encodeURIComponent(followerId)}`);
      const result = await response.json();

      if (result.ok) {
        toast({
          title: 'Connection Successful',
          description: `Successfully connected to ${followerStates[followerId]?.followerName}'s broker account`,
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result.message || 'Token may be invalid or expired',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error testing connection: ${String(error)}`,
        variant: 'destructive',
      });
    } finally {
      setProcessingFollower(null);
    }
  };

  const toggleCopyTrading = async (followerId: string, enable: boolean) => {
    setProcessingFollower(followerId);

    try {
      const response = await fetch(`/api/followers/copy-trading-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId,
          enabled: enable,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: 'Updated',
          description: enable ? 'Copy trading enabled' : 'Copy trading disabled',
        });
        await loadFollowerStates();
      } else {
        toast({
          title: 'Failed',
          description: result.message || 'Could not update copy trading status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Error updating copy trading: ${String(error)}`,
        variant: 'destructive',
      });
    } finally {
      setProcessingFollower(null);
    }
  };

  const copyTokenLink = (followerId: string) => {
    const url = `${window.location.origin}/api/alice/oauth/vendor/start?accountId=${encodeURIComponent(followerId)}`;
    navigator.clipboard?.writeText(url).then(() => {
      toast({
        title: 'Copied',
        description: 'OAuth link copied to clipboard',
      });
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Follower Auth Token Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Follower Auth Token Manager
            </CardTitle>
            <CardDescription>
              Manage OAuth tokens and copy trading settings for each follower
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setRefreshing(true);
              loadFollowerStates().finally(() => setRefreshing(false));
            }}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.values(followerStates).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No followers found. Add followers first from the configuration panel.</p>
            </div>
          ) : (
            <>
              {Object.values(followerStates).map((follower) => (
                <div
                  key={follower.followerId}
                  className="border rounded-lg p-4 space-y-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-base">{follower.followerName}</h3>
                        <Badge
                          variant={follower.status === 'active' ? 'default' : 'secondary'}
                          className="capitalize"
                        >
                          {follower.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">ID: {follower.followerId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {follower.hasToken ? (
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Token Set
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <XCircle className="w-4 h-4" />
                          No Token
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Token Last Updated */}
                  {follower.tokenLastUpdated && (
                    <p className="text-xs text-gray-500">
                      Last updated: {new Date(follower.tokenLastUpdated).toLocaleString()}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {/* Set/Update Token Button */}
                    <Dialog open={tokenDialogOpen && selectedFollower === follower.followerId} onOpenChange={(open) => {
                      if (!open) {
                        setTokenDialogOpen(false);
                        setSelectedFollower(null);
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          onClick={() => openTokenDialog(follower.followerId)}
                          variant="outline"
                          size="sm"
                          disabled={processingFollower !== null}
                        >
                          {follower.hasToken ? 'Update Token' : 'Set Token'}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Set Auth Token</DialogTitle>
                          <DialogDescription>
                            Enter the OAuth access token for {follower.followerName}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Auth Token</label>
                            <Input
                              type="password"
                              placeholder="Paste OAuth token here..."
                              value={tokenInput}
                              onChange={(e) => setTokenInput(e.target.value)}
                              className="mt-2"
                            />
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                            <p className="font-medium mb-1">Get Token via OAuth:</p>
                            <Button
                              onClick={() => copyTokenLink(follower.followerId)}
                              variant="link"
                              size="sm"
                              className="text-blue-600 p-0 h-auto"
                            >
                              Copy OAuth Link
                            </Button>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button
                              onClick={() => setTokenDialogOpen(false)}
                              variant="ghost"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={saveToken}
                              disabled={!tokenInput.trim() || processingFollower === follower.followerId}
                            >
                              {processingFollower === follower.followerId && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              Save Token
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Test Connection Button */}
                    {follower.hasToken && (
                      <Button
                        onClick={() => testTokenConnection(follower.followerId)}
                        variant="outline"
                        size="sm"
                        disabled={processingFollower !== null}
                      >
                        {processingFollower === follower.followerId && (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        )}
                        Test Connection
                      </Button>
                    )}

                    {/* Copy Trading Toggle */}
                    {follower.hasToken && (
                      <Button
                        onClick={() => toggleCopyTrading(follower.followerId, !follower.copyTradingEnabled)}
                        variant={follower.copyTradingEnabled ? 'default' : 'outline'}
                        size="sm"
                        disabled={processingFollower !== null}
                        className={follower.copyTradingEnabled ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        {processingFollower === follower.followerId && (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        )}
                        <Zap className="w-4 h-4 mr-1" />
                        {follower.copyTradingEnabled ? 'Copy Trading ON' : 'Enable Copy Trading'}
                      </Button>
                    )}
                  </div>

                  {/* Copy Trading Status */}
                  {follower.hasToken && (
                    <div className="text-xs text-gray-600 pt-2 border-t">
                      Copy Trading: {follower.copyTradingEnabled ? '✓ Enabled' : '✗ Disabled'}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

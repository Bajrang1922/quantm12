'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { TradesTable } from './trades-table';
import { useAccount } from '@/context/account-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MasterConnectionStatus } from './master-connection-status';
import { AddFollowerDialog } from '@/app/(main)/configuration/components/account-settings';
import { FollowerCardWithControls } from './follower-card-with-controls';
import { OAuthConnectDialog } from '@/app/(main)/components/oauth-connect-dialog';
import { ManualCopyTradeDialog } from '@/app/(main)/components/manual-copy-trade-dialog';
import { CopyTradeExecutionDialog } from '@/app/(main)/components/copy-trade-execution-dialog';
import { FollowersManagement } from '@/app/(main)/components/followers-management';
import { X, RefreshCw } from 'lucide-react';

export function MasterDashboard() {
  const { followerAccounts, masterAccounts } = useAccount();
  const [selectedFollower, setSelectedFollower] = useState<any>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(true);
  const [masterAccountId, setMasterAccountId] = useState<string | undefined>(undefined);

  // Fetch master account ID from API on mount
  useEffect(() => {
    const fetchMasterAccountId = async () => {
      try {
        const res = await fetch('/api/master/status');
        const data = await res.json();
        if (data.master?.userId) {
          setMasterAccountId(data.master.userId);
          console.log('[DASHBOARD] Master account ID:', data.master.userId);
        }
      } catch (e) {
        console.error('Failed to fetch master account ID:', e);
      }
    };
    fetchMasterAccountId();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!isAutoRefreshEnabled) return;

    const interval = setInterval(() => {
      setRefreshCounter((prev) => prev + 1);
    }, 5000); // 5000ms = 5 seconds

    return () => clearInterval(interval);
  }, [isAutoRefreshEnabled]);

  const ManageFollowerDialog = ({ account }: { account: any }) => {
    const [clientId, setClientId] = useState(account.clientId || '');
    const [apiKey, setApiKey] = useState(account.apiKey || '');
    const [consentGiven, setConsentGiven] = useState(account.consentGiven || false);
    const [brokerSessionId, setBrokerSessionId] = useState(account.brokerSessionId || '');
    const [open, setOpen] = useState(false);

    const handleSave = async () => {
      if (!clientId || !apiKey) return;
      try {
        const response = await fetch('/api/followers/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerId: account.id,
            clientId,
            apiKey,
            brokerSessionId: brokerSessionId || undefined,
            accessToken: 'api_auth',
          }),
        });
        const result = await response.json();
        if (result.ok) {
          setOpen(false);
        }
      } catch (error) {
        console.error('Failed to save credentials', error);
      }
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <Button onClick={() => setOpen(true)} variant="outline" size="sm">Manage</Button>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage {account.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="text-sm font-medium">Client ID</label>
              <input 
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">API Key</label>
              <input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Broker Session ID (Optional)</label>
              <input 
                type="text"
                value={brokerSessionId}
                onChange={(e) => setBrokerSessionId(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">Save</Button>
              <Button onClick={() => setOpen(false)} variant="ghost" className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header with OAuth Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your master trading account</p>
        </div>
        <Link href="/connections" className="flex gap-2">
          <OAuthConnectDialog />
        </Link>
      </div>

      {/* Master Connection Status */}
      <MasterConnectionStatus />

      {/* Master Trade Book Section */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Master Trade Book</CardTitle>
            <CardDescription>
              Real-time trades from your master Alice Blue account
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50">
              <RefreshCw className="h-3 w-3 mr-1" />
              Auto-refresh: {isAutoRefreshEnabled ? 'ON (5s)' : 'OFF'}
            </Badge>
            <Button
              onClick={() => setIsAutoRefreshEnabled(!isAutoRefreshEnabled)}
              variant={isAutoRefreshEnabled ? 'default' : 'outline'}
              size="sm"
            >
              {isAutoRefreshEnabled ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TradesTable refreshTrigger={refreshCounter} accountId={masterAccountId} />
        </CardContent>
      </Card>

      {/* Copy Trading Controls */}
      <div className="flex gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-lg p-6">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2">Copy Trading to Followers</h3>
          <p className="text-sm text-muted-foreground">Execute trades from your master account to all or selected followers</p>
        </div>
        <div className="flex gap-2 items-center">
          <CopyTradeExecutionDialog />
        </div>
      </div>

      {/* Followers Management */}
      <FollowersManagement />

      {/* Followers Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Followers</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Click on a follower to view their trade book and manage settings
            </p>
          </div>
          <div className="flex gap-2">
            <AddFollowerDialog />
            <Button asChild variant="outline">
              <Link href="/configuration">Manage All</Link>
            </Button>
          </div>
        </div>

        {followerAccounts && followerAccounts.length > 0 ? (
          <>
            {/* Followers Grid */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6">
              {followerAccounts.map((follower: any) => (
                <FollowerCardWithControls
                  key={follower.id}
                  follower={follower}
                  onSelect={setSelectedFollower}
                />
              ))}
            </div>

            {/* Follower Detail Modal */}
            {selectedFollower && (
              <Card className="border-2 border-blue-200 bg-blue-50/20">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{selectedFollower.name}</CardTitle>
                    <CardDescription>{selectedFollower.id}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFollower(null)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Follower Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded border">
                    <div>
                      <p className="text-xs text-muted-foreground">Client ID</p>
                      <p className="font-mono text-sm mt-1">{selectedFollower.clientId || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className={`text-sm font-medium mt-1 ${selectedFollower.consentGiven ? 'text-green-600' : 'text-yellow-600'}`}>
                        {selectedFollower.consentGiven ? '✓ Active' : '⚠ Pending'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lot Multiplier</p>
                      <p className="font-medium text-sm mt-1">{selectedFollower.lotMultiplier || '1.0'}x</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Max Quantity</p>
                      <p className="font-medium text-sm mt-1">{selectedFollower.perAccountCap || '-'}</p>
                    </div>
                  </div>

                  {/* Copy Trading Status Alert */}
                  <Card className="border-l-4 border-l-blue-500 bg-blue-50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Copy Trading Status</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedFollower.consentGiven 
                              ? 'This follower is ready to receive your trades' 
                              : 'Consent required before copy trading can start'}
                          </p>
                        </div>
                        <Badge className="ml-2 text-base px-3 py-2">
                          {selectedFollower.consentGiven ? '✓ Ready' : '⚠ Pending'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Follower Trade Book */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">
                      {selectedFollower.name} - Copied Trades
                    </h3>
                    <TradesTable refreshTrigger={refreshCounter} />
                  </div>

                  {/* Manage Button */}
                  <div className="flex gap-2 pt-4 border-t">
                    <ManageFollowerDialog account={selectedFollower} />
                    <Button asChild variant="outline" className="flex-1">
                      <Link href="/configuration">Settings</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <div className="text-muted-foreground">
              <p className="mb-4 text-lg">No followers added yet</p>
              <AddFollowerDialog />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

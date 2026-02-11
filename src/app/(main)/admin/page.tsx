'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Copy, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TradesTable } from '@/app/(main)/dashboard/components/trades-table';

interface Settings {
  max_quantity_per_trade: number;
  max_daily_loss_percentage: number;
  min_lot_size: number;
  default_lot_multiplier: number;
  auto_liquidate_on_loss: boolean;
  max_concurrent_trades: number;
  auto_replicate_new_trades: boolean;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [lastPoll, setLastPoll] = useState<string | null>(null);
  const [pollResult, setPollResult] = useState<any>(null);
  const [autoReplicating, setAutoReplicating] = useState(false);
  const [autoReplicateResult, setAutoReplicateResult] = useState<any>(null);
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [masterTrades, setMasterTrades] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings>({
    max_quantity_per_trade: 1000,
    max_daily_loss_percentage: 5,
    min_lot_size: 1,
    default_lot_multiplier: 1,
    auto_liquidate_on_loss: false,
    max_concurrent_trades: 10,
    auto_replicate_new_trades: true,
  });

  // Only master can access
  if (user?.role !== 'master') {
    return (
      <div className="text-center py-10">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p>Only master account can access admin panel.</p>
      </div>
    );
  }

  const loadAdminData = async () => {
    if (!secret) {
      toast({
        title: 'Error',
        description: 'Please enter x-qa-secret',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    setSettingsLoading(true);
    
    try {
      // Load accounts
      const accountRes = await fetch('/api/admin/accounts', {
        headers: { 'x-qa-secret': secret }
      });
      const accountData = await accountRes.json();
      if (accountData.ok) {
        setAccounts(accountData.list || []);
      }

      // Load settings
      const settingsRes = await fetch('/api/admin/settings', {
        headers: { 'x-qa-secret': secret }
      });
      const settingsData = await settingsRes.json();
      if (settingsData.ok) {
        setSettings(settingsData.settings);
      }

      // Save secret to localStorage for logs page
      localStorage.setItem('qa-secret', secret);

      toast({
        title: 'Success',
        description: 'Admin data loaded successfully',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as any).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setSettingsLoading(false);
    }
  };

  const triggerPoll = async () => {
    setPolling(true);
    try {
      const res = await fetch('/api/alice/trades', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      const trades = data.trades || [];
      setPollResult({ ok: true, newTrades: trades.length });
      setLastPoll(new Date().toLocaleString());
      toast({
        title: 'Trades Fetched',
        description: `Fetched ${trades.length} trades from OAuth`,
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as any).message,
        variant: 'destructive',
      });
    } finally {
      setPolling(false);
    }
  };

  const triggerAutoReplicate = async () => {
    // Auto-replication is now done via manual copy-trades
    toast({
      title: 'Use Manual Copy Trade',
      description: 'Go to dashboard and use "Manual Copy Trade (Testing)" to copy trades to followers',
    });
  };

  const saveSettings = async () => {
    if (!secret) {
      toast({
        title: 'Error',
        description: 'Please enter x-qa-secret',
        variant: 'destructive',
      });
      return;
    }

    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-qa-secret': secret
        },
        body: JSON.stringify({
          maxQuantityPerTrade: settings.max_quantity_per_trade,
          maxDailyLossPercentage: settings.max_daily_loss_percentage,
          minLotSize: settings.min_lot_size,
          defaultLotMultiplier: settings.default_lot_multiplier,
          autoLiquidateOnLoss: settings.auto_liquidate_on_loss,
          maxConcurrentTrades: settings.max_concurrent_trades,
          autoReplicateNewTrades: settings.auto_replicate_new_trades,
        })
      });
      const data = await res.json();
      if (data.ok) {
        toast({
          title: 'Success',
          description: 'Settings saved successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: data.message,
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as any).message,
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Manage Alice Blue accounts, risk settings, and trading automation</p>
      </div>

      {/* Secret Management - Only shows if not authenticated */}
      {!secret && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-900">🔐 Admin Authentication Required</CardTitle>
            <CardDescription className="text-yellow-800">Enter your x-qa-secret to access admin features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showSecret ? "text" : "password"}
                  placeholder="Enter x-qa-secret"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button onClick={loadAdminData} disabled={loading || !secret}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Unlock Admin'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {secret && (
        <>
          {/* Master Trade Book */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Master Trade Book</CardTitle>
              <CardDescription>Real-time trades from your master account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Button onClick={triggerPoll} disabled={polling} size="sm">
                  {polling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Polling...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Trades
                    </>
                  )}
                </Button>
                {lastPoll && (
                  <p className="text-xs text-muted-foreground mt-2">Last poll: {lastPoll}</p>
                )}
              </div>
              <TradesTable />
            </CardContent>
          </Card>

          {/* Accounts List */}
          {accounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>✅ Connected Accounts</CardTitle>
                <CardDescription>{accounts.length} account(s) connected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {accounts.map((acc, idx) => (
                    <div key={idx} className="border rounded p-4 flex justify-between items-start hover:bg-muted/50 transition">
                      <div className="flex-1">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {acc.userId}
                          <Badge variant="outline" className="text-xs">Connected</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground font-mono mt-1">{acc.tokenMask}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(acc.tokenMask)}
                      >
                        <Copy size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Management Settings */}
          <Card>
            <CardHeader>
              <CardTitle>⚠️ Risk Management Settings</CardTitle>
              <CardDescription>Configure trade risk parameters and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Max Quantity Per Trade */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Quantity Per Trade</label>
                  <input
                    type="number"
                    value={settings.max_quantity_per_trade}
                    onChange={(e) => setSettings({...settings, max_quantity_per_trade: parseInt(e.target.value)})}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Maximum quantity for any single trade</p>
                </div>

                {/* Max Daily Loss Percentage */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Daily Loss %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.max_daily_loss_percentage}
                    onChange={(e) => setSettings({...settings, max_daily_loss_percentage: parseFloat(e.target.value)})}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Stop trading if daily loss exceeds this percentage</p>
                </div>

                {/* Min Lot Size */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Min Lot Size</label>
                  <input
                    type="number"
                    value={settings.min_lot_size}
                    onChange={(e) => setSettings({...settings, min_lot_size: parseInt(e.target.value)})}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Minimum quantity per lot</p>
                </div>

                {/* Default Lot Multiplier */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Lot Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.default_lot_multiplier}
                    onChange={(e) => setSettings({...settings, default_lot_multiplier: parseFloat(e.target.value)})}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Multiplier for follower quantity calculation</p>
                </div>

                {/* Max Concurrent Trades */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Max Concurrent Trades</label>
                  <input
                    type="number"
                    value={settings.max_concurrent_trades}
                    onChange={(e) => setSettings({...settings, max_concurrent_trades: parseInt(e.target.value)})}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Maximum number of active trades allowed</p>
                </div>

                {/* Auto Liquidate */}
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.auto_liquidate_on_loss}
                      onChange={(e) => setSettings({...settings, auto_liquidate_on_loss: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Auto Liquidate on Max Loss</span>
                  </label>
                </div>

                {/* Auto Replicate New Trades */}
                <div className="space-y-2 flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.auto_replicate_new_trades}
                      onChange={(e) => setSettings({...settings, auto_replicate_new_trades: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Auto-Replicate NEW Trades</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={saveSettings} disabled={savingSettings}>
                  {savingSettings ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle size={14} />
                  Changes apply to all future trades
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lots Management */}
          <Card>
            <CardHeader>
              <CardTitle>📦 Lot Settings</CardTitle>
              <CardDescription>Configure lot sizes and multipliers for followers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded">
                  <p className="font-medium text-sm mb-2">How Lot Calculations Work:</p>
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    <li>1. Master places trade with quantity: <span className="font-mono">{settings.min_lot_size} x {settings.default_lot_multiplier}</span></li>
                    <li>2. Each follower receives quantity: <span className="font-mono">base × lot_multiplier</span></li>
                    <li>3. Max allowed quantity: <span className="font-mono">{settings.max_quantity_per_trade}</span></li>
                    <li>4. Orders rejected if they exceed risk limits (max daily loss: <span className="font-mono">{settings.max_daily_loss_percentage}%</span>)</li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded p-4">
                    <p className="text-xs text-muted-foreground mb-1">Min Lot Size</p>
                    <p className="text-lg font-bold">{settings.min_lot_size}</p>
                  </div>
                  <div className="border rounded p-4">
                    <p className="text-xs text-muted-foreground mb-1">Default Multiplier</p>
                    <p className="text-lg font-bold">× {settings.default_lot_multiplier}</p>
                  </div>
                  <div className="border rounded p-4">
                    <p className="text-xs text-muted-foreground mb-1">Max Trade Qty</p>
                    <p className="text-lg font-bold">{settings.max_quantity_per_trade}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Poll Control */}
          <Card>
            <CardHeader>
              <CardTitle>⚡ Trade Polling</CardTitle>
              <CardDescription>Fetch trades from master and broadcast to dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={triggerPoll} 
                disabled={polling} 
                size="lg" 
                className="w-full"
              >
                {polling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Polling...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Trigger Poll Now
                  </>
                )}
              </Button>

              {pollResult && (
                <div className="bg-green-50 border border-green-200 p-4 rounded space-y-2">
                  <p className="font-medium text-sm">✓ Poll completed successfully</p>
                  <p className="text-sm">
                    <span className="font-mono">New trades:</span> <span className="font-bold text-lg">{pollResult.newTrades || 0}</span>
                  </p>
                  {pollResult.message && (
                    <p className="text-xs text-muted-foreground">{pollResult.message}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto-Replication */}
          <Card>
            <CardHeader>
              <CardTitle>🔄 Auto-Replication to Followers</CardTitle>
              <CardDescription>Automatically copy NEW master trades to all active followers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded">
                <p className="font-medium text-sm mb-2">How it works:</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Auto-replication is {settings.auto_replicate_new_trades ? '✅ ENABLED' : '❌ DISABLED'}</li>
                  <li>• Polls for NEW trades from master account</li>
                  <li>• Identifies trades not yet replicated to followers</li>
                  <li>• Automatically copies NEW trades to all active followers</li>
                  <li>• Skips trades already replicated</li>
                  <li>• Risk management rules still apply</li>
                </ul>
              </div>

              <Button 
                onClick={triggerAutoReplicate} 
                disabled={autoReplicating} 
                size="lg" 
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {autoReplicating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Auto-Replicating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Trigger Auto-Replication Now
                  </>
                )}
              </Button>

              {autoReplicateResult && (
                <div className="bg-green-50 border border-green-200 p-4 rounded space-y-2">
                  <p className="font-medium text-sm">✓ Auto-replication completed successfully</p>
                  <p className="text-sm">
                    <span className="font-mono">Replicated:</span> <span className="font-bold text-lg">{autoReplicateResult.autoReplicated || 0}</span> trades
                  </p>
                  <p className="text-sm">
                    <span className="font-mono">To followers:</span> <span className="font-bold text-lg">{autoReplicateResult.totalFollowers || 0}</span>
                  </p>
                  {autoReplicateResult.message && (
                    <p className="text-xs text-muted-foreground">{autoReplicateResult.message}</p>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground border-t pt-3">
                💡 Tip: Enable auto-replication in Risk Management Settings above to automatically copy trades when polling runs.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

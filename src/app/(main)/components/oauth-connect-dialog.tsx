'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle, Loader2, LogOut, Plug } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface OAuthConnection {
  accountId: string;
  connected: boolean;
  connectedAt?: string;
  expiresAt?: string;
  status: 'connected' | 'disconnected' | 'expired';
}

export function OAuthConnectDialog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connection, setConnection] = useState<OAuthConnection | null>(null);
  const [checking, setChecking] = useState(true);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, [user?.id]);

  const checkConnectionStatus = async () => {
    try {
      setChecking(true);
      // For OAuth users, use their account ID (user.id is the account ID like 2548613)
      // For followers, use 'Master' to check master account status
      const accountId = user?.id || 'Master';
      const res = await fetch(`/api/alice/oauth-status?accountId=${encodeURIComponent(accountId)}`, {
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      
      if (data.ok) {
        setConnection(data.connection);
      }
    } catch (error) {
      console.error('Failed to check connection status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleConnectOAuth = async () => {
    try {
      setLoading(true);
      
      if (!user?.id) {
        throw new Error('User ID not found');
      }

      // Determine if this is a master account connection
      const isMaster = user?.role === 'master';
      
      // Call OAuth start endpoint to get redirect URL
      const res = await fetch(`/api/alice/oauth/start?accountId=${encodeURIComponent(user.id)}&isMaster=${isMaster}`);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to initiate OAuth');
      }
      
      const data = await res.json();
      
      if (data.ok && data.redirectUrl) {
        // Redirect to AliceBlue OAuth login
        window.location.href = data.redirectUrl;
      } else {
        throw new Error(data.message || 'Invalid OAuth response');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as any)?.message || 'Failed to connect to AliceBlue',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection?.accountId) return;
    
    try {
      setDisconnecting(true);
      const res = await fetch('/api/alice/oauth-disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connection.accountId })
      });
      
      const data = await res.json();
      
      if (data.ok) {
        toast({
          title: 'Disconnected',
          description: 'AliceBlue connection removed',
        });
        setConnection(null);
        setOpen(false);
        await checkConnectionStatus();
      } else {
        throw new Error(data.message || 'Failed to disconnect');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as any)?.message || 'Failed to disconnect',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const getConnectionStatusColor = (status?: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plug className="w-4 h-4" />
          AliceBlue Connection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>AliceBlue OAuth Connection</DialogTitle>
          <DialogDescription>
            Connect your AliceBlue account to start trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {checking ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : connection?.status === 'connected' ? (
            <>
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <CardTitle className="text-base">Connected</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Account ID</p>
                    <p className="text-sm font-mono text-gray-900">{connection.accountId}</p>
                  </div>
                  
                  {connection.connectedAt && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Connected</p>
                      <p className="text-sm text-gray-700">
                        {new Date(connection.connectedAt).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {connection.expiresAt && (
                    <div>
                      <p className="text-sm font-medium text-gray-600">Expires</p>
                      <p className="text-sm text-gray-700">
                        {new Date(connection.expiresAt).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-600 mb-3">
                      ✅ Your AliceBlue account is connected. Trades will sync automatically.
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                    >
                      {disconnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <CardTitle className="text-base">Not Connected</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 mb-4">
                    Connect your AliceBlue account to enable trade syncing and copy-trading features.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Account Type</p>
                <Badge variant="outline" className="w-full justify-center py-2">
                  {user?.role === 'master' ? '🎯 Master Account' : '📊 Follower Account'}
                </Badge>
              </div>

              <Button
                onClick={handleConnectOAuth}
                disabled={loading}
                className="w-full gap-2"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Plug className="w-4 h-4" />
                    Connect to AliceBlue
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                You'll be redirected to AliceBlue to securely authenticate.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

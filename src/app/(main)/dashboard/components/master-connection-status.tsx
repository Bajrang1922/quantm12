'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, CheckCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';

export function MasterConnectionStatus() {
  const { toast } = useToast();
  const [masterAccount, setMasterAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkMasterConnection();
  }, []);

  const checkMasterConnection = async () => {
    try {
      const res = await fetch('/api/master/status');
      const data = await res.json();
      if (data.ok) {
        setMasterAccount(data.master);
      }
    } catch (e) {
      console.error('Failed to check master status:', e);
    } finally {
      setLoading(false);
    }
  };

  const connectToAliceBlue = () => {
    setConnecting(true);
    // Trigger vendor OAuth flow
    const redirectUrl = new URL('/api/alice/oauth/vendor/start', window.location.origin);
    window.location.href = redirectUrl.toString();
  };

  const disconnectFromAliceBlue = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/master/disconnect', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMasterAccount(null);
        toast({
          title: 'Disconnected',
          description: 'Master account disconnected from Alice Blue',
        });
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as any).message,
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!masterAccount) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Master Account Not Connected
          </CardTitle>
          <CardDescription>Connect your Alice Blue account to start copy trading</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={connectToAliceBlue}
            disabled={connecting}
            size="lg"
            className="w-full"
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4 mr-2" />
                Connect to Alice Blue
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            You will be redirected to Alice Blue to authorize this app. After login, your token will be automatically stored.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Master Account Connected
        </CardTitle>
        <CardDescription>Your Alice Blue account is ready for copy trading</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Account ID:</span>
            <span className="text-sm font-mono bg-white px-3 py-1 rounded">{masterAccount.userId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Token:</span>
            <span className="text-sm font-mono bg-white px-3 py-1 rounded">{masterAccount.tokenMask}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Status:</span>
            <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
          </div>
        </div>

        <Alert className="bg-white border-green-200">
          <AlertDescription className="text-sm">
            ✅ Ready! Your trades will appear on the dashboard. Select followers and click "Copy" to replicate trades.
          </AlertDescription>
        </Alert>

        <Button
          onClick={disconnectFromAliceBlue}
          disabled={disconnecting}
          variant="outline"
          className="w-full text-red-600 border-red-200 hover:bg-red-50"
        >
          {disconnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Disconnecting...
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-2" />
              Disconnect
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

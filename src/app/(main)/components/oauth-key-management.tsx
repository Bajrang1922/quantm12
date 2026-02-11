'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Eye, EyeOff, Key, Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { OAuthConnectDialog } from './oauth-connect-dialog';

interface OAuthConfig {
  appCode?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authMethod?: string;
  configured: boolean;
  lastUpdated?: string;
}

interface OAuthConnection {
  accountId: string;
  connected: boolean;
  connectedAt?: string;
  status: 'connected' | 'disconnected' | 'expired';
}

export function OAuthKeyManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setConfig] = useState<OAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

  // Form state
  const [formData, setFormData] = useState<Partial<OAuthConfig>>({});

  // Only show for master
  if (user?.role !== 'master') {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-800 font-semibold">Master Access Required</p>
            <p className="text-yellow-700 text-sm">Only master accounts can manage OAuth keys.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  useEffect(() => {
    fetchOAuthConfig();
    fetchConnections();
  }, []);

  const fetchOAuthConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/alice/oauth-config');
      const data = await res.json();
      
      if (data.ok) {
        setConfig(data.config);
        setFormData(data.config);
      }
    } catch (error) {
      console.error('Failed to fetch OAuth config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      setLoadingConnections(true);
      const res = await fetch('/api/alice/oauth-connections');
      const data = await res.json();
      
      if (data.ok) {
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/alice/oauth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.ok) {
        toast({
          title: 'Success',
          description: 'OAuth configuration updated',
        });
        setConfig(data.config);
        setEditOpen(false);
      } else {
        throw new Error(data.message || 'Failed to save config');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as any)?.message || 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const maskSecret = (secret?: string) => {
    if (!secret) return 'Not configured';
    return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Value copied to clipboard',
    });
  };

  return (
    <div className="space-y-6">
      {/* OAuth Configuration Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              OAuth Configuration
            </CardTitle>
            <CardDescription>
              Manage your AliceBlue OAuth keys and settings
            </CardDescription>
          </div>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Edit Keys</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Update OAuth Configuration</DialogTitle>
                <DialogDescription>
                  Update your AliceBlue OAuth keys from the developer portal
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="appCode">App Code</Label>
                  <Input
                    id="appCode"
                    placeholder="Your AliceBlue App Code"
                    value={formData.appCode || ''}
                    onChange={(e) => setFormData({ ...formData, appCode: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    placeholder="Your Client ID"
                    value={formData.clientId || ''}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    placeholder="Your Client Secret"
                    value={formData.clientSecret || ''}
                    onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="redirectUri">Redirect URI</Label>
                  <Input
                    id="redirectUri"
                    placeholder="https://yourdomain.com/aliceblue/callback"
                    value={formData.redirectUri || window.location.origin + '/aliceblue/callback'}
                    onChange={(e) => setFormData({ ...formData, redirectUri: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="authMethod">Auth Method</Label>
                  <select
                    id="authMethod"
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.authMethod || 'headers'}
                    onChange={(e) => setFormData({ ...formData, authMethod: e.target.value })}
                  >
                    <option value="headers">Headers (x-api-key)</option>
                    <option value="basic">Basic Auth</option>
                    <option value="hmac">HMAC-SHA256</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-700">
                    💡 Get these keys from your AliceBlue Developer Portal
                  </p>
                </div>

                <Button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="w-full gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : config?.configured ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-600">App Code</Label>
                  <p className="font-mono text-sm break-all">{maskSecret(config.appCode)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Client ID</Label>
                  <p className="font-mono text-sm break-all">{maskSecret(config.clientId)}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-600">Redirect URI</Label>
                  <div className="flex gap-2 items-center">
                    <p className="font-mono text-xs break-all flex-1 p-2 bg-gray-50 rounded">
                      {config.redirectUri}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(config.redirectUri || '')}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {config.lastUpdated && (
                  <div className="col-span-2">
                    <Label className="text-xs text-gray-600">Last Updated</Label>
                    <p className="text-sm text-gray-700">
                      {new Date(config.lastUpdated).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              <Badge className="bg-green-100 text-green-800 border-green-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                Configured
              </Badge>
            </>
          ) : (
            <div className="text-center py-6">
              <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-gray-700">No OAuth configuration found</p>
              <p className="text-sm text-gray-600 mb-4">
                Add your AliceBlue OAuth keys to enable connections
              </p>
              <Button onClick={() => setEditOpen(true)}>Configure Now</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Manage master and follower connections
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadingConnections ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : connections.length > 0 ? (
            <div className="space-y-3">
              {connections.map((conn) => (
                <div
                  key={conn.accountId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-mono text-sm">{conn.accountId}</p>
                    <p className="text-xs text-gray-600">
                      {conn.connectedAt
                        ? `Connected: ${new Date(conn.connectedAt).toLocaleString()}`
                        : 'Disconnected'}
                    </p>
                  </div>
                  <Badge
                    variant={conn.status === 'connected' ? 'default' : 'outline'}
                    className={
                      conn.status === 'connected'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {conn.status === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-700">No accounts connected yet</p>
            </div>
          )}

          <div className="pt-4 border-t">
            <OAuthConnectDialog />
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Guide */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-base">Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900">
          <p>1. 📋 Get OAuth keys from <a href="https://developer.aliceblueonline.com" target="_blank" className="underline font-semibold">AliceBlue Developer Portal</a></p>
          <p>2. 🔑 Click "Edit Keys" above and paste your credentials</p>
          <p>3. 🔗 Click "Connect to AliceBlue" to authorize your account</p>
          <p>4. ✅ Your account will appear in "Connected Accounts"</p>
          <p>5. 📊 Trades will sync automatically to your dashboard</p>
        </CardContent>
      </Card>
    </div>
  );
}

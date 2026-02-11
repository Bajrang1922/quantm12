'use client';

import { useState } from 'react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Loader2, UserPlus, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

interface FollowerCredentials {
  followerId: string;
  followerName: string;
  loginUsername: string;
  loginPassword: string;
  createdAt: string;
}

export function FollowerApiKeyRegistration() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<FollowerCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    followerName: '',
    apiKey: '',
    apiSecret: '',
    clientId: '',
    lotMultiplier: 1,
    maxQuantity: 1000,
    maxDailyLoss: 50000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const res = await fetch('/api/followers/register-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (data.ok) {
        setGeneratedCredentials(data.follower);
        toast({
          title: 'Success',
          description: 'Follower registered successfully',
        });
      } else {
        throw new Error(data.message || 'Failed to register');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as any)?.message || 'Failed to register follower',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: 'Copied',
      description: `${field} copied to clipboard`,
    });
  };

  const resetForm = () => {
    setFormData({
      followerName: '',
      apiKey: '',
      apiSecret: '',
      clientId: '',
      lotMultiplier: 1,
      maxQuantity: 1000,
      maxDailyLoss: 50000,
    });
    setGeneratedCredentials(null);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Follower with API Key
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register Follower - API Key Method</DialogTitle>
          <DialogDescription>
            Add a follower using their AliceBlue API credentials. System will generate login credentials.
          </DialogDescription>
        </DialogHeader>

        {generatedCredentials ? (
          // Show generated credentials
          <div className="space-y-4">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <CheckCircle className="w-5 h-5" />
                  Registration Successful!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-green-800">
                  Follower has been registered. Share these credentials with them:
                </p>

                {/* Login Credentials Card */}
                <Card className="border-2 border-green-300 bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">📱 Login Credentials</CardTitle>
                    <CardDescription>
                      Share these with your follower
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Username */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <Label className="text-xs text-gray-600">Username</Label>
                      <div className="flex items-center justify-between mt-2 font-mono text-sm break-all">
                        <span className="flex-1">{generatedCredentials.loginUsername}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(generatedCredentials.loginUsername, 'Username')}
                          className="ml-2"
                        >
                          {copiedField === 'Username' ? '✓' : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <Label className="text-xs text-gray-600">Password</Label>
                      <div className="flex items-center justify-between mt-2 font-mono text-sm break-all">
                        <span className="flex-1 text-yellow-700 font-semibold">
                          {generatedCredentials.loginPassword}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(generatedCredentials.loginPassword, 'Password')}
                          className="ml-2"
                        >
                          {copiedField === 'Password' ? '✓' : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Website URL */}
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <Label className="text-xs text-gray-600">Website URL</Label>
                      <div className="flex items-center justify-between mt-2 font-mono text-sm break-all">
                        <span className="flex-1 text-blue-600">{window.location.origin}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(window.location.origin, 'Website')}
                          className="ml-2"
                        >
                          {copiedField === 'Website' ? '✓' : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Follower Info */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Follower</span>
                      <span className="text-sm">{generatedCredentials.followerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Follower ID</span>
                      <span className="font-mono text-xs">{generatedCredentials.followerId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Registered</span>
                      <span className="text-sm">
                        {new Date(generatedCredentials.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Warning */}
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="pt-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold">Important:</p>
                      <p>These credentials are shown only once. Save them securely before closing.</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Share Instructions */}
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-base">📧 How to Share</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-green-900">
                    <p>1. Send the login credentials above to your follower</p>
                    <p>2. They log in at: {window.location.origin}</p>
                    <p>3. Dashboard shows live copy-traded orders</p>
                    <p>4. They can see their risk limits and trading activity</p>
                  </CardContent>
                </Card>

                <Button onClick={() => {
                  setOpen(false);
                  resetForm();
                }} className="w-full">
                  Done
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          // Show registration form
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Follower Name */}
            <div>
              <Label htmlFor="followerName">Follower Name *</Label>
              <Input
                id="followerName"
                placeholder="e.g., Trader John"
                value={formData.followerName}
                onChange={(e) => setFormData({ ...formData, followerName: e.target.value })}
                required
              />
              <p className="text-xs text-gray-600 mt-1">Used to generate login username</p>
            </div>

            {/* API Credentials */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900 font-semibold mb-3">
                📌 Get these from AliceBlue Developer Portal
              </p>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="apiKey">API Key *</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="Follower's AliceBlue API Key"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="apiSecret">API Secret *</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    placeholder="Follower's AliceBlue API Secret"
                    value={formData.apiSecret}
                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="clientId">Client ID *</Label>
                  <Input
                    id="clientId"
                    placeholder="Follower's AliceBlue Client ID"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Risk Configuration */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-900 font-semibold mb-3">
                ⚙️ Risk Configuration (Optional)
              </p>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="lotMultiplier">Lot Multiplier</Label>
                  <Input
                    id="lotMultiplier"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={formData.lotMultiplier}
                    onChange={(e) => setFormData({ ...formData, lotMultiplier: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-gray-600 mt-1">Default: 1x (trade same quantity as master)</p>
                </div>

                <div>
                  <Label htmlFor="maxQuantity">Max Quantity per Trade</Label>
                  <Input
                    id="maxQuantity"
                    type="number"
                    value={formData.maxQuantity}
                    onChange={(e) => setFormData({ ...formData, maxQuantity: parseInt(e.target.value) })}
                  />
                </div>

                <div>
                  <Label htmlFor="maxDailyLoss">Max Daily Loss (₹)</Label>
                  <Input
                    id="maxDailyLoss"
                    type="number"
                    value={formData.maxDailyLoss}
                    onChange={(e) => setFormData({ ...formData, maxDailyLoss: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Register Follower
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>

            {/* Info */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4 text-xs text-blue-900">
                <p>✅ Follower will receive login credentials</p>
                <p>✅ They log in at your website</p>
                <p>✅ They see their copy-trading dashboard</p>
              </CardContent>
            </Card>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

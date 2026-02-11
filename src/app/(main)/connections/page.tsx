'use client';

import { useAuth } from '@/context/auth-context';
import { OAuthKeyManagement } from '../components/oauth-key-management';
import { OAuthConnectDialog } from '../components/oauth-connect-dialog';
import { FollowerApiKeyRegistration } from '../components/follower-api-key-registration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Key } from 'lucide-react';

export default function ConnectionsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">AliceBlue Connections</h2>
        <p className="text-muted-foreground">
          Manage your OAuth connections and follower registrations
        </p>
      </div>

      {/* Master Panel */}
      {user?.role === 'master' && (
        <>
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge className="bg-blue-600">Master Account</Badge>
              </CardTitle>
              <CardDescription>Configure OAuth and manage followers</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-900">
                You can manage OAuth configuration and add followers with their API credentials.
              </p>
            </CardContent>
          </Card>

          {/* Master OAuth Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Your AliceBlue Account
              </CardTitle>
              <CardDescription>
                Connect your master AliceBlue account via OAuth
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Connect your own AliceBlue account to fetch and manage trades, then copy them to your followers.
              </p>
              <OAuthConnectDialog />
            </CardContent>
          </Card>

          {/* Master OAuth Configuration */}
          <OAuthKeyManagement />

          {/* Add Followers Section */}
          <Card>
            <CardHeader>
              <CardTitle>Add Followers</CardTitle>
              <CardDescription>
                Register followers using their AliceBlue API credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Add followers to your copy-trading system. The system will generate unique login credentials for each follower.
              </p>
              <FollowerApiKeyRegistration />
              
              <Card className="bg-purple-50 border-purple-200 mt-4">
                <CardContent className="pt-4 space-y-2 text-sm text-purple-900">
                  <p className="font-semibold">📋 What Happens:</p>
                  <p>1. You provide follower's AliceBlue API Key & Secret</p>
                  <p>2. System generates login credentials for your website</p>
                  <p>3. Share credentials with the follower</p>
                  <p>4. Follower logs in and sees their copy-trading dashboard</p>
                  <p>5. All their copy-trades appear in real-time</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </>
      )}

      {/* Follower Panel */}
      {user?.role !== 'master' && (
        <div className="space-y-4">
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge className="bg-purple-600">Follower Account</Badge>
              </CardTitle>
              <CardDescription>You are connected as a follower</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-900">
                Your master has added you to the copy-trading system. All trades copied from the master will appear in your dashboard automatically.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                You're All Set!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-green-900">
              <p>✅ Your account is connected</p>
              <p>✅ Your API credentials are secure</p>
              <p>✅ Go to Dashboard to see your copy-trades in real-time</p>
              <p>✅ Monitor your trading activity in risk management</p>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-base">📊 Your Dashboard Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-blue-900">
              <p>• Live copy-trading activity</p>
              <p>• Order history and status</p>
              <p>• Risk limits and performance</p>
              <p>• P&L tracking</p>
              <p>• Connection status</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Security Note */}
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Security & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-900">
          <p>🔒 Your credentials are encrypted and stored securely</p>
          <p>🔑 API keys never leave our servers</p>
          <p>📋 Each follower is tracked individually</p>
          <p>⚡ Orders are verified before placement</p>
        </CardContent>
      </Card>
    </div>
  );
}

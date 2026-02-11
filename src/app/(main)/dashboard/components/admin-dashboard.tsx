'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAccount } from '@/context/account-context';
import { TradesTable } from './trades-table';
import { FollowerControlCard } from './follower-control-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AddFollowerDialog } from '@/app/(main)/configuration/components/account-settings';

export function AdminDashboard() {
  const { followerAccounts, masterAccounts } = useAccount();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of all master and follower accounts with their copy-trading status
        </p>
      </div>

      {/* Master Accounts Section */}
      {masterAccounts && masterAccounts.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Master Accounts</h2>
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {masterAccounts.map((master: any) => (
              <Card key={master.id} className="border-2 border-green-200 bg-green-50/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-green-600">👑</span> {master.name}
                  </CardTitle>
                  <CardDescription>{master.id}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium text-green-600">Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Auth Method:</span>
                    <span className="font-mono">{master.authMethod || 'OAuth'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Followers Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Followers ({followerAccounts?.length || 0})</h2>
          <div className="flex gap-2">
            <AddFollowerDialog />
            <Button asChild variant="outline">
              <Link href="/configuration">Manage</Link>
            </Button>
          </div>
        </div>

        {followerAccounts && followerAccounts.length > 0 ? (
          <div className="space-y-6">
            {/* Master Trade Book - shown to all followers */}
            <Card className="border-2 border-blue-200 bg-blue-50/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-blue-600">📊</span> Master Trade Book
                </CardTitle>
                <CardDescription>
                  All followers receive and replicate these trades
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TradesTable />
              </CardContent>
            </Card>

            {/* Followers Grid */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {followerAccounts.map((follower: any) => (
                <FollowerControlCard
                  key={follower.id}
                  followerId={follower.id}
                  followerName={follower.name}
                  clientId={follower.clientId}
                  lotMultiplier={follower.lotMultiplier}
                  perAccountCap={follower.perAccountCap}
                  consentGiven={follower.consentGiven}
                />
              ))}
            </div>
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium mb-2">No followers added yet</p>
              <p className="text-sm mb-4">Start by adding your first follower account</p>
              <AddFollowerDialog />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

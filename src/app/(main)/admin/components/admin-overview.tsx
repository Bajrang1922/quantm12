'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAccount } from '@/context/account-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AddFollowerDialog } from '@/app/(main)/configuration/components/account-settings';

export function AdminOverview() {
  const accountData = useAccount() as any;
  const followerAccounts = accountData?.followerAccounts || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground mt-2">
          All followers with their configuration and status
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <AddFollowerDialog />
        <Button asChild variant="outline">
          <Link href="/configuration">Manage All</Link>
        </Button>
      </div>

      {followerAccounts && followerAccounts.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {followerAccounts.map((follower: any) => (
            <Card key={follower.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{follower.name}</CardTitle>
                <CardDescription className="text-xs">{follower.id}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client ID:</span>
                  <span className="font-mono text-xs">{follower.clientId || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={follower.consentGiven ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                    {follower.consentGiven ? '✓ Active' : '⚠ Pending'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lot Multiplier:</span>
                  <span className="font-medium">{follower.lotMultiplier || '1.0'}x</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center border-dashed">
          <p className="text-muted-foreground mb-4">No followers configured</p>
          <AddFollowerDialog />
        </Card>
      )}
    </div>
  );
}

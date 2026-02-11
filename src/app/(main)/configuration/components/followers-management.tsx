"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function FollowersManagement() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Followers</h3>
      <Card>
        <CardHeader>
          <CardTitle>Manage Followers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Add, generate OAuth links, and update follower tokens from the master dashboard.
          </p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

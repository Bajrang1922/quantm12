'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function FollowerCopyTradesBoard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Copy Trading</CardTitle>
        <CardDescription>
          Real-time tracking of copy trades from your connected master traders
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-semibold text-sm">No Active Masters</p>
              <p className="text-sm text-muted-foreground">
                Connect to a master trader to start receiving copy trades
              </p>
            </div>
            <Badge variant="secondary">Inactive</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

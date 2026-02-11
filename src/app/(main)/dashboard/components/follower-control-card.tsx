'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, Play, Pause } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface FollowerControlCardProps {
  followerId: string;
  followerName: string;
  clientId?: string;
  lotMultiplier?: number;
  perAccountCap?: number;
  consentGiven?: boolean;
}

export function FollowerControlCard({
  followerId,
  followerName,
  clientId,
  lotMultiplier,
  perAccountCap,
  consentGiven,
}: FollowerControlCardProps) {
  const { toast } = useToast();
  const [copyTradingActive, setCopyTradingActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [stoppedAt, setStoppedAt] = useState<string | null>(null);
  const [stoppedBy, setStoppedBy] = useState<string | null>(null);

  // Check initial copy trading status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/followers/stop-copy-trading?followerId=${encodeURIComponent(followerId)}`);
        const data = await response.json();
        if (data.ok) {
          setCopyTradingActive(data.copyTradingActive);
          setStoppedAt(data.stoppedAt);
          setStoppedBy(data.stoppedBy);
        }
      } catch (error) {
        console.error('Failed to check copy trading status:', error);
      }
    };

    checkStatus();
  }, [followerId]);

  const handleToggleCopyTrading = async (action: 'stop' | 'resume') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/followers/stop-copy-trading', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${action} copy trading`);
      }

      setCopyTradingActive(data.consent.copyTradingActive);
      setStoppedAt(data.consent.stoppedAt);
      setStoppedBy(data.consent.stoppedBy);

      toast({
        title: action === 'stop' ? 'Copy Trading Stopped' : 'Copy Trading Resumed',
        description: `${followerName} will ${action === 'stop' ? 'no longer' : 'now'} receive copy trades`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || `Failed to ${action} copy trading`,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 border-b bg-slate-50/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{followerName}</CardTitle>
            <CardDescription className="text-xs">{followerId}</CardDescription>
          </div>
          <Badge
            variant={copyTradingActive ? 'default' : 'destructive'}
            className="whitespace-nowrap"
          >
            {copyTradingActive ? '🟢 Active' : '🔴 Stopped'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3 flex-grow text-xs space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Client ID:</span>
            <span className="font-mono truncate">{clientId || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Consent:</span>
            <span className={`font-medium ${consentGiven ? 'text-green-600' : 'text-yellow-600'}`}>
              {consentGiven ? '✓ Given' : '⚠ Pending'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lot Multiplier:</span>
            <span className="font-medium">{lotMultiplier || '1.0'}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Per Account Cap:</span>
            <span className="font-medium">₹{(perAccountCap || 100000).toLocaleString()}</span>
          </div>
        </div>

        {!copyTradingActive && stoppedAt && (
          <div className="pt-2 border-t bg-red-50/50 p-2 rounded text-xs space-y-1">
            <div className="flex gap-1 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">Copy Trading Disabled</span>
            </div>
            <div className="text-red-600 pl-5">
              Stopped: {new Date(stoppedAt).toLocaleString()}
              {stoppedBy && ` • By: ${stoppedBy}`}
            </div>
          </div>
        )}

        <div className="pt-2 border-t space-y-2">
          {copyTradingActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Pause className="w-4 h-4 mr-1" />
                  Stop Copy Trading
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop Copy Trading?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {followerName} will no longer receive copy trades from the master account. This action can be reversed by clicking "Resume".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-3">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleToggleCopyTrading('stop')}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Stop Copy Trading
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isLoading}
              onClick={() => handleToggleCopyTrading('resume')}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Play className="w-4 h-4 mr-1" />
              Resume Copy Trading
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

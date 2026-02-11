'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface FollowerCardWithControlsProps {
  follower: any;
  onSelect: (follower: any) => void;
}

export function FollowerCardWithControls({ follower, onSelect }: FollowerCardWithControlsProps) {
  const { toast } = useToast();
  const [copyTradingActive, setCopyTradingActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Check initial copy trading status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/followers/stop-copy-trading?followerId=${encodeURIComponent(follower.id)}`
        );
        const data = await response.json();
        if (data.ok) {
          setCopyTradingActive(data.copyTradingActive);
        }
      } catch (error) {
        console.error('Failed to check copy trading status:', error);
      }
    };

    checkStatus();
  }, [follower.id]);

  const handleToggleCopyTrading = async (action: 'stop' | 'resume', e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      const response = await fetch('/api/followers/stop-copy-trading', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId: follower.id,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${action} copy trading`);
      }

      setCopyTradingActive(data.consent.copyTradingActive);

      toast({
        title: action === 'stop' ? 'Copy Trading Stopped' : 'Copy Trading Resumed',
        description: `${follower.name} will ${action === 'stop' ? 'no longer' : 'now'} receive copy trades`,
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
    <Card
      className="cursor-pointer hover:shadow-lg hover:border-primary transition-all flex flex-col h-full"
      onClick={() => onSelect(follower)}
    >
      <CardContent className="pt-6 flex-1 flex flex-col">
        <div className="space-y-3 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm">{follower.name}</h3>
              <p className="text-xs text-muted-foreground">{follower.id}</p>
            </div>
            <Badge
              variant={copyTradingActive ? 'default' : 'destructive'}
              className="whitespace-nowrap text-xs font-semibold"
            >
              {copyTradingActive ? '🟢 REPLICATING' : '🔴 STOPPED'}
            </Badge>
          </div>
          <div className="border-t pt-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client ID:</span>
              <span className="font-mono truncate">
                {follower.clientId ? follower.clientId.slice(0, 8) + '...' : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span
                className={follower.consentGiven ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}
              >
                {follower.consentGiven ? '✓ Active' : '⚠ Pending'}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t pt-3 mt-3 space-y-2">
          {copyTradingActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full font-semibold"
                  disabled={isLoading}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  <Pause className="w-4 h-4 mr-1" />
                  Stop Copy Trading
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-lg">Stop Copy Trading?</AlertDialogTitle>
                  <AlertDialogDescription className="text-base">
                    <strong>{follower.name}</strong> will no longer receive copy trades from your master account. Any open positions will remain. You can resume anytime.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex gap-3">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => handleToggleCopyTrading('stop', e as any)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Yes, Stop Copy Trading
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 font-semibold"
              disabled={isLoading}
              onClick={(e) => handleToggleCopyTrading('resume', e)}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Play className="w-4 h-4 mr-1" />
              Start Copy Trading
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

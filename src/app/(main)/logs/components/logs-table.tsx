'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'Info' | 'Warning' | 'Error' | 'Intervention';
  message: string;
  eventType: string;
  masterOrderId: string;
  followerId: string;
  quantity: number;
  riskValidated: boolean;
}

export function LogsTable() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState('');
  const { toast } = useToast();

  const getLevelVariant = (level: LogEntry['level']) => {
    switch (level) {
      case 'Info':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Intervention':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  useEffect(() => {
    const secret = localStorage.getItem('qa-secret');
    if (secret) {
      setSecret(secret);
      fetchLogs(secret);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchLogs = async (secretKey: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/trade-events', {
        headers: { 'x-qa-secret': secretKey }
      });
      const data = await res.json();
      if (data.ok) {
        setLogs(data.logs || []);
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to fetch logs',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: (e as any).message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading real-time logs...</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No trade events yet. Trades will appear here in real-time.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Timestamp</TableHead>
            <TableHead className="w-[120px]">Level</TableHead>
            <TableHead className="w-[150px]">Event Type</TableHead>
            <TableHead className="w-[100px]">Master Order</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-muted-foreground text-xs">{log.timestamp}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('border-transparent text-xs', getLevelVariant(log.level))}>
                  {log.level}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">{log.eventType}</TableCell>
              <TableCell className="font-mono text-xs">{log.masterOrderId}</TableCell>
              <TableCell className="font-mono text-xs">{log.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

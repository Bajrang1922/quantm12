"use client";

import { useAuth } from '@/context/auth-context';
import { MasterDashboard } from './components/master-dashboard';
import { FollowerDashboard } from './components/follower-dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  // Handle OAuth callback if query params present
  useEffect(() => {
    const authCode = searchParams.get('authCode');
    const userId = searchParams.get('userId');

    if (authCode && userId && !processing) {
      setProcessing(true);
      // Process OAuth callback by calling our callback endpoint
      fetch(`/aliceblue/callback?authCode=${encodeURIComponent(authCode)}&userId=${encodeURIComponent(userId)}`, { credentials: 'same-origin' })
        .then(() => {
          // Try to read the temporary cookie the callback set and persist user to localStorage
          try {
            const cookies = document.cookie.split(';').reduce((acc: any, cookie) => {
              const [k, v] = cookie.trim().split('=');
              if (k && v) acc[k] = decodeURIComponent(v);
              return acc;
            }, {});
            if (cookies.alice_user) {
              try {
                const oauthUser = JSON.parse(cookies.alice_user);
                const userToSet = { ...oauthUser, role: 'trader', authMethod: 'oauth' };
                localStorage.setItem('user', JSON.stringify(userToSet));
              } catch (e) {
                console.warn('Failed to parse alice_user cookie', e);
              }
              // Clear the temporary cookie
              document.cookie = 'alice_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            }
          } catch (e) {
            console.warn('Failed to persist OAuth user from cookie', e);
          }
          // Callback processed, redirect to clean dashboard URL
          router.replace('/dashboard');
        })
        .catch((err) => {
          console.error('OAuth callback processing failed:', err);
          setProcessing(false);
        });
    }
  }, [searchParams, processing, router]);

  if (loading || !user || processing) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (user.role === 'master') {
    return <MasterDashboard />;
  }

  // OAuth trader users see master dashboard with their Alice Blue trades
  if (user.role === 'trader' && user.authMethod === 'oauth') {
    return <MasterDashboard />;
  }

  return <FollowerDashboard />;
}

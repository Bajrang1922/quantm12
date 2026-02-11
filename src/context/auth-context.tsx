"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/context/account-context';
import { useToast } from '@/hooks/use-toast';
import type { FollowerAccount } from '@/lib/data';

// Define the shape of the user object
interface User {
  id: string;
  role: 'master' | 'follower' | 'trader';
  name: string;
  authMethod?: 'password' | 'oauth';
}

// Define the shape of the context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Master user credentials (should be in an environment variable in a real app)
const MASTER_USERNAME = 'master';
const MASTER_PASSWORD = 'password';

// Create the provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  // We need to get follower accounts from the account context to check credentials
  const { followerAccounts } = useAccount();


  useEffect(() => {
    // Prefer server-side session (HttpOnly cookie) so OAuth flow is secure
    (async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const payload = await res.json().catch(() => ({}));
          if (payload?.ok && payload.user) {
            const serverUser = payload.user as User;
            // Persist to localStorage for client-side usage
            try { localStorage.setItem('user', JSON.stringify(serverUser)); } catch (e) {}
            setUser(serverUser);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // ignore and fallback to client-side checks
      }

      // Fallback: Check if user is logged in from localStorage
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
        try { localStorage.removeItem('user'); } catch (_) {}
      }

      setLoading(false);
    })();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    let loggedInUser: User | null = null;
    
    if (username.toLowerCase() === MASTER_USERNAME && password === MASTER_PASSWORD) {
      loggedInUser = { id: 'master', role: 'master', name: 'Alice Blue Master' };
    } else {
      // It's important to use the live followerAccounts from the context
      const followerAccount = followerAccounts.find(
        (acc: FollowerAccount) => acc.username.toLowerCase() === username.toLowerCase() && acc.password === password
      );
      if (followerAccount) {
        loggedInUser = { id: followerAccount.id, role: 'follower', name: followerAccount.name };
      }
    }

    if (loggedInUser) {
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      toast({ title: 'Login Successful', description: `Welcome back, ${loggedInUser.name}!` });
      router.push('/dashboard');
      return true;
    } else {
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Invalid username or password.' });
      return false;
    }
  };

  const logout = () => {
    (async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
      try { localStorage.removeItem('user'); } catch (e) {}
      setUser(null);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login');
    })();
  };
  
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

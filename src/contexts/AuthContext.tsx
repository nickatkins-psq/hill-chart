import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';

const ALLOWED_DOMAIN = 'parentsquare.com';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[AuthProvider] Setting up auth state listener...');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[AuthProvider] Auth state changed:', user?.email || 'no user');
      if (user) {
        // Verify email domain
        const email = user.email || '';
        if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          setUser(user);
          setError(null);
        } else {
          // Sign out users with non-allowed domains
          signOut(auth);
          setUser(null);
          setError(`Access restricted to @${ALLOWED_DOMAIN} emails only.`);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const email = result.user.email || '';
      
      // Double-check domain after sign in
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        await signOut(auth);
        setError(`Access restricted to @${ALLOWED_DOMAIN} emails only.`);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error('Sign in error:', error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup, not an error to display
        return;
      }
      
      if (error.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for sign-in. Please contact the administrator.');
      } else {
        setError(error.message || 'Failed to sign in. Please try again.');
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setError(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      console.error('Sign out error:', error);
      setError(error.message || 'Failed to sign out.');
    }
  };

  const value = {
    user,
    loading,
    error,
    signInWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

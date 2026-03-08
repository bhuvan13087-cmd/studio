
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export type UserRole = 'admin' | 'member';

export function useRole() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const db = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return doc(db, 'users', user.uid);
  }, [db, user?.uid]);

  const { data: userData, isLoading: isDocLoading } = useDoc(userDocRef);

  const isLoading = isAuthLoading || isDocLoading;
  const role = (userData?.role as UserRole) || 'member';
  const isAdmin = role === 'admin';

  return {
    role,
    isAdmin,
    isLoading,
    user: userData,
  };
}

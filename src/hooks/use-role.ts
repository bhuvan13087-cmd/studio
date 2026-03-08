
'use client';

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export type UserRole = 'admin' | 'member';

/**
 * Hook to determine the current user's role and administrative status.
 * Uses the 'roles_admin' collection to verify administrative privileges
 * as defined in the DBAC security strategy.
 */
export function useRole() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const db = useFirestore();

  // Create a memoized reference to the potential admin document for the current user.
  // We check 'roles_admin' instead of 'users' to align with the security rules.
  const adminDocRef = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return doc(db, 'roles_admin', user.uid);
  }, [db, user?.uid]);

  const { data: adminData, isLoading: isDocLoading } = useDoc(adminDocRef);

  const isLoading = isAuthLoading || isDocLoading;
  
  // A user is considered an admin if a document exists in the 'roles_admin' collection.
  const isAdmin = !!adminData;
  const role: UserRole = isAdmin ? 'admin' : 'member';

  return {
    role,
    isAdmin,
    isLoading,
    user: adminData, // Returns the admin document data if it exists.
  };
}

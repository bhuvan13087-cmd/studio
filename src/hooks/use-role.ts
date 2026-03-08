
'use client';

import { useUser } from '@/firebase';

export type UserRole = 'admin' | 'member';

/**
 * Hook to determine the current user's role and administrative status.
 * Updated to treat all authenticated users as administrators by default,
 * fulfilling the requirement to remove strict UID-based restrictions.
 */
export function useRole() {
  const { user, isUserLoading: isLoading } = useUser();

  // For now, any authenticated user is considered an admin with full access.
  const isAdmin = !!user;
  const role: UserRole = isAdmin ? 'admin' : 'member';

  return {
    role,
    isAdmin,
    isLoading,
    user: user, // Returns the Firebase user object directly.
  };
}

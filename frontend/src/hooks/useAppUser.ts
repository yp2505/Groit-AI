import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';

export type UserRole = 'developer' | 'manager';

export interface AppUser {
  email: string;
  role: UserRole;
  name: string;
}

function resolveRole(metadata: Record<string, unknown> | undefined): UserRole {
  const role = metadata?.role;
  return role === 'manager' ? 'manager' : 'developer';
}

export function useAppUser() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isSignedIn, isLoaded: authLoaded, signOut } = useClerkAuth();

  const appUser: AppUser | null = user
    ? {
        email: user.primaryEmailAddress?.emailAddress ?? '',
        name: user.fullName || user.firstName || user.username || 'User',
        role: resolveRole(user.publicMetadata as Record<string, unknown>),
      }
    : null;

  return {
    user: appUser,
    isAuthenticated: !!isSignedIn,
    isLoaded: userLoaded && authLoaded,
    logout: () => signOut(),
  };
}

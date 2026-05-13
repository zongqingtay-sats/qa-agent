/**
 * Client-side wrapper around NextAuth's `SessionProvider`.
 *
 * Placed in the root layout so that `useSession()` is available
 * throughout the component tree.
 *
 * @module session-provider
 */

"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

/**
 * Provides the NextAuth session context to all child components.
 *
 * @param props.children - The React subtree to wrap.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}

/**
 * Next.js middleware for authentication gating and header injection.
 *
 * - Redirects unauthenticated users to `/login`.
 * - Redirects authenticated users away from the login page.
 * - Injects `x-user-id`, `x-user-email`, `x-user-name` headers into
 *   API requests so the backend can identify the caller.
 * - Skips enforcement entirely when `AUTH_MICROSOFT_ENTRA_ID_ID` is unset.
 *
 * @module proxy
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

/** Whether OAuth is configured; when false all routes are public. */
const authEnabled = !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID;

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Skip auth enforcement if not configured
  if (!authEnabled) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login";
  const isAuthApi = pathname.startsWith("/api/auth");

  // Allow auth API routes through
  if (isAuthApi) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!req.auth && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect authenticated users away from login page
  if (req.auth && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Inject user info headers into API requests for backend proxy
  if (req.auth?.user && pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", req.auth.user.id || "");
    requestHeaders.set("x-user-email", req.auth.user.email || "");
    requestHeaders.set("x-user-name", req.auth.user.name || "");
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

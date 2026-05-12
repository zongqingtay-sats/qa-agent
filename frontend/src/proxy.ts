import { auth } from "@/auth";
import { NextResponse } from "next/server";

const authEnabled = !!process.env.AZURE_AD_CLIENT_ID;

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

  // Inject access token into API requests for backend proxy
  if (req.auth?.accessToken && pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("Authorization", `Bearer ${req.auth.accessToken}`);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/**
 * Module augmentations for NextAuth.js session and JWT types.
 *
 * Adds the database `id` field to the session user and JWT token
 * so it is available throughout the application.
 */

import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}

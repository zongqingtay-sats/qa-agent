import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID || "",
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || "",
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "",
      allowDangerousEmailAccountLinking: true,
    })
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Only allow sign-in if the user's email already exists in the database
      if (account?.provider === "microsoft-entra-id") {
        const email = user.email;
        if (!email) return false;
        const existing = await prisma.user.findUnique({ where: { email } });
        if (!existing) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      // On initial sign-in, persist the database user id
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

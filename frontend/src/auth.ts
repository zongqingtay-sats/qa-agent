import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID,
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign-in, persist the ID token (verified by backend via Azure AD JWKS)
      if (account) {
        token.accessToken = account.id_token;
        token.id = profile?.sub ?? profile?.oid as string;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

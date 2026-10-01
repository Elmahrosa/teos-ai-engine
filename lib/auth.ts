import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import TwitterProvider from "next-auth/providers/twitter";
import LinkedInProvider from "next-auth/providers/linkedin";
import AzureADProvider from "next-auth/providers/azure-ad";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createAuditLog } from "@/lib/session";

const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

function makeid(): string {
  return Array.from({ length: 32 }, () =>
    Math.random().toString(36)[2]
  ).join("");
}

// Extracted authorize function for testability
export async function authorizeCredentials(credentials: any) {
  if (!credentials?.email) return null;
  try {
    const email = credentials.email.toString().trim().toLowerCase();
    const password = credentials.password?.toString() || "";
    const name = credentials.name?.toString().trim() || email.split("@")[0];

    let user = await prisma.user.findUnique({ where: { email } });

     if (user) {
       // Accounts created through OAuth (Google/Twitter/LinkedIn/Azure) have a
       // null passwordHash. Never adopt an arbitrary password for them here:
       // doing so would let anyone who knows an OAuth user's email log in as
       // that user and permanently claim the account. Setting a password must
       // go through an explicitly verified flow (e.g. a confirmed email
       // password-reset), never through an unauthenticated sign-in attempt.
       if (!user.passwordHash) return null;
       const valid = await verifyPassword(password, user.passwordHash);
       if (!valid) return null;
     } else {
      if (!password) return null;
      user = await prisma.user.create({
        data: {
          email,
          name,
          role: "user",
          plan: "free",
          passwordHash: await hashPassword(password),
        },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    await createAuditLog(user.id, "login", { email, method: "credentials" });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      trialEndsAt: user.trialEndsAt ? user.trialEndsAt.toISOString() : null,
      isAdmin: user.isAdmin,
    } as any;
  } catch {
    return null;
  }
}

export const authOptions: NextAuthOptions = {
  secret: secret || makeid(),
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.X_TWITTER_CLIENT_ID && process.env.X_TWITTER_CLIENT_SECRET
      ? [
          TwitterProvider({
            clientId: process.env.X_TWITTER_CLIENT_ID,
            clientSecret: process.env.X_TWITTER_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET
      ? [
          LinkedInProvider({
            clientId: process.env.LINKEDIN_CLIENT_ID,
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
      ? [
          AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            tenantId: process.env.AZURE_AD_TENANT_ID || "common",
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        return authorizeCredentials(credentials);
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.type === "oauth" && user.id) {
        await createAuditLog(user.id, "login", {
          email: user.email,
          method: account.provider,
        }).catch(() => {});
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "user";
        token.plan = (user as any).plan;
        token.trialEndsAt = (user as any).trialEndsAt;
        token.isAdmin = (user as any).isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).plan = token.plan;
        (session.user as any).trialEndsAt = token.trialEndsAt;
        (session.user as any).isAdmin = token.isAdmin;
      }
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
};

export default authOptions;

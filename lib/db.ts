import { prisma } from './prisma';

export async function ensureUserExists(email: string, name?: string) {
  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name || email.split("@")[0],
        role: "user",
        plan: "free",
        status: "trial",
        totalPostsUsed: 0,
        dailyPostsUsed: 0,
      },
    });
  }
  return user;
}

const UNLIMITED_PLANS = ["agency_monthly", "agency_yearly", "agency_lifetime", "pro_lifetime", "lifetime_seat"];

export async function canUserPost(userId: string, plan: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { allowed: false, reason: "User not found" };

  const p = user.plan ?? "";
  if (p === "free" && user.totalPostsUsed >= 5) {
    return { allowed: false, reason: "Starter limit reached. Upgrade to continue." };
  }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfLastReset = user.lastResetDate ? new Date(user.lastResetDate) : null;
    if (startOfLastReset === null || startOfLastReset.getTime() !== startOfToday.getTime()) {
      await prisma.user.update({
        where: { id: userId },
        data: { dailyPostsUsed: 0, lastResetDate: new Date() }
      });
    }

  const isUnlimited = UNLIMITED_PLANS.includes(p) || p.startsWith("agency_") || p === "pro_lifetime";
  const isPro = p.startsWith("pro_") && p !== "pro_lifetime";
  const limit = isUnlimited ? 200 : isPro ? 50 : 5;
  if (user.dailyPostsUsed >= limit) {
    return { allowed: false, reason: `Daily limit reached (${limit} posts).` };
  }

  return { allowed: true, limit };
}

export async function recordPost(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totalPostsUsed: { increment: 1 },
      dailyPostsUsed: { increment: 1 }
    }
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function updateUserByEmail(email: string, data: any) {
  return prisma.user.update({
    where: { email: email.toLowerCase() },
    data
  });
}

export async function listUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function appendPost(data: { userId: string; content: string; platform: string; prompt?: string }) {
  const post = await prisma.post.create({ data });
  await recordPost(data.userId);
  return post;
}


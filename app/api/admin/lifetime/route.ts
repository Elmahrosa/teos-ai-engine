import { NextResponse } from "next/server";
import { TransactionGateway, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionEmail } from "@/lib/session";
import { isAdminEmail } from "@/lib/access";
import { adminLifetimeSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const actorEmail = await getSessionEmail();
  if (!isAdminEmail(actorEmail)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const parsed = adminLifetimeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: "agency_lifetime",
      status: "active",
    },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      gateway: TransactionGateway.ADMIN,
      status: TransactionStatus.COMPLETED,
      planId: "agency_lifetime",
      amountUSD: 0,
      paymentRef: `admin-lifetime-${email}-${Date.now()}`,
      creditsAdded: 999999,
      metadata: { email, provider: "admin-lifetime" },
    },
  });

  return NextResponse.json({ success: true, message: `Lifetime access granted to ${email}` });
}

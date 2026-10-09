import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/access";
import { getSessionEmail } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const actorEmail = await getSessionEmail();

  if (!isAdminEmail(actorEmail)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const formData = await req.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const plan = String(formData.get("plan") || "").trim().toLowerCase();

  const validPlans = ["free", "pro_monthly", "agency_monthly", "pro_yearly", "agency_yearly", "pro_lifetime", "agency_lifetime"];
  if (!email || !validPlans.includes(plan)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { plan, status: "active" },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id,
      gateway: "ADMIN",
      status: "COMPLETED",
      planId: plan,
      amountUSD: 0,
      paymentRef: `admin-${email}-${Date.now()}`,
      creditsAdded: 0,
      metadata: { email, provider: "admin" },
    },
  });

  return NextResponse.redirect(new URL("/admin", req.url));
}
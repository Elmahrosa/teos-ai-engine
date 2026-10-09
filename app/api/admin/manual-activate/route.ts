import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionEmail } from '@/lib/session';
import { isAdminEmail } from '@/lib/access';

export async function POST(req: Request) {
  const actorEmail = await getSessionEmail();
  if (!actorEmail || !isAdminEmail(actorEmail)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const plan = String(formData.get('plan') || '').trim().toLowerCase();

  const validPlans = ['free', 'pro_monthly', 'agency_monthly', 'pro_yearly', 'agency_yearly', 'pro_lifetime', 'agency_lifetime'];
  if (!email || !validPlans.includes(plan)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: { plan, status: 'active' },
  });

  await prisma.transaction.create({
    data: {
      userId: targetUser.id,
      gateway: "ADMIN",
      status: "COMPLETED",
      planId: plan,
      amountUSD: 0,
      paymentRef: `manual-admin-${email}-${Date.now()}`,
      creditsAdded: 0,
      metadata: { email, provider: 'manual-admin' },
    },
  });

  return NextResponse.redirect(new URL('/admin', req.url));
}

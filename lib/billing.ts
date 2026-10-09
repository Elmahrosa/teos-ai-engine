// ─── TEOS Unified Billing Engine ─────────────────────────────────────────────
// Atomic plan provisioning with idempotency, credit allocation, and audit trail.
// All external payment handlers must route through provisionPlan() — never write
// to User.plan directly from a route handler.

import { prisma } from "@/lib/prisma";
import { trace, generateRequestId } from "@/lib/trace";

// ─── Canonical plan → credit allocation matrix ────────────────────────────────

export const PLANS_MATRIX = {
  free:             { id: "free",             name: "Free Tier",        credits: 100    },
  pro_monthly:      { id: "pro_monthly",      name: "Pro Monthly",      credits: 5_000  },
  pro_yearly:       { id: "pro_yearly",       name: "Pro Yearly",       credits: 60_000 },
  agency_monthly:   { id: "agency_monthly",   name: "Agency Monthly",   credits: 25_000 },
  agency_yearly:    { id: "agency_yearly",    name: "Agency Yearly",    credits: 300_000},
  pro_lifetime:     { id: "pro_lifetime",     name: "Pro Lifetime",     credits: 999_999},
  agency_lifetime:  { id: "agency_lifetime",  name: "Founder Lifetime", credits: 999_999},
  lifetime_seat:    { id: "lifetime_seat",    name: "Lifetime VIP",     credits: 999_999},
} as const;

export type BillingPlanId = keyof typeof PLANS_MATRIX;

export function getPlanCredits(planId: string): number {
  return planId in PLANS_MATRIX
    ? PLANS_MATRIX[planId as BillingPlanId].credits
    : 0;
}

export function isLifetimePlan(planId: string): boolean {
  return (
    planId === "pro_lifetime" ||
    planId === "agency_lifetime" ||
    planId === "lifetime_seat"
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProvisionPlanArgs {
  email: string;
  planId: string;
  gateway: string;
  /** Unique payment reference: Dodo payment_id or Pi txid. Used for idempotency. */
  paymentRef: string;
  amountUSD: number;
  amountPi?: number;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

export interface ProvisionResult {
  success: boolean;
  duplicate: boolean;
  userId: string;
  creditsAdded: number;
  transactionId: string | null;
}

// ─── Core atomic provisioning function ───────────────────────────────────────

export async function provisionPlan(args: ProvisionPlanArgs): Promise<ProvisionResult> {
  const {
    email,
    planId,
    gateway,
    paymentRef,
    amountUSD,
    amountPi,
    metadata = {},
    requestId = generateRequestId(),
  } = args;

  const normalizedEmail = email.toLowerCase().trim();
  const creditsAdded = getPlanCredits(planId);
  const now = new Date();

  trace({ requestId, event: "billing.provision.start", gateway, planId, email: normalizedEmail, paymentRef });

  // ── 1. Idempotency guard — reject duplicate paymentRef ──────────────────────
  const existingTx = await prisma.transaction.findUnique({
    where: { paymentRef },
    select: { id: true, userId: true, creditsAdded: true },
  });

  if (existingTx) {
    trace({ requestId, event: "billing.provision.duplicate", paymentRef, transactionId: existingTx.id });
    return {
      success: true,
      duplicate: true,
      userId: existingTx.userId,
      creditsAdded: existingTx.creditsAdded,
      transactionId: existingTx.id,
    };
  }

  // ── 2. Resolve user ──────────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, plan: true },
  });

  if (!user) {
    trace({ requestId, event: "billing.provision.user_not_found", email: normalizedEmail });
    throw new BillingError(`User not found: ${normalizedEmail}`, "USER_NOT_FOUND");
  }

  // ── 3. Compute plan expiry for subscription plans ────────────────────────────
  const planExpiresAt = computeExpiry(planId, now);

  // ── 4. Atomic DB write: user + transaction + auditLog ────────────────────────
  const [, transaction] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        plan: planId,
        status: "active",
        credits: { increment: creditsAdded },
        planActivatedAt: now,
        planExpiresAt,
        updatedAt: now,
      },
    }),

    prisma.transaction.create({
      data: {
        userId: user.id,
        gateway,
        status: "COMPLETED",
        planId,
        amountUSD,
        amountPi: amountPi ?? null,
        paymentRef,
        creditsAdded,
        metadata: { ...metadata, requestId },
      },
    }),

    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "plan-upgraded",
        metadata: {
          email: normalizedEmail,
          planId,
          gateway,
          amountUSD,
          amountPi: amountPi ?? null,
          creditsAdded,
          paymentRef,
          requestId,
        },
      },
    }),
  ]);

  trace({
    requestId,
    event: "billing.provision.success",
    gateway,
    planId,
    userId: user.id,
    transactionId: transaction.id,
    creditsAdded,
  });

  return {
    success: true,
    duplicate: false,
    userId: user.id,
    creditsAdded,
    transactionId: transaction.id,
  };
}

// ─── Subscription expiry helper ───────────────────────────────────────────────

function computeExpiry(planId: string, from: Date): Date | null {
  if (planId.endsWith("_monthly")) {
    const d = new Date(from);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (planId.endsWith("_yearly")) {
    const d = new Date(from);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  // lifetime / free: no expiry
  return null;
}

// ─── Typed billing error ──────────────────────────────────────────────────────

export class BillingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

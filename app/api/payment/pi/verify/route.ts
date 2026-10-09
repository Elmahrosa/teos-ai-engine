// ─── Pi Network Transaction Verification Handler ─────────────────────────────
// Hardened: session-gated, txid idempotency (double-spend proof), amount
// tolerance check, atomic plan provisioning via lib/billing.ts.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { provisionPlan, BillingError } from "@/lib/billing";
import { PAYMENT_PLANS, PI_DISCOUNT_PCT, getPlanPricePi } from "@/lib/payments";
import { fetchPiPrice, verifyPiTransaction } from "@/lib/pi";
import { trace, generateRequestId } from "@/lib/trace";

// ─── Config ───────────────────────────────────────────────────────────────────

const AMOUNT_TOLERANCE = 0.01;   // Pi — allow ±1π slippage for price drift
const TXID_REGEX = /^[a-f0-9]{64}$/i; // Stellar txid: 64 hex chars

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  // ── Session guard ────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    trace({ requestId, event: "pi.verify.unauthorized" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email.toLowerCase().trim();

  // ── Parse + validate body ────────────────────────────────────────────────────
  let body: { planId?: unknown; txid?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { planId, txid, amount } = body;

  if (typeof planId !== "string" || !planId) {
    return NextResponse.json({ error: "Missing or invalid planId" }, { status: 400 });
  }
  if (typeof txid !== "string" || !TXID_REGEX.test(txid)) {
    return NextResponse.json(
      { error: "Invalid txid format — expected 64-character hex string" },
      { status: 400 },
    );
  }
  if (typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Missing or invalid amount" }, { status: 400 });
  }

  trace({ requestId, event: "pi.verify.start", email, planId, txid });

  // ── Plan lookup ───────────────────────────────────────────────────────────────
  const plan = PAYMENT_PLANS.find((p) => p.id === planId);
  if (!plan) {
    trace({ requestId, event: "pi.verify.invalid_plan", planId });
    return NextResponse.json({ error: "Invalid planId" }, { status: 400 });
  }

  // ── Amount tolerance check ────────────────────────────────────────────────────
  const piPrice = await fetchPiPrice();
  const expectedAmount = getPlanPricePi(planId, piPrice);

  if (Math.abs(amount - expectedAmount) > AMOUNT_TOLERANCE) {
    trace({
      requestId,
      event: "pi.verify.amount_mismatch",
      planId,
      expected: expectedAmount,
      received: amount,
      piPrice,
    });
    return NextResponse.json(
      { error: "Amount mismatch", expected: expectedAmount, received: amount },
      { status: 400 },
    );
  }

  // ── On-chain confirmation ─────────────────────────────────────────────────────
  const { valid, tx } = await verifyPiTransaction(txid);
  if (!valid) {
    trace({ requestId, event: "pi.verify.unconfirmed", txid });
    return NextResponse.json(
      { error: "Transaction not yet confirmed on the Pi blockchain" },
      { status: 400 },
    );
  }

  trace({ requestId, event: "pi.verify.confirmed", txid, blockHeight: tx?.blockHeight });

  // ── Atomic plan provisioning (idempotency dedup on txid) ─────────────────────
  try {
    const result = await provisionPlan({
      email,
      planId,
      gateway: "PI_NETWORK",
      paymentRef: txid,
      amountUSD: plan.priceUSD,
      amountPi: amount,
      metadata: {
        txid,
        piPrice,
        discountPct: PI_DISCOUNT_PCT,
        blockHeight: tx?.blockHeight ?? null,
        memo: tx?.memo ?? null,
      },
      requestId,
    });

    trace({
      requestId,
      event: "pi.verify.provisioned",
      userId: result.userId,
      planId,
      creditsAdded: result.creditsAdded,
      duplicate: result.duplicate,
    });

    return NextResponse.json({
      success: true,
      plan: planId,
      duplicate: result.duplicate,
      creditsAdded: result.creditsAdded,
      discountApplied: `${PI_DISCOUNT_PCT}%`,
    });
  } catch (err) {
    if (err instanceof BillingError && err.code === "USER_NOT_FOUND") {
      trace({ requestId, event: "pi.verify.user_not_found", email });
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    trace({ requestId, event: "pi.verify.provision_error", error: String(err) });
    return NextResponse.json({ error: "Internal provisioning error" }, { status: 500 });
  }
}

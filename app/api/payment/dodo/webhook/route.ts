// ─── Dodo Payments Webhook Handler ───────────────────────────────────────────
// Hardened: timing-safe HMAC, replay-attack guard, idempotency via WebhookEvent,
// atomic plan provisioning via lib/billing.ts.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { provisionPlan, BillingError } from "@/lib/billing";
import { isPaidPlan, getPlanPriceUSD } from "@/lib/payments";
import { trace, generateRequestId } from "@/lib/trace";
import crypto from "crypto";

// ─── Config ───────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET ?? "";
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

// ─── Signature Verification ───────────────────────────────────────────────────

interface SignatureVerificationResult {
  valid: boolean;
  timestamp: number;
  reason?: string;
}

function verifyDodoSignature(
  rawBody: string,
  signatureHeader: string,
): SignatureVerificationResult {
  if (!WEBHOOK_SECRET) {
    return { valid: false, timestamp: 0, reason: "webhook_secret_not_configured" };
  }
  if (!signatureHeader) {
    return { valid: false, timestamp: 0, reason: "missing_signature_header" };
  }

  const commaIdx = signatureHeader.indexOf(",");
  if (commaIdx === -1) {
    return { valid: false, timestamp: 0, reason: "malformed_signature_header" };
  }

  const timestampStr = signatureHeader.slice(0, commaIdx);
  const receivedSig = signatureHeader.slice(commaIdx + 1);

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || timestamp <= 0) {
    return { valid: false, timestamp: 0, reason: "invalid_timestamp" };
  }

  // Replay-attack protection: reject events older than MAX_TIMESTAMP_DRIFT_MS
  const drift = Date.now() - timestamp * 1000;
  if (drift > MAX_TIMESTAMP_DRIFT_MS || drift < -MAX_TIMESTAMP_DRIFT_MS) {
    return { valid: false, timestamp, reason: "timestamp_out_of_window" };
  }

  const payload = `${timestampStr}.${rawBody}`;
  const expectedBuf = Buffer.from(
    crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex"),
  );
  const receivedBuf = Buffer.from(receivedSig);

  // Constant-time comparison — prevents timing-based HMAC oracle attacks
  if (expectedBuf.length !== receivedBuf.length) {
    return { valid: false, timestamp, reason: "signature_length_mismatch" };
  }

  const match = crypto.timingSafeEqual(expectedBuf, receivedBuf);
  return match
    ? { valid: true, timestamp }
    : { valid: false, timestamp, reason: "signature_mismatch" };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-dodo-signature") ?? "";

  // ── Signature + replay verification ─────────────────────────────────────────
  const sigResult = verifyDodoSignature(rawBody, signatureHeader);
  if (!sigResult.valid) {
    trace({
      requestId,
      event: "dodo.webhook.signature_rejected",
      reason: sigResult.reason,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────────
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    trace({ requestId, event: "dodo.webhook.parse_error" });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = event.type as string | undefined;
  const eventId = event.id as string | undefined;
  const data = (event.data ?? {}) as Record<string, unknown>;

  if (!eventType || !eventId) {
    return NextResponse.json({ error: "Missing event type or id" }, { status: 400 });
  }

  trace({ requestId, event: "dodo.webhook.received", eventType, eventId });

  // ── Only process terminal payment events ─────────────────────────────────────
  if (eventType !== "checkout.completed" && eventType !== "payment.success") {
    return NextResponse.json({ received: true, skipped: true });
  }

  // ── Idempotency: deduplicate via WebhookEvent ────────────────────────────────
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId },
    select: { id: true },
  });

  if (existing) {
    trace({ requestId, event: "dodo.webhook.duplicate", eventId });
    return NextResponse.json({ received: true, duplicate: true });
  }

  // ── Extract and validate payload ─────────────────────────────────────────────
  const email = (data.customer_email as string | undefined)?.toLowerCase().trim();
  const planId = data.plan_id as string | undefined;
  const paymentId = data.payment_id as string | undefined;
  const amountUSD = typeof data.amount === "number" ? data.amount : getPlanPriceUSD(planId ?? "");

  if (!email || !planId || !paymentId) {
    trace({ requestId, event: "dodo.webhook.missing_fields", email, planId, paymentId });
    return NextResponse.json({ error: "Missing required fields: customer_email, plan_id, payment_id" }, { status: 400 });
  }

  if (!isPaidPlan(planId)) {
    trace({ requestId, event: "dodo.webhook.invalid_plan", planId });
    return NextResponse.json({ error: "Unrecognised plan_id" }, { status: 400 });
  }

  // ── Record idempotency marker before side-effects ────────────────────────────
  await prisma.webhookEvent.create({
    data: {
      eventId,
      gateway: "DODO",
      eventType,
      metadata: { planId, email, paymentId, requestId },
    },
  });

  // ── Atomic plan provisioning ─────────────────────────────────────────────────
  try {
    const result = await provisionPlan({
      email,
      planId,
      gateway: "DODO",
      paymentRef: paymentId,
      amountUSD,
      metadata: {
        eventId,
        eventType,
        dodoPaymentId: paymentId,
        rawPlanId: data.plan_id,
      },
      requestId,
    });

    trace({
      requestId,
      event: "dodo.webhook.provisioned",
      userId: result.userId,
      planId,
      creditsAdded: result.creditsAdded,
      duplicate: result.duplicate,
    });

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      creditsAdded: result.creditsAdded,
    });
  } catch (err) {
    if (err instanceof BillingError && err.code === "USER_NOT_FOUND") {
      trace({ requestId, event: "dodo.webhook.user_not_found", email });
      // Return 200 so Dodo does not retry indefinitely for an unknown email
      return NextResponse.json({ received: true, warning: "user_not_found" });
    }

    trace({ requestId, event: "dodo.webhook.provision_error", error: String(err) });
    return NextResponse.json({ error: "Internal provisioning error" }, { status: 500 });
  }
}

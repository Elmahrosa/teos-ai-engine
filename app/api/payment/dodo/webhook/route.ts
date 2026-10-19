// ─── Dodo Payments Webhook Handler ───────────────────────────────────────────
// Hardened: timing-safe HMAC, replay-attack guard, idempotency via WebhookEvent,
// atomic plan provisioning via lib/billing.ts.

console.log("DEBUG: route.ts loaded");

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { provisionPlan, BillingError } from "@/lib/billing";
import { isPaidPlan, getPlanPriceUSD } from "@/lib/payments";
import { trace, generateRequestId } from "@/lib/trace";
import crypto from "crypto";

// ─── Config ───────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET ?? "";
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

// ─── Signature Verification (Standard Webhooks) ─────────────────────────────────

interface SignatureVerificationResult {
  valid: boolean;
  timestamp: number;
  reason?: string;
}

function verifyStandardWebhookSignature(
  rawBody: string,
  idHeader: string | null,
  timestampHeader: string | null,
  signatureHeader: string | null,
): SignatureVerificationResult {
  console.log("DEBUG: WEBHOOK_SECRET:", process.env.DODO_WEBHOOK_SECRET);
  console.log("DEBUG: idHeader:", idHeader);
  console.log("DEBUG: timestampHeader:", timestampHeader);
  console.log("DEBUG: signatureHeader:", signatureHeader);
  if (!(process.env.DODO_WEBHOOK_SECRET ?? "")) {
    console.log("DEBUG: returning because !WEBHOOK_SECRET");
    return { valid: false, timestamp: 0, reason: "webhook_secret_not_configured" };
  }
  if (!idHeader) {
    console.log("DEBUG: returning because !idHeader");
    return { valid: false, timestamp: 0, reason: "missing_webhook_id" };
  }
  if (!timestampHeader) {
    console.log("DEBUG: returning because !timestampHeader");
    return { valid: false, timestamp: 0, reason: "missing_webhook_timestamp" };
  }
  if (!signatureHeader) {
    console.log("DEBUG: returning because !signatureHeader");
    return { valid: false, timestamp: 0, reason: "missing_webhook_signature" };
  }

  console.log("DEBUG: passed header checks");

  const timestamp = parseInt(timestampHeader, 10);
  console.log("DEBUG: parsed timestamp:", timestamp);
  if (isNaN(timestamp) || timestamp <= 0) {
    console.log("DEBUG: timestamp invalid (NaN or <=0)");
    return { valid: false, timestamp: 0, reason: "invalid_timestamp" };
  }

  // Replay-attack protection: reject events older than MAX_TIMESTAMP_DRIFT_MS
  const drift = Date.now() - timestamp * 1000;
  console.log("DEBUG: drift (ms):", drift);
  console.log("DEBUG: MAX_TIMESTAMP_DRIFT_MS:", MAX_TIMESTAMP_DRIFT_MS);
  if (drift > MAX_TIMESTAMP_DRIFT_MS || drift < -MAX_TIMESTAMP_DRIFT_MS) {
    console.log("DEBUG: timestamp out of window");
    return { valid: false, timestamp, reason: "timestamp_out_of_window" };
  }

  const signedPayload = `${idHeader}.${timestampHeader}.${rawBody}`;

  // Decode secret: expect format whsec_<base64>
  const secretMatch = (process.env.DODO_WEBHOOK_SECRET ?? "").match(/^whsec_(.+)$/);
  if (!secretMatch) {
    // If the secret doesn't match the expected format, we still try to use it as raw secret?
    // According to docs, secret is whsec_ format. We'll treat mismatch as misconfiguration.
    return { valid: false, timestamp, reason: "invalid_secret_format" };
  }
  const secretBase64 = secretMatch[1];
  let secretBuffer;
  try {
    secretBuffer = Buffer.from(secretBase64, "base64");
  } catch {
    return { valid: false, timestamp, reason: "invalid_secret_base64" };
  }

  // The signature header may contain multiple signatures separated by spaces.
  // We look for one that starts with "v1,".
  const signatures = signatureHeader.trim().split(/\s+/);
  for (const sig of signatures) {
    if (!sig.startsWith("v1,")) continue;
    const receivedSigBase64 = sig.slice(3); // after "v1,"
    let receivedSigBuffer;
    try {
      receivedSigBuffer = Buffer.from(receivedSigBase64, "base64");
    } catch {
      continue; // skip invalid base64
    }

    // Compute expected HMAC-SHA256
    const expectedBuf = crypto.createHmac("sha256", secretBuffer).update(signedPayload).digest();

    // Debug logging
    console.log("DEBUG: secretBase64:", secretBase64);
    console.log("DEBUG: secretBuffer:", secretBuffer.toString("hex"));
    console.log("DEBUG: signedPayload:", signedPayload);
    console.log("DEBUG: expectedBuf (hex):", expectedBuf.toString("hex"));
    console.log("DEBUG: receivedSigBase64:", receivedSigBase64);
    console.log("DEBUG: receivedSigBuffer (hex):", receivedSigBuffer.toString("hex"));

    // Constant-time comparison
    if (expectedBuf.length !== receivedSigBuffer.length) {
      console.log("DEBUG: length mismatch");
      continue;
    }
    const match = crypto.timingSafeEqual(expectedBuf, receivedSigBuffer);
    console.log("DEBUG: match:", match);
    if (match) {
      return { valid: true, timestamp };
    }
  }

  return { valid: false, timestamp, reason: "signature_mismatch" };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const rawBody = await req.text();
  const idHeader = req.headers.get("webhook-id");
  const timestampHeader = req.headers.get("webhook-timestamp");
  const signatureHeader = req.headers.get("webhook-signature");

  // ── Signature + replay verification ─────────────────────────────────────────
  const sigResult = verifyStandardWebhookSignature(
    rawBody,
    idHeader,
    timestampHeader,
    signatureHeader,
  );
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

  // ── Idempotency: deduplicate via WebhookEvent, keyed on webhook-id ───────────
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId: idHeader ?? "" }, // Use webhook-id as idempotency key
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
      eventId: idHeader ?? "", // Store webhook-id as the eventId for idempotency
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

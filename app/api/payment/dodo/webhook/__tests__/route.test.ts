import { NextRequest } from "next/server";
import { POST } from "@/app/api/payment/dodo/webhook/route";
import crypto from "crypto";

// Mock prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    webhookEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock billing
jest.mock("@/lib/billing", () => ({
  provisionPlan: jest.fn(),
  BillingError: class extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock payments
jest.mock("@/lib/payments", () => ({
  isPaidPlan: jest.fn(),
  getPlanPriceUSD: jest.fn(),
}));

// Mock trace
jest.mock("@/lib/trace", () => ({
  trace: jest.fn(),
  generateRequestId: jest.fn(() => "test-request-id"),
}));

describe("Dodo webhook handler", () => {
  const fakeSecret = "whsec_dGVzdC1zZWNyZXQ="; // base64 of "test-secret"
  const rawBody = JSON.stringify({
    id: "evt_123",
    type: "checkout.completed",
    data: {
      customer_email: "test@example.com",
      plan_id: "pro",
      payment_id: "pay_123",
      amount: 1000,
    },
  });

  const createWebhookSignature = (id: string, timestamp: string, payload: string, secret: string) => {
    const signedPayload = `${id}.${timestamp}.${payload}`;
    // Decode secret: whsec_<base64>
    const secretMatch = secret.match(/^whsec_(.+)$/);
    if (!secretMatch) throw new Error("Invalid secret format");
    const secretBase64 = secretMatch[1];
    const secretBuffer = Buffer.from(secretBase64, "base64");
    const hmacBytes = crypto.createHmac("sha256", secretBuffer).update(signedPayload).digest();
    return `v1,${hmacBytes.toString("base64")}`;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DODO_WEBHOOK_SECRET = fakeSecret;
    // Mock isPaidPlan to return true for "pro"
    require("@/lib/payments").isPaidPlan.mockReturnValue(true);
    // Mock getPlanPriceUSD to return 10
    require("@/lib/payments").getPlanPriceUSD.mockReturnValue(10);
    // Mock provisionPlan to return a successful result
    require("@/lib/billing").provisionPlan.mockResolvedValue({
      userId: "user_123",
      creditsAdded: 100,
      duplicate: false,
    });
    // Mock prisma.webhookEvent.findUnique to return null (no duplicate)
    require("@/lib/prisma").prisma.webhookEvent.findUnique.mockResolvedValue(null);
    // Mock prisma.webhookEvent.create to resolve
    require("@/lib/prisma").prisma.webhookEvent.create.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.DODO_WEBHOOK_SECRET;
  });

  it("accepts valid signature", async () => {
    const id = "wh_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createWebhookSignature(id, timestamp, rawBody, fakeSecret);

    const request = new NextRequest("https://example.com/api/payment/dodo/webhook", {
      method: "POST",
      headers: {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
      },
      body: rawBody,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.received).toBe(true);
  });

  it("rejects wrong secret", async () => {
    const id = "wh_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    // Sign with a different secret
    const wrongSecret = "whsec_dGVzdC1zZWNyZXQxMjM="; // "test-secret123"
    const signature = createWebhookSignature(id, timestamp, rawBody, wrongSecret);

    const request = new NextRequest("https://example.com/api/payment/dodo/webhook", {
      method: "POST",
      headers: {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
      },
      body: rawBody,
    });

    // Set the environment variable to the correct secret (so the handler uses the correct one)
    process.env.DODO_WEBHOOK_SECRET = fakeSecret;

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("rejects tampered body", async () => {
    const id = "wh_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createWebhookSignature(id, timestamp, rawBody, fakeSecret);

    // Tamper with the body
    const tamperedBody = rawBody.replace("test@example.com", "hacker@example.com");

    const request = new NextRequest("https://example.com/api/payment/dodo/webhook", {
      method: "POST",
      headers: {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
      },
      body: tamperedBody,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("rejects missing headers", async () => {
    const request = new NextRequest("https://example.com/api/payment/dodo/webhook", {
      method: "POST",
      headers: {}, // missing all headers
      body: rawBody,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("rejects stale timestamp", async () => {
    const id = "wh_123";
    // Timestamp that is too old (more than 5 minutes ago)
    const timestamp = String(Math.floor(Date.now() / 1000) - 6 * 60); // 6 minutes ago
    const signature = createWebhookSignature(id, timestamp, rawBody, fakeSecret);

    const request = new NextRequest("https://example.com/api/payment/dodo/webhook", {
      method: "POST",
      headers: {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
      },
      body: rawBody,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("processes duplicate webhook-id only once", async () => {
    const id = "wh_123";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createWebhookSignature(id, timestamp, rawBody, fakeSecret);

    // First request: no duplicate
    require("@/lib/prisma").prisma.webhookEvent.findUnique.mockResolvedValue(null);
    let request = new NextRequest("https://example.com/api/payment/dodo/webhook", {
      method: "POST",
      headers: {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
      },
      body: rawBody,
    });
    let response = await POST(request);
    expect(response.status).toBe(200);
    let json = await response.json();
    expect(json.received).toBe(true);
    expect(json.duplicate).toBe(false);

    // Second request with same id: duplicate found
    require("@/lib/prisma").prisma.webhookEvent.findUnique.mockResolvedValue({ id: "dummy" });
    request = new NextRequest("https://example.com/api/payment/dodo/webhook", {
      method: "POST",
      headers: {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature,
      },
      body: rawBody,
    });
    response = await POST(request);
    expect(response.status).toBe(200);
    json = await response.json();
    expect(json.received).toBe(true);
    expect(json.duplicate).toBe(true);
  });
});
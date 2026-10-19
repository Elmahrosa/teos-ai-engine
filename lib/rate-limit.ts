import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { trace, generateRequestId } from "./trace";

export type RoutePolicy = "strict" | "medium" | "light";

const POLICY_CONFIG: Record<RoutePolicy, { limit: number; window: number }> = {
  strict: { limit: 10, window: 60_000 },
  medium: { limit: 30, window: 60_000 },
  light: { limit: 100, window: 60_000 },
};

const clients = new Map<string, { ratelimit: Ratelimit; redis: Redis }>();

const inMemoryMap = new Map<string, { count: number; resetAt: number }>();

function getClient(policy: RoutePolicy) {
  const key = `ratelimit:${policy}`;
  if (clients.has(key)) return clients.get(key)!;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  const config = POLICY_CONFIG[policy];

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, `${config.window}ms`),
    analytics: true,
    prefix: `teos:${policy}`,
  });

  const entry = { ratelimit, redis };
  clients.set(key, entry);
  return entry;
}

export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

function inMemoryCheck(
  ip: string,
  policy: RoutePolicy,
): { allowed: boolean; remaining: number; reset: number } {
  const config = POLICY_CONFIG[policy];
  const now = Date.now();
  const key = `${policy}:${ip}`;
  const record = inMemoryMap.get(key);

  if (!record || now > record.resetAt) {
    inMemoryMap.set(key, { count: 1, resetAt: now + config.window });
    return { allowed: true, remaining: config.limit - 1, reset: now + config.window };
  }

  if (record.count >= config.limit) {
    return { allowed: false, remaining: 0, reset: record.resetAt };
  }

  record.count += 1;
  return { allowed: true, remaining: config.limit - record.count, reset: record.resetAt };
}

export async function checkRateLimit(
  request: NextRequest,
  policy: RoutePolicy = "medium"
): Promise<{ allowed: boolean; remaining: number; reset: number } | null> {
  const client = getClient(policy);
  if (!client) {
    // Warning: in-memory fallback is not suitable for production\n    // Warning: in-memory fallback is not suitable for production
    return inMemoryCheck(getClientIP(request), policy);
  }

  const ip = getClientIP(request);
  const identifier = `${policy}:${ip}`;

  const { success, remaining, reset } = await client.ratelimit.limit(identifier);

  return { allowed: success, remaining, reset };
}

export function rateLimitResponse(
  remaining: number,
  reset: number
): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please slow down.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
        "X-RateLimit-Remaining": String(remaining),
      },
    }
  );
}

export async function withRateLimit(
  request: NextRequest,
  policy: RoutePolicy = "medium",
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const requestId = generateRequestId();
  const result = await checkRateLimit(request, policy);

  if (result === null) {
    return handler();
  }

  if (!result.allowed) {
    trace({
      requestId,
      event: "rateLimit.blocked",
      policy,
      ip: getClientIP(request),
      remaining: result.remaining,
    });

    return rateLimitResponse(result.remaining, result.reset);
  }

  return handler();
}




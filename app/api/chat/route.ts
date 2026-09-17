import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// ─── Public chat endpoint (free acquisition funnel) ──────────────────────────
// No session, no plan check — anyone on the home page can ask Ask TEOS AI.
// Best-effort IP rate limit guards against LLM cost abuse on serverless.
// The paid dashboard keeps using /api/generate (session + plan enforced).

const chatSchema = z.object({
  prompt: z.string().trim().min(3, "Message is too short").max(600),
  platform: z
    .enum(["x", "instagram", "linkedin", "facebook", "threads", "tiktok", "youtube"])
    .default("linkedin"),
});

const SYSTEM_PROMPT = `You are Ask TEOS AI — the free sovereign acquisition assistant of Elmahrosa International.
Answer concisely and helpfully about entrepreneurship, content strategy, market insights, and sovereign AI.
Keep answers under 250 words, plain text only, no markdown, no JSON.
Be honest when you are unsure, and never invent figures, quotes, or product claims.`;

// ─── Best-effort sliding-window rate limiter (per IP, in-memory) ─────────────
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 10;
const hits = new Map<string, number[]>();

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) {
    for (const [key, times] of hits) {
      if (times.length === 0 || now - Math.max(...times) > WINDOW_MS) hits.delete(key);
    }
  }
  return true;
}

function resolveModel() {
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic("claude-3-5-sonnet-20241022");
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.0-flash");
  }
  return null;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (!allowRequest(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = chatSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters.", detail: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const model = resolveModel();
  if (!model) {
    return NextResponse.json({ error: "AI engine is not configured." }, { status: 503 });
  }

  try {
    const { text } = await generateText({
      model,
      system: SYSTEM_PROMPT,
      prompt: `User question: ${parsed.data.prompt}`,
    });
    const reply = text.trim();
    if (!reply) {
      return NextResponse.json({ error: "Engine returned an empty reply." }, { status: 502 });
    }
    return NextResponse.json({ post: reply });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to generate reply.", detail }, { status: 500 });
  }
}
// ─── Post Generation Endpoint ─────────────────────────────────────────────────
// Handles structured (non-streaming) post generation for the dashboard.
// Response shape: { post: string; hashtags: string[]; platform: string }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionEmail } from "@/lib/session";
import { appendPost, canUserPost } from "@/lib/db";
import { getPlan, isUnlimited } from "@/lib/plans";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { trace, generateRequestId } from "@/lib/trace";

// ─── Schema ───────────────────────────────────────────────────────────────────

const generateSchema = z.object({
  prompt: z.string().trim().min(5, "Prompt must be at least 5 characters").max(600),
  platform: z.enum(["x", "instagram", "linkedin", "facebook", "threads", "tiktok", "youtube"]),
});

type Platform = z.infer<typeof generateSchema>["platform"];

// ─── Platform-specific system prompts ────────────────────────────────────────

const PLATFORM_CONTEXT: Record<Platform, string> = {
  x:         "X (Twitter) — max 280 characters, punchy hook, conversational tone, 1–3 hashtags",
  instagram: "Instagram — engaging caption up to 2200 characters, storytelling tone, 5–10 hashtags",
  linkedin:  "LinkedIn — professional thought leadership post, 150–300 words, 3–5 hashtags",
  facebook:  "Facebook — community-friendly, conversational, 100–200 words, 2–4 hashtags",
  threads:   "Threads — conversational short-form, max 500 characters, 0–2 hashtags",
  tiktok:    "TikTok — viral hook for video caption, max 150 characters, 3–5 trending hashtags",
  youtube:   "YouTube — SEO-friendly video description, 200–300 words, 5–8 hashtags",
};

// ─── Model routing by plan tier ──────────────────────────────────────────────

function resolveModel(planId: string) {
  const isAgencyTier =
    planId === "agency_monthly" ||
    planId === "agency_yearly"  ||
    planId === "agency_lifetime";

  if (isAgencyTier && process.env.ANTHROPIC_API_KEY) {
    return { model: anthropic("claude-3-5-sonnet-20241022"), provider: "claude" as const };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { model: google("gemini-2.0-flash"), provider: "gemini" as const };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { model: anthropic("claude-3-5-sonnet-20241022"), provider: "claude" as const };
  }
  return null;
}

// ─── Response parser: extract post + hashtags from raw AI text ────────────────

function parseAIResponse(raw: string): { post: string; hashtags: string[] } {
  // Try JSON block first (wrapped in ```json ... ```)
  const jsonBlock = raw.match(/```json\s*([\s\S]*?)```/i);
  if (jsonBlock?.[1]) {
    try {
      const parsed = JSON.parse(jsonBlock[1].trim());
      if (typeof parsed.post === "string") {
        return {
          post: parsed.post.trim(),
          hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        };
      }
    } catch { /* fall through */ }
  }

  // Try raw JSON object
  const jsonRaw = raw.match(/\{[\s\S]*\}/);
  if (jsonRaw) {
    try {
      const parsed = JSON.parse(jsonRaw[0]);
      if (typeof parsed.post === "string") {
        return {
          post: parsed.post.trim(),
          hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
        };
      }
    } catch { /* fall through */ }
  }

  // Fallback: use raw text as post, extract hashtags via regex
  const hashtags = (raw.match(/#\w+/g) ?? []).map((h) => h.replace("#", ""));
  const postText = raw.trim();
  return { post: postText, hashtags };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const req = request as NextRequest;

  try {
    // ── Auth ────────────────────────────────────────────────────────────────────
    const email = await getSessionEmail();
    if (!email) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    // ── User resolution ─────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    // ── Validate request body ───────────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parseResult = generateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request parameters.",
          detail: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { prompt, platform } = parseResult.data;

    // ── Plan resolution (handles all plan ID formats) ────────────────────────────
    const plan = getPlan(user.plan, user.email);

    // ── Usage limit check ────────────────────────────────────────────────────────
    const usage = await canUserPost(user.id, user.plan);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.reason, limitReached: true },
        { status: 403 },
      );
    }

    // ── Platform access check (free plan: 2 platforms only) ─────────────────────
    const freePlatforms: Platform[] = ["x", "linkedin"];
    if (plan.id === "free" && !freePlatforms.includes(platform)) {
      return NextResponse.json(
        {
          error: `Your Starter plan supports X and LinkedIn only. Upgrade to unlock ${platform}.`,
          limitReached: false,
        },
        { status: 403 },
      );
    }

    // ── Model selection ─────────────────────────────────────────────────────────
    const modelConfig = resolveModel(user.plan);
    if (!modelConfig) {
      return NextResponse.json(
        { error: "AI engine is not configured. Contact support." },
        { status: 503 },
      );
    }

    trace({
      requestId,
      event: "generate.start",
      provider: modelConfig.provider,
      planId: user.plan,
      platform,
    });

    // ── Build prompt ─────────────────────────────────────────────────────────────
    const systemPrompt = `You are an expert social media copywriter specializing in ${PLATFORM_CONTEXT[platform]}.

Your task: write a high-converting post for the platform context described above based on the user's idea.

Return ONLY a JSON object in this exact format (no markdown, no explanation, just the JSON):
{
  "post": "<the full post text, ready to copy-paste>",
  "hashtags": ["hashtag1", "hashtag2"]
}

Rules:
- The "hashtags" array must NOT include the # symbol — just the words.
- The "post" field should include inline hashtags naturally if appropriate for the platform.
- Never exceed platform character limits.`;

    // ── Generate ─────────────────────────────────────────────────────────────────
    const start = Date.now();
    const { text: rawOutput } = await generateText({
      model: modelConfig.model,
      system: systemPrompt,
      prompt: `User idea: ${prompt}`,
    });

    const durationMs = Date.now() - start;
    trace({ requestId, event: "generate.complete", provider: modelConfig.provider, durationMs });

    // ── Parse structured output ──────────────────────────────────────────────────
    const { post, hashtags } = parseAIResponse(rawOutput);

    // ── Persist post + increment counters ────────────────────────────────────────
    await appendPost({
      userId: user.id,
      content: post,
      platform,
      prompt,
    });

    return NextResponse.json({ post, hashtags, platform, provider: modelConfig.provider });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    trace({ requestId, event: "generate.error", error: detail });

    return NextResponse.json(
      { error: "Failed to generate post.", detail },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

// ─── Internal sovereign script generation for the TEOS Video Engine ──────────
// Server-to-server endpoint (no browser session) used by the Railway-hosted
// forge. Guarded by the same INTERNAL_KEY header pattern as app/api/seats.

const scriptSchema = z.object({
  prompt: z.string().trim().min(3, "Topic is too short").max(1000),
});

const SOVEREIGN_SYSTEM_PROMPT = `You are TEOS Sovereign Script Author, the content forge of Elmahrosa International. You write fact-checked, source-restricted YouTube scripts.
HARD RESTRICTIONS (non-negotiable, per Elmahrosa Sovereign Technology policy "Law over Code — Evidence over claims"):
1. Cite ONLY official Elmahrosa International sources. Allowed: elmahrosa.com, teosegypt.com, github.com/Elmahrosa
2. Do NOT invent facts, quotes, figures, or product claims.
3. If a claim has no official Elmahrosa source, mark it as '[TEOS PENDING FACT-CHECK]'.
4. Output ONLY the final script text (no preamble, no JSON, no markdown).
5. Structure the script as: HOOK / VISION / EVIDENCE / SOVEREIGN CALL-TO-ACTION.
Write 8-12 short spoken sentences in plain, clear language.`;

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
  const key = req.headers.get("x-internal-key");
  if (!process.env.INTERNAL_KEY || key !== process.env.INTERNAL_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = scriptSchema.safeParse(raw);
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
      system: SOVEREIGN_SYSTEM_PROMPT,
      prompt: `Sovereign video topic: ${parsed.data.prompt}`,
    });

    const script = text.trim();
    if (!script) {
      return NextResponse.json({ error: "Engine returned an empty script." }, { status: 502 });
    }

    return NextResponse.json({ script });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to generate script.", detail }, { status: 500 });
  }
}
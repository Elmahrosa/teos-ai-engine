import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateRequestId } from "@/lib/trace";

const logSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  event: z.string().min(1),
  message: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  try {
    const parsed = logSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid log format", requestId }, { status: 400 });
    }

    const { level, event, message, data } = parsed.data;

    const entry = {
      timestamp: new Date().toISOString(),
      requestId,
      level,
      event,
      message: message || event,
      ...(data || {}),
    };

    if (process.env.LOG_WEBHOOK_URL) {
      fetch(process.env.LOG_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).catch(() => {});
    }

    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify(entry)); // eslint-disable-line no-console
    }

    return NextResponse.json({ success: true, requestId });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}

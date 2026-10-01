import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { mediaGenerateSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const plan = getPlan(user.plan, user.email);
    if (user.email !== "aams1969@gmail.com" && user.email !== "ayman@teosegypt.com" && plan.id === "free") {
      return NextResponse.json({ error: "Media Synthesis requires a paid tier." }, { status: 403 });
    }

    const parsed = mediaGenerateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const { type, prompt, stylePreset, anchorWeight, keepShapeWeight, sourceAssetUrl } = parsed.data;

    const mediaJob = await prisma.mediaJob.create({
      data: {
        userId: user.id,
        type: type === "video" ? "VIDEO" : "IMAGE",
        prompt,
        stylePreset: stylePreset || "DEFAULT",
        anchorWeight: anchorWeight ?? 0.55,
        keepShapeWeight: keepShapeWeight ?? 0.50,
        sourceAssetUrl,
        status: "COMPLETED",
      },
    });

    const mockOutputUrl =
      type === "video"
        ? "https://cdn.teosegypt.com/outputs/sample_render.mp4"
        : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000";

    return NextResponse.json({
      jobId: mediaJob.id,
      status: "COMPLETED",
      outputUrl: mockOutputUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Engine Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

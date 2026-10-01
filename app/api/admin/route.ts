import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access";
import { listUsers, updateUserByEmail } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { adminUserUpdateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  return withRateLimit(req, "strict", async () => {
    const session = await getServerSession(authOptions);

    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await listUsers();

    const activePlans = ["pro_monthly", "pro_yearly", "pro_lifetime", "agency_monthly", "agency_yearly", "agency_lifetime"];

    const stats = {
      total: users.length,
      pro: users.filter((u) => activePlans.includes(u.plan)).length,
      active: users.filter((u) => activePlans.includes(u.plan)).length,
      trial: users.filter((u) => u.plan === "free").length,
      blocked: 0,
    };

    return NextResponse.json({ stats, users });
  });
}

export async function PATCH(req: NextRequest) {
  return withRateLimit(req, "strict", async () => {
    const session = await getServerSession(authOptions);

    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = adminUserUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const { email, plan, status } = parsed.data;

    const updated = await updateUserByEmail(email, {
      ...(plan ? { plan } : {}),
      ...(status ? { status } : {}),
    });

    return NextResponse.json({ success: true, user: updated });
  });
}

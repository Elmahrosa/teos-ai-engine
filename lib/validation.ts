import { z } from "zod";
import type { PlanId } from "@/lib/plans";
import type { AestheticStyle } from "@prisma/client";

export const emailSchema = z.string().email().trim().toLowerCase();

export const passwordSchema = z.string().min(6).max(128);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const signupSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(100),
  password: passwordSchema,
});

export const resetRequestSchema = z.object({
  email: emailSchema,
});

export const resetConfirmSchema = z.object({
  token: z.string().min(1),
  email: emailSchema,
  password: passwordSchema,
});

export const generatePostSchema = z.object({
  prompt: z.string().trim().min(10).max(500),
  platform: z.enum(["x", "instagram", "linkedin"]),
});

export const subscribeSchema = z.object({
  plan: z.enum(["starter", "pro", "agency"]),
});

// ─── Shared vocabularies ─────────────────────────────────────────────────────
// Kept in sync with lib/plans.ts via `satisfies`, so adding a plan there
// forces a compile error here rather than silently rejecting it at runtime.

const PLAN_IDS = [
  "free",
  "pro_monthly",
  "agency_monthly",
  "pro_yearly",
  "agency_yearly",
  "pro_lifetime",
  "agency_lifetime",
] as const satisfies readonly PlanId[];

export const planIdSchema = z.enum(PLAN_IDS);

export const userStatusSchema = z.enum(["trial", "active"]);

// NOTE: includes "facebook", which the dashboard (app/dashboard/page.tsx)
// can post as. Deliberately wider than generatePostSchema above.
export const platformSchema = z.enum([
  "x",
  "facebook",
  "instagram",
  "linkedin",
]);

// ─── Route request bodies ────────────────────────────────────────────────────

export const createPostSchema = z.object({
  platform: platformSchema,
  prompt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(1).max(10000),
});

export const adminUserUpdateSchema = z
  .object({
    email: emailSchema,
    plan: planIdSchema.optional(),
    status: userStatusSchema.optional(),
  })
  .refine((v) => v.plan !== undefined || v.status !== undefined, {
    message: "At least one of plan or status is required",
  });

export const adminLifetimeSchema = z.object({
  email: emailSchema,
});

const AESTHETIC_STYLES = [
  "DEFAULT",
  "ANIMATION_3D",
  "ANIME",
  "CYBERPUNK",
  "CINEMATIC",
  "VINTAGE_VHS",
] as const satisfies readonly AestheticStyle[];

export const aestheticStyleSchema = z.enum(AESTHETIC_STYLES);

// z.string().url() only checks that the value parses as a URL, so it happily
// accepts "javascript:alert(1)" and "data:..." — dangerous for a value that is
// persisted and later rendered as a link or src. Restrict to http(s).
export const httpUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((v) => {
    try {
      const proto = new URL(v).protocol;
      return proto === "http:" || proto === "https:";
    } catch {
      return false;
    }
  }, { message: "URL must use http or https" });

export const mediaGenerateSchema = z.object({
  type: z.enum(["image", "video"]).optional(),
  prompt: z.string().trim().min(1).max(2000),
  stylePreset: aestheticStyleSchema.optional(),
  anchorWeight: z.number().min(0).max(1).optional(),
  keepShapeWeight: z.number().min(0).max(1).optional(),
  sourceAssetUrl: httpUrlSchema.optional(),
});

import {
  planIdSchema,
  userStatusSchema,
  platformSchema,
  createPostSchema,
  adminUserUpdateSchema,
  adminLifetimeSchema,
  mediaGenerateSchema,
} from '@/lib/validation';

describe('lib/validation.ts - shared vocabularies', () => {
  it('should accept every PlanId and reject unknown plans', () => {
    const valid = [
      'free',
      'pro_monthly',
      'agency_monthly',
      'pro_yearly',
      'agency_yearly',
      'pro_lifetime',
      'agency_lifetime',
    ];
    for (const id of valid) {
      expect(planIdSchema.safeParse(id).success).toBe(true);
    }
    expect(planIdSchema.safeParse('enterprise').success).toBe(false);
    expect(planIdSchema.safeParse('').success).toBe(false);
    expect(planIdSchema.safeParse('PRO_MONTHLY').success).toBe(false);
  });

  it('should accept the known user statuses', () => {
    expect(userStatusSchema.safeParse('trial').success).toBe(true);
    expect(userStatusSchema.safeParse('active').success).toBe(true);
    expect(userStatusSchema.safeParse('banned').success).toBe(false);
  });

  it('should accept facebook, which the dashboard can post as', () => {
    // Regression guard: reusing generatePostSchema's narrower enum here would
    // silently break Facebook post saving in app/dashboard/page.tsx.
    expect(platformSchema.safeParse('x').success).toBe(true);
    expect(platformSchema.safeParse('facebook').success).toBe(true);
    expect(platformSchema.safeParse('instagram').success).toBe(true);
    expect(platformSchema.safeParse('linkedin').success).toBe(true);
    expect(platformSchema.safeParse('tiktok').success).toBe(false);
    expect(platformSchema.safeParse('').success).toBe(false);
  });
});

describe('lib/validation.ts - createPostSchema', () => {
  const valid = { platform: 'linkedin', prompt: 'hello', content: 'post body' };

  it('should accept a valid post', () => {
    expect(createPostSchema.safeParse(valid).success).toBe(true);
  });

  it('should treat prompt as optional', () => {
    const { prompt, ...withoutPrompt } = valid;
    expect(prompt).toBe('hello');
    expect(createPostSchema.safeParse(withoutPrompt).success).toBe(true);
  });

  it('should reject an unknown platform', () => {
    expect(
      createPostSchema.safeParse({ ...valid, platform: 'myspace' }).success
    ).toBe(false);
  });

  it('should reject empty or whitespace-only content', () => {
    expect(createPostSchema.safeParse({ ...valid, content: '' }).success).toBe(
      false
    );
    expect(createPostSchema.safeParse({ ...valid, content: '   ' }).success).toBe(
      false
    );
  });

  it('should reject oversized content', () => {
    expect(
      createPostSchema.safeParse({ ...valid, content: 'a'.repeat(10001) }).success
    ).toBe(false);
  });
});

describe('lib/validation.ts - adminUserUpdateSchema', () => {
  it('should accept an email with only a plan', () => {
    expect(
      adminUserUpdateSchema.safeParse({
        email: 'user@example.com',
        plan: 'pro_yearly',
      }).success
    ).toBe(true);
  });

  it('should accept an email with only a status', () => {
    expect(
      adminUserUpdateSchema.safeParse({
        email: 'user@example.com',
        status: 'active',
      }).success
    ).toBe(true);
  });

  it('should reject an email with neither plan nor status', () => {
    expect(
      adminUserUpdateSchema.safeParse({ email: 'user@example.com' }).success
    ).toBe(false);
  });

  it('should reject an invalid email', () => {
    expect(
      adminUserUpdateSchema.safeParse({ email: 'not-an-email', plan: 'free' })
        .success
    ).toBe(false);
  });

  it('should reject an unknown plan', () => {
    expect(
      adminUserUpdateSchema.safeParse({
        email: 'user@example.com',
        plan: 'enterprise',
      }).success
    ).toBe(false);
  });
});

describe('lib/validation.ts - adminLifetimeSchema', () => {
  it('should accept a valid email', () => {
    expect(
      adminLifetimeSchema.safeParse({ email: 'user@example.com' }).success
    ).toBe(true);
  });

  it('should reject a missing or malformed email', () => {
    expect(adminLifetimeSchema.safeParse({}).success).toBe(false);
    expect(adminLifetimeSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('lib/validation.ts - mediaGenerateSchema', () => {
  const valid = { prompt: 'a cinematic portrait' };

  it('should accept a minimal request', () => {
    expect(mediaGenerateSchema.safeParse(valid).success).toBe(true);
  });

  it('should reject an empty prompt', () => {
    expect(mediaGenerateSchema.safeParse({ ...valid, prompt: '' }).success).toBe(
      false
    );
  });

  it('should reject an unknown type', () => {
    expect(
      mediaGenerateSchema.safeParse({ ...valid, type: 'audio' }).success
    ).toBe(false);
  });

  it('should accept known style presets and reject unknown ones', () => {
    expect(
      mediaGenerateSchema.safeParse({ ...valid, stylePreset: 'ANIME' }).success
    ).toBe(true);
    expect(
      mediaGenerateSchema.safeParse({ ...valid, stylePreset: 'PLAID' }).success
    ).toBe(false);
  });

  it('should bound the weights to 0..1', () => {
    expect(
      mediaGenerateSchema.safeParse({ ...valid, anchorWeight: 0.55 }).success
    ).toBe(true);
    expect(
      mediaGenerateSchema.safeParse({ ...valid, anchorWeight: 1.5 }).success
    ).toBe(false);
    expect(
      mediaGenerateSchema.safeParse({ ...valid, keepShapeWeight: -0.1 }).success
    ).toBe(false);
  });

  it('should reject a malformed or non-http sourceAssetUrl', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'not a url',
    ]) {
      expect(
        mediaGenerateSchema.safeParse({ ...valid, sourceAssetUrl: bad }).success
      ).toBe(false);
    }
    expect(
      mediaGenerateSchema.safeParse({
        ...valid,
        sourceAssetUrl: 'https://cdn.example.com/a.png',
      }).success
    ).toBe(true);
  });
});
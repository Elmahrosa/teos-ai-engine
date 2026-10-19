# 🏺 Teos AI Engine

> **Egypt's Sovereign AI Content Engine** — Generate platform-optimized social media content for X, LinkedIn, Instagram, Facebook, TikTok, Threads, and Telegram. Built in Alexandria. Powered by Elmahrosa International.

[![Live App](https://img.shields.io/badge/Live%20App-teos--ai--engine.vercel.app-black?style=flat-square&logo=vercel)](https://teos-ai-engine.vercel.app)
[![License](https://img.shields.io/badge/License-TESL%20v2.0-blue?style=flat-square)](./LICENSE)
[![Built with Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Powered by Claude](https://img.shields.io/badge/AI-Claude%20%2F%20OpenAI-orange?style=flat-square)](https://anthropic.com)
[![Payments](https://img.shields.io/badge/Payments-Dodo%20%7C%20USDC%20%7C%20Pi-green?style=flat-square)](https://dodo.pe)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Live Demo](#live-demo)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Pricing](#pricing)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Payments](#payments)
- [Security](#security)
- [License](#license)

---

## Overview

**Teos AI Engine** is a production-grade AI SaaS platform that turns raw ideas into high-impact, platform-optimized social media posts across 7 platforms — in seconds.

Built for **founders, creators, and agencies** who need to produce consistent, on-brand content at scale without hiring a content team.

Key differentiator: **Sovereign AI architecture.** Choose your AI provider (Anthropic Claude or OpenAI GPT-4o), deploy your database in your preferred jurisdiction, and select your deployment target to achieve data sovereignty.

```
Prompt → AI Engine → Platform-Optimized Post → Scheduled → Published
```

### Who It's For

| User | Use Case |
|---|---|
| Solo founders | Generate 30+ posts/week in under an hour |
| Content agencies | Manage 10+ brand accounts from a single dashboard |
| Marketing teams | Scale content output without scaling headcount |
| MENA startups | Sovereign AI infrastructure — GDPR & Egyptian law compliant |

---

## Live Demo

🌐 **Production:** [https://teos-ai-engine.vercel.app](https://teos-ai-engine.vercel.app)  
🔗 **Canonical domain:** [https://ai.teosegypt.com](https://ai.teosegypt.com)

No sign-up required to test content generation on the landing page demo.

---

## Features

### Core Engine

- **Multi-platform generation** — X, LinkedIn, Instagram, Facebook, TikTok, Threads, Telegram
- **Tone selection** — Professional, Viral Hook, Founder Story, Authority, Contrarian, Sales CTA, Educational, and more
- **Visibility scoring** — Engagement-aware AI output ranked before it reaches you
- **Brand voice training** — Feed the engine your existing content; it matches your style across platforms
- **Platform-specific optimization** — Character limits, hashtag strategy, format, and audience behavior per platform

### SaaS Infrastructure

- **Plan-based feature gating** — Starter / Pro / Agency / Lifetime
- **Daily usage tracking** with automatic reset
- **Lifetime post counter** per user
- **Admin dashboard** — manual activation, plan upgrades, billing validation
- **Persistent post history** — Prisma + PostgreSQL

### Platform Coverage

| Platform | Starter | Pro | Agency | Lifetime |
|---|---|---|---|---|
| X (Twitter) | ✅ | ✅ | ✅ | ✅ |
| Instagram | ✅ | ✅ | ✅ | ✅ |
| LinkedIn | ❌ | ✅ | ✅ | ✅ |
| Facebook | ❌ | ✅ | ✅ | ✅ |
| TikTok | ❌ | ❌ | ✅ | ✅ |
| Threads | ❌ | ❌ | ✅ | ✅ |
| Telegram | ❌ | ❌ | ✅ | ✅ |

---

## Architecture

```
teos-ai-engine/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Auth routes (login, register)
│   ├── (dashboard)/            # Protected dashboard routes
│   ├── api/                    # API route handlers
│   │   ├── ai/generate/        # AI content generation endpoint
│   │   ├── auth/               # NextAuth handlers
│   │   ├── usage/              # Usage tracking
│   │   └── webhooks/           # Dodo Payments webhooks
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/
│   ├── ui/                     # shadcn/ui base components
│   ├── landing/                # Landing page sections
│   ├── dashboard/              # Dashboard components
│   └── shared/                 # Shared components
├── lib/
│   ├── ai/                     # AI provider abstraction layer
│   │   ├── client.ts           # Provider selector (Claude / Gemini)
│   │   ├── prompts.ts          # Platform-specific prompt templates
│   │   └── rate-limit.ts       # AI request rate limiting
│   ├── auth/                   # Auth configuration
│   ├── db/                     # Prisma client
│   └── payments/               # Dodo Payments integration
├── prisma/
│   └── schema.prisma           # Database schema
├── .github/workflows/          # CI/CD pipelines
├── .env.example                # Environment variable template
└── vercel.json                 # Vercel deployment config
```

### Data Flow

```
User Prompt
    │
    ▼
API Route (/api/ai/generate)
    │
    ├── Auth check (NextAuth session)
    ├── Usage limit check (Prisma)
    ├── Rate limit check (edge)
    │
    ▼
AI Service Layer
    │
    ├── Platform prompt template
    ├── Brand voice context
    ├── Tone configuration
    │
    ▼
Claude / Gemini (with plan-based routing)
    │
    ▼
Visibility Score → Response
    │
    ▼
Persist to DB → Return to client
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Database | PostgreSQL (Neon) via Prisma ORM |
| Auth | NextAuth.js v5 |
| AI — Primary | Anthropic Claude (claude-sonnet) |
| AI — Fallback | Google Gemini (gemini-2.0-flash) |
| Payments | Dodo Payments + USDC (Solana) + Pi Network |
| Deployment | Vercel (edge-optimized) |
| CI/CD | GitHub Actions |
| Email | Resend |
| Monitoring | Vercel Analytics |

---

## Pricing

| Plan | Price | Daily Limit | Platforms | Team Seats |
|---|---|---|---|---|
| **Starter** | Free | 5 posts total | X, Instagram | 1 |
| **Pro** | $29/month | 50 posts/day | X, Instagram, LinkedIn, Facebook | 1 |
| **Agency** | $69/month | 200 posts/day | All 7 platforms | 3 |
| **Lifetime** | $149 one-time | 100 posts/day | All 7 platforms | 10 |

> 🔥 **First 500 users** receive 1 free month when TikTok + AI video scripts ship.  
> ⚡ **Lifetime plan** is limited. Price increases after the TikTok upgrade.

Payments accepted via card (Visa/Mastercard), USDC on Solana, and Pi Network through [Dodo Payments](https://dodo.pe).

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (Neon recommended)
- Anthropic API key
- Dodo Payments account

### Local Development

```bash
# Clone the repo
git clone https://github.com/Elmahrosa/Teos-AI-Engine.git
cd Teos-AI-Engine

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your values — see Environment Variables section below

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# Start the dev server
npm run dev
```

App runs at `http://localhost:3000`.

### Build Verification

```bash
npm run build    # Must pass with zero errors
npm run lint     # Must pass with zero warnings
npx tsc --noEmit # TypeScript strict check
```

---

## Environment Variables

Copy `.env.example` and fill in all values before deployment.

```env
# ─── Database ────────────────────────────────────────────
DATABASE_URL="postgresql://..."

# ─── Auth ────────────────────────────────────────────────
NEXTAUTH_SECRET="your-secret-32-chars-minimum"
NEXTAUTH_URL="https://teos-ai-engine.vercel.app"

# ─── AI Providers ────────────────────────────────────────
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."           # Fallback provider

# ─── Payments — Dodo ─────────────────────────────────────
DODO_WEBHOOK_SECRET="your-dodo-webhook-secret"

# ─── App Config ──────────────────────────────────────────
NEXT_PUBLIC_APP_URL="https://teos-ai-engine.vercel.app"
ADMIN_EMAIL="ayman@teosegypt.com"
```

> ⚠️ Never commit `.env.local` or any file containing secrets.  
> All `NEXT_PUBLIC_` prefixed variables are exposed to the browser — keep secrets server-side only.

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Link to Vercel project
vercel link

# Deploy to production
vercel --prod
```

All environment variables must be configured in the Vercel dashboard under **Settings → Environment Variables** before deploying.

### Database Migration on Deploy

```bash
# Run after each schema change
npx prisma migrate deploy
```

Add this as a build command in Vercel:
```
npx prisma generate && npx prisma migrate deploy && next build
```

### vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && npx prisma migrate deploy && next build",
  "functions": {
    "app/api/ai/generate/route.ts": {
      "maxDuration": 60
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

---

## API Reference

### POST `/api/ai/generate`

Generate platform-optimized content. Requires authenticated session.

**Request**
```typescript
{
  platform: "x" | "linkedin" | "instagram" | "facebook" | "tiktok" | "threads" | "telegram";
  tone: "professional" | "viral" | "founder_story" | "authority" | "contrarian" | "educational" | "sales_cta" | "community";
  prompt: string;           // max 500 chars
  brandVoice?: string;      // optional trained voice context
}
```

**Response**
```typescript
{
  content: string;          // generated post
  visibilityScore: number;  // 0–100 engagement prediction
  platform: string;
  characterCount: number;
  hashtags: string[];
  generatedAt: string;      // ISO timestamp
}
```

**Error codes**

| Code | Reason |
|---|---|
| `401` | Unauthenticated |
| `403` | Plan limit reached |
| `429` | Rate limit exceeded |
| `500` | AI provider error |

---

## Payments

### Dodo Payments Checkout Links

| Plan | Checkout URL |
|---|---|
| Pro ($29/mo) | `https://dodo.pe/ljkagv2ixcr` |
| Agency ($69/mo) | `https://dodo.pe/dbvnd9a4pp` |
| Lifetime ($149) | `https://dodo.pe/relh2gradr9` |

> ⚠️ These links are canonical. Do not regenerate or replace them.

### Webhook

Dodo sends payment events to `/api/webhooks/dodo`. The handler validates the signature, upgrades the user's plan in the database, and triggers a confirmation email.

### Crypto Payments

USDC on Solana accepted. Wallet:  
`0xd9CA11Dde3810a1BA9B5E1a4b6b76F5a419FAb41` (Base network)

Pi Network payments processed via Dodo at checkout.

---

## Security

- All secrets are server-side only — no `NEXT_PUBLIC_` prefix on sensitive keys
- API routes protected by NextAuth session middleware
- Usage limits enforced server-side (never trust client)
- Webhook signatures validated on every Dodo event
- Security headers applied globally via `vercel.json`
- AI prompts sanitized server-side before forwarding to providers
- No user content used for external model training
- TLS 1.3 in transit, AES-256 at rest

To report a vulnerability: **security@teosegypt.com**

---

## CI/CD

GitHub Actions pipeline runs on every push to `main` and on all pull requests:

```
push/PR → Lint → TypeScript → Build → (main only) → Deploy to Vercel
```

See `.github/workflows/` for full workflow definitions.

---

## Roadmap

- [x] Multi-platform content generation (7 platforms)
- [x] Plan-based usage gating
- [x] Dodo Payments integration
- [x] Brand voice training
- [x] Admin dashboard
- [ ] TikTok + AI video scripts
- [ ] Content scheduling calendar
- [ ] Team collaboration workflows
- [ ] Analytics dashboard
- [ ] API access for Agency+ plans
- [ ] Arabic language content support
- [ ] $TEOS token utility integration

---

## About Elmahrosa International

**Elmahrosa International** is an Alexandria-based technology company (est. 2007) building sovereign AI-powered systems for MENA and global markets. The TEOS ecosystem spans AI content, code security, compliance infrastructure, and institutional telehealth.

- 🌐 [teosegypt.com](https://teosegypt.com)
- 𝕏 [@king_teos](https://x.com/king_teos)
- 💼 [linkedin.com/in/aymanseif](https://linkedin.com/in/aymanseif)
- 🐙 [github.com/Elmahrosa](https://github.com/Elmahrosa)
- 📬 [support@teosegypt.com](mailto:support@teosegypt.com)

---

## License

Proprietary — Elmahrosa International  
Licensed under **TESL v2.0** (TEOS Ecosystem Sovereign License)  
Not for redistribution without written permission.

© 2026 TEOS Network · Built in Alexandria, Egypt 🇪🇬

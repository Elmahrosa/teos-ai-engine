#!/bin/bash
# =============================================================
# TEOS AI ENGINE — DEPLOY SCRIPT
# Run this from the ROOT of your Teos-AI-Engine repo
# =============================================================

set -e

echo ""
echo "================================================"
echo "  Teos AI Engine — Deploy Script"
echo "  Elmahrosa International"
echo "================================================"
echo ""

echo "Installing dependencies..."
npm install
echo "  Done."

echo "Generating Prisma client..."
npx prisma generate
echo "  Done."

echo "TypeScript check..."
npx tsc --noEmit && echo "  No errors" || echo "  Errors found — check output above"

if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
  echo "  Done."

  echo "Running seed..."
  npm run db:seed
  echo "  Done."
else
  echo "DATABASE_URL not set — skipping migration/seed."
  echo "Run manually after setting env vars:"
  echo "  npx prisma migrate deploy"
  echo "  npm run db:seed"
fi

echo ""
echo "================================================"
echo "  Ready. Push to trigger deploy (Railway GitHub Integration):"
echo "  git add -A && git commit -m \"update\" && git push"
echo "================================================"
echo ""
echo "Required env vars:"
echo "  DATABASE_URL"
echo "  NEXTAUTH_SECRET"
echo "  OPENAI_API_KEY"
echo "  ADMIN_EMAIL"

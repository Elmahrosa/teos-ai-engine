import { spawn } from "child_process";
import { createServer } from "http";

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

console.log(`[Hostinger] Starting Teos AI Engine on ${HOST}:${PORT}`);
console.log(`[Hostinger] Node version: ${process.version}`);

const missing = [
  "DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL",
  "GOOGLE_GENERATIVE_AI_API_KEY", "ANTHROPIC_API_KEY",
].filter(k => !process.env[k]);

if (missing.length > 0) {
  console.warn(`[Hostinger] Missing env vars: ${missing.join(", ")}`);
}

const next = spawn("npx", ["next", "start", "-p", String(PORT)], {
  stdio: "inherit",
  env: { ...process.env, PORT: String(PORT) },
  shell: true,
});

next.on("error", (err) => {
  console.error("[Hostinger] Failed to start Next.js:", err);
  process.exit(1);
});

next.on("exit", (code) => {
  console.log(`[Hostinger] Next.js exited with code ${code}`);
  process.exit(code);
});

process.on("SIGTERM", () => next.kill("SIGTERM"));
process.on("SIGINT", () => next.kill("SIGINT"));

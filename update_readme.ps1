 (Get-Content -Raw README.md) -replace '| AI — Fallback | OpenAI GPT-4o |', '| AI — Fallback | Google Gemini (gemini-2.0-flash) |' | Set-Content README.md

 $content = Get-Content -Raw README.md
 $content = $content -replace '# Provider selector (Claude / OpenAI)', '# Provider selector (Claude / Gemini)'
 $content = $content -replace 'Claude / OpenAI (with fallback)', 'Claude / Gemini (with plan-based routing)'
 Set-Content README.md $content

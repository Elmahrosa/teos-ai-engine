 $content = Get-Content -Raw -Path 'app/api/generate/route.ts'
 $content = $content -replace 'platform: z.enum\(\["x", "instagram", "linkedin", "facebook", "threads", "tiktok", "youtube"\]\),', 'platform: z.enum\(\["x", "instagram", "linkedin", "facebook", "threads", "tiktok"\]\),'
 $content = $content -replace '  youtube:   "YouTube â€” SEO-friendly video description, max 150 characters, 3â€“5 trending hashtags",', ''
 Set-Content -Path 'app/api/generate/route.ts' -Value $content

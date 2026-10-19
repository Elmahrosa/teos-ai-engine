 $path = 'app/api/generate/route.ts.bak'
 $content = Get-Content -Raw -Path $path
 $content = $content -replace '  platform: z.enum(["x", "instagram", "linkedin", "facebook", "threads", "tiktok", "youtube"]),', '  platform: z.enum(["x", "instagram", "linkedin", "facebook", "threads", "tiktok"]),'
 $content = $content -replace '  youtube:   "YouTube â€” SEO-friendly video description, max 150 characters, 3â€“5 trending hashtags",', ''
 Set-Content -Path $path -Value $content

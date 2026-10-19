 $path = 'app/api/generate/route.ts.bak'
 $content = Get-Content -Raw -Path $path
 $youtubeLine = '  youtube:   "YouTube' + [char]8212 + ' SEO-friendly video description, max 150 characters, 3' + [char]8212 + '5 trending hashtags",'
 $content = $content -replace [regex]::Escape($youtubeLine), ''
 $enumOld = '  platform: z.enum(["x", "instagram", "linkedin", "facebook", "threads", "tiktok", "youtube"]),'
 $enumNew = '  platform: z.enum(["x", "instagram", "linkedin", "facebook", "threads", "tiktok"]),'
 $content = $content -replace [regex]::Escape($enumOld), $enumNew
 Set-Content -Path $path -Value $content

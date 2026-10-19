 $path = 'app/api/generate/route.ts.bak'
 $content = Get-Content -Raw -Path $path
 $content -replace 'platform: z\.enum\(\[([^\]]*)\]\)', {
     param($match)
     $inner = $match.Groups[1].Value
     $inner = $inner -replace ',?\s*youtube', ''
     $inner = $inner.Trim()
     if ($inner -eq '') {
         '  platform: z.enum([]),'
     } else {
         $elements = $inner -split '\s*,\s*'
         $newInner = ($elements -join ', ')
         "  platform: z.enum([$newInner]),"
     }
 } | Set-Content -Path $path
 $content = $content -replace '  youtube:   "YouTube â€” SEO-friendly video description, max 150 characters, 3â€“5 trending hashtags",', ''
 Set-Content -Path $path -Value $content

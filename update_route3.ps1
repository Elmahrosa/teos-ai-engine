 $path = 'app/api/generate/route.ts'
 $content = Get-Content -Raw -Path $path
 $content -replace 'platform: z\.enum\(\[([^\]]*)\]\)', {
     param($match)
     $list = $match.Groups[1].Value
     $list = $list -replace ',?\s*youtube', ''
     $list = $list -trim -replace '^,+|,+$', ''
     if ($list) {
         "platform: z.enum([$list]),"
     } else {
         "platform: z.enum([]),"
     }
 } | Set-Content -Path $path

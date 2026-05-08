$content = Get-Content src/components/ia-client.tsx
$newContent = $content[0..3524] + $content[3534..($content.Length-1)]
$newContent | Set-Content src/components/ia-client.tsx -Encoding UTF8

const fs = require('fs');
const path = require('path');

const files = [
  'src/components/ia-client.tsx',
  'src/components/dashboard-client.tsx',
  'src/components/schedule-client.tsx',
  'src/components/stops-client.tsx',
  'src/components/report-client.tsx',
  'src/components/oee-client.tsx',
  'src/components/melaza-client.tsx',
  'src/components/materials-client.tsx',
  'src/components/log-history-client.tsx',
  'src/components/history-client.tsx',
  'src/components/bodega-melaza-client.tsx',
  'src/components/access-client.tsx',
  'src/components/admin-client.tsx',
  'src/components/melaza-kpi-client.tsx',
  'src/components/materials-kpi-client.tsx'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to match buttons with "Volver" text and an icon
  // Matches <Button ...> ... <ChevronLeft ... /> ... Volver ... </Button>
  
  // Replace complex buttons with spans
  content = content.replace(
    /(<Button[^>]*?)size="[^"]*"([^>]*?>\s*)<ChevronLeft[^>]*?\/>.*?Volver.*?(\s*<\/Button>)/gs,
    '$1size="icon" className="h-8 w-8"$2<ChevronLeft className="h-4 w-4" />$3'
  );

  // Replace buttons without explicit size
  content = content.replace(
    /(<Button(?!.*size=")[^>]*?>\s*)<ChevronLeft[^>]*?\/>.*?Volver.*?(\s*<\/Button>)/gs,
    '$1size="icon" className="h-8 w-8"$2<ChevronLeft className="h-4 w-4" />$3'
  );
  
  // Cleanup double classNames if any were created
  content = content.replace(/className="([^"]*)"\s+className="([^"]*)"/g, (match, c1, c2) => {
    const combined = [...new Set([...c1.split(' '), ...c2.split(' ')])].filter(Boolean).join(' ');
    return `className="${combined}"`;
  });

  fs.writeFileSync(filePath, content);
  console.log(`Deep Updated ${file}`);
});

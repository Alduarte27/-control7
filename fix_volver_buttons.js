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
  'src/components/admin-client.tsx'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // Regex to match buttons with "Volver" text and an icon
  // Matches <Button ...> ... <ChevronLeft ... /> ... Volver ... </Button>
  // or variations with spans
  
  // Pattern 1: Button with ChevronLeft and text directly
  content = content.replace(
    /(<Button[^>]*?variant="(?:outline|ghost)"[^>]*?)size="sm"([^>]*?>\s*)<ChevronLeft[^>]*?\/>\s*Volver(\s*<\/Button>)/g,
    '$1size="icon"$2<ChevronLeft className="h-4 w-4" />$3'
  );

  // Pattern 2: Button with Link/href and spans (common in this project)
  content = content.replace(
    /(<Button[^>]*?)size="sm"([^>]*?>\s*)<ChevronLeft[^>]*?\/>\s*<span[^>]*?>Volver.*?<\/span>\s*<span[^>]*?>Volver<\/span>(\s*<\/Button>)/gs,
    '$1size="icon" className="h-8 w-8"$2<ChevronLeft className="h-4 w-4" />$3'
  );

  // Pattern 3: Specific for ia-client.tsx and dashboard-client.tsx headers
  content = content.replace(
    /(<Button[^>]*?)size="sm"([^>]*?className="text-xs md:text-sm"[^>]*?>\s*)<ChevronLeft[^>]*?\/>\s*<span[^>]*?>Volver.*?<\/span>\s*<span[^>]*?>Volver<\/span>(\s*<\/Button>)/gs,
    '$1size="icon" className="h-8 w-8"$2<ChevronLeft className="h-4 w-4" />$3'
  );

  // Pattern 4: Simple Volver text inside Button
  content = content.replace(
    /(<Button[^>]*?>\s*)<ChevronLeft[^>]*?\/>\s*Volver(\s*<\/Button>)/g,
    '$1<ChevronLeft className="h-4 w-4" />$2'
  );

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});

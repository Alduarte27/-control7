const fs = require('fs');
const path = 'c:/Users/Alexander Ayavaca/Desktop/control7/src/components/ia-client.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix imports
content = content.replace(
    "Target, PanelLeftClose, PanelLeftOpen, CalendarRange } from 'lucide-react';",
    "Target, PanelLeftClose, PanelLeftOpen, CalendarRange, Calendar, ArrowLeftRight } from 'lucide-react';"
);

// 2. Fix the daily click regex more carefully
// Sometimes the regex fails if there are minor whitespace differences.
const dailyDiaMatch = /onClick=\{\(\) => setEditingOverride\(\{ key: keyDia, machineId: m\.id, title: day\.toLocaleDateString\('es-ES', \{ day: 'numeric', month: 'long' \}\), shift: 'dia', currentProductId: pIdDia, currentSpeed: sDia, inactive: !!overrideDia\?\.inactive \}\)\}/g;
if (dailyDiaMatch.test(content)) {
    content = content.replace(dailyDiaMatch, 'onClick={() => setEditingOverride({ key: keyDia, machineId: m.id, title: day.toLocaleDateString(\'es-ES\', { day: \'numeric\', month: \'long\' }), shift: \'dia\', currentProductId: pIdDia, currentSpeed: sDia, inactive: !!overrideDia?.inactive, startDate: dateStr, endDate: dateStr })}');
}

const dailyNocMatch = /onClick=\{\(\) => setEditingOverride\(\{ key: keyNoc, machineId: m\.id, title: day\.toLocaleDateString\('es-ES', \{ day: 'numeric', month: 'long' \}\), shift: 'noche', currentProductId: pIdNoc, currentSpeed: sNoc, inactive: !!overrideNoc\?\.inactive \}\)\}/g;
if (dailyNocMatch.test(content)) {
    content = content.replace(dailyNocMatch, 'onClick={() => setEditingOverride({ key: keyNoc, machineId: m.id, title: day.toLocaleDateString(\'es-ES\', { day: \'numeric\', month: \'long\' }), shift: \'noche\', currentProductId: pIdNoc, currentSpeed: sNoc, inactive: !!overrideNoc?.inactive, startDate: dateStr, endDate: dateStr })}');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed imports and daily click handlers.');

const fs = require('fs');
const path = 'c:/Users/Alexander Ayavaca/Desktop/control7/src/components/ia-client.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove the "Programar por Rango" card from sidebar
const rangeCardRegex = /<Card className="border rounded-lg shadow-sm border-primary\/20 bg-primary\/5">[\s\S]*?<\/Card>/;
content = content.replace(rangeCardRegex, '');

// 2. Update renderTable daily clicks to include startDate and endDate
// For daily view:
const dailyClickRegex = /onClick=\{\(\) => setEditingOverride\(\{ key: keyDia, machineId: m.id, title: day\.toLocaleDateString\('es-ES', \{ day: 'numeric', month: 'long' \}\), shift: 'dia', currentProductId: pIdDia, currentSpeed: sDia, inactive: !!overrideDia\?\.inactive \}\)\}/g;
content = content.replace(dailyClickRegex, 'onClick={() => setEditingOverride({ key: keyDia, machineId: m.id, title: day.toLocaleDateString(\'es-ES\', { day: \'numeric\', month: \'long\' }), shift: \'dia\', currentProductId: pIdDia, currentSpeed: sDia, inactive: !!overrideDia?.inactive, startDate: dateStr, endDate: dateStr })}');

const dailyClickNocRegex = /onClick=\{\(\) => setEditingOverride\(\{ key: keyNoc, machineId: m.id, title: day\.toLocaleDateString\('es-ES', \{ day: 'numeric', month: 'long' \}\), shift: 'noche', currentProductId: pIdNoc, currentSpeed: sNoc, inactive: !!overrideNoc\?\.inactive \}\)\}/g;
content = content.replace(dailyClickNocRegex, 'onClick={() => setEditingOverride({ key: keyNoc, machineId: m.id, title: day.toLocaleDateString(\'es-ES\', { day: \'numeric\', month: \'long\' }), shift: \'noche\', currentProductId: pIdNoc, currentSpeed: sNoc, inactive: !!overrideNoc?.inactive, startDate: dateStr, endDate: dateStr })}');

// 3. Update the Dialog to show "Hasta" date picker
// I need to find the place where the product select is and add the date picker above or below it.
const dialogControlsRegex = /<div className="space-y-2">\s*<Label className="text-xs">Producto \/ Presentación<\/Label>/;
const newDialogControls = `                        <div className="grid grid-cols-2 gap-4 pb-2 border-b">
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold text-muted-foreground uppercase">Desde</Label>
                                <div className="h-9 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-xs font-medium flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    {editingOverride?.startDate}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold text-primary uppercase flex items-center gap-1.5">
                                    Hasta <CalendarRange className="h-3 w-3" />
                                </Label>
                                <Input 
                                    type="date" 
                                    value={editingOverride?.endDate || ''} 
                                    onChange={(e) => setEditingOverride(prev => prev ? { ...prev, endDate: e.target.value } : null)}
                                    className="h-9 text-xs font-bold border-primary/30"
                                    min={editingOverride?.startDate}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label className="text-xs">Producto / Presentación</Label>`;

content = content.replace(dialogControlsRegex, newDialogControls);

// 4. Update the "Apply to Both Shifts" logic in the Dialog
// Add a switch for "Aplicar a ambos turnos" (Día y Noche) inside the modal
const applyBothShiftsRegex = /<div className="flex items-center justify-between p-3 bg-muted\/30 rounded-lg border mb-4">[\s\S]*?<\/div>/;
const newShiftControls = `                    <div className="grid grid-cols-1 gap-3 mb-4">
                        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-full", editingOverride?.inactive ? "bg-muted" : "bg-primary/10")}>
                                    {editingOverride?.inactive ? <PowerOff className="h-5 w-5 text-muted-foreground" /> : <Power className="h-5 w-5 text-primary" />}
                                </div>
                                <div>
                                    <Label className="text-sm font-bold">{editingOverride?.inactive ? 'Turno Desactivado' : 'Turno Activo'}</Label>
                                    <p className="text-[10px] text-muted-foreground">Estado del turno {editingOverride?.shift}</p>
                                </div>
                            </div>
                            <Switch checked={!editingOverride?.inactive} onCheckedChange={(val) => setEditingOverride(prev => prev ? { ...prev, inactive: !val } : null)} />
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-primary/10 text-primary">
                                    <ArrowLeftRight className="h-5 w-5" />
                                </div>
                                <div>
                                    <Label className="text-sm font-bold">Aplicar a Día y Noche</Label>
                                    <p className="text-[10px] text-muted-foreground">Configura ambos turnos simultáneamente</p>
                                </div>
                            </div>
                            <Switch checked={!!editingOverride?.applyToBothShifts} onCheckedChange={(val) => setEditingOverride(prev => prev ? { ...prev, applyToBothShifts: val } : null)} />
                        </div>
                    </div>`;

content = content.replace(applyBothShiftsRegex, newShiftControls);

// 5. Update applyEditOverride to handle ranges correctly
// The current applyEditOverride has a conditional for isRange. 
// I'll make it always check for startDate/endDate and if endDate > startDate, use range logic.
const applyEditOverrideLogic = `    const applyEditOverride = () => {
        if (!editingOverride) return;
        const newOverrides = { ...overrides };
        const sync = syncContinuity && editingOverride.shift === 'dia';

        if (editingOverride.startDate && editingOverride.endDate) {
            const start = new Date(editingOverride.startDate + "T12:00:00");
            const end = new Date(editingOverride.endDate + "T12:00:00");
            let curr = new Date(start);
            
            while (curr <= end) {
                const dateStr = curr.toISOString().split('T')[0];
                const baseKey = \`\${editingOverride.machineId}-\${dateStr}\`;
                
                if (editingOverride.shift === 'dia') {
                    newOverrides[\`\${baseKey}-dia\`] = { 
                        productId: editingOverride.currentProductId, 
                        speed: editingOverride.currentSpeed,
                        inactive: editingOverride.inactive
                    };
                    if (sync || editingOverride.applyToBothShifts) {
                        newOverrides[\`\${baseKey}-noche\`] = { 
                            productId: editingOverride.currentProductId, 
                            speed: editingOverride.currentSpeed,
                            inactive: editingOverride.inactive
                        };
                    }
                } else {
                    newOverrides[\`\${baseKey}-noche\`] = { 
                        productId: editingOverride.currentProductId, 
                        speed: editingOverride.currentSpeed,
                        inactive: editingOverride.inactive
                    };
                    if (editingOverride.applyToBothShifts) {
                        newOverrides[\`\${baseKey}-dia\`] = { 
                            productId: editingOverride.currentProductId, 
                            speed: editingOverride.currentSpeed,
                            inactive: editingOverride.inactive
                        };
                    }
                }
                curr.setDate(curr.getDate() + 1);
            }
        } else {
            // Fallback for weekly keys or missing dates
            newOverrides[editingOverride.key] = { 
                productId: editingOverride.currentProductId, 
                speed: editingOverride.currentSpeed,
                inactive: editingOverride.inactive
            };
        }
        
        setOverrides(newOverrides);
        setEditingOverride(null);
    };`;

content = content.replace(/const applyEditOverride = \(\) => \{[\s\S]*?setEditingOverride\(null\);\n\s*\};/, applyEditOverrideLogic);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully moved Range Programming to the cell-click modal.');

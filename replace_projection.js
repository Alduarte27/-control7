const fs = require('fs');
const path = 'c:/Users/Alexander Ayavaca/Desktop/control7/src/components/ia-client.tsx';
let content = fs.readFileSync(path, 'utf8');

const newView = `function ProductionProjectionView({
    onClose,
    machines,
    products,
}: {
    onClose: () => void;
    machines: MachineState[];
    products: ProductDefinition[];
}) {
    const [season, setSeason] = React.useState<'zafra' | 'no-zafra'>('zafra');
    const [zafraStartMonth, setZafraStartMonth] = React.useState<number>(7);
    const [zafraEndMonth, setZafraEndMonth] = React.useState<number>(11);
    
    const [rendimiento, setRendimiento] = React.useState<number>(0.8);
    const [horasPorTurno, setHorasPorTurno] = React.useState<number>(10.5);
    const [turnosPorDia, setTurnosPorDia] = React.useState<number>(2);
    
    const [customDays, setCustomDays] = React.useState<Record<number, number>>({});
    
    // Config of products and speeds per machine
    const [machineConfig, setMachineConfig] = React.useState<Record<number, { active: boolean, productId: string, speed: number }>>({});

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentYear = new Date().getFullYear();

    React.useEffect(() => {
        if (Object.keys(machineConfig).length === 0) {
            const initial: Record<number, { active: boolean, productId: string, speed: number }> = {};
            machines.forEach(m => {
                initial[m.id] = {
                    active: m.isSimulatingActive && m.productId !== 'inactive',
                    productId: m.productId !== 'inactive' ? m.productId : (products[0]?.id || ''),
                    speed: m.speed || 30 // Fallback to 30 if speed is 0
                };
            });
            setMachineConfig(initial);
        }
    }, [machines, products, machineConfig]);

    const isMonthInZafra = (m: number) => {
        if (zafraStartMonth <= zafraEndMonth) {
            return m >= zafraStartMonth && m <= zafraEndMonth;
        } else {
            return m >= zafraStartMonth || m <= zafraEndMonth;
        }
    };

    const generateWeeksGroupedByMonth = () => {
        const grouped: { monthIndex: number; monthName: string; weeks: { weekNum: number; start: Date; end: Date }[] }[] = [];
        
        let d = new Date(currentYear, 0, 1);
        while (d.getDay() !== 1) d.setDate(d.getDate() + 1); // first monday
        let weekNum = 1;
        
        while (d.getFullYear() === currentYear || (d.getFullYear() === currentYear + 1 && d.getMonth() === 0 && d.getDate() < 4)) {
            const start = new Date(d);
            const end = new Date(d);
            end.setDate(end.getDate() + 6);
            
            const midWeek = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
            const mIndex = midWeek.getMonth();
            const isZafra = isMonthInZafra(mIndex);
            
            if ((season === 'zafra' && isZafra) || (season === 'no-zafra' && !isZafra)) {
                let monthGroup = grouped.find(g => g.monthIndex === mIndex);
                if (!monthGroup) {
                    monthGroup = { monthIndex: mIndex, monthName: monthNames[mIndex], weeks: [] };
                    grouped.push(monthGroup);
                }
                monthGroup.weeks.push({ weekNum, start, end });
            }
            
            d.setDate(d.getDate() + 7);
            weekNum++;
        }
        
        grouped.sort((a, b) => {
            if (zafraStartMonth > zafraEndMonth && season === 'zafra') {
                const aIsLate = a.monthIndex >= zafraStartMonth;
                const bIsLate = b.monthIndex >= zafraStartMonth;
                if (aIsLate && !bIsLate) return -1;
                if (!aIsLate && bIsLate) return 1;
            }
            return a.monthIndex - b.monthIndex;
        });
        
        return grouped;
    };

    const groupedWeeks = generateWeeksGroupedByMonth();

    const handleCustomDaysChange = (weekNum: number, value: string) => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0 && num <= 7) {
            setCustomDays(prev => ({ ...prev, [weekNum]: num }));
        } else if (value === '') {
            setCustomDays(prev => ({ ...prev, [weekNum]: NaN }));
        }
    };

    const changeProduct = (id: number, productId: string) => {
        setMachineConfig(prev => ({ ...prev, [id]: { ...prev[id], productId } }));
    };

    const changeSpeed = (id: number, speed: number) => {
        setMachineConfig(prev => ({ ...prev, [id]: { ...prev[id], speed } }));
    };

    const toggleMachine = (id: number) => {
        setMachineConfig(prev => ({ ...prev, [id]: { ...prev[id], active: !prev[id].active } }));
    };

    const renderTable = () => {
        const activeMachines = machines.filter(m => machineConfig[m.id]?.active);
        
        const machineHeaders = activeMachines.map(m => {
            const conf = machineConfig[m.id];
            const prod = products.find(p => p.id === conf?.productId);
            return (
                <th key={m.id} className="px-1 py-2 border-l min-w-[120px] text-center bg-card">
                    <div className="flex flex-col items-center justify-center gap-1">
                        <div className="relative w-12 h-8 bg-white rounded border overflow-hidden">
                            <Image 
                                src={m.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media"} 
                                alt={\`M\${m.id}\`} fill className="object-contain" unoptimized 
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-primary text-[11px] leading-tight">M{m.id} ({conf?.speed || 0} BPM)</span>
                            <span className="text-[9px] text-muted-foreground font-normal whitespace-normal w-24 truncate leading-tight" title={prod?.productName}>
                                {prod?.productName || 'Sin Producto'}
                            </span>
                        </div>
                    </div>
                </th>
            );
        });

        const rows: JSX.Element[] = [];
        let grandTotalMachines: Record<number, number> = {};
        
        activeMachines.forEach(m => grandTotalMachines[m.id] = 0);

        groupedWeeks.forEach((group) => {
            group.weeks.forEach((week, wIndex) => {
                const days = customDays[week.weekNum] !== undefined && !isNaN(customDays[week.weekNum]) 
                    ? customDays[week.weekNum] 
                    : 7;

                const machineCells = activeMachines.map(m => {
                    const conf = machineConfig[m.id];
                    const prod = products.find(p => p.id === conf?.productId);
                    if (!prod || !conf) return <td key={m.id} className="px-1 py-1 border-l text-center text-muted-foreground">-</td>;

                    // Calculation: speed (BPM) * 60 (min/h) * rendimiento * (horas * turnos) * days
                    const effectiveBagsPerHour = (conf.speed * 60) * rendimiento;
                    const hoursPerDay = horasPorTurno * turnosPorDia;
                    const totalBags = effectiveBagsPerHour * hoursPerDay * days;
                    
                    const totalKg = totalBags * (prod.presentationWeight || 50); // Fallback exactly as 50
                    const totalQQ = totalKg / 50;
                    
                    grandTotalMachines[m.id] += totalQQ;

                    return (
                        <td key={m.id} className="px-2 py-1.5 border-l text-center">
                            <div className="font-semibold text-primary text-xs">{totalQQ > 0 ? Math.round(totalQQ).toLocaleString() : '0'} QQ</div>
                            <div className="text-[9px] text-muted-foreground">{totalBags > 0 ? Math.round(totalBags).toLocaleString() : '0'} Unid</div>
                        </td>
                    );
                });

                rows.push(
                    <tr key={week.weekNum} className="border-b hover:bg-muted/30">
                        {wIndex === 0 && (
                            <td rowSpan={group.weeks.length} className="px-2 py-1 text-xs font-medium bg-muted/10 border-r align-top text-center">
                                {group.monthName.substring(0,3)}
                            </td>
                        )}
                        <td className="px-2 py-1 text-xs text-center border-r">{week.weekNum}</td>
                        <td className="px-1 py-1 text-center border-r">
                            <Input 
                                type="number" 
                                value={isNaN(customDays[week.weekNum]) ? '' : (customDays[week.weekNum] ?? 7)} 
                                onChange={(e) => handleCustomDaysChange(week.weekNum, e.target.value)}
                                className="w-12 h-6 text-[10px] mx-auto text-center font-mono bg-background px-1 border-primary/20"
                                step="0.1" min="0" max="7"
                            />
                        </td>
                        {machineCells}
                    </tr>
                );
            });
        });

        const totalsCells = activeMachines.map(m => (
            <td key={m.id} className="px-2 py-2 border-l text-center bg-card border-t border-b">
                <div className="font-bold text-primary text-sm">{Math.round(grandTotalMachines[m.id]).toLocaleString()} QQ</div>
            </td>
        ));

        return (
            <div className="overflow-x-auto rounded-lg border shadow-sm bg-card w-full flex-1 min-h-0 flex flex-col">
                <div className="overflow-y-auto flex-1 h-full max-h-[calc(100vh-140px)]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] uppercase bg-muted text-muted-foreground sticky top-0 z-10 shadow-sm leading-none">
                            <tr>
                                <th className="px-2 py-2 border-r bg-muted w-10 text-center">Mes</th>
                                <th className="px-2 py-2 border-r bg-muted w-12 text-center">Semana</th>
                                <th className="px-2 py-2 border-r bg-muted w-14 text-center">Días</th>
                                {machineHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length > 0 ? rows : (
                                <tr>
                                    <td colSpan={3 + activeMachines.length} className="px-4 py-8 text-center text-muted-foreground text-xs">
                                        No hay semanas en el periodo seleccionado o no hay máquinas activas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] bg-card border-t-2">
                            <tr className="font-bold">
                                <td colSpan={3} className="px-4 py-2 text-right bg-card text-xs uppercase">Total (QQ):</td>
                                {totalsCells}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
            <header className="flex items-center justify-between p-3 border-b bg-card shrink-0 shadow-sm z-10 relative">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={onClose} className="rounded-md hover:bg-muted h-8 px-3">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Volver
                    </Button>
                    <div className="flex flex-col">
                        <h1 className="text-lg font-bold flex items-center gap-2 leading-tight">
                            <Target className="h-4 w-4 text-primary" />
                            Proyección de Producción ({currentYear})
                        </h1>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 p-3 overflow-hidden flex flex-col bg-muted/20">
                <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
                    {/* Left Sidebar: Compact Settings */}
                    <div className="w-full lg:w-64 space-y-3 overflow-y-auto pr-1 custom-scrollbar shrink-0">
                        {/* Compact Config Blocks */}
                        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-muted/50 px-3 py-1.5 border-b font-medium text-xs flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5" /> Temporada
                            </div>
                            <div className="p-2 space-y-2">
                                <div className="flex bg-muted p-0.5 rounded">
                                    <Button variant={season === 'zafra' ? 'default' : 'ghost'} size="sm" className="flex-1 h-6 text-[10px]" onClick={() => setSeason('zafra')}>Zafra</Button>
                                    <Button variant={season === 'no-zafra' ? 'default' : 'ghost'} size="sm" className="flex-1 h-6 text-[10px]" onClick={() => setSeason('no-zafra')}>No Zafra</Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-0.5">
                                        <Label className="text-[9px] text-muted-foreground">Inicio (Mes)</Label>
                                        <Select value={zafraStartMonth.toString()} onValueChange={(val) => setZafraStartMonth(Number(val))}>
                                            <SelectTrigger className="h-6 text-[10px] px-1.5"><SelectValue /></SelectTrigger>
                                            <SelectContent>{monthNames.map((m, i) => <SelectItem key={i} value={i.toString()} className="text-[10px]">{m}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label className="text-[9px] text-muted-foreground">Fin (Mes)</Label>
                                        <Select value={zafraEndMonth.toString()} onValueChange={(val) => setZafraEndMonth(Number(val))}>
                                            <SelectTrigger className="h-6 text-[10px] px-1.5"><SelectValue /></SelectTrigger>
                                            <SelectContent>{monthNames.map((m, i) => <SelectItem key={i} value={i.toString()} className="text-[10px]">{m}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-muted/50 px-3 py-1.5 border-b font-medium text-xs flex items-center gap-1.5">
                                <Settings2 className="h-3.5 w-3.5" /> Parámetros
                            </div>
                            <div className="p-2 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-[10px] font-medium leading-none w-20">Eficiencia</Label>
                                    <Input type="number" value={rendimiento} onChange={(e) => setRendimiento(Number(e.target.value))} className="h-6 text-[10px] w-14 px-1 text-center" step="0.05" min="0.1" />
                                    <span className="text-[9px] font-mono bg-muted px-1 py-0.5 rounded">{(rendimiento * 100).toFixed(0)}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-[10px] font-medium leading-none w-20">Hrs/Turno</Label>
                                    <Input type="number" value={horasPorTurno} onChange={(e) => setHorasPorTurno(Number(e.target.value))} className="h-6 text-[10px] w-14 px-1 text-center" step="0.5" />
                                    <span className="text-[9px] text-muted-foreground w-6 text-right">hrs</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-[10px] font-medium leading-none w-20">Turnos/Día</Label>
                                    <Input type="number" value={turnosPorDia} onChange={(e) => setTurnosPorDia(Number(e.target.value))} className="h-6 text-[10px] w-14 px-1 text-center" min="1" max="3" />
                                    <span className="text-[9px] text-muted-foreground w-6 text-right">u</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-muted/50 px-3 py-1.5 border-b font-medium text-xs flex items-center gap-1.5">
                                <Factory className="h-3.5 w-3.5" /> Envasadoras
                            </div>
                            <div className="p-2 space-y-2">
                                {machines.map(machine => {
                                    const conf = machineConfig[machine.id];
                                    if (!conf) return null;
                                    return (
                                        <div key={machine.id} className={cn("p-2 border rounded text-xs", conf.active ? "bg-primary/5 border-primary/30" : "bg-muted/30 opacity-60")}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <Switch checked={conf.active} onCheckedChange={() => toggleMachine(machine.id)} className="scale-[0.6] origin-left" />
                                                    M{machine.id}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Input type="number" value={conf.speed || ''} onChange={(e) => changeSpeed(machine.id, Number(e.target.value))} className="h-5 w-12 text-[9px] px-1 py-0 text-center" placeholder="BPM" />
                                                    <span className="text-[8px] text-muted-foreground">BPM</span>
                                                </div>
                                            </div>
                                            {conf.active && (
                                                <Select value={conf.productId || ''} onValueChange={(val) => changeProduct(machine.id, val)}>
                                                    <SelectTrigger className="h-6 text-[9px] w-full px-1.5"><SelectValue placeholder="Producto" /></SelectTrigger>
                                                    <SelectContent>
                                                        {products.map(p => (
                                                            <SelectItem key={p.id} value={p.id} className="text-[9px]">{p.productName}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Data Table */}
                    <div className="flex-1 flex flex-col min-w-0 min-h-0">
                        {renderTable()}
                    </div>
                </div>
            </main>
        </div>
    );
}`;

const viewRegex = /function ProductionProjectionView\(\{[\s\S]*?\}\s*\)\s*\{[\s\S]*?return \([\s\S]*?\);\n\}/;
if (viewRegex.test(content)) {
    content = content.replace(viewRegex, newView);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully updated ProductionProjectionView design and added custom speeds.');
} else {
    console.log('ProductionProjectionView not found.');
}

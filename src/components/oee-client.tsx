'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Calendar as CalendarIcon, Activity, X, BarChart, Percent, LineChart, Package, CheckCircle, ShieldCheck, Target, PieChartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { DailyLog, StopData, StopCause, ProductDefinition, MachineLog, TimeSlot, ProductData } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format, addDays, eachDayOfInterval, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import KpiCard from './kpi-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Bar, BarChart as RechartsBarChart, Pie, PieChart as RechartsPieChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';
import { HardHat } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '@/lib/utils';
import OeeExplanation from './oee-explanation';

interface AggregatedStopData {
    name: string;
    totalMinutes: number;
    color: string;
}

type DetailedStopData = StopData & {
  machineId: string;
  logDate: string;
  shift: 'day' | 'night';
}

type StopTypeDistribution = {
    name: 'Planificadas' | 'No Planificadas';
    value: number;
    fill: string;
}

export default function OeeClient({ prefetchedProducts, prefetchedStopCauses }: { prefetchedProducts: ProductDefinition[], prefetchedStopCauses: StopCause[]}) {
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({ from: addDays(new Date(), -7), to: new Date() });
    const [loading, setLoading] = React.useState(false);
    const [machineStops, setMachineStops] = React.useState<{ [machineId: string]: number }>({});
    const [stopsByReason, setStopsByReason] = React.useState<AggregatedStopData[]>([]);
    const [stopTypeDistribution, setStopTypeDistribution] = React.useState<StopTypeDistribution[]>([]);
    
    const [allStopsInRange, setAllStopsInRange] = React.useState<DetailedStopData[]>([]);
    const [selectedReason, setSelectedReason] = React.useState<string | null>(null);
    
    // OEE States
    const [availability, setAvailability] = React.useState(0);
    const [performance, setPerformance] = React.useState(0);
    const [quality, setQuality] = React.useState(0);
    const [oee, setOee] = React.useState(0);

    const { toast } = useToast();

    const handleFetchData = React.useCallback(async () => {
        if (!dateRange?.from || !dateRange?.to) {
            toast({ title: "Error de Fechas", description: "Por favor, selecciona un rango de fechas válido.", variant: "destructive"});
            return;
        }

        setLoading(true);
        setSelectedReason(null);
        // Reset all states
        setOee(0);
        setAvailability(0);
        setPerformance(0);
        setQuality(0);
        setMachineStops({});
        setStopsByReason([]);
        setAllStopsInRange([]);
        setStopTypeDistribution([]);

        const startId = format(dateRange.from, 'yyyy-MM-dd');
        const endId = format(dateRange.to, 'yyyy-MM-dd');
        
        try {
            // 1. Fetch Daily Logs (for stops and availability)
            const logsQuery = query(
                collection(db, 'dailyLogs'),
                where('__name__', '>=', `${startId}_`),
                where('__name__', '<=', `${endId}\uf8ff`)
            );
            
            // 2. Fetch Production Plans (for actual production and performance)
            const daysInInterval = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
            const planIdsToFetch = Array.from(new Set(daysInInterval.map(d => `${format(d, 'yyyy')}-W${format(d, 'w', { locale: es })}`)));

            const [logsSnapshot, plansSnapshot] = await Promise.all([
                getDocs(logsQuery),
                planIdsToFetch.length > 0 ? getDocs(query(collection(db, 'productionPlans'), where('__name__', 'in', planIdsToFetch))) : Promise.resolve({ docs: [] })
            ]);

            if (logsSnapshot.empty) {
                toast({ title: "Sin Datos", description: "No se encontraron registros de bitácora en el rango de fechas seleccionado." });
                setLoading(false);
                return;
            }
            
            const plansMap = new Map(plansSnapshot.docs.map(doc => [doc.id, doc.data().products as ProductData[]]));

            // --- Aggregation Variables ---
            const aggregatedMachineStops: { [machineId: string]: number } = {};
            const aggregatedStopsByReason: { [reason: string]: { totalMinutes: number, color: string } } = {};
            const detailedStops: DetailedStopData[] = [];
            const stopTypes = { planned: 0, unplanned: 0 };
            
            let totalPlannedTime = 0;
            let totalStopTime = 0;
            let totalActualProductionSacks = 0;
            let totalGoodProductionSacks = 0;
            let totalTheoreticalProductionSacks = 0;
            let lastKnownSpeed: { [key: string]: number } = {};

            // --- Process each log within the date range ---
            logsSnapshot.forEach(doc => {
                if (!doc.id.includes('_')) return; 

                const log = doc.data() as DailyLog;
                const [logDate, logShift] = doc.id.split('_');
                const currentDate = new Date(logDate.replace(/-/g, '/')); // Safer date parsing
                
                const planIdForDate = `${format(currentDate, 'yyyy')}-W${format(currentDate, 'w', { locale: es })}`;
                const relevantPlanProducts = plansMap.get(planIdForDate);

                totalPlannedTime += 12 * 60; // Each log represents a 12-hour shift
                
                if (!log.timeSlots || typeof log.timeSlots !== 'object') return;

                // Prime lastKnownSpeed with speeds from the machine definitions for the shift
                Object.entries(log.machines).forEach(([machineId, machineLog]) => {
                    const productDef = prefetchedProducts.find(p => p.id === machineLog.productId);
                    // Let's assume a default speed if not defined anywhere.
                    const theoreticalSpeed = 40; // Example: 40 bags/min
                    lastKnownSpeed[machineId] = theoreticalSpeed;
                });

                Object.entries(log.timeSlots).forEach(([time, slotData]) => {
                    if (!slotData || typeof slotData !== 'object') return;

                    Object.entries(slotData).forEach(([key, value]) => {
                        if (key.startsWith('machine_') && value && typeof value === 'object') {
                            const machineId = key;
                            const machineData = value as TimeSlot['machine_1'];
                            
                            // Update speed from the time slot if available
                            if (typeof machineData.speed === 'number' && machineData.speed > 0) {
                                lastKnownSpeed[machineId] = machineData.speed;
                            }
                            
                            let timeSlotStopTime = 0;
                            if ('stops' in machineData && Array.isArray(machineData.stops)) {
                                machineData.stops.forEach(stop => {
                                    const duration = stop.duration || 0;
                                    totalStopTime += duration;
                                    timeSlotStopTime += duration;
                                    
                                    if(stop.type === 'planned') {
                                        stopTypes.planned += duration;
                                    } else {
                                        stopTypes.unplanned += duration;
                                    }

                                    if (!aggregatedMachineStops[machineId]) aggregatedMachineStops[machineId] = 0;
                                    aggregatedMachineStops[machineId] += duration;

                                    if (stop.reason) {
                                        const causeConfig = prefetchedStopCauses.find(c => c.name === stop.reason);
                                        if (!aggregatedStopsByReason[stop.reason]) {
                                            aggregatedStopsByReason[stop.reason] = {
                                                totalMinutes: 0,
                                                color: causeConfig?.color || '#8884d8'
                                            };
                                        }
                                        aggregatedStopsByReason[stop.reason].totalMinutes += duration;
                                    }
                                    
                                    detailedStops.push({
                                        ...stop,
                                        machineId: machineId.replace('machine_', 'Máquina '),
                                        logDate: logDate,
                                        shift: logShift as 'day' | 'night',
                                    });
                                });
                            }
                            
                            // Performance Calculation
                            const runTimeInMinutes = 30 - timeSlotStopTime;
                            if (runTimeInMinutes > 0 && lastKnownSpeed[machineId] > 0) {
                                const theoreticalSacksInSlot = (lastKnownSpeed[machineId]) * runTimeInMinutes;
                                totalTheoreticalProductionSacks += theoreticalSacksInSlot;
                            }
                        }
                    });
                });

                // Get actual production from the production plan for the corresponding day and shift
                if (relevantPlanProducts) {
                    const dayOfWeek = (currentDate.getDay() + 6) % 7; // 0=Mon, 1=Tue, ...
                    const dayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][dayOfWeek];
                    
                    relevantPlanProducts.forEach(product => {
                        const shiftProduction = product.actual[dayKey as keyof typeof product.actual]?.[logShift as 'day' | 'night'] || 0;
                        totalActualProductionSacks += shiftProduction;
                        
                        // Quality Calculation: Add to "good" production if name doesn't include "PB"
                        if (!product.productName.includes('PB')) {
                            totalGoodProductionSacks += shiftProduction;
                        }
                    });
                }
            });

            // --- Final OEE Calculations ---
            const runTime = totalPlannedTime > totalStopTime ? totalPlannedTime - totalStopTime : 0;
            const finalAvailability = totalPlannedTime > 0 ? (runTime / totalPlannedTime) * 100 : 0;
            const finalPerformance = totalTheoreticalProductionSacks > 0 ? (totalActualProductionSacks / totalTheoreticalProductionSacks) * 100 : 0;
            const finalQuality = totalActualProductionSacks > 0 ? (totalGoodProductionSacks / totalActualProductionSacks) * 100 : 0;
            const finalOee = (finalAvailability / 100) * (finalPerformance / 100) * (finalQuality / 100) * 100;
            
            setAvailability(finalAvailability);
            setPerformance(finalPerformance);
            setQuality(finalQuality);
            setOee(finalOee);
            
            // --- Set State for Charts and Tables ---
            setMachineStops(aggregatedMachineStops);
            setAllStopsInRange(detailedStops);
            setStopTypeDistribution([
                { name: 'Planificadas', value: stopTypes.planned, fill: 'hsl(var(--chart-2))' },
                { name: 'No Planificadas', value: stopTypes.unplanned, fill: 'hsl(var(--chart-5))' },
            ]);

            const reasonData = Object.entries(aggregatedStopsByReason).map(([reason, data]) => ({
                name: reason,
                totalMinutes: data.totalMinutes,
                color: data.color,
            })).sort((a,b) => b.totalMinutes - a.totalMinutes);

            setStopsByReason(reasonData);

        } catch (error) {
            console.error("Error fetching OEE data:", error);
            toast({ title: "Error", description: "No se pudieron cargar los datos para el análisis.", variant: "destructive"});
        } finally {
            setLoading(false);
        }
    }, [dateRange, prefetchedStopCauses, prefetchedProducts, toast]);
    
    React.useEffect(() => {
        handleFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleBarClick = (data: any) => {
        if (data && data.activePayload && data.activePayload.length > 0) {
            const reason = data.activePayload[0].payload.name;
            setSelectedReason(prev => prev === reason ? null : reason);
        }
    };

    const filteredStopsForTable = React.useMemo(() => {
        if (!selectedReason) return [];
        return allStopsInRange.filter(stop => stop.reason === selectedReason).sort((a,b) => b.duration - a.duration);
    }, [selectedReason, allStopsInRange]);

    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Activity className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Análisis de Paradas y OEE</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/stops">
                        <Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver a la Bitácora</Button>
                    </Link>
                </div>
            </header>
            <main className="p-4 md:p-6 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Filtros de Análisis</CardTitle>
                        <CardDescription>Selecciona el rango de fechas para analizar las paradas registradas y calcular el OEE.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col md:flex-row items-center gap-4">
                        <div className="grid gap-2">
                            <Label>Rango de Fechas</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className="w-[300px] justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                                                    {format(dateRange.to, "LLL dd, y", { locale: es })}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y", { locale: es })
                                            )
                                        ) : (
                                            <span>Elige un rango</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={2}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Button onClick={handleFetchData} disabled={loading} className="mt-auto">
                            {loading ? 'Analizando...' : 'Analizar Datos'}
                        </Button>
                    </CardContent>
                </Card>

                 {loading ? <p className="text-center pt-8">Cargando datos de análisis...</p> : (
                    <div className='space-y-6'>
                        <OeeExplanation />

                         <Card>
                             <CardHeader>
                                <CardTitle>Indicadores OEE (Overall Equipment Effectiveness)</CardTitle>
                                <CardDescription>Eficiencia general del equipo en el período seleccionado.</CardDescription>
                            </CardHeader>
                             <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <KpiCard title="Disponibilidad" value={`${availability.toFixed(1)}%`} icon={CheckCircle} description="Porcentaje del tiempo planificado que el equipo estuvo realmente en producción." />
                                <KpiCard title="Rendimiento" value={`${performance.toFixed(1)}%`} icon={Target} description="Velocidad de producción como un porcentaje de su capacidad máxima teórica." />
                                <KpiCard title="Calidad" value={`${quality.toFixed(1)}%`} icon={ShieldCheck} description="Porcentaje de productos que cumplen con los estándares de calidad (productos 'PB' se consideran no conformes)." />
                                <KpiCard title="OEE General" value={`${oee.toFixed(1)}%`} icon={BarChart} description="Métrica global que combina Disponibilidad, Rendimiento y Calidad." valueColor={oee > 85 ? 'text-green-600' : oee > 60 ? 'text-yellow-600' : 'text-destructive'}/>
                             </CardContent>
                         </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Total de Tiempo de Parada por Máquina</CardTitle>
                                    <CardDescription>Suma de todos los minutos de parada para cada máquina en el período seleccionado.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.keys(machineStops).length > 0 ? (
                                        Object.entries(machineStops).map(([machineId, minutes]) => (
                                            <KpiCard
                                                key={machineId}
                                                title={`Máquina ${machineId.split('_')[1]}`}
                                                value={`${Math.floor(minutes / 60)}h ${minutes % 60}m`}
                                                subValue={`${minutes.toLocaleString()} minutos totales`}
                                                icon={HardHat}
                                                description="Tiempo total que esta máquina estuvo detenida."
                                            />
                                        ))
                                    ) : (
                                        <p className="col-span-full text-center text-muted-foreground py-8">No se encontraron datos de paradas para este rango.</p>
                                    )}
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader>
                                    <CardTitle>Distribución de Paradas</CardTitle>
                                    <CardDescription>Proporción del tiempo de parada total clasificado como planificado vs. no planificado.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {stopTypeDistribution.some(d => d.value > 0) ? (
                                        <ChartContainer config={{}} className="w-full h-[250px]">
                                            <RechartsPieChart>
                                                <RechartsTooltip 
                                                  formatter={(value, name) => [`${value} min`, name]}
                                                />
                                                <Legend />
                                                <Pie
                                                    data={stopTypeDistribution}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                                                >
                                                    {stopTypeDistribution.map((entry) => (
                                                        <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                            </RechartsPieChart>
                                        </ChartContainer>
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8">No hay datos de paradas para mostrar.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>


                        <Card>
                            <CardHeader>
                                <CardTitle>Desglose de Paradas por Motivo</CardTitle>
                                <CardDescription>Tiempo total de parada (en minutos) agrupado por el motivo registrado. Haz clic en una barra para ver detalles.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {stopsByReason.length > 0 ? (
                                    <ChartContainer config={{}} className="w-full h-[400px]">
                                        <ResponsiveContainer>
                                            <RechartsBarChart layout="vertical" data={stopsByReason} margin={{ left: 100 }} onClick={handleBarClick}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" />
                                                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} interval={0}/>
                                                <RechartsTooltip
                                                    cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }}
                                                    content={<ChartTooltipContent />}
                                                />
                                                <Legend />
                                                <Bar dataKey="totalMinutes" name="Minutos" radius={[0, 4, 4, 0]} cursor="pointer">
                                                    {stopsByReason.map((entry) => (
                                                        <Cell key={`cell-${entry.name}`} fill={entry.color}
                                                          className={cn(selectedReason && selectedReason !== entry.name && "opacity-30", "transition-opacity")}
                                                        />
                                                    ))}
                                                </Bar>
                                            </RechartsBarChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                ) : (
                                        <p className="col-span-full text-center text-muted-foreground py-8">No se encontraron datos de paradas para este rango.</p>
                                )}
                            </CardContent>
                        </Card>

                         {selectedReason && (
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle>Detalle de Paradas por: "{selectedReason}"</CardTitle>
                                            <CardDescription>Mostrando {filteredStopsForTable.length} eventos de parada.</CardDescription>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedReason(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="max-h-[500px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Turno</TableHead>
                                                    <TableHead>Máquina</TableHead>
                                                    <TableHead>Hora Inicio</TableHead>
                                                    <TableHead>Hora Fin</TableHead>
                                                    <TableHead className="text-right">Duración (min)</TableHead>
                                                    <TableHead>Causa Específica</TableHead>
                                                    <TableHead>Solución</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredStopsForTable.length > 0 ? filteredStopsForTable.map(stop => (
                                                    <TableRow key={stop.id}>
                                                        <TableCell>{stop.logDate}</TableCell>
                                                        <TableCell className="capitalize">{stop.shift === 'day' ? 'Día' : 'Noche'}</TableCell>
                                                        <TableCell>{stop.machineId}</TableCell>
                                                        <TableCell>{stop.startTime}</TableCell>
                                                        <TableCell>{stop.endTime}</TableCell>
                                                        <TableCell className="text-right font-medium">{stop.duration}</TableCell>
                                                        <TableCell>{stop.cause || '-'}</TableCell>
                                                        <TableCell>{stop.solution || '-'}</TableCell>
                                                    </TableRow>
                                                )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={8} className="text-center">No hay paradas para mostrar.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                 )}
            </main>
        </div>
    );
}

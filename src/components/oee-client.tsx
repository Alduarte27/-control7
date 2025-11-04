'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Calendar as CalendarIcon, Activity, X, BarChart, Percent, LineChart, TrendingUp, TrendingDown, Target, CheckCircle, ShieldCheck, PieChartIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { DailyLog, StopData, StopCause, ProductDefinition, MachineLog, TimeSlot, ProductData } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Bar, BarChart as RechartsBarChart, Pie, PieChart as RechartsPieChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend, Line, LineChart as RechartsLineChart } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '@/lib/utils';
import OeeExplanation from './oee-explanation';
import OeeGauge from './oee-gauge';

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

type WeeklyKpiData = {
    week: string;
    oee: number;
    availability: number;
    performance: number;
    quality: number;
}


export default function OeeClient({ prefetchedProducts, prefetchedStopCauses }: { prefetchedProducts: ProductDefinition[], prefetchedStopCauses: StopCause[]}) {
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({ from: addDays(new Date(), -28), to: new Date() });
    const [loading, setLoading] = React.useState(false);
    const [machineStops, setMachineStops] = React.useState<{ name: string, minutes: number }[]>([]);
    const [stopsByReason, setStopsByReason] = React.useState<AggregatedStopData[]>([]);
    const [stopTypeDistribution, setStopTypeDistribution] = React.useState<StopTypeDistribution[]>([]);
    
    const [allStopsInRange, setAllStopsInRange] = React.useState<DetailedStopData[]>([]);
    const [selectedReason, setSelectedReason] = React.useState<string | null>(null);
    
    // OEE States
    const [availability, setAvailability] = React.useState(0);
    const [performance, setPerformance] = React.useState(0);
    const [quality, setQuality] = React.useState(0);
    const [oee, setOee] = React.useState(0);
    const [weeklyKpis, setWeeklyKpis] = React.useState<WeeklyKpiData[]>([]);


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
        setMachineStops([]);
        setStopsByReason([]);
        setAllStopsInRange([]);
        setStopTypeDistribution([]);
        setWeeklyKpis([]);

        const startId = format(dateRange.from, 'yyyy-MM-dd');
        const endId = format(dateRange.to, 'yyyy-MM-dd');
        
        try {
            const logsQuery = query(
                collection(db, 'dailyLogs'),
                where('__name__', '>=', `${startId}_`),
                where('__name__', '<=', `${endId}\uf8ff`)
            );
            
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
            const weeklyData: { [weekId: string]: { logs: DailyLog[], planProducts: ProductData[] } } = {};

            logsSnapshot.forEach(doc => {
                const log = doc.data() as DailyLog;
                const logDate = new Date(doc.id.split('_')[0].replace(/-/g, '/'));
                const weekId = `${format(logDate, 'yyyy')}-W${format(logDate, 'w', { locale: es })}`;
                if (!weeklyData[weekId]) {
                    weeklyData[weekId] = { logs: [], planProducts: plansMap.get(weekId) || [] };
                }
                weeklyData[weekId].logs.push(log);
            });

            // --- Aggregation Variables ---
            const aggregatedMachineStops: { [machineId: string]: number } = {};
            const aggregatedStopsByReason: { [reason: string]: { totalMinutes: number, color: string } } = {};
            const detailedStops: DetailedStopData[] = [];
            const stopTypes = { planned: 0, unplanned: 0 };
            
            let grandTotalPlannedTime = 0;
            let grandTotalStopTime = 0;
            let grandTotalActualProductionSacks = 0;
            let grandTotalGoodProductionSacks = 0;
            let grandTotalTheoreticalProductionSacks = 0;
            
            const weeklyKpiResults: WeeklyKpiData[] = [];

            for (const weekId of Object.keys(weeklyData).sort()) {
                const { logs, planProducts } = weeklyData[weekId];
                let weeklyTotalPlannedTime = 0;
                let weeklyTotalStopTime = 0;
                let weeklyTotalActualProductionSacks = 0;
                let weeklyTotalGoodProductionSacks = 0;
                let weeklyTotalTheoreticalProductionSacks = 0;

                logs.forEach(log => {
                    const [logDate, logShift] = log.id.split('_');
                    const currentDate = new Date(logDate.replace(/-/g, '/'));
                    
                    weeklyTotalPlannedTime += 12 * 60;
                    
                    if (!log.timeSlots || typeof log.timeSlots !== 'object') return;

                    let lastKnownSpeed: { [key: string]: number } = {};
                    Object.entries(log.machines).forEach(([machineId, machineLog]) => {
                        const productDef = prefetchedProducts.find(p => p.id === machineLog.productId);
                        lastKnownSpeed[machineId] = productDef?.presentationWeight === 0.5 ? 60 : 40;
                    });

                    Object.entries(log.timeSlots).forEach(([time, slotData]) => {
                        if (!slotData || typeof slotData !== 'object') return;

                        Object.entries(slotData).forEach(([key, value]) => {
                            if (key.startsWith('machine_') && value && typeof value === 'object') {
                                const machineId = key;
                                const machineData = value as TimeSlot['machine_1'];
                                
                                if (typeof machineData.speed === 'number' && machineData.speed > 0) {
                                    lastKnownSpeed[machineId] = machineData.speed;
                                }
                                
                                let timeSlotStopTime = 0;
                                if ('stops' in machineData && Array.isArray(machineData.stops)) {
                                    machineData.stops.forEach(stop => {
                                        const duration = stop.duration || 0;
                                        weeklyTotalStopTime += duration;
                                        timeSlotStopTime += duration;
                                        
                                        if(stop.type === 'planned') stopTypes.planned += duration;
                                        else stopTypes.unplanned += duration;

                                        if (!aggregatedMachineStops[machineId]) aggregatedMachineStops[machineId] = 0;
                                        aggregatedMachineStops[machineId] += duration;

                                        if (stop.reason) {
                                            const causeConfig = prefetchedStopCauses.find(c => c.name === stop.reason);
                                            if (!aggregatedStopsByReason[stop.reason]) {
                                                aggregatedStopsByReason[stop.reason] = { totalMinutes: 0, color: causeConfig?.color || '#8884d8' };
                                            }
                                            aggregatedStopsByReason[stop.reason].totalMinutes += duration;
                                        }
                                        
                                        detailedStops.push({ ...stop, machineId: machineId.replace('machine_', 'Máquina '), logDate, shift: logShift as 'day' | 'night' });
                                    });
                                }
                                
                                const runTimeInMinutes = 30 - timeSlotStopTime;
                                if (runTimeInMinutes > 0 && lastKnownSpeed[machineId] > 0) {
                                    weeklyTotalTheoreticalProductionSacks += lastKnownSpeed[machineId] * runTimeInMinutes;
                                }
                            }
                        });
                    });

                    if (planProducts) {
                        const dayOfWeek = (currentDate.getDay() + 6) % 7;
                        const dayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][dayOfWeek];
                        
                        planProducts.forEach(product => {
                            const shiftProduction = product.actual[dayKey as keyof typeof product.actual]?.[logShift as 'day' | 'night'] || 0;
                            weeklyTotalActualProductionSacks += shiftProduction;
                            if (!product.productName.toLowerCase().includes('pb')) {
                                weeklyTotalGoodProductionSacks += shiftProduction;
                            }
                        });
                    }
                });

                grandTotalPlannedTime += weeklyTotalPlannedTime;
                grandTotalStopTime += weeklyTotalStopTime;
                grandTotalActualProductionSacks += weeklyTotalActualProductionSacks;
                grandTotalGoodProductionSacks += weeklyTotalGoodProductionSacks;
                grandTotalTheoreticalProductionSacks += weeklyTotalTheoreticalProductionSacks;
                
                const weeklyRunTime = weeklyTotalPlannedTime > weeklyTotalStopTime ? weeklyTotalPlannedTime - weeklyTotalStopTime : 0;
                const weeklyAvailability = weeklyTotalPlannedTime > 0 ? (weeklyRunTime / weeklyTotalPlannedTime) * 100 : 0;
                const weeklyPerformance = weeklyTotalTheoreticalProductionSacks > 0 ? (weeklyTotalActualProductionSacks / weeklyTotalTheoreticalProductionSacks) * 100 : 0;
                const weeklyQuality = weeklyTotalActualProductionSacks > 0 ? (weeklyTotalGoodProductionSacks / weeklyTotalActualProductionSacks) * 100 : 0;
                const weeklyOee = (weeklyAvailability / 100) * (weeklyPerformance / 100) * (weeklyQuality / 100) * 100;
                
                weeklyKpiResults.push({
                    week: weekId.split('-W')[1],
                    oee: weeklyOee,
                    availability: weeklyAvailability,
                    performance: weeklyPerformance,
                    quality: weeklyQuality,
                });
            }


            // --- Final Grand Total OEE Calculations ---
            const grandTotalRunTime = grandTotalPlannedTime > grandTotalStopTime ? grandTotalPlannedTime - grandTotalStopTime : 0;
            const finalAvailability = grandTotalPlannedTime > 0 ? (grandTotalRunTime / grandTotalPlannedTime) * 100 : 0;
            const finalPerformance = grandTotalTheoreticalProductionSacks > 0 ? (grandTotalActualProductionSacks / grandTotalTheoreticalProductionSacks) * 100 : 0;
            const finalQuality = grandTotalActualProductionSacks > 0 ? (grandTotalGoodProductionSacks / grandTotalActualProductionSacks) * 100 : 0;
            const finalOee = (finalAvailability / 100) * (finalPerformance / 100) * (finalQuality / 100) * 100;
            
            setAvailability(finalAvailability);
            setPerformance(finalPerformance);
            setQuality(finalQuality);
            setOee(finalOee);
            
            // --- Set State for Charts and Tables ---
            setAllStopsInRange(detailedStops);
            setStopTypeDistribution([
                { name: 'Planificadas', value: stopTypes.planned, fill: 'hsl(var(--chart-2))' },
                { name: 'No Planificadas', value: stopTypes.unplanned, fill: 'hsl(var(--chart-5))' },
            ]);

            const reasonData = Object.entries(aggregatedStopsByReason).map(([reason, data]) => ({ name: reason, totalMinutes: data.totalMinutes, color: data.color })).sort((a,b) => b.totalMinutes - a.totalMinutes);
            setStopsByReason(reasonData);
            
            const machineStopsDataForChart = Object.entries(aggregatedMachineStops).map(([machineId, minutes]) => ({ name: `Máquina ${machineId.split('_')[1]}`, minutes })).sort((a, b) => b.minutes - a.minutes);
            setMachineStops(machineStopsDataForChart);
            setWeeklyKpis(weeklyKpiResults);

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

    const getOeeColor = (label: string, value: number): string => {
        const thresholds = {
            'OEE General': { red: 60, yellow: 80 },
            'Disponibilidad': { red: 85, yellow: 95 },
            'Rendimiento': { red: 85, yellow: 95 },
            'Calidad': { red: 95, yellow: 98 },
        };
        const limits = thresholds[label as keyof typeof thresholds] || thresholds.Disponibilidad;
        
        if (value < limits.red) return 'hsl(var(--destructive))';
        if (value < limits.yellow) return 'hsl(var(--chart-4))';
        return 'hsl(var(--chart-2))';
    }

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

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <OeeGauge label="Disponibilidad" value={availability} color={getOeeColor("Disponibilidad", availability)} icon={CheckCircle} description="Porcentaje del tiempo planificado que el equipo estuvo realmente en producción." />
                            <OeeGauge label="Rendimiento" value={performance} color={getOeeColor("Rendimiento", performance)} icon={Target} description="Velocidad de producción como un porcentaje de su capacidad máxima teórica." />
                            <OeeGauge label="Calidad" value={quality} color={getOeeColor("Calidad", quality)} icon={ShieldCheck} description="Porcentaje de productos que cumplen con los estándares de calidad (productos 'PB' se consideran no conformes)." />
                            <OeeGauge label="OEE General" value={oee} color={getOeeColor("OEE General", oee)} icon={BarChart} description="Métrica global que combina Disponibilidad, Rendimiento y Calidad." isPrimary />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                           <Card>
                                <CardHeader>
                                    <CardTitle>Total de Tiempo de Parada por Máquina</CardTitle>
                                    <CardDescription>Suma de todos los minutos de parada para cada máquina en el período seleccionado.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {machineStops.length > 0 ? (
                                        <ChartContainer config={{}} className="w-full h-[250px]">
                                            <RechartsBarChart layout="vertical" data={machineStops} margin={{ right: 20 }}>
                                                <CartesianGrid horizontal={false} />
                                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} />
                                                <XAxis type="number" dataKey="minutes" />
                                                <RechartsTooltip 
                                                    cursor={{ fill: 'rgba(200, 200, 200, 0.1)'}}
                                                    formatter={(value: number) => [`${Math.floor(value / 60)}h ${value % 60}m`, "Tiempo de Parada"]}
                                                />
                                                <Bar dataKey="minutes" name="Minutos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                            </RechartsBarChart>
                                        </ChartContainer>
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
                                <CardTitle>Tendencia de KPIs de OEE por Semana</CardTitle>
                                <CardDescription>Evolución de los indicadores de OEE a lo largo de las semanas en el período seleccionado.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {weeklyKpis.length > 1 ? (
                                    <ChartContainer config={{}} className="w-full h-[300px]">
                                        <RechartsLineChart data={weeklyKpis}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="week" name="Semana" tickFormatter={(val) => `S${val}`} />
                                            <YAxis unit="%" />
                                            <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                                            <Legend />
                                            <Line type="monotone" dataKey="oee" name="OEE" stroke="hsl(var(--chart-4))" strokeWidth={2} />
                                            <Line type="monotone" dataKey="availability" name="Disponibilidad" stroke="hsl(var(--chart-1))" />
                                            <Line type="monotone" dataKey="performance" name="Rendimiento" stroke="hsl(var(--chart-2))" />
                                            <Line type="monotone" dataKey="quality" name="Calidad" stroke="hsl(var(--chart-3))" />
                                        </RechartsLineChart>
                                    </ChartContainer>
                                ) : (
                                    <p className="text-center text-muted-foreground py-8">Se necesitan datos de al menos dos semanas para mostrar una tendencia.</p>
                                )}
                            </CardContent>
                        </Card>


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

'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Calendar as CalendarIcon, Activity, X, BarChart, Percent, LineChart, Package, CheckCircle, ShieldCheck, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { DailyLog, StopData, StopCause, ProductDefinition, MachineLog } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import KpiCard from './kpi-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';
import { HardHat } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '@/lib/utils';

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

export default function OeeClient({ prefetchedProducts, prefetchedStopCauses }: { prefetchedProducts: ProductDefinition[], prefetchedStopCauses: StopCause[]}) {
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({ from: addDays(new Date(), -7), to: new Date() });
    const [loading, setLoading] = React.useState(false);
    const [machineStops, setMachineStops] = React.useState<{ [machineId: string]: number }>({});
    const [stopsByReason, setStopsByReason] = React.useState<AggregatedStopData[]>([]);
    
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
        setOee(0);
        setAvailability(0);
        setPerformance(0);
        setQuality(0);


        const startId = format(dateRange.from, 'yyyy-MM-dd');
        const endId = format(dateRange.to, 'yyyy-MM-dd');
        
        try {
            const logsQuery = query(
                collection(db, 'dailyLogs'),
                where('__name__', '>=', `${startId}_`),
                where('__name__', '<=', `${endId}\uf8ff`)
            );

            const querySnapshot = await getDocs(logsQuery);
            if (querySnapshot.empty) {
                toast({ title: "Sin Datos", description: "No se encontraron registros de bitácora en el rango de fechas seleccionado." });
                setMachineStops({});
                setStopsByReason([]);
                setAllStopsInRange([]);
                setLoading(false);
                return;
            }
            
            const aggregatedMachineStops: { [machineId: string]: number } = {};
            const aggregatedStopsByReason: { [reason: string]: { totalMinutes: number, color: string } } = {};
            const detailedStops: DetailedStopData[] = [];

            let totalPlannedTime = 0;
            let totalStopTime = 0;
            let totalProduction = 0; // In bags
            let theoreticalTotalProduction = 0; // In bags


            querySnapshot.forEach(doc => {
                // Ensure document ID has the correct format
                if (!doc.id.includes('_')) return;

                const log = doc.data() as DailyLog;
                const [logDate, logShift] = doc.id.split('_');

                totalPlannedTime += 12 * 60; // Each log represents a 12-hour shift

                if (!log.timeSlots || typeof log.timeSlots !== 'object') return;

                Object.values(log.timeSlots).forEach(slot => {
                    if (!slot || typeof slot !== 'object') return;
                    
                    Object.entries(slot).forEach(([key, machineData]) => {
                        if (key.startsWith('machine_') && machineData && typeof machineData === 'object') {
                            const machineId = key;
                            
                            // Process Stops
                            if ('stops' in machineData && Array.isArray(machineData.stops)) {
                                (machineData.stops as StopData[]).forEach(stop => {
                                    const duration = stop.duration || 0;
                                    totalStopTime += duration;

                                    if (!aggregatedMachineStops[machineId]) {
                                        aggregatedMachineStops[machineId] = 0;
                                    }
                                    aggregatedMachineStops[machineId] += duration;

                                    if (stop.reason) {
                                        if (!aggregatedStopsByReason[stop.reason]) {
                                            const causeConfig = prefetchedStopCauses.find(c => c.name === stop.reason);
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

                            // Process Production for Performance calculation
                            if ('weight' in machineData && machineData.weight) {
                                 const machineInfo: MachineLog | undefined = log.machines[machineId];
                                 const bagsProduced = 1; // Assuming weight is per bag
                                 totalProduction += bagsProduced;

                                 if (machineInfo && machineInfo.theoreticalPerformance) {
                                     const idealTimePerBag = 60 / machineInfo.theoreticalPerformance; // in minutes
                                     theoreticalTotalProduction += idealTimePerBag;
                                 }
                            }
                        }
                    });
                });
            });

            // OEE Calculations
            const runTime = totalPlannedTime > totalStopTime ? totalPlannedTime - totalStopTime : 0;
            
            const finalAvailability = totalPlannedTime > 0 ? (runTime / totalPlannedTime) * 100 : 0;
            const finalPerformance = runTime > 0 && theoreticalTotalProduction > 0 ? (theoreticalTotalProduction / runTime) * 100 : 0;
            const finalQuality = 100; // Assuming 100% quality for now
            const finalOee = (finalAvailability / 100) * (finalPerformance / 100) * (finalQuality / 100) * 100;

            setAvailability(finalAvailability);
            setPerformance(finalPerformance);
            setQuality(finalQuality);
            setOee(finalOee);


            setMachineStops(aggregatedMachineStops);
            setAllStopsInRange(detailedStops);

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
    }, [dateRange, prefetchedStopCauses, toast]);
    
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
                         <Card>
                             <CardHeader>
                                <CardTitle>Indicadores OEE (Overall Equipment Effectiveness)</CardTitle>
                                <CardDescription>Eficiencia general del equipo en el período seleccionado.</CardDescription>
                            </CardHeader>
                             <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <KpiCard title="Disponibilidad" value={`${availability.toFixed(1)}%`} icon={CheckCircle} description="Porcentaje del tiempo planificado que el equipo estuvo realmente en producción." />
                                <KpiCard title="Rendimiento" value={`${performance.toFixed(1)}%`} icon={Target} description="Velocidad de producción como un porcentaje de su capacidad máxima teórica." />
                                <KpiCard title="Calidad" value={`${quality.toFixed(1)}%`} icon={ShieldCheck} description="Porcentaje de productos que cumplen con los estándares de calidad (actualmente 100% asumido)." />
                                <KpiCard title="OEE General" value={`${oee.toFixed(1)}%`} icon={BarChart} description="Métrica global que combina Disponibilidad, Rendimiento y Calidad." valueColor={oee > 85 ? 'text-green-600' : oee > 60 ? 'text-yellow-600' : 'text-destructive'}/>
                             </CardContent>
                         </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Total de Tiempo de Parada por Máquina</CardTitle>
                                <CardDescription>Suma de todos los minutos de parada para cada máquina en el período seleccionado.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

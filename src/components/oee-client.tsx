'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Calendar as CalendarIcon, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { DailyLog, StopData, StopCause, ProductDefinition } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import KpiCard from './kpi-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';
import { HardHat } from 'lucide-react';

interface AggregatedStopData {
    name: string;
    totalMinutes: number;
    color: string;
}

export default function OeeClient({ prefetchedProducts, prefetchedStopCauses }: { prefetchedProducts: ProductDefinition[], prefetchedStopCauses: StopCause[]}) {
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({ from: addDays(new Date(), -7), to: new Date() });
    const [loading, setLoading] = React.useState(false);
    const [machineStops, setMachineStops] = React.useState<{ [machineId: string]: number }>({});
    const [stopsByReason, setStopsByReason] = React.useState<AggregatedStopData[]>([]);
    const { toast } = useToast();

    const handleFetchData = React.useCallback(async () => {
        if (!dateRange?.from || !dateRange?.to) {
            toast({ title: "Error de Fechas", description: "Por favor, selecciona un rango de fechas válido.", variant: "destructive"});
            return;
        }

        setLoading(true);
        const startId = format(dateRange.from, 'yyyy-MM-dd');
        // To include the end date, we need to query up to the next day or use a string that's lexicographically after all possible shift suffixes.
        // For '2024-07-28', we want to include '2024-07-28_day' and '2024-07-28_night'.
        // A simple way is to get the day after the end date and use '<'.
        const endIdBoundary = format(addDays(dateRange.to, 1), 'yyyy-MM-dd');

        const aggregatedMachineStops: { [machineId: string]: number } = {};
        const aggregatedStopsByReason: { [reason: string]: { totalMinutes: number, color: string } } = {};

        try {
            const logsQuery = query(
                collection(db, 'dailyLogs'),
                where('__name__', '>=', startId),
                where('__name__', '<', endIdBoundary)
            );
            const querySnapshot = await getDocs(logsQuery);

            querySnapshot.forEach(doc => {
                const log = doc.data() as DailyLog;
                if (!log.timeSlots || typeof log.timeSlots !== 'object') return;

                Object.values(log.timeSlots).forEach(slot => {
                    if (!slot || typeof slot !== 'object') return;
                    
                    Object.entries(slot).forEach(([key, value]) => {
                        if (key.startsWith('machine_') && value && typeof value === 'object' && 'stops' in value && Array.isArray(value.stops)) {
                            const machineId = key;
                            (value.stops as StopData[]).forEach(stop => {
                                if (!aggregatedMachineStops[machineId]) {
                                    aggregatedMachineStops[machineId] = 0;
                                }
                                aggregatedMachineStops[machineId] += stop.duration;

                                if (stop.reason) {
                                    if (!aggregatedStopsByReason[stop.reason]) {
                                        const causeConfig = prefetchedStopCauses.find(c => c.name === stop.reason);
                                        aggregatedStopsByReason[stop.reason] = {
                                            totalMinutes: 0,
                                            color: causeConfig?.color || '#8884d8'
                                        };
                                    }
                                    aggregatedStopsByReason[stop.reason].totalMinutes += stop.duration;
                                }
                            });
                        }
                    });
                });
            });

            setMachineStops(aggregatedMachineStops);

            const reasonData = Object.entries(aggregatedStopsByReason).map(([reason, data]) => ({
                name: reason,
                totalMinutes: data.totalMinutes,
                color: data.color,
            })).sort((a,b) => b.totalMinutes - a.totalMinutes);

            setStopsByReason(reasonData);
            
            if (querySnapshot.empty) {
              toast({ title: "Sin Datos", description: "No se encontraron registros de bitácora en el rango de fechas seleccionado."})
            }

        } catch (error) {
            console.error("Error fetching OEE data:", error);
            toast({ title: "Error", description: "No se pudieron cargar los datos para el análisis.", variant: "destructive"});
        } finally {
            setLoading(false);
        }
    }, [dateRange, prefetchedStopCauses, toast]);
    
    // Auto-fetch data when the component mounts
    React.useEffect(() => {
        handleFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <Activity className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Análisis de Paradas (OEE)</h1>
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
                        <CardDescription>Selecciona el rango de fechas para analizar las paradas registradas.</CardDescription>
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
                                <CardDescription>Tiempo total de parada (en minutos) agrupado por el motivo registrado.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {stopsByReason.length > 0 ? (
                                    <ChartContainer config={{}} className="w-full h-[400px]">
                                        <ResponsiveContainer>
                                            <BarChart layout="vertical" data={stopsByReason} margin={{ left: 100 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" />
                                                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} interval={0}/>
                                                <RechartsTooltip
                                                    cursor={{ fill: 'rgba(200, 200, 200, 0.1)' }}
                                                    content={<ChartTooltipContent />}
                                                />
                                                <Bar dataKey="totalMinutes" name="Minutos" radius={[0, 4, 4, 0]}>
                                                    {stopsByReason.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                ) : (
                                        <p className="col-span-full text-center text-muted-foreground py-8">No se encontraron datos de paradas para este rango.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                 )}
            </main>
        </div>
    );
}

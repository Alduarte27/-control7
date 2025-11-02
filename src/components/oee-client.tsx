'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Activity, Calendar as CalendarIcon, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { DailyLog, StopCause, StopData } from '@/lib/types';
import KpiCard from './kpi-card';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';


interface AggregatedStopData {
    name: string;
    totalMinutes: number;
    color: string;
}

export default function OeeClient({ prefetchedStopCauses }: { prefetchedStopCauses: StopCause[] }) {
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
        from: addDays(new Date(), -7),
        to: new Date(),
    });
    const [loading, setLoading] = React.useState(false);
    const [machineStops, setMachineStops] = React.useState<{ [machineId: string]: number }>({});
    const [stopsByReason, setStopsByReason] = React.useState<AggregatedStopData[]>([]);

    const stopCausesMap = React.useMemo(() => {
        return new Map(prefetchedStopCauses.map(cause => [cause.name, cause]));
    }, [prefetchedStopCauses]);

    const handleFetchData = React.useCallback(async () => {
        if (!dateRange?.from || !dateRange?.to) {
            return;
        }

        setLoading(true);
        const start = format(dateRange.from, 'yyyy-MM-dd');
        const end = format(dateRange.to, 'yyyy-MM-dd');

        const aggregatedMachineStops: { [machineId: string]: number } = {};
        const aggregatedStopsByReason: { [reason: string]: number } = {};

        try {
            const logsQuery = query(
                collection(db, 'dailyLogs'),
                where('id', '>=', start),
                where('id', '<=', end)
            );
            const querySnapshot = await getDocs(logsQuery);

            querySnapshot.forEach(doc => {
                const log = doc.data() as DailyLog;
                Object.values(log.timeSlots).forEach(slot => {
                    Object.entries(slot).forEach(([key, value]) => {
                        if (key.startsWith('machine_') && typeof value === 'object' && value && 'stops' in value && Array.isArray(value.stops)) {
                            const machineId = key;
                            (value.stops as StopData[]).forEach(stop => {
                                // Aggregate by machine
                                if (!aggregatedMachineStops[machineId]) {
                                    aggregatedMachineStops[machineId] = 0;
                                }
                                aggregatedMachineStops[machineId] += stop.duration;

                                // Aggregate by reason
                                if (!aggregatedStopsByReason[stop.reason]) {
                                    aggregatedStopsByReason[stop.reason] = 0;
                                }
                                aggregatedStopsByReason[stop.reason] += stop.duration;
                            });
                        }
                    });
                });
            });

            setMachineStops(aggregatedMachineStops);

            const reasonData = Object.entries(aggregatedStopsByReason).map(([reason, minutes]) => ({
                name: reason,
                totalMinutes: minutes,
                color: stopCausesMap.get(reason)?.color || '#8884d8'
            })).sort((a,b) => b.totalMinutes - a.totalMinutes);

            setStopsByReason(reasonData);

        } catch (error) {
            console.error("Error fetching OEE data:", error);
        } finally {
            setLoading(false);
        }
    }, [dateRange, stopCausesMap]);


    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Activity className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Dashboard OEE - Disponibilidad</h1>
                </div>
                <Link href="/">
                    <Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver</Button>
                </Link>
            </header>

            <main className="p-4 md:p-8 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Filtros</CardTitle>
                        <CardDescription>Selecciona el rango de fechas para analizar las paradas.</CardDescription>
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
                            {loading ? 'Cargando...' : 'Analizar Datos'}
                        </Button>
                    </CardContent>
                </Card>

                {loading ? <p className="text-center">Cargando datos...</p> : (
                    <>
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
                                            <BarChart layout="vertical" data={stopsByReason}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" />
                                                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                                <RechartsTooltip 
                                                    cursor={{ fill: 'rgba(200, 200, 200, 0.1)' }}
                                                    content={<ChartTooltipContent />}
                                                />
                                                <Bar dataKey="totalMinutes" name="Minutos" radius={[0, 4, 4, 0]}>
                                                    {stopsByReason.map((entry) => (
                                                         <Bar key={entry.name} dataKey="totalMinutes" fill={entry.color} />
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
                    </>
                )}
            </main>
        </div>
    );
}

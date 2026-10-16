
'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, ArrowLeft, Calendar as CalendarIcon, Activity, X, BarChart, Percent, LineChart, TrendingUp, TrendingDown, Target, CheckCircle, ShieldCheck, PieChartIcon, AlertTriangle, Clock, Wrench, Filter, SlidersHorizontal, Settings2, Timer, CheckSquare, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { DailyLog, StopData, StopCause, ProductDefinition, MachineLog, TimeSlot, ProductData } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { format, addDays, eachDayOfInterval, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Bar, BarChart as RechartsBarChart, Pie, PieChart as RechartsPieChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend, Line, LineChart as RechartsLineChart, LabelList } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn, isObservationEvent } from '@/lib/utils';
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
  operator?: string;
  operatorGranel?: string;
}

type TimeDistributionData = {
    name: 'Tiempo Productivo' | 'Tiempo Total de Parada';
    value: number;
    fill: string;
    plannedMinutes?: number;
    unplannedMinutes?: number;
}

type WeeklyKpiData = {
    week: string;
    oee: number;
    availability: number;
    performance: number;
    quality: number;
}

type MachineReliabilityKpis = {
    stopFrequency: number;
    mtbf: number; // Mean Time Between Failures in hours
    mttr: number; // Mean Time To Repair in minutes
}

type StopsByHour = {
    hour: string;
    minutes: number;
}

type PerMachineOee = {
    oee: number;
    availability: number;
    performance: number;
    quality: number;
}

type MaintenanceTypeData = {
    name: string;
    minutes: number;
    count: number;
    color: string;
}

type MachineStopTypeData = {
    name: string;
    planned: number;
    unplanned: number;
    observation?: number;
}

const formatMinutesToHours = (minutes: number) => {
    if (minutes === 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h > 0 ? `${h}h ` : ''}${m}m`;
};

const MAINTENANCE_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1', '#84cc16'
];

const MACHINE_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'
];

const getOeeMachineName = (nameOrId: string): string => {
    if (!nameOrId) return 'Desconocida';
    const clean = String(nameOrId).trim();
    const lower = clean.toLowerCase();

    if (
        lower === 'machine_5' ||
        lower === '5' ||
        lower.includes('granel 1') ||
        lower.includes('granelera 1') ||
        lower.includes('granelera #1') ||
        lower.includes('maquina granel #1') ||
        lower.includes('máquina granel #1') ||
        lower.includes('máquina 5') ||
        lower.includes('máquina #5') ||
        lower.includes('máq 5')
    ) {
        return 'Granelera #1';
    }

    if (
        lower === 'machine_6' ||
        lower === '6' ||
        lower.includes('granel 2') ||
        lower.includes('granelera 2') ||
        lower.includes('granelera #2') ||
        lower.includes('maquina granel #2') ||
        lower.includes('máquina granel #2') ||
        lower.includes('máquina 6') ||
        lower.includes('máquina #6') ||
        lower.includes('máq 6')
    ) {
        return 'Granelera #2';
    }

    if (
        lower === 'machine_7' ||
        lower === '7' ||
        lower.includes('enfardadora 1') ||
        lower.includes('enfardadora #1') ||
        lower.includes('máquina 7') ||
        lower.includes('máquina #7') ||
        lower.includes('máq 7')
    ) {
        return 'Enfardadora #1';
    }

    if (
        lower === 'machine_8' ||
        lower === '8' ||
        lower.includes('enfardadora 2') ||
        lower.includes('enfardadora #2') ||
        lower.includes('máquina 8') ||
        lower.includes('máquina #8') ||
        lower.includes('máq 8')
    ) {
        return 'Enfardadora #2';
    }

    if (
        lower === 'machine_1' ||
        lower === '1' ||
        lower.includes('máquina 1') ||
        lower.includes('máquina #1') ||
        lower.includes('máq 1') ||
        lower.includes('tecnotok 1') ||
        lower.includes('tecnotok #1')
    ) {
        return 'Tecnotok #1';
    }

    if (
        lower === 'machine_2' ||
        lower === '2' ||
        lower.includes('máquina 2') ||
        lower.includes('máquina #2') ||
        lower.includes('máq 2') ||
        lower.includes('tecnotok 2') ||
        lower.includes('tecnotok #2')
    ) {
        return 'Tecnotok #2';
    }

    if (
        lower === 'machine_3' ||
        lower === '3' ||
        lower.includes('máquina 3') ||
        lower.includes('máquina #3') ||
        lower.includes('máq 3') ||
        lower.includes('tecnotok 3') ||
        lower.includes('tecnotok #3')
    ) {
        return 'Tecnotok #3';
    }

    if (
        lower === 'machine_4' ||
        lower === '4' ||
        lower.includes('máquina 4') ||
        lower.includes('máquina #4') ||
        lower.includes('máq 4') ||
        lower.includes('tecnotok 4') ||
        lower.includes('tecnotok #4')
    ) {
        return 'Tecnotok #4';
    }

    return clean;
};

export default function OeeClient({ prefetchedProducts, prefetchedStopCauses }: { prefetchedProducts: ProductDefinition[], prefetchedStopCauses: StopCause[]}) {
    const [isMounted, setIsMounted] = React.useState(false);
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    const [dateRange, setDateRange] = React.useState<DateRange | undefined>({ from: addDays(new Date(), -28), to: new Date() });
    const [loading, setLoading] = React.useState(false);
    const [machineStops, setMachineStops] = React.useState<{ name: string, minutes: number }[]>([]);
    const [stopsByReason, setStopsByReason] = React.useState<AggregatedStopData[]>([]);
    const [timeDistribution, setTimeDistribution] = React.useState<TimeDistributionData[]>([]);
    const [stopsByMaintenance, setStopsByMaintenance] = React.useState<MaintenanceTypeData[]>([]);
    const [machinePlannedVsUnplanned, setMachinePlannedVsUnplanned] = React.useState<MachineStopTypeData[]>([]);
    
    // Dynamic Filter States
    const [selectedMachineFilter, setSelectedMachineFilter] = React.useState<string>('all');
    const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<string>('all');
    const [selectedTurnoFilter, setSelectedTurnoFilter] = React.useState<string>('all');
    const [selectedMaintenanceFilter, setSelectedMaintenanceFilter] = React.useState<string>('all');
    const [selectedOperatorFilter, setSelectedOperatorFilter] = React.useState<string>('all');
    const [selectedOpGranelFilter, setSelectedOpGranelFilter] = React.useState<string>('all');

    const [allStopsInRange, setAllStopsInRange] = React.useState<DetailedStopData[]>([]);
    const [selectedReason, setSelectedReason] = React.useState<string | null>(null);
    
    // OEE States
    const [availability, setAvailability] = React.useState(0);
    const [performance, setPerformance] = React.useState(0);
    const [quality, setQuality] = React.useState(0);
    const [oee, setOee] = React.useState(0);
    const [weeklyKpis, setWeeklyKpis] = React.useState<WeeklyKpiData[]>([]);
    const [perMachineOee, setPerMachineOee] = React.useState<{[machineId: string]: PerMachineOee}>({});
    
    // New Reliability KPIs
    const [machineReliability, setMachineReliability] = React.useState<{[machineId: string]: MachineReliabilityKpis}>({});
    const [stopsByHour, setStopsByHour] = React.useState<StopsByHour[]>([]);


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
        setTimeDistribution([]);
        setWeeklyKpis([]);
        setMachineReliability({});
        setStopsByHour([]);
        setPerMachineOee({});

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

            const [logsSnapshot, plansSnapshot, causesSnapshot] = await Promise.all([
                getDocs(logsQuery),
                planIdsToFetch.length > 0 ? getDocs(query(collection(db, 'productionPlans'), where('__name__', 'in', planIdsToFetch))) : Promise.resolve({ docs: [] }),
                getDocs(collection(db, 'stopCauses'))
            ]);

            const stopCausesMap = new Map(causesSnapshot.docs.map(doc => [doc.data().name, doc.data() as StopCause]));

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
            const aggregatedStopsByMaintenance: { [mType: string]: { totalMinutes: number, count: number } } = {};
            const machinePlannedUnplannedMap: { [machineId: string]: { planned: number, unplanned: number, observation: number } } = {};
            const detailedStops: DetailedStopData[] = [];
            const stopTypes = { planned: 0, unplanned: 0, observation: 0 };
            const stopsByHourOfDay: {[hour: string]: number} = {};

            const machineReliabilityData: { [machineId: string]: { totalOpTime: number, unplannedStops: number, repairTime: number, stopCount: number }} = {};
            
            // Per Machine OEE data
            const perMachineTotals: {
                [machineId: string]: {
                    plannedTime: number;
                    stopTime: number;
                    actualProductionSacks: number;
                    goodProductionSacks: number;
                    theoreticalProductionSacks: number;
                }
            } = {};

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
                    
                    if (!log.machines || typeof log.machines !== 'object') {
                        log.machines = {};
                    }

                    Object.keys(log.machines).forEach(machineId => {
                        const shiftTotalTime = logShift === 'night' ? 13 * 60 : 11 * 60; // Día: 07:00-18:00 (11h = 660m), Noche: 18:00-07:00 (13h = 780m)
                        weeklyTotalPlannedTime += shiftTotalTime;
                        
                        if (!perMachineTotals[machineId]) {
                            perMachineTotals[machineId] = { plannedTime: 0, stopTime: 0, actualProductionSacks: 0, goodProductionSacks: 0, theoreticalProductionSacks: 0 };
                        }
                        perMachineTotals[machineId].plannedTime += shiftTotalTime;

                         if (!machineReliabilityData[machineId]) {
                            machineReliabilityData[machineId] = { totalOpTime: 0, unplannedStops: 0, repairTime: 0, stopCount: 0 };
                        }
                        machineReliabilityData[machineId].totalOpTime += shiftTotalTime;
                    });
                    
                    let lastKnownSpeed: { [key: string]: number } = {};
                    Object.entries(log.machines).forEach(([machineId, machineLog]) => {
                        const prod = prefetchedProducts.find(p => p.id === machineLog.productId);
                        lastKnownSpeed[machineId] = prod?.defaultSpeed || machineLog.theoreticalSpeed || 40;
                    });

                    if (!log.timeSlots || typeof log.timeSlots !== 'object') {
                        log.timeSlots = {};
                    }
                    Object.entries(log.timeSlots).forEach(([time, slotData]) => {
                        if (!slotData || typeof slotData !== 'object') return;

                        Object.entries(slotData).forEach(([key, value]) => {
                            if (key.startsWith('machine_') && value && typeof value === 'object') {
                                const machineId = key;
                                const machineData = value as TimeSlot['machine_1'];
                                
                                const productDef = prefetchedProducts.find(p => p.id === log.machines[machineId]?.productId);

                                // Deprecated: Removed override of lastKnownSpeed using machineData.speed because
                                // 'speed' in time slots was historically misused by operators to record 'Peso Funda'.
                                // We now rely solely on the product's defaultSpeed or the log's theoreticalSpeed.
                                let timeSlotStopTime = 0;
                                if ('stops' in machineData && Array.isArray(machineData.stops)) {
                                     (machineData.stops as StopData[]).forEach(stop => {
                                         const duration = stop.duration || 0;
                                         const causeConfig = stopCausesMap.get(stop.reason);
                                         const isObservation = isObservationEvent(stop, causeConfig);
                                         const effectiveType = isObservation ? 'observation' : stop.type;

                                         if (!isObservation) {
                                             weeklyTotalStopTime += duration;
                                             timeSlotStopTime += duration;
                                             
                                             if (perMachineTotals[machineId]) {
                                                 perMachineTotals[machineId].stopTime += duration;
                                             }

                                             machineReliabilityData[machineId].totalOpTime -= duration;
                                             if (!aggregatedMachineStops[machineId]) aggregatedMachineStops[machineId] = 0;
                                             aggregatedMachineStops[machineId] += duration;

                                             machineReliabilityData[machineId].stopCount += 1;

                                             const stopHour = stop.startTime.split(':')[0];
                                             if(!stopsByHourOfDay[stopHour]) stopsByHourOfDay[stopHour] = 0;
                                             stopsByHourOfDay[stopHour] += duration;
                                             
                                             const mType = stop.maintenanceType || 'Sin Clasificar';
                                             if (!aggregatedStopsByMaintenance[mType]) {
                                                 aggregatedStopsByMaintenance[mType] = { totalMinutes: 0, count: 0 };
                                             }
                                             aggregatedStopsByMaintenance[mType].totalMinutes += duration;
                                             aggregatedStopsByMaintenance[mType].count += 1;

                                             if (stop.reason) {
                                                 if (!aggregatedStopsByReason[stop.reason]) {
                                                     aggregatedStopsByReason[stop.reason] = { totalMinutes: 0, color: causeConfig?.color || '#8884d8' };
                                                 }
                                                 aggregatedStopsByReason[stop.reason].totalMinutes += duration;
                                             }
                                         }

                                         if (!machinePlannedUnplannedMap[machineId]) {
                                             machinePlannedUnplannedMap[machineId] = { planned: 0, unplanned: 0, observation: 0 };
                                         }

                                         if (effectiveType === 'planned') {
                                             stopTypes.planned += duration;
                                             machinePlannedUnplannedMap[machineId].planned += duration;
                                         } else if (effectiveType === 'unplanned') {
                                             stopTypes.unplanned += duration;
                                             machinePlannedUnplannedMap[machineId].unplanned += duration;
                                             machineReliabilityData[machineId].unplannedStops += 1;
                                             machineReliabilityData[machineId].repairTime += duration;
                                         } else if (effectiveType === 'observation') {
                                             stopTypes.observation += duration;
                                             machinePlannedUnplannedMap[machineId].observation += duration;
                                         }
                                         
                                         const isGranelMachine = machineId === 'machine_5' || machineId === 'machine_6';
                                         const operatorGranel = isGranelMachine ? (log.operadorGranel || 'Sin operador') : undefined;
                                         detailedStops.push({ 
                                             ...stop, 
                                             type: effectiveType as any,
                                             machineId: getOeeMachineName(machineId), 
                                             operator: log.operador || 'Sin operador', 
                                             operatorGranel: operatorGranel,
                                             logDate, 
                                             shift: logShift as 'day' | 'night' 
                                         });
                                     });
                                 }
                                
                                const runTimeInMinutes = 30 - timeSlotStopTime;
                                const theoreticalSacks = lastKnownSpeed[machineId] * runTimeInMinutes;

                                if (runTimeInMinutes > 0 && lastKnownSpeed[machineId] > 0) {
                                    weeklyTotalTheoreticalProductionSacks += theoreticalSacks;
                                    if(perMachineTotals[machineId]) {
                                        perMachineTotals[machineId].theoreticalProductionSacks += theoreticalSacks;
                                    }
                                }

                                if (planProducts) {
                                    const dayOfWeek = (currentDate.getDay() + 6) % 7;
                                    const dayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][dayOfWeek];
                                    
                                    const productInPlan = planProducts.find(p => p.id === log.machines[machineId]?.productId);
                                    if(productInPlan) {
                                        const totalDailyProd = (productInPlan.actual[dayKey as keyof typeof productInPlan.actual]?.[logShift as 'day' | 'night'] || 0);
                                        const productionInSlot = totalDailyProd / 24; 
                                        
                                        if(perMachineTotals[machineId]) {
                                           perMachineTotals[machineId].actualProductionSacks += productionInSlot;
                                           if (!productDef?.productName.toLowerCase().includes('pb')) {
                                               perMachineTotals[machineId].goodProductionSacks += productionInSlot;
                                           }
                                        }
                                    }
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

            // --- Per Machine OEE Final Calculations ---
            const machineOeeResults: {[machineId: string]: PerMachineOee} = {};
            Object.entries(perMachineTotals).forEach(([machineId, totals]) => {
                const runTime = totals.plannedTime - totals.stopTime;
                const availability = totals.plannedTime > 0 ? (runTime / totals.plannedTime) * 100 : 0;
                const performance = totals.theoreticalProductionSacks > 0 ? (totals.actualProductionSacks / totals.theoreticalProductionSacks) * 100 : 0;
                const quality = totals.actualProductionSacks > 0 ? (totals.goodProductionSacks / totals.actualProductionSacks) * 100 : 0;
                const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

                machineOeeResults[machineId] = { oee, availability, performance, quality };
            });
            setPerMachineOee(machineOeeResults);

            // --- Final Reliability KPIs Calculations ---
            const finalReliability: {[machineId: string]: MachineReliabilityKpis} = {};
            Object.entries(machineReliabilityData).forEach(([machineId, data]) => {
                finalReliability[machineId] = {
                    stopFrequency: data.stopCount,
                    mtbf: data.unplannedStops > 0 ? (data.totalOpTime / 60) / data.unplannedStops : data.totalOpTime / 60,
                    mttr: data.unplannedStops > 0 ? data.repairTime / data.unplannedStops : 0,
                };
            });
            setMachineReliability(finalReliability);
            
            // --- Set State for Charts and Tables ---
            setAllStopsInRange(detailedStops);
            setTimeDistribution([
                { name: 'Tiempo Productivo', value: grandTotalRunTime, fill: 'hsl(var(--chart-2))' },
                { name: 'Tiempo Total de Parada', value: grandTotalStopTime, fill: 'hsl(var(--chart-5))', plannedMinutes: stopTypes.planned, unplannedMinutes: stopTypes.unplanned },
            ]);

            const reasonData = Object.entries(aggregatedStopsByReason).map(([reason, data]) => ({ name: reason, totalMinutes: data.totalMinutes, color: data.color })).sort((a,b) => b.totalMinutes - a.totalMinutes);
            setStopsByReason(reasonData);
            
            const maintenanceDataForChart: MaintenanceTypeData[] = Object.entries(aggregatedStopsByMaintenance)
                .map(([mType, data], idx) => ({
                    name: mType,
                    minutes: data.totalMinutes,
                    count: data.count,
                    color: MAINTENANCE_COLORS[idx % MAINTENANCE_COLORS.length],
                }))
                .sort((a, b) => b.minutes - a.minutes);
            setStopsByMaintenance(maintenanceDataForChart);

            const machinePlannedVsUnplannedData: MachineStopTypeData[] = Object.entries(machinePlannedUnplannedMap)
                .map(([mId, data]) => {
                    const mNum = mId.split('_')[1];
                    const isGranel = mId === 'machine_5' || mId === 'machine_6';
                    return {
                        name: isGranel ? `Granel ${mNum === '5' ? '1' : '2'}` : `Máq ${mNum}`,
                        planned: data.planned,
                        unplanned: data.unplanned,
                        observation: data.observation || 0,
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));
            setMachinePlannedVsUnplanned(machinePlannedVsUnplannedData);

            const machineStopsDataForChart = Object.entries(aggregatedMachineStops).map(([machineId, minutes]) => ({ name: `Máquina ${machineId.split('_')[1]}`, minutes })).sort((a, b) => b.minutes - a.minutes);
            setMachineStops(machineStopsDataForChart);
            setWeeklyKpis(weeklyKpiResults);

            const hourlyData = Object.entries(stopsByHourOfDay).map(([hour, minutes]) => ({hour: `${hour}:00`, minutes})).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
            setStopsByHour(hourlyData);

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

    // Auto-reload when date range changes (both dates must be selected)
    React.useEffect(() => {
        if (dateRange?.from && dateRange?.to) {
            handleFetchData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange]);

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
        
        if (value < limits.red) return 'text-red-600';
        if (value < limits.yellow) return 'text-yellow-500';
        return 'text-green-600';
    }

    const filteredStopsList = React.useMemo(() => {
        return allStopsInRange.filter(stop => {
            if (selectedMachineFilter !== 'all') {
                const targetName = getOeeMachineName(selectedMachineFilter);
                const stopMachineName = getOeeMachineName(stop.machineId);
                if (targetName !== stopMachineName) return false;
            }
            if (selectedTypeFilter !== 'all' && stop.type !== selectedTypeFilter) {
                return false;
            }
            if (selectedMaintenanceFilter !== 'all') {
                const mType = stop.maintenanceType || 'Sin Clasificar';
                if (mType !== selectedMaintenanceFilter) return false;
            }
            if (selectedReason && stop.reason !== selectedReason) {
                return false;
            }
            if (selectedOperatorFilter !== 'all') {
                const stopOp = stop.operator || '';
                if (stopOp !== selectedOperatorFilter) return false;
            }
            if (selectedOpGranelFilter !== 'all') {
                const stopOpG = stop.operatorGranel || '';
                if (stopOpG !== selectedOpGranelFilter) return false;
            }
            if (selectedTurnoFilter !== 'all') {
                if (stop.shift !== selectedTurnoFilter) return false;
            }
            return true;
        }).sort((a, b) => b.duration - a.duration);
    }, [allStopsInRange, selectedMachineFilter, selectedTypeFilter, selectedMaintenanceFilter, selectedReason, selectedOperatorFilter, selectedOpGranelFilter, selectedTurnoFilter]);

    const stopsByMaintenanceDynamic = React.useMemo(() => {
        const agg: { [mType: string]: { minutes: number; count: number } } = {};
        filteredStopsList.forEach(stop => {
            if (isObservationEvent(stop)) return;
            const mType = stop.maintenanceType || 'Sin Clasificar';
            if (!agg[mType]) agg[mType] = { minutes: 0, count: 0 };
            agg[mType].minutes += stop.duration;
            agg[mType].count += 1;
        });

        return Object.entries(agg)
            .map(([name, data], idx) => ({
                name,
                minutes: data.minutes,
                count: data.count,
                color: MAINTENANCE_COLORS[idx % MAINTENANCE_COLORS.length],
            }))
            .sort((a, b) => b.minutes - a.minutes);
    }, [filteredStopsList]);

    const machinePlannedVsUnplannedDynamic = React.useMemo(() => {
        const agg: { [mId: string]: { planned: number; unplanned: number } } = {};
        filteredStopsList.forEach(stop => {
            const mId = getOeeMachineName(stop.machineId);
            if (!agg[mId]) agg[mId] = { planned: 0, unplanned: 0 };
            if (stop.type === 'planned') {
                agg[mId].planned += stop.duration;
            } else if (stop.type === 'unplanned') {
                agg[mId].unplanned += stop.duration;
            }
        });

        return Object.entries(agg)
            .map(([name, data]) => ({
                name,
                planned: data.planned,
                unplanned: data.unplanned,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredStopsList]);

    const machineStopsDynamic = React.useMemo(() => {
        const agg: { [mId: string]: { stopMinutes: number; shiftSet: Set<string> } } = {};
        filteredStopsList.forEach(stop => {
            if (isObservationEvent(stop)) return;
            const mId = getOeeMachineName(stop.machineId);
            if (!agg[mId]) agg[mId] = { stopMinutes: 0, shiftSet: new Set() };
            agg[mId].stopMinutes += stop.duration;
            agg[mId].shiftSet.add(`${stop.logDate}_${stop.shift}`);
        });

        // Solo mostrar máquinas con registros reales en los datos filtrados
        return Object.entries(agg)
            .map(([name, data]) => {
                const totalPlannedMin = Array.from(data.shiftSet).reduce((sum, sKey) => sum + (sKey.endsWith('_night') ? 13 * 60 : 11 * 60), 0) || 11 * 60;
                const stopMinutes = data.stopMinutes;
                const opMinutes = Math.max(0, totalPlannedMin - stopMinutes);

                return {
                    name,
                    stopMinutes,
                    opMinutes,
                    totalPlannedMin,
                };
            })
            .sort((a, b) => b.stopMinutes - a.stopMinutes);
    }, [filteredStopsList]);

    const stopsByReasonDynamic = React.useMemo(() => {
        const agg: { [reason: string]: { minutes: number; color: string } } = {};
        filteredStopsList.forEach(stop => {
            if (isObservationEvent(stop)) return;
            const reason = stop.reason || 'Sin Motivo';
            if (!agg[reason]) {
                const causeConfig = prefetchedStopCauses.find(c => c.name === reason);
                agg[reason] = { minutes: 0, color: causeConfig?.color || '#8884d8' };
            }
            agg[reason].minutes += stop.duration;
        });

        return Object.entries(agg)
            .map(([name, data]) => ({ name, totalMinutes: data.minutes, color: data.color }))
            .sort((a, b) => b.totalMinutes - a.totalMinutes);
    }, [filteredStopsList, prefetchedStopCauses]);

    const timeDistributionDynamic = React.useMemo(() => {
        const agg: { [mId: string]: number } = {};
        filteredStopsList.forEach(stop => {
            if (isObservationEvent(stop)) return;
            const mId = getOeeMachineName(stop.machineId);
            if (!agg[mId]) agg[mId] = 0;
            agg[mId] += stop.duration;
        });

        return Object.entries(agg)
            .map(([name, value], idx) => ({
                name,
                value,
                fill: MACHINE_COLORS[idx % MACHINE_COLORS.length],
            }))
            .sort((a, b) => b.value - a.value);
    }, [filteredStopsList]);

    const eventsCountByMachineDynamic = React.useMemo(() => {
        const agg: { [mId: string]: number } = {};
        filteredStopsList.forEach(stop => {
            if (isObservationEvent(stop)) return;
            const mId = getOeeMachineName(stop.machineId);
            if (!agg[mId]) agg[mId] = 0;
            agg[mId] += 1;
        });

        return Object.entries(agg)
            .map(([name, count], idx) => ({
                name,
                count,
                fill: MACHINE_COLORS[idx % MACHINE_COLORS.length],
            }))
            .sort((a, b) => b.count - a.count);
    }, [filteredStopsList]);

    const stopsByOperatorDynamic = React.useMemo(() => {
        const agg: { [opName: string]: { dayCount: number; nightCount: number; dayMin: number; nightMin: number } } = {};
        filteredStopsList.forEach(stop => {
            if (isObservationEvent(stop)) return;
            const machineName = getOeeMachineName(stop.machineId);
            let op = stop.operator;

            if (!op || op === 'Operador General' || op === 'Operador No Asignado' || op === 'Sin Operador Registrado' || op.startsWith('Operador ')) {
                if (machineName.includes('Granelera') || machineName.includes('Granel')) {
                    op = 'Operador Granel';
                } else {
                    op = 'Operador Tecnotok';
                }
            }

            if (!agg[op]) agg[op] = { dayCount: 0, nightCount: 0, dayMin: 0, nightMin: 0 };
            
            if (stop.shift === 'night') {
                agg[op].nightCount += 1;
                agg[op].nightMin += stop.duration;
            } else {
                agg[op].dayCount += 1;
                agg[op].dayMin += stop.duration;
            }
        });

        return Object.entries(agg)
            .map(([name, data]) => ({
                name,
                dayCount: data.dayCount,
                nightCount: data.nightCount,
                totalCount: data.dayCount + data.nightCount,
                dayMin: data.dayMin,
                nightMin: data.nightMin,
                totalMin: data.dayMin + data.nightMin,
            }))
            .sort((a, b) => b.totalCount - a.totalCount);
    }, [filteredStopsList]);

    const kpiStats = React.useMemo(() => {
        let plannedMin = 0;
        let plannedCount = 0;
        let unplannedMin = 0;
        let unplannedCount = 0;

        filteredStopsList.forEach(stop => {
            if (stop.type === 'planned') {
                plannedMin += stop.duration;
                plannedCount++;
            } else if (stop.type === 'unplanned') {
                unplannedMin += stop.duration;
                unplannedCount++;
            }
        });

        const totalMin = plannedMin + unplannedMin;
        const plannedPct = totalMin > 0 ? (plannedMin / totalMin) * 100 : 0;
        const unplannedPct = totalMin > 0 ? (unplannedMin / totalMin) * 100 : 0;

        // Top maintenance type
        const mCounts: { [key: string]: { min: number; count: number } } = {};
        filteredStopsList.forEach(stop => {
            if (isObservationEvent(stop)) return;
            if (stop.maintenanceType) {
                const mt = stop.maintenanceType;
                if (!mCounts[mt]) mCounts[mt] = { min: 0, count: 0 };
                mCounts[mt].min += stop.duration;
                mCounts[mt].count++;
            }
        });
        const topMaintenance = Object.entries(mCounts).sort((a, b) => b[1].min - a[1].min)[0];

        return {
            plannedMin,
            plannedCount,
            plannedPct,
            unplannedMin,
            unplannedCount,
            unplannedPct,
            totalMin,
            totalEvents: plannedCount + unplannedCount,
            topMaintenanceName: topMaintenance ? topMaintenance[0] : 'N/A',
            topMaintenanceMin: topMaintenance ? topMaintenance[1].min : 0,
        };
    }, [filteredStopsList]);

    const maintenanceOptions = React.useMemo(() => {
        const set = new Set<string>();
        allStopsInRange.forEach(s => {
            if (s.maintenanceType) set.add(s.maintenanceType);
        });
        return Array.from(set);
    }, [allStopsInRange]);

    if (!isMounted) {
        return (
            <div className="bg-background min-h-screen text-foreground flex items-center justify-center p-12">
                <p className="font-medium text-muted-foreground animate-pulse">Cargando dashboard de análisis de paradas...</p>
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen text-foreground">
            <main className="p-3 md:p-6 space-y-6">
                {/* Control Panel: Integrated Horizontal Filter Toolbar */}
                <Card className="shadow-sm border border-border/80 bg-card p-3 md:p-4">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        {/* Title & Clear Action */}
                        <div className="flex items-center justify-between xl:justify-start gap-3 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <Link href="/stops" title="Volver a la Bitácora">
                                        <ArrowLeft className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <SlidersHorizontal className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-foreground leading-tight">Filtros Dinámicos</h2>
                                    <p className="text-[11px] text-muted-foreground hidden sm:block">Actualiza todos los indicadores</p>
                                </div>
                            </div>
                            {(selectedMachineFilter !== 'all' || selectedTypeFilter !== 'all' || selectedMaintenanceFilter !== 'all' || selectedReason) && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => {
                                        setSelectedMachineFilter('all');
                                        setSelectedTypeFilter('all');
                                        setSelectedTurnoFilter('all');
                                        setSelectedMaintenanceFilter('all');
                                        setSelectedOperatorFilter('all');
                                        setSelectedOpGranelFilter('all');
                                        setSelectedReason(null);
                                    }}
                                    className="h-8 text-xs gap-1 ml-2 border-dashed"
                                >
                                    <X className="h-3.5 w-3.5" /> Limpiar
                                </Button>
                            )}
                        </div>

                        {/* Inline Controls Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-3 flex-grow w-full">
                            {/* Rango de Fechas */}
                            <div className="grid gap-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rango de Fechas</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className="w-full justify-start text-left font-normal text-xs h-9 bg-background/80">
                                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                            {dateRange?.from ? (
                                                dateRange.to ? (
                                                    <span className="truncate">{format(dateRange.from, "dd MMM y", { locale: es })} - {format(dateRange.to, "dd MMM y", { locale: es })}</span>
                                                ) : (
                                                    format(dateRange.from, "dd MMM y", { locale: es })
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

                            {/* Máquina */}
                            <div className="grid gap-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Máquina</span>
                                <Select value={selectedMachineFilter} onValueChange={setSelectedMachineFilter}>
                                    <SelectTrigger className="h-9 text-xs bg-background/80">
                                        <SelectValue placeholder="Todas las Máquinas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas las Máquinas</SelectItem>
                                        <SelectItem value="machine_1">Tecnotok #1</SelectItem>
                                        <SelectItem value="machine_2">Tecnotok #2</SelectItem>
                                        <SelectItem value="machine_3">Tecnotok #3</SelectItem>
                                        <SelectItem value="machine_4">Tecnotok #4</SelectItem>
                                        <SelectItem value="machine_5">Granelera #1</SelectItem>
                                        <SelectItem value="machine_6">Granelera #2</SelectItem>
                                        <SelectItem value="machine_7">Enfardadora #1</SelectItem>
                                        <SelectItem value="machine_8">Enfardadora #2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Turno */}
                            <div className="grid gap-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Turno</span>
                                <Select value={selectedTurnoFilter} onValueChange={setSelectedTurnoFilter}>
                                    <SelectTrigger className="h-9 text-xs bg-background/80">
                                        <SelectValue placeholder="Todos los Turnos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Turnos</SelectItem>
                                        <SelectItem value="day">Día</SelectItem>
                                        <SelectItem value="night">Noche</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Tipo de Parada */}
                            <div className="grid gap-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Parada</span>
                                <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                                    <SelectTrigger className="h-9 text-xs bg-background/80">
                                        <SelectValue placeholder="Todos los Tipos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Tipos</SelectItem>
                                        <SelectItem value="planned">Planificada</SelectItem>
                                        <SelectItem value="unplanned">No Planificada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Tipo de Mantenimiento */}
                            <div className="grid gap-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo Mantenimiento</span>
                                <Select value={selectedMaintenanceFilter} onValueChange={setSelectedMaintenanceFilter}>
                                    <SelectTrigger className="h-9 text-xs bg-background/80">
                                        <SelectValue placeholder="Todos los Mantenimientos" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Mantenimientos</SelectItem>
                                        {maintenanceOptions.map(opt => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Operador */}
                            <div className="grid gap-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Operador</span>
                                <Select value={selectedOperatorFilter} onValueChange={setSelectedOperatorFilter}>
                                    <SelectTrigger className="h-9 text-xs bg-background/80">
                                        <SelectValue placeholder="Todos los Operadores" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Operadores</SelectItem>
                                        {Array.from(new Set(allStopsInRange.map(s => (s as any).operator).filter(Boolean))).sort().map(op => (
                                            <SelectItem key={op} value={op}>{op}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Op. Granel */}
                            <div className="grid gap-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Op. Granel</span>
                                <Select value={selectedOpGranelFilter} onValueChange={setSelectedOpGranelFilter}>
                                    <SelectTrigger className="h-9 text-xs bg-background/80">
                                        <SelectValue placeholder="Todos Op. Granel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos Op. Granel</SelectItem>
                                        {Array.from(new Set(allStopsInRange.map(s => s.operatorGranel).filter((op): op is string => Boolean(op)))).sort().map(op => (
                                            <SelectItem key={op} value={op}>{op}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </Card>

                {loading ? <p className="text-center pt-8 font-medium text-muted-foreground">Analizando indicadores de producción y paradas...</p> : (
                    <div className="space-y-6">
                        {/* Dynamic Modern KPI Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Card 1: Paradas Planificadas */}
                            <Card className="p-4 border-l-4 border-l-sky-500 bg-sky-50/50 dark:bg-sky-950/20 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">Paradas Planificadas</span>
                                    <div className="p-2 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline justify-between">
                                    <span className="text-2xl font-extrabold text-sky-950 dark:text-sky-100">
                                        {formatMinutesToHours(kpiStats.plannedMin)}
                                    </span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-200/80 text-sky-900 dark:bg-sky-900 dark:text-sky-200">
                                        {kpiStats.plannedPct.toFixed(1)}% del total
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {kpiStats.plannedCount} eventos de paradas programadas
                                </p>
                            </Card>

                            {/* Card 2: Paradas No Planificadas */}
                            <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Paradas No Planificadas</span>
                                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300">
                                        <AlertTriangle className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline justify-between">
                                    <span className="text-2xl font-extrabold text-amber-950 dark:text-amber-100">
                                        {formatMinutesToHours(kpiStats.unplannedMin)}
                                    </span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                                        {kpiStats.unplannedPct.toFixed(1)}% del total
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {kpiStats.unplannedCount} fallas o eventos no programados
                                </p>
                            </Card>

                            {/* Card 3: Tipo Mantenimiento Principal */}
                            <Card className="p-4 border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Mantenimiento Dominante</span>
                                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300">
                                        <Wrench className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <span className="text-lg font-bold text-purple-950 dark:text-purple-100 truncate block">
                                        {kpiStats.topMaintenanceName}
                                    </span>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs text-muted-foreground">Acumulado:</span>
                                        <span className="text-xs font-bold text-purple-800 dark:text-purple-300">
                                            {formatMinutesToHours(kpiStats.topMaintenanceMin)}
                                        </span>
                                    </div>
                                </div>
                            </Card>

                            {/* Card 4: Resumen de Inactividad */}
                            <Card className="p-4 border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Inactividad Acumulada</span>
                                    <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300">
                                        <Timer className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-baseline justify-between">
                                    <span className="text-2xl font-extrabold text-emerald-950 dark:text-emerald-100">
                                        {formatMinutesToHours(kpiStats.totalMin)}
                                    </span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
                                        {kpiStats.totalEvents} eventos
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Promedio: {kpiStats.totalEvents > 0 ? (kpiStats.totalMin / kpiStats.totalEvents).toFixed(1) : 0} min / parada
                                </p>
                            </Card>
                        </div>



                        {/* Bento Grid: Fit-To-Screen Executive Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                            {/* LEFT COLUMN: Desglose de Paradas por Motivo / Causa (Full Height) */}
                            <Card className="lg:col-span-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                                <CardHeader className="pb-1 p-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base font-bold">Desglose de Paradas por Motivo / Causa</CardTitle>
                                            <CardDescription className="text-[11px]">Haz clic en una barra para filtrar eventos por este motivo.</CardDescription>
                                        </div>
                                        <Target className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 flex-grow w-full">
                                    {stopsByReasonDynamic.length > 0 ? (
                                        <ChartContainer config={{}} className="w-full h-full min-h-[500px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RechartsBarChart layout="vertical" data={stopsByReasonDynamic} margin={{ top: 0, bottom: 0, left: 0, right: 50 }} onClick={handleBarClick}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                                    <YAxis dataKey="name" type="category" width={135} tick={{ fontSize: 11 }} interval={0} tickLine={false}/>
                                                    <RechartsTooltip
                                                        cursor={{ fill: 'rgba(200, 200, 200, 0.2)' }}
                                                        formatter={(value: number) => [`${formatMinutesToHours(value)} (${value} min)`, "Duración Total"]}
                                                    />
                                                    <Bar dataKey="totalMinutes" name="Minutos" radius={[0, 4, 4, 0]} cursor="pointer">
                                                        <LabelList dataKey="totalMinutes" content={(props: any) => {
                                                            const { x, y, width, height, value } = props;
                                                            if (!value || value <= 0) return null;
                                                            return (
                                                                <text x={x + width + 5} y={y + height / 2} fill="#666" fontSize={10} dominantBaseline="central">
                                                                    <tspan x={x + width + 5} dy="-0.6em" fontWeight="bold">{formatMinutesToHours(value)}</tspan>
                                                                    <tspan x={x + width + 5} dy="1.2em">{value}m</tspan>
                                                                </text>
                                                            );
                                                        }} />
                                                        {stopsByReasonDynamic.map((entry) => (
                                                            <Cell key={`cell-${entry.name}`} fill={entry.color}
                                                              className={cn(selectedReason && selectedReason !== entry.name && "opacity-30", "transition-opacity")}
                                                            />
                                                        ))}
                                                    </Bar>
                                                </RechartsBarChart>
                                            </ResponsiveContainer>
                                        </ChartContainer>
                                    ) : (
                                        <p className="text-center text-muted-foreground py-8 text-xs w-full">No se encontraron datos de motivos.</p>
                                    )}
                                </CardContent>
                            </Card>

                            {/* RIGHT COLUMN: Stack of 3 rows (Ranking -> Planned vs Unplanned -> 3 Donuts at bottom) */}
                            <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
                                {/* 1. TOP: Tiempo de Operación vs Parada por Máquina */}
                                <Card className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-1 p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="text-sm font-bold">Tiempo de Operación vs. Parada por Máquina</CardTitle>
                                                <CardDescription className="text-[10px]">Tiempo de operación vs inactividad acumulada.</CardDescription>
                                            </div>
                                            <BarChart className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0">
                                        {machineStopsDynamic.length > 0 ? (
                                            <ChartContainer config={{}} className="w-full h-[145px]">
                                                <RechartsBarChart layout="vertical" data={machineStopsDynamic} margin={{ top: 0, right: 15, bottom: 0, left: 0 }}>
                                                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} interval={0} tickLine={false} axisLine={false} width={120} />
                                                    <XAxis type="number" tick={{ fontSize: 9 }} />
                                                    <RechartsTooltip 
                                                        cursor={{ fill: 'rgba(200, 200, 200, 0.1)'}}
                                                        formatter={(value: number, name: string) => [
                                                            `${formatMinutesToHours(value)} (${value} min)`,
                                                            name === 'Operación Efectiva' ? 'Tiempo Operación' : 'Tiempo Parado'
                                                        ]}
                                                    />
                                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                                                    <Bar dataKey="opMinutes" name="Operación Efectiva" fill="#10b981" stackId="mStack" radius={[0, 0, 0, 0]}>
                                                        <LabelList dataKey="opMinutes" content={(props: any) => {
                                                            const { x, y, width, height, value } = props;
                                                            if (!value || value <= 0 || width < 50) return null;
                                                            return (
                                                                <text x={x + width / 2} y={y + height / 2} fill="#fff" fontSize={8} dominantBaseline="central" textAnchor="middle" fontWeight="bold">
                                                                    {formatMinutesToHours(value)}
                                                                </text>
                                                            );
                                                        }} />
                                                    </Bar>
                                                    <Bar dataKey="stopMinutes" name="Tiempo de Parada" fill="#ef4444" stackId="mStack" radius={[0, 4, 4, 0]}>
                                                        <LabelList dataKey="stopMinutes" content={(props: any) => {
                                                            const { x, y, width, height, value } = props;
                                                            if (!value || value <= 0 || width < 50) return null;
                                                            return (
                                                                <text x={x + width / 2} y={y + height / 2} fill="#fff" fontSize={8} dominantBaseline="central" textAnchor="middle" fontWeight="bold">
                                                                    {formatMinutesToHours(value)}
                                                                </text>
                                                            );
                                                        }} />
                                                    </Bar>
                                                </RechartsBarChart>
                                            </ChartContainer>
                                        ) : (
                                            <p className="text-center text-muted-foreground py-4 text-[10px]">No hay datos</p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* 2. MIDDLE: Planificadas vs. No Planificadas */}
                                <Card className="shadow-sm hover:shadow-md transition-shadow">
                                    <CardHeader className="pb-1 p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="text-sm font-bold">Planificadas vs. No Planificadas</CardTitle>
                                                <CardDescription className="text-[10px]">Inactividad por cada máquina.</CardDescription>
                                            </div>
                                            <Layers className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0">
                                        {machinePlannedVsUnplannedDynamic.length > 0 ? (
                                            <ChartContainer config={{}} className="w-full h-[135px]">
                                                <RechartsBarChart data={machinePlannedVsUnplannedDynamic} margin={{ top: 25, right: 10, left: -25, bottom: 0 }}>
                                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                                                    <YAxis tick={{ fontSize: 9 }} />
                                                    <RechartsTooltip formatter={(value: number) => [`${formatMinutesToHours(value)} (${value} min)`, 'Minutos']} />
                                                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '2px' }} />
                                                    <Bar dataKey="planned" name="Planificada" fill="#0284c7" radius={[4, 4, 0, 0]}>
                                                        <LabelList dataKey="planned" content={(props: any) => {
                                                            const { x, y, width, value } = props;
                                                            if (!value || value <= 0) return null;
                                                            return (
                                                                <text x={x + width / 2} y={y - 12} fill="#0284c7" fontSize={10} dominantBaseline="central" textAnchor="middle">
                                                                    <tspan x={x + width / 2} dy="-0.6em" fontWeight="bold">{formatMinutesToHours(value)}</tspan>
                                                                    <tspan x={x + width / 2} dy="1.2em">{value}m</tspan>
                                                                </text>
                                                            );
                                                        }} />
                                                    </Bar>
                                                    <Bar dataKey="unplanned" name="No Planificada" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                                                        <LabelList dataKey="unplanned" content={(props: any) => {
                                                            const { x, y, width, value } = props;
                                                            if (!value || value <= 0) return null;
                                                            return (
                                                                <text x={x + width / 2} y={y - 12} fill="#f59e0b" fontSize={10} dominantBaseline="central" textAnchor="middle">
                                                                    <tspan x={x + width / 2} dy="-0.6em" fontWeight="bold">{formatMinutesToHours(value)}</tspan>
                                                                    <tspan x={x + width / 2} dy="1.2em">{value}m</tspan>
                                                                </text>
                                                            );
                                                        }} />
                                                    </Bar>
                                                </RechartsBarChart>
                                            </ChartContainer>
                                        ) : (
                                            <p className="text-center text-muted-foreground py-4 text-[10px]">No hay datos</p>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* 3. BOTTOM: Row of 3 Donut Charts */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Donut 1: Distribución por Máquina */}
                                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-0 p-2.5">
                                            <CardTitle className="text-[11px] font-bold">Distribución por Máquina</CardTitle>
                                            <CardDescription className="text-[9px]">Porcentaje inactividad.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-2 pt-0">
                                            {timeDistributionDynamic.some(d => d.value > 0) ? (
                                                <ChartContainer config={{}} className="w-full h-[180px]">
                                                    <RechartsPieChart>
                                                        <RechartsTooltip formatter={(value: number, name: string) => [`${formatMinutesToHours(value)} (${value} min)`, `Máquina: ${name}`]} />
                                                        <Pie
                                                            data={timeDistributionDynamic}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={20}
                                                            outerRadius={35}
                                                            paddingAngle={2}
                                                            label={(props) => {
                                                                const { x, y, name, value, textAnchor, fill } = props;
                                                                const words = name.split(' ');
                                                                const line1 = words.length > 2 ? words.slice(0, 2).join(' ') : name;
                                                                const line2 = words.length > 2 ? words.slice(2).join(' ') : '';
                                                                return (
                                                                    <text x={x} y={y} fill={fill} textAnchor={textAnchor} dominantBaseline="central" fontSize={9}>
                                                                        <tspan x={x} dy={line2 ? "-1em" : "-0.5em"}>{line1}</tspan>
                                                                        {line2 && <tspan x={x} dy="1.2em">{line2}</tspan>}
                                                                        <tspan x={x} dy="1.2em" fontWeight="bold">{value}m</tspan>
                                                                    </text>
                                                                );
                                                            }}
                                                            labelLine={true}
                                                        >
                                                            {timeDistributionDynamic.map((entry) => (
                                                                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                                            ))}
                                                        </Pie>
                                                    </RechartsPieChart>
                                                </ChartContainer>
                                            ) : (
                                                <p className="text-center text-muted-foreground py-3 text-[9px]">Sin datos</p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Donut 2: Tipo de Mantenimiento */}
                                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-0 p-2.5">
                                            <CardTitle className="text-[11px] font-bold">Tipo de Mantenimiento</CardTitle>
                                            <CardDescription className="text-[9px]">Categorías registradas.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-2 pt-0">
                                            {stopsByMaintenanceDynamic.length > 0 ? (
                                                <ChartContainer config={{}} className="w-full h-[180px]">
                                                    <RechartsPieChart>
                                                        <RechartsTooltip formatter={(value: number, name: string) => [`${formatMinutesToHours(value)} (${value} min)`, `Categoría: ${name}`]} />
                                                        <Pie
                                                            data={stopsByMaintenanceDynamic}
                                                            dataKey="minutes"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={20}
                                                            outerRadius={35}
                                                            paddingAngle={2}
                                                            label={(props) => {
                                                                const { x, y, percent, textAnchor, fill } = props;
                                                                // Solo mostramos el porcentaje para evitar que se amontone el texto
                                                                return (
                                                                    <text x={x} y={y} fill={fill} textAnchor={textAnchor} dominantBaseline="central" fontSize={9}>
                                                                        <tspan x={x} dy="0" fontWeight="bold">{(percent * 100).toFixed(0)}%</tspan>
                                                                    </text>
                                                                );
                                                            }}
                                                            labelLine={true}
                                                        >
                                                            {stopsByMaintenanceDynamic.map((entry) => (
                                                                <Cell key={`cell-${entry.name}`} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                    </RechartsPieChart>
                                                </ChartContainer>
                                            ) : (
                                                <p className="text-center text-muted-foreground py-3 text-[9px]">Sin datos</p>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Donut 3: Frecuencia de Eventos por Máquina */}
                                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                                        <CardHeader className="pb-0 p-2.5">
                                            <CardTitle className="text-[11px] font-bold">Frecuencia de Eventos</CardTitle>
                                            <CardDescription className="text-[9px]">N° de paradas.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-2 pt-0">
                                            {eventsCountByMachineDynamic.length > 0 ? (
                                                <ChartContainer config={{}} className="w-full h-[180px]">
                                                    <RechartsPieChart>
                                                        <RechartsTooltip formatter={(value: number, name: string) => [`${value} paradas`, `Máquina: ${name}`]} />
                                                        <Pie
                                                            data={eventsCountByMachineDynamic}
                                                            dataKey="count"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={20}
                                                            outerRadius={35}
                                                            paddingAngle={2}
                                                            label={(props) => {
                                                                const { x, y, name, value, textAnchor, fill } = props;
                                                                const words = name.split(' ');
                                                                const line1 = words.length > 2 ? words.slice(0, 2).join(' ') : name;
                                                                const line2 = words.length > 2 ? words.slice(2).join(' ') : '';
                                                                return (
                                                                    <text x={x} y={y} fill={fill} textAnchor={textAnchor} dominantBaseline="central" fontSize={9}>
                                                                        <tspan x={x} dy={line2 ? "-1em" : "-0.5em"}>{line1}</tspan>
                                                                        {line2 && <tspan x={x} dy="1.2em">{line2}</tspan>}
                                                                        <tspan x={x} dy="1.2em" fontWeight="bold">{value} {value === 1 ? 'parada' : 'paradas'}</tspan>
                                                                    </text>
                                                                );
                                                            }}
                                                            labelLine={true}
                                                        >
                                                            {eventsCountByMachineDynamic.map((entry) => (
                                                                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                                            ))}
                                                        </Pie>
                                                    </RechartsPieChart>
                                                </ChartContainer>
                                            ) : (
                                                <p className="text-center text-muted-foreground py-3 text-[9px]">Sin datos</p>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>

                        {/* Filtered Table Details */}
                        <Card className="shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle>
                                            Detalle de Eventos Registrados 
                                            {selectedReason && ` (Motivo: "${selectedReason}")`}
                                        </CardTitle>
                                        <CardDescription>Mostrando {filteredStopsList.length} eventos según los filtros aplicados.</CardDescription>
                                    </div>
                                    {selectedReason && (
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedReason(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="max-h-[500px] overflow-y-auto border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Turno</TableHead>
                                                <TableHead>Máquina</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>Mantenimiento</TableHead>
                                                <TableHead>Hora Inicio</TableHead>
                                                <TableHead>Hora Fin</TableHead>
                                                <TableHead className="text-right">Duración</TableHead>
                                                <TableHead>Motivo</TableHead>
                                                <TableHead>Causa de la parada</TableHead>
                                                <TableHead>Solución Aplicada</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredStopsList.length > 0 ? filteredStopsList.map(stop => (
                                                <TableRow key={stop.id}>
                                                    <TableCell className="font-mono text-xs">{stop.logDate}</TableCell>
                                                    <TableCell className="capitalize text-xs">{stop.shift === 'day' ? 'Día' : 'Noche'}</TableCell>
                                                    <TableCell className="font-semibold text-xs">{getOeeMachineName(stop.machineId)}</TableCell>
                                                    <TableCell>
                                                        <span className={cn(
                                                            "px-2 py-0.5 text-[10px] font-bold rounded-full",
                                                            stop.type === 'planned' ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" : (stop.type === 'observation' ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300")
                                                        )}>
                                                            {stop.type === 'planned' ? 'Planificada' : (stop.type === 'observation' ? 'Observación' : 'No Planificada')}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{stop.maintenanceType || '-'}</TableCell>
                                                    <TableCell className="font-mono text-xs">{stop.startTime}</TableCell>
                                                    <TableCell className="font-mono text-xs">{stop.endTime}</TableCell>
                                                    <TableCell className="text-right font-medium text-xs">{formatMinutesToHours(stop.duration)} ({stop.duration}m)</TableCell>
                                                    <TableCell className="text-xs">{stop.reason || '-'}</TableCell>
                                                    <TableCell className="text-xs">{stop.cause || '-'}</TableCell>
                                                    <TableCell className="text-xs">{stop.solution || '-'}</TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No se encontraron eventos de paradas con los filtros actuales.</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                 )}
            </main>
        </div>
    );
}



'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart, ChevronLeft, Calendar as CalendarIcon, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial } from '@/lib/types';
import { materialTypeLabels } from '@/lib/types';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';


type Kpi = {
    totalDiscrepancy: number;
    averagePerformance: number;
    totalMissingMaterial: number;
    totalExtraMaterial: number;
    totalConsumedCount: number;
    nonConformingRate: number;
    nonConformingCount: number;
};

type SupplierKpi = {
    name: string;
    materialsByType: {
        [materialType: string]: Kpi & { count: number };
    }
    overall: Kpi;
};

type MaterialTypeKpi = {
    name: string;
    averagePerformance: number;
    count: number;
}

export default function MelazaKpiClient() {
    const [consumedMaterials, setConsumedMaterials] = React.useState<PackagingMaterial[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
    
    const { toast } = useToast();

    React.useEffect(() => {
        setDateRange({
            from: addDays(new Date(), -30),
            to: new Date(),
        });

        const q = query(collection(db, "melazaSacks"), where("status", "==", "consumido"));
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const materialsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial));
            setConsumedMaterials(materialsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching consumed materials in real-time:", error);
            toast({
                title: "Error de Sincronización",
                description: "No se pudieron obtener los datos en tiempo real.",
                variant: "destructive"
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    const filteredMaterials = React.useMemo(() => {
        if (!dateRange?.from) return [];
        return consumedMaterials.filter(m => {
            if (!m.tareWeightedAt) return false;
            const tareDate = new Date(m.tareWeightedAt);
            const from = dateRange.from!;
            const to = dateRange.to || from;
            const fromDate = new Date(from.getFullYear(), from.getMonth(), from.getDate());
            const toDate = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);

            return tareDate >= fromDate && tareDate <= toDate;
        });
    }, [consumedMaterials, dateRange]);


    const calculateKpis = (materials: PackagingMaterial[]): Kpi => {
        let totalDiscrepancy = 0;
        let totalActualNetWeight = 0;
        let totalReferenceNetWeight = 0;
        let totalMissingMaterial = 0;
        let totalExtraMaterial = 0;
        let nonConformingCount = 0;

        materials.forEach(m => {
            const referenceNetWeight = m.totalWeight || 0; 
            
            if (m.actualNetWeight !== undefined && referenceNetWeight > 0) {
                const discrepancy = m.actualNetWeight - referenceNetWeight;
                
                totalDiscrepancy += discrepancy;
                totalActualNetWeight += m.actualNetWeight;
                totalReferenceNetWeight += referenceNetWeight;

                if (discrepancy < 0) {
                    totalMissingMaterial += Math.abs(discrepancy);
                    nonConformingCount++;
                } else {
                    totalExtraMaterial += discrepancy;
                }
            }
        });
        
        const averagePerformance = totalReferenceNetWeight > 0 
            ? (totalActualNetWeight / totalReferenceNetWeight) * 100 
            : 0;

        const nonConformingRate = materials.length > 0 ? (nonConformingCount / materials.length) * 100 : 0;

        return {
            totalDiscrepancy,
            averagePerformance,
            totalMissingMaterial,
            totalExtraMaterial,
            totalConsumedCount: materials.length,
            nonConformingRate,
            nonConformingCount,
        }
    };

    const overallKpis = React.useMemo(() => calculateKpis(filteredMaterials), [filteredMaterials]);
    
    const supplierKpis: SupplierKpi[] = React.useMemo(() => {
        const bySupplier: { [supplierName: string]: PackagingMaterial[] } = {};
        
        filteredMaterials.forEach(m => {
            const supplierName = m.supplier || 'Sin Proveedor';
            if (!bySupplier[supplierName]) {
                bySupplier[supplierName] = [];
            }
            bySupplier[supplierName].push(m);
        });

        return Object.entries(bySupplier).map(([name, materials]) => {
             const materialsByType: SupplierKpi['materialsByType'] = {};
            const byType: { [key: string]: PackagingMaterial[] } = {};
            materials.forEach(m => {
                const typeName = materialTypeLabels[m.type];
                if(!byType[typeName]) byType[typeName] = [];
                byType[typeName].push(m);
            });
            
            Object.entries(byType).forEach(([typeName, typeMaterials]) => {
                const kpis = calculateKpis(typeMaterials);
                materialsByType[typeName] = { ...kpis, count: typeMaterials.length };
            });

            return {
                name,
                materialsByType,
                overall: calculateKpis(materials),
            };
        });
    }, [filteredMaterials]);

    const getPerformanceColor = (performance: number) => {
        if (performance >= 99) return 'text-green-600';
        if (performance >= 98) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <BarChart className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Dashboard Sacos de Melaza</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/material-melaza">
                        <Button variant="outline">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Volver a Material Melaza
                        </Button>
                    </Link>
                </div>
            </header>

            <main className="p-4 md:p-8 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Filtro de Análisis</CardTitle>
                        <CardDescription>Selecciona el rango de fechas para analizar los sacos consumidos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn("w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "LLL dd, y", { locale: es })} -{' '}
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
                    </CardContent>
                </Card>

                {loading ? (
                    <p className="text-center py-12 text-muted-foreground">Cargando datos del dashboard...</p>
                ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Discrepancia Neta</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={cn("text-3xl font-bold", overallKpis.totalDiscrepancy >= 0 ? "text-green-600" : "text-red-600")}>
                                                {overallKpis.totalDiscrepancy.toFixed(2)} kg
                                            </div>
                                            <p className="text-xs text-muted-foreground">({(overallKpis.totalDiscrepancy * 1000).toLocaleString(undefined, {maximumFractionDigits: 0})} g)</p>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent><p>Diferencia total entre el peso neto real y el de etiqueta.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Rendimiento Promedio</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className={cn("text-3xl font-bold", getPerformanceColor(overallKpis.averagePerformance))}>
                                                {overallKpis.averagePerformance.toFixed(2)}%
                                            </div>
                                            <p className="text-xs text-muted-foreground">Sobre {overallKpis.totalConsumedCount} sacos</p>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent><p>Rendimiento promedio ponderado por peso.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>


                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Total Faltante</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-3xl font-bold text-red-600">
                                                <TrendingDown className="inline h-7 w-7 mr-2" />
                                                {overallKpis.totalMissingMaterial.toFixed(2)} kg
                                            </div>
                                            <p className="text-xs text-muted-foreground">({(overallKpis.totalMissingMaterial * 1000).toLocaleString(undefined, {maximumFractionDigits: 0})} g)</p>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent><p>Suma total del material faltante.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Total Excedente</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-3xl font-bold text-green-600">
                                                <TrendingUp className="inline h-7 w-7 mr-2" />
                                                {overallKpis.totalExtraMaterial.toFixed(2)} kg
                                            </div>
                                            <p className="text-xs text-muted-foreground">({(overallKpis.totalExtraMaterial * 1000).toLocaleString(undefined, {maximumFractionDigits: 0})} g)</p>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent><p>Suma total del material excedente.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Análisis por Proveedor</CardTitle>
                            <CardDescription>Rendimiento y discrepancia neta agrupados por proveedor en el período seleccionado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Proveedor / Tipo de Material</TableHead>
                                        <TableHead className="text-right">Rendimiento</TableHead>
                                        <TableHead className="text-right">Discrepancia</TableHead>
                                        <TableHead className="text-right">Materiales</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {supplierKpis.map(supplier => (
                                        <React.Fragment key={supplier.name}>
                                            <TableRow className="bg-muted/50">
                                                <TableCell className="font-bold">{supplier.name}</TableCell>
                                                <TableCell className={cn("text-right font-bold", getPerformanceColor(supplier.overall.averagePerformance))}>
                                                    {supplier.overall.averagePerformance.toFixed(2)}%
                                                </TableCell>
                                                <TableCell className={cn("text-right font-bold", supplier.overall.totalDiscrepancy >= 0 ? "text-green-600" : "text-red-600")}>
                                                    {supplier.overall.totalDiscrepancy.toFixed(2)} kg
                                                </TableCell>
                                                <TableCell className="text-right font-bold">{supplier.overall.totalConsumedCount}</TableCell>
                                            </TableRow>
                                            {Object.entries(supplier.materialsByType).map(([typeName, kpi]) => (
                                                <TableRow key={typeName}>
                                                    <TableCell className="pl-8 text-muted-foreground">{typeName}</TableCell>
                                                    <TableCell className={cn("text-right font-semibold", getPerformanceColor(kpi.averagePerformance))}>
                                                        {kpi.averagePerformance.toFixed(2)}%
                                                    </TableCell>
                                                    <TableCell className={cn("text-right font-semibold", kpi.totalDiscrepancy >= 0 ? "text-green-600" : "text-red-600")}>
                                                        {kpi.totalDiscrepancy.toFixed(2)} kg
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">{kpi.count}</TableCell>
                                                </TableRow>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
                )}
            </main>
        </div>
    );
}

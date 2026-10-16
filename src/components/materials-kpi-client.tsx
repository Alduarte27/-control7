

'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart, ChevronLeft, ArrowLeft, Calendar as CalendarIcon, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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

export default function MaterialsKpiClient() {
    const [consumedMaterials, setConsumedMaterials] = React.useState<PackagingMaterial[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
    
    const { toast } = useToast();

    const currentYear = new Date().getFullYear();
    const [selectedYearMode, setSelectedYearMode] = React.useState<string>("custom");

    React.useEffect(() => {
        setDateRange({
            from: addDays(new Date(), -30),
            to: new Date(),
        });

        const q = query(collection(db, "packagingMaterials"), where("status", "==", "consumido"));
        
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

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, [toast]);

    const filteredMaterials = React.useMemo(() => {
        if (!dateRange?.from && !dateRange?.to) return consumedMaterials;
        return consumedMaterials.filter(m => {
            if (!m.tareWeightedAt) return false;
            const tareDate = new Date(m.tareWeightedAt);
            const from = dateRange.from;
            const to = dateRange.to || from;
            
            if (from && tareDate < new Date(from.getFullYear(), from.getMonth(), from.getDate())) return false;
            if (to && tareDate > new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59)) return false;

            return true;
        });
    }, [consumedMaterials, dateRange]);

    const availableYears = React.useMemo(() => {
        const years = new Set<number>();
        consumedMaterials.forEach(m => {
            if (m.tareWeightedAt) {
                years.add(new Date(m.tareWeightedAt).getFullYear());
            }
        });
        years.add(currentYear);
        return Array.from(years).sort((a, b) => b - a);
    }, [consumedMaterials, currentYear]);

    const handleYearChange = (val: string) => {
        setSelectedYearMode(val);
        const now = new Date();
        if (val === "current") {
            setDateRange({
                from: new Date(now.getFullYear(), 0, 1),
                to: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
            });
        } else if (val === "all") {
            setDateRange(undefined);
        } else if (val === "custom") {
            setDateRange({
                from: addDays(now, -30),
                to: now,
            });
        } else {
            const y = parseInt(val);
            setDateRange({
                from: new Date(y, 0, 1),
                to: new Date(y, 11, 31, 23, 59, 59),
            });
        }
    };


    const calculateKpis = (materials: PackagingMaterial[]): Kpi => {
        let totalDiscrepancy = 0;
        let totalActualNetWeight = 0;
        let totalReferenceNetWeight = 0;
        let totalMissingMaterial = 0;
        let totalExtraMaterial = 0;
        let nonConformingCount = 0;

        materials.forEach(m => {
            const isRollosType = m.type === 'rollo_fardo' || m.type === 'rollo_laminado';
            const isSacosType = m.type === 'sacos_familiar' || m.type === 'sacos_granel';
            
            let referenceNetWeight = 0;
            if (isRollosType) {
                referenceNetWeight = m.netWeight || 0;
            } else if (isSacosType) {
                referenceNetWeight = m.totalWeight || 0; 
            }
            
            if (m.actualNetWeight !== undefined && referenceNetWeight > 0) {
                const discrepancy = m.actualNetWeight - referenceNetWeight;
                
                totalDiscrepancy += discrepancy;
                totalActualNetWeight += m.actualNetWeight;
                totalReferenceNetWeight += referenceNetWeight;

                if (discrepancy < 0) { // Material faltante
                    totalMissingMaterial += Math.abs(discrepancy);
                    nonConformingCount++;
                } else { // Material excedente
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
    
    const materialTypeKpis = React.useMemo(() => {
        const byType: { [key: string]: PackagingMaterial[] } = {};
        filteredMaterials.forEach(m => {
            const typeName = materialTypeLabels[m.type];
            if (!byType[typeName]) {
                byType[typeName] = [];
            }
            byType[typeName].push(m);
        });
        
        return Object.entries(byType).map(([name, materials]) => {
            const kpis = calculateKpis(materials);
            return { name, averagePerformance: kpis.averagePerformance, count: materials.length };
        });
    }, [filteredMaterials]);

    const getPerformanceColor = (performance: number) => {
        if (performance >= 99) return 'text-green-600';
        if (performance >= 98) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="bg-background min-h-screen h-full overflow-y-auto text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Button asChild variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                        <Link href="/materials" title="Volver a Materiales">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <BarChart className="h-8 w-8 text-primary flex-shrink-0" />
                    <h1 className="text-2xl font-bold text-foreground">Dashboard de Rendimiento</h1>
                </div>
            </header>

            <main className="p-4 md:p-8 space-y-6">
                <Card className="shadow-sm">
                    <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <span className="text-sm font-medium whitespace-nowrap">Filtro de Análisis:</span>
                            <Select value={selectedYearMode} onValueChange={handleYearChange}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="custom">Mes actual</SelectItem>
                                    <SelectItem value="current">Este año</SelectItem>
                                    <SelectItem value="all">Todos los años</SelectItem>
                                    {availableYears.map(year => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full md:w-auto flex-1">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full md:w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
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
                                        onSelect={(range) => {
                                            setDateRange(range);
                                            setSelectedYearMode("custom");
                                        }}
                                        numberOfMonths={2}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
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
                                        <CardHeader className="pb-0 pt-3">
                                            <CardTitle className="text-sm font-medium">Discrepancia Neta</CardTitle>
                                        </CardHeader>
                                        <CardContent className="pb-3 pt-1">
                                            <div className={cn("text-xl font-bold", overallKpis.totalDiscrepancy >= 0 ? "text-green-600" : "text-red-600")}>
                                                {overallKpis.totalDiscrepancy.toFixed(2)} kg
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">({(overallKpis.totalDiscrepancy * 1000).toLocaleString(undefined, {maximumFractionDigits: 0})} g)</p>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent><p>Diferencia total entre el peso neto real y el de etiqueta. Positivo = excedente, Negativo = faltante.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Card>
                                        <CardHeader className="pb-0 pt-3">
                                            <CardTitle className="text-sm font-medium">Rendimiento Promedio</CardTitle>
                                        </CardHeader>
                                        <CardContent className="pb-3 pt-1">
                                            <div className={cn("text-xl font-bold", getPerformanceColor(overallKpis.averagePerformance))}>
                                                {overallKpis.averagePerformance.toFixed(2)}%
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">Sobre {overallKpis.totalConsumedCount} materiales</p>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent><p>Rendimiento promedio ponderado por peso (Peso Real Total / Peso Etiqueta Total).</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>


                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Card>
                                        <CardHeader className="pb-0 pt-3">
                                            <CardTitle className="text-sm font-medium">Total Material Faltante</CardTitle>
                                        </CardHeader>
                                        <CardContent className="pb-3 pt-1">
                                            <div className="text-xl font-bold text-red-600 flex items-center">
                                                <TrendingDown className="h-4 w-4 mr-1.5" />
                                                {overallKpis.totalMissingMaterial.toFixed(2)} kg
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">({(overallKpis.totalMissingMaterial * 1000).toLocaleString(undefined, {maximumFractionDigits: 0})} g)</p>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent><p>Suma total de todo el material faltante (en kg) en las unidades no conformes.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Card>
                                        <CardHeader className="pb-0 pt-3">
                                            <CardTitle className="text-sm font-medium">Total Material Excedente</CardTitle>
                                        </CardHeader>
                                        <CardContent className="pb-3 pt-1">
                                            <div className="text-xl font-bold text-green-600 flex items-center">
                                                <TrendingUp className="h-4 w-4 mr-1.5" />
                                                {overallKpis.totalExtraMaterial.toFixed(2)} kg
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">({(overallKpis.totalExtraMaterial * 1000).toLocaleString(undefined, {maximumFractionDigits: 0})} g)</p>
                                        </CardContent>
                                    </Card>
                                </TooltipTrigger>
                                <TooltipContent><p>Suma total de todo el material excedente (en kg) en las unidades con sobrepeso.</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                        <Card>
                            <CardHeader>
                                <CardTitle>Rendimiento Promedio por Tipo de Material</CardTitle>
                                <CardDescription>Compara el rendimiento promedio entre los diferentes tipos de material de empaque.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={300}>
                                    <RechartsBarChart data={materialTypeKpis} layout="vertical">
                                        <XAxis type="number" domain={[90, 102]} tickFormatter={(val) => `${val}%`} />
                                        <YAxis dataKey="name" type="category" width={120} />
                                        <RechartsTooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                                        <Bar dataKey="averagePerformance" name="Rendimiento" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </>
                )}
            </main>
        </div>
    );
}

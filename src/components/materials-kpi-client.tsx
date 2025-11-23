

'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart, ChevronLeft, Calendar as CalendarIcon, TrendingUp, TrendingDown } from 'lucide-react';
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


type Kpi = {
    totalDiscrepancy: number;
    averagePerformance: number;
    totalMissingMaterial: number;
    totalExtraMaterial: number;
    totalConsumedCount: number;
};

type SupplierKpi = Kpi & {
    name: string;
};

type MaterialTypeKpi = {
    name: string;
    averagePerformance: number;
    count: number;
}

export default function MaterialsKpiClient({ 
    consumedMaterials,
}: { 
    consumedMaterials: PackagingMaterial[],
}) {
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
    
    const { toast } = useToast();

    React.useEffect(() => {
        setDateRange({
            from: addDays(new Date(), -30),
            to: new Date(),
        });
    }, []);

    const filteredMaterials = React.useMemo(() => {
        if (!dateRange?.from) return [];
        return consumedMaterials.filter(m => {
            if (!m.tareWeightedAt) return false;
            const tareDate = new Date(m.tareWeightedAt);
            const from = dateRange.from!;
            const to = dateRange.to || from;
            // Normalize dates to avoid time zone issues
            const fromDate = new Date(from.getFullYear(), from.getMonth(), from.getDate());
            const toDate = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);

            return tareDate >= fromDate && tareDate <= toDate;
        });
    }, [consumedMaterials, dateRange]);


    const calculateKpis = (materials: PackagingMaterial[]): Kpi => {
        let totalDiscrepancy = 0;
        let totalPerformanceSum = 0;
        let totalMissingMaterial = 0;
        let totalExtraMaterial = 0;
        let performanceCount = 0;

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
                const performance = (m.actualNetWeight / referenceNetWeight) * 100;
                
                totalDiscrepancy += discrepancy;
                totalPerformanceSum += performance;
                performanceCount++;

                if (discrepancy < 0) { // Material faltante
                    totalMissingMaterial += Math.abs(discrepancy);
                } else { // Material excedente
                    totalExtraMaterial += discrepancy;
                }
            }
        });

        return {
            totalDiscrepancy,
            averagePerformance: performanceCount > 0 ? totalPerformanceSum / performanceCount : 0,
            totalMissingMaterial,
            totalExtraMaterial,
            totalConsumedCount: materials.length,
        }
    };

    const overallKpis = React.useMemo(() => calculateKpis(filteredMaterials), [filteredMaterials]);
    
    const supplierKpis = React.useMemo(() => {
        const bySupplier: { [key: string]: PackagingMaterial[] } = {};
        filteredMaterials.forEach(m => {
            const supplierName = m.supplier || 'Sin Proveedor';
            if (!bySupplier[supplierName]) {
                bySupplier[supplierName] = [];
            }
            bySupplier[supplierName].push(m);
        });

        return Object.entries(bySupplier).map(([name, materials]) => {
            const kpis = calculateKpis(materials);
            return { name, ...kpis };
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

    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <BarChart className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Dashboard de Rendimiento</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/materials">
                        <Button variant="outline">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Volver a Materiales
                        </Button>
                    </Link>
                </div>
            </header>

            <main className="p-4 md:p-8 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Filtro de Análisis</CardTitle>
                        <CardDescription>Selecciona el rango de fechas para analizar los materiales consumidos.</CardDescription>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Discrepancia Neta</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className={cn("text-3xl font-bold", overallKpis.totalDiscrepancy >= 0 ? "text-green-600" : "text-red-600")}>
                                {overallKpis.totalDiscrepancy.toFixed(2)} kg
                            </div>
                            <p className="text-xs text-muted-foreground">Positivo es bueno (excedente)</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Rendimiento Promedio</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="text-3xl font-bold">
                                {overallKpis.averagePerformance.toFixed(1)}%
                            </div>
                             <p className="text-xs text-muted-foreground">Sobre {overallKpis.totalConsumedCount} materiales</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Total Material Faltante</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-red-600">
                                <TrendingDown className="inline h-7 w-7 mr-2" />
                                {overallKpis.totalMissingMaterial.toFixed(2)} kg
                            </div>
                            <p className="text-xs text-muted-foreground">Suma de todas las discrepancias negativas</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Total Material Excedente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-600">
                                <TrendingUp className="inline h-7 w-7 mr-2" />
                                {overallKpis.totalExtraMaterial.toFixed(2)} kg
                            </div>
                             <p className="text-xs text-muted-foreground">Suma de todas las discrepancias positivas</p>
                        </CardContent>
                    </Card>
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
                                        <TableHead>Proveedor</TableHead>
                                        <TableHead className="text-right">Rendimiento</TableHead>
                                        <TableHead className="text-right">Discrepancia</TableHead>
                                        <TableHead className="text-right">Materiales</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {supplierKpis.map(kpi => (
                                        <TableRow key={kpi.name}>
                                            <TableCell className="font-medium">{kpi.name}</TableCell>
                                            <TableCell className={cn("text-right font-semibold", kpi.averagePerformance >= 99 ? 'text-green-600' : 'text-amber-600')}>
                                                {kpi.averagePerformance.toFixed(1)}%
                                            </TableCell>
                                            <TableCell className={cn("text-right font-semibold", kpi.totalDiscrepancy >= 0 ? "text-green-600" : "text-red-600")}>
                                                {kpi.totalDiscrepancy.toFixed(2)} kg
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">{kpi.totalConsumedCount}</TableCell>
                                        </TableRow>
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
            </main>
        </div>
    );
}

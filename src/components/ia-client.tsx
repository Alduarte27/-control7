'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Sparkles, LineChart, TrendingUp, HardHat, BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { forecastDemand, type ForecastDemandOutput } from '@/ai/flows/forecast-demand-flow';
import { simulateProduction, type SimulateProductionInput, type SimulateProductionOutput } from '@/ai/flows/simulate-production-flow';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData, CategoryDefinition, ProductDefinition } from '@/lib/types';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Line, BarChart as RechartsBarChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import ComparisonCard from './comparison-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';


// --- Shared Chart Configurations ---

const trendChartConfig = {
  planned: { label: 'Planificado', color: 'hsl(var(--chart-2))' },
  actual: { label: 'Real (s/Plan)', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const simulationChartConfig = {
    optimalProduction: { label: 'Producción Óptima', color: 'hsl(var(--chart-2))' },
    realisticProjection: { label: 'Proyección Realista', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

// --- Type Definitions ---

type WeeklySummaryDoc = {
    id: string;
    week: number;
    year: number;
    totalPlanned: number;
    totalActualForPlanned: number;
    categoryTotals: { [categoryId: string]: { planned: number; actualForPlanned: number; } }
};

// Client-side number formatter to prevent hydration errors
const ClientFormattedNumber = ({ value, maximumFractionDigits = 0 }: { value: number, maximumFractionDigits?: number }) => {
  const [formattedValue, setFormattedValue] = React.useState(String(value));

  React.useEffect(() => {
    setFormattedValue(value.toLocaleString(undefined, { maximumFractionDigits }));
  }, [value, maximumFractionDigits]);

  return <>{formattedValue}</>;
};


// --- Main IA Client Component ---

export default function IAClient({ 
  prefetchedCategories, 
  prefetchedProducts 
}: { 
  initialPlanId?: string,
  prefetchedCategories: CategoryDefinition[], 
  prefetchedProducts: ProductDefinition[]
}) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [allSummaries, setAllSummaries] = React.useState<WeeklySummaryDoc[]>([]);
  const [allPlans, setAllPlans] = React.useState<any[]>([]);
  
  // --- States for each Tab ---
  const [isForecasting, setIsForecasting] = React.useState(false);
  const [forecast, setForecast] = React.useState<ForecastDemandOutput | null>(null);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [simulationResult, setSimulationResult] = React.useState<SimulateProductionOutput | null>(null);

  // --- Initial Data Fetching ---
  React.useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const [summariesSnapshot, plansSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'weeklySummaries'))),
            getDocs(query(collection(db, "productionPlans")))
        ]);

        const fetchedSummaries = summariesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklySummaryDoc));
        setAllSummaries(fetchedSummaries);

        const fetchedPlans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side to avoid index errors
        fetchedPlans.sort((a, b) => b.id.localeCompare(a.id));
        setAllPlans(fetchedPlans);
        
      } catch (error) {
        console.error("Error fetching historical data:", error);
        toast({ title: 'Error al cargar historial', variant: 'destructive' });
      }
      setLoading(false);
    };
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // --- Memoized Derived Data ---
  const historicalTrendData = React.useMemo(() => {
    return allSummaries.slice(0, 12).reverse().map(summary => ({
        name: `S${summary.week}`,
        planned: summary.totalPlanned,
        actual: summary.totalActualForPlanned,
    }));
  }, [allSummaries]);

  // --- AI Flow Handlers ---
  const handleForecastDemand = async () => {
    setIsForecasting(true);
    setForecast(null);
    toast({ title: 'Generando Pronóstico', description: 'La IA está analizando tendencias...' });
    try {
      const historicalDataForAI = allPlans.slice(0, 4).map(plan => ({
          week: plan.week,
          year: plan.year,
          products: plan.products.map((p: ProductData) => ({
              productName: p.productName,
              totalActual: Object.values(p.actual).reduce((sum: any, s: any) => sum + (s.day || 0) + (s.night || 0), 0),
              categoryIsPlanned: p.categoryIsPlanned ?? true,
          }))
      })).reverse();
      
      const result = await forecastDemand({ historicalData: historicalDataForAI });
      setForecast(result);
    } catch (error) {
      toast({ title: 'Error de Pronóstico', description: 'No se pudo generar el pronóstico.', variant: 'destructive' });
    } finally {
      setIsForecasting(false);
    }
  };

  const handleSimulation = async (input: SimulateProductionInput) => {
    setIsSimulating(true);
    setSimulationResult(null);
    toast({ title: 'Ejecutando Simulación', description: 'La IA está procesando los parámetros...' });
    try {
        const selectedProduct = prefetchedProducts.find(p => p.id === input.productName); // It's the ID
        if (!selectedProduct) throw new Error("Producto no encontrado");

        const productPlans = allPlans
            .map(plan => ({
                ...plan,
                productData: plan.products.find((p: ProductData) => p.id === selectedProduct.id)
            }))
            .filter(plan => plan.productData && plan.productData.planned > 0);

        const historicalPerformance = productPlans.slice(0, 5).map(plan => {
            const totalActual = Object.values(plan.productData.actual).reduce((sum: number, day: any) => sum + (day.day || 0) + (day.night || 0), 0);
            return {
                totalPlanned: plan.productData.planned,
                totalActual: totalActual,
                efficiency: (totalActual / plan.productData.planned) * 100
            };
        });

        const result = await simulateProduction({
            ...input,
            productName: selectedProduct.productName,
            historicalPerformance: historicalPerformance.length > 0 ? historicalPerformance : undefined
        });
        setSimulationResult(result);
    } catch (error) {
        toast({ title: 'Error de Simulación', description: 'No se pudo completar la simulación.', variant: 'destructive' });
    } finally {
        setIsSimulating(false);
    }
  };
  
  return (
    <>
      <div className="bg-background min-h-screen text-foreground">
        <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Análisis con IA</h1>
          </div>
          <Link href="/"><Button variant="outline"><ChevronLeft />Volver</Button></Link>
        </header>
        
        <main className="p-4 md:p-8 space-y-6">
            <Tabs defaultValue="simulator" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="simulator"><HardHat className="mr-2" />Simulador</TabsTrigger>
                    <TabsTrigger value="forecast"><TrendingUp className="mr-2" />Pronóstico</TabsTrigger>
                </TabsList>
                
                <TabsContent value="simulator" className="mt-6">
                    <SimulatorTab onSimulate={handleSimulation} isSimulating={isSimulating} result={simulationResult} products={prefetchedProducts} />
                </TabsContent>
                <TabsContent value="forecast" className="mt-6">
                    <ForecastTab onForecast={handleForecastDemand} isForecasting={isForecasting} forecast={forecast} trendData={historicalTrendData} isLoading={loading} />
                </TabsContent>
            </Tabs>
        </main>
      </div>
    </>
  );
}

// --- Tab Components ---

function SimulatorTab({ onSimulate, isSimulating, result, products }: {
    onSimulate: (input: SimulateProductionInput) => void;
    isSimulating: boolean;
    result: SimulateProductionOutput | null;
    products: ProductDefinition[];
}) {
    type SimInputState = {
        productId: string;
        machineSpeed: number; // fundas/min
        performanceLoss: number; // percentage
        unitsPerSack: number;
        hoursPerDayShift: number;
        hoursPerNightShift: number;
        activeDays: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean; };
    }

    const [simInput, setSimInput] = React.useState<SimInputState>({
        productId: products.find(p => p.isActive)?.id || '',
        machineSpeed: 40,
        performanceLoss: 8,
        unitsPerSack: 50,
        hoursPerDayShift: 11,
        hoursPerNightShift: 11,
        activeDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
    });

    const calculatedValues = React.useMemo(() => {
        const unitsPerMinute = simInput.machineSpeed;
        const grossUnitsPerHour = unitsPerMinute * 60;
        const effectiveUnitsPerHour = grossUnitsPerHour * (1 - (simInput.performanceLoss / 100));
        const sacksPerHour = simInput.unitsPerSack > 0 ? effectiveUnitsPerHour / simInput.unitsPerSack : 0;
        
        const sacksPerShift = sacksPerHour * simInput.hoursPerDayShift;
        const sacksPerDay = sacksPerHour * (simInput.hoursPerDayShift + simInput.hoursPerNightShift);
        const activeDayCount = Object.values(simInput.activeDays).filter(Boolean).length;
        const weeklyProduction = sacksPerDay * activeDayCount;

        return { grossUnitsPerHour, effectiveUnitsPerHour, sacksPerHour, sacksPerShift, sacksPerDay, weeklyProduction };
    }, [simInput]);

    const handleInputChange = (field: keyof Omit<SimInputState, 'activeDays' | 'productId'>, value: string | number) => {
        setSimInput(prev => ({ ...prev, [field]: Number(value) }));
    };
    
    const handleProductChange = (productId: string) => {
        setSimInput(p => ({...p, productId}));
    }

    const handleDayChange = (day: keyof SimInputState['activeDays'], checked: boolean) => {
        setSimInput(prev => ({ ...prev, activeDays: { ...prev, activeDays: { ...prev.activeDays, [day]: checked } } }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSimulate({
            productName: simInput.productId, // Pass the ID, flow will get the name
            productionRate: calculatedValues.sacksPerHour,
            hoursPerDayShift: simInput.hoursPerDayShift,
            hoursPerNightShift: simInput.hoursPerNightShift,
            activeDays: simInput.activeDays,
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><HardHat />Simulador de Producción Inteligente</CardTitle>
                <CardDescription>Estima la producción semanal basándote en parámetros operativos y compárala con proyecciones realistas basadas en el historial.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent>
                    <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                        {/* Columna de Inputs */}
                        <div className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="product-select">Producto</Label>
                                <Select value={simInput.productId} onValueChange={handleProductChange}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                                    <SelectContent>
                                        {products.filter(p => p.isActive).map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.productName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                               <div className="space-y-2">
                                    <Label htmlFor="machine-speed">Velocidad (fundas/min)</Label>
                                    <Input id="machine-speed" type="number" value={simInput.machineSpeed} onChange={e => handleInputChange('machineSpeed', e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="performance-loss">Pérdida Rendimiento (%)</Label>
                                    <Input id="performance-loss" type="number" value={simInput.performanceLoss} onChange={e => handleInputChange('performanceLoss', e.target.value)} required />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="units-per-sack">Unidades/Saco</Label>
                                    <Input id="units-per-sack" type="number" value={simInput.unitsPerSack} onChange={e => handleInputChange('unitsPerSack', e.target.value)} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="day-shift">Horas Turno Día</Label>
                                    <Input id="day-shift" type="number" value={simInput.hoursPerDayShift} onChange={e => handleInputChange('hoursPerDayShift', e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="night-shift">Horas Turno Noche</Label>
                                    <Input id="night-shift" type="number" value={simInput.hoursPerNightShift} onChange={e => handleInputChange('hoursPerNightShift', e.target.value)} required />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label>Días de Producción Activos</Label>
                                <div className="flex flex-wrap gap-4 pt-2">
                                    {Object.keys(simInput.activeDays).map(day => (
                                        <div key={day} className="flex items-center space-x-2">
                                            <Checkbox id={day} checked={simInput.activeDays[day as keyof typeof simInput.activeDays]} onCheckedChange={(checked) => handleDayChange(day as keyof typeof simInput.activeDays, !!checked)} />
                                            <Label htmlFor={day} className="capitalize text-sm font-normal">{day}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Columna de Resultados */}
                        <div className="space-y-4">
                             <div>
                                <Label>Resultados del Cálculo (Estimaciones)</Label>
                                <Table className="mt-2">
                                    <TableBody>
                                         <TableRow>
                                            <TableCell>Fundas por Hora (bruto)</TableCell>
                                            <TableCell className="text-right font-medium">
                                                <ClientFormattedNumber value={calculatedValues.grossUnitsPerHour} maximumFractionDigits={0} />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Fundas por Hora (con rendimiento)</TableCell>
                                            <TableCell className="text-right font-medium">
                                                <ClientFormattedNumber value={calculatedValues.effectiveUnitsPerHour} maximumFractionDigits={2} />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow className="bg-muted/50">
                                            <TableCell className="font-bold text-primary">Sacos por Hora (neto)</TableCell>
                                            <TableCell className="text-right font-bold text-primary text-base">
                                                <ClientFormattedNumber value={calculatedValues.sacksPerHour} maximumFractionDigits={2} />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Sacos por Turno ({simInput.hoursPerDayShift} hrs)</TableCell>
                                            <TableCell className="text-right">
                                                <ClientFormattedNumber value={calculatedValues.sacksPerShift} maximumFractionDigits={0} />
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell className="font-medium">Sacos por Día ({simInput.hoursPerDayShift + simInput.hoursPerNightShift} hrs)</TableCell>
                                            <TableCell className="text-right">
                                                <ClientFormattedNumber value={calculatedValues.sacksPerDay} maximumFractionDigits={0} />
                                            </TableCell>
                                        </TableRow>
                                         <TableRow>
                                            <TableCell className="font-medium">Producción Semanal</TableCell>
                                            <TableCell className="text-right">
                                                <ClientFormattedNumber value={calculatedValues.weeklyProduction} maximumFractionDigits={0} />
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                             </div>
                        </div>
                    </div>
                     <div className="px-6 pt-4">
                        {isSimulating &&  <p className="text-center text-muted-foreground pt-4">La IA está calculando la simulación...</p>}
                        {result && (
                            <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md w-full">
                                <h4 className="font-semibold">Recomendaciones de la IA</h4>
                                {result.recommendations.split('\n').map((line, i) => <p key={i} className="my-1">{line}</p>)}
                            </div>
                        )}
                     </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSimulating || !simInput.productId}><BrainCircuit className="mr-2" />{isSimulating ? 'Calculando...' : 'Ejecutar Simulación con IA'}</Button>
                </CardFooter>
            </form>
            
            {result && (
                <CardContent className="mt-6 border-t pt-6">
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-center">Resultados de la Simulación Semanal (en Sacos)</h3>
                        <div className="grid md:grid-cols-2 gap-6 items-center">
                            <div className="space-y-4">
                                <ComparisonCard 
                                    title="Producción Óptima Semanal (2 Turnos)" 
                                    valueA={0} 
                                    valueB={result.totalOptimalProduction * 2} 
                                    showPercentage={false} 
                                    description="Cálculo teórico máximo basado en los parámetros de entrada, sin considerar paradas o ineficiencias."
                                />
                                <ComparisonCard 
                                    title="Proyección Realista Semanal (2 Turnos)" 
                                    valueA={result.totalOptimalProduction * 2} 
                                    valueB={result.totalRealisticProjection * 2} 
                                    isPercentage={false}
                                    description="Estimación ajustada basada en la eficiencia histórica real, ofreciendo un pronóstico más alcanzable."
                                />
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2 text-center">Desglose Diario y Proyección (1 Turno)</h4>
                                <ChartContainer config={simulationChartConfig} className="w-full h-[300px]">
                                    <RechartsBarChart data={result.dailyBreakdown}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis dataKey="day" />
                                        <YAxis />
                                        <RechartsTooltip content={<ChartTooltipContent />} />
                                        <Legend content={<ChartLegendContent />} />
                                        <Bar dataKey="optimalProduction" fill="var(--color-optimalProduction)" radius={4} />
                                        <Bar dataKey="realisticProjection" fill="var(--color-realisticProjection)" radius={4} />
                                    </RechartsBarChart>
                                </ChartContainer>
                            </div>
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

function ForecastTab({ onForecast, isForecasting, forecast, trendData, isLoading }: {
    onForecast: () => void;
    isForecasting: boolean;
    forecast: ForecastDemandOutput | null;
    trendData: any[];
    isLoading: boolean;
}) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp />Proyecciones y Pronósticos</CardTitle>
                    <CardDescription>Usa IA para generar un pronóstico cualitativo de la demanda para las próximas semanas basado en tendencias históricas.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={onForecast} disabled={isForecasting}><TrendingUp className={`mr-2 ${isForecasting ? 'animate-spin' : ''}`} />{isForecasting ? 'Generando...' : 'Generar Pronóstico de Demanda'}</Button>
                </CardContent>
                {(isForecasting || forecast) && (
                  <CardContent className="mt-6 border-t pt-6">
                     {isForecasting ? (
                        <p className="text-center text-muted-foreground">La IA está analizando las tendencias...</p>
                     ) : forecast && (
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg pt-4">Pronóstico de Demanda (Análisis IA)</h3>
                          <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md w-full">{forecast.analysis.split('\n').map((p, i) => <p key={i}>{p}</p>)}</div>
                        </div>
                     )}
                  </CardContent>
                )}
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><LineChart />Tendencias de Producción</CardTitle>
                    <CardDescription>Evolución de la producción planificada vs. la real en las últimas semanas.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Cargando...</p> : trendData.length > 0 ? (
                        <ChartContainer config={trendChartConfig} className="w-full h-[300px]">
                            <ComposedChart data={trendData}>
                                <CartesianGrid vertical={false} /><XAxis dataKey="name" /><YAxis />
                                <RechartsTooltip content={<ChartTooltipContent />} /><Legend content={<ChartLegendContent />} />
                                <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                                <Line type="monotone" dataKey="actual" stroke="var(--color-actual)" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ChartContainer>
                    ) : <p>No hay datos históricos.</p>}
                </CardContent>
            </Card>
        </div>
    );
}

    
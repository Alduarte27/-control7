'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Sparkles, LineChart, TrendingUp, HardHat, Package, Percent, Clock, FileDigit, Sun, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { forecastDemand, type ForecastDemandOutput } from '@/ai/flows/forecast-demand-flow';
import { simulateProduction, type SimulateProductionOutput } from '@/ai/flows/simulate-production-flow';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData, CategoryDefinition, ProductDefinition } from '@/lib/types';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import KpiCard from '@/components/kpi-card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

const trendChartConfig = {
  planned: { label: 'Planificado', color: 'hsl(var(--chart-2))' },
  actual: { label: 'Real (s/Plan)', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

type WeeklySummaryDoc = {
    id: string;
    week: number;
    year: number;
    totalPlanned: number;
    totalActualForPlanned: number;
    categoryTotals: { [categoryId: string]: { planned: number; actualForPlanned: number; } }
};

export default function OperationsClient({ 
  prefetchedCategories, 
  prefetchedProducts 
}: { 
  prefetchedCategories: CategoryDefinition[], 
  prefetchedProducts: ProductDefinition[]
}) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [allSummaries, setAllSummaries] = React.useState<WeeklySummaryDoc[]>([]);
  const [allPlans, setAllPlans] = React.useState<any[]>([]);
  
  const [isForecasting, setIsForecasting] = React.useState(false);
  const [forecast, setForecast] = React.useState<ForecastDemandOutput | null>(null);
  
  React.useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const [summariesSnapshot, plansSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'weeklySummaries'))),
            getDocs(query(collection(db, "productionPlans")))
        ]);

        const fetchedSummaries = summariesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklySummaryDoc));
        fetchedSummaries.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.week - a.week;
        });
        setAllSummaries(fetchedSummaries);

        const fetchedPlans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        fetchedPlans.sort((a, b) => {
            if (!a.id || !b.id) return 0;
            return a.id.localeCompare(b.id);
        });
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
  
  const historicalTrendData = React.useMemo(() => {
    return allSummaries.slice(-12).map(summary => ({
        name: `S${summary.week}`,
        planned: summary.totalPlanned,
        actual: summary.totalActualForPlanned,
    }));
  }, [allSummaries]);

  const handleForecastDemand = async () => {
    setIsForecasting(true);
    setForecast(null);
    toast({ title: 'Generando Pronóstico', description: 'La IA está analizando tendencias...' });
    try {
      const historicalDataForAI = allPlans.slice(-4).map(plan => ({
          week: plan.week,
          year: plan.year,
          products: plan.products.map((p: ProductData) => ({
              productName: p.productName,
              totalActual: Object.values(p.actual).reduce((sum: any, s: any) => sum + (s.day || 0) + (s.night || 0), 0),
              categoryIsPlanned: p.categoryIsPlanned ?? true,
          }))
      }));
      
      const result = await forecastDemand({ historicalData: historicalDataForAI });
      setForecast(result);
    } catch (error) {
      toast({ title: 'Error de Pronóstico', description: 'No se pudo generar el pronóstico.', variant: 'destructive' });
    } finally {
      setIsForecasting(false);
    }
  };

  return (
    <>
      <div className="bg-background min-h-screen text-foreground">
        <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Centro de Operaciones</h1>
          </div>
          <Link href="/"><Button variant="outline"><ChevronLeft />Volver</Button></Link>
        </header>
        
        <main className="p-4 md:p-8 space-y-6">
            <Tabs defaultValue="prod-simulator" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="prod-simulator"><HardHat className="mr-2" />Simulador de Producción</TabsTrigger>
                    <TabsTrigger value="forecast"><TrendingUp className="mr-2" />Pronóstico de Demanda</TabsTrigger>
                </TabsList>
                
                <TabsContent value="prod-simulator" className="mt-6">
                    <ProductionSimulatorTab products={prefetchedProducts} allPlans={allPlans} />
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

const dayMapping: { [key: string]: string } = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo' };

function ProductionSimulatorTab({ products, allPlans }: {
    products: ProductDefinition[];
    allPlans: any[];
}) {
    const { toast } = useToast();
    const plannableProducts = React.useMemo(() => products.filter(p => p.isActive), [products]);

    const [simulationParams, setSimulationParams] = React.useState({
        productId: plannableProducts[0]?.id || '',
        productionRate: 40,
        hoursPerDayShift: 12,
        hoursPerNightShift: 12,
        activeDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false }
    });

    const [isSimulating, setIsSimulating] = React.useState(false);
    const [simulationResult, setSimulationResult] = React.useState<SimulateProductionOutput | null>(null);

    const handleParamChange = (field: string, value: any) => {
        setSimulationParams(prev => ({ ...prev, [field]: value }));
    };
    
    const handleDayChange = (day: string, checked: boolean) => {
        setSimulationParams(prev => ({
            ...prev,
            activeDays: { ...prev.activeDays, [day]: checked }
        }));
    };

    const handleRunSimulation = async () => {
        if (!simulationParams.productId) {
            toast({ title: 'Error', description: 'Por favor, selecciona un producto.', variant: 'destructive' });
            return;
        }

        setIsSimulating(true);
        setSimulationResult(null);
        toast({ title: 'Ejecutando Simulación', description: 'La IA está calculando las proyecciones...' });

        try {
            const productName = products.find(p => p.id === simulationParams.productId)?.productName || '';

            // Find historical performance for the selected product
            const historicalPerformance = allPlans.slice(-4).map(plan => {
                const productData = plan.products.find((p: ProductData) => p.id === simulationParams.productId);
                if (!productData) return null;

                const totalActual = Object.values(productData.actual).reduce((sum: number, day: any) => sum + (day.day || 0) + (day.night || 0), 0);
                const totalPlanned = productData.planned || 0;
                
                return {
                    totalPlanned,
                    totalActual,
                    efficiency: totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0,
                };
            }).filter(Boolean);

            const result = await simulateProduction({
                productName,
                productionRate: simulationParams.productionRate,
                hoursPerDayShift: simulationParams.hoursPerDayShift,
                hoursPerNightShift: simulationParams.hoursPerNightShift,
                activeDays: simulationParams.activeDays,
                historicalPerformance: historicalPerformance as any,
            });

            setSimulationResult(result);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error de Simulación', variant: 'destructive' });
        } finally {
            setIsSimulating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><HardHat />Parámetros de Simulación</CardTitle>
                        <CardDescription>Configura los parámetros para simular una semana de producción.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="product-select">Producto a Simular</Label>
                            <Select value={simulationParams.productId} onValueChange={(val) => handleParamChange('productId', val)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {plannableProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="production-rate">Tasa de Producción (sacos/hora)</Label>
                            <Input id="production-rate" type="number" value={simulationParams.productionRate} onChange={e => handleParamChange('productionRate', Number(e.target.value))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="day-shift-hours">Horas Turno Día</Label>
                                <Input id="day-shift-hours" type="number" value={simulationParams.hoursPerDayShift} onChange={e => handleParamChange('hoursPerDayShift', Number(e.target.value))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="night-shift-hours">Horas Turno Noche</Label>
                                <Input id="night-shift-hours" type="number" value={simulationParams.hoursPerNightShift} onChange={e => handleParamChange('hoursPerNightShift', Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Días de Producción Activos</Label>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-sm">
                                {Object.entries(dayMapping).map(([key, name]) => (
                                    <div key={key} className="flex items-center gap-2">
                                        {/* @ts-ignore */}
                                        <Checkbox id={`day-${key}`} checked={simulationParams.activeDays[key]} onCheckedChange={(checked) => handleDayChange(key, !!checked)} />
                                        <Label htmlFor={`day-${key}`}>{name}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                         <Button onClick={handleRunSimulation} disabled={isSimulating} className="w-full">
                            <Sparkles className={`mr-2 h-4 w-4 ${isSimulating ? 'animate-spin' : ''}`} />
                            {isSimulating ? 'Simulando...' : 'Ejecutar Simulación con IA'}
                        </Button>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Resultados de la Simulación</CardTitle>
                        <CardDescription>Proyecciones y recomendaciones generadas por la IA.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isSimulating ? (
                            <p className="text-center text-muted-foreground py-10">La IA está procesando los datos...</p>
                        ) : !simulationResult ? (
                            <p className="text-center text-muted-foreground py-10">Ejecuta la simulación para ver los resultados.</p>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <KpiCard title="Producción Óptima" value={simulationResult.totalOptimalProduction.toLocaleString()} icon={Package} description="Máxima producción teórica posible en la semana (1 turno)." />
                                     <KpiCard title="Proyección Realista" value={simulationResult.totalRealisticProjection.toLocaleString()} icon={FileDigit} description="Producción estimada aplicando la eficiencia histórica." />
                                     <KpiCard title="Eficiencia Promedio" value={`${simulationResult.averageEfficiency.toFixed(1)}%`} icon={Percent} description="Eficiencia promedio basada en el historial de producción de este producto." />
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Desglose Diario (Proyección en Sacos)</h4>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Día</TableHead>
                                                <TableHead className="text-right">Producción Óptima</TableHead>
                                                <TableHead className="text-right">Proyección Realista</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {simulationResult.dailyBreakdown.map(day => (
                                                <TableRow key={day.day}>
                                                    <TableCell>{day.day}</TableCell>
                                                    <TableCell className="text-right">{day.optimalProduction.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">{day.realisticProjection.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Recomendaciones de la IA</h4>
                                    <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md w-full">
                                      {simulationResult.recommendations.split('- ').filter(rec => rec.trim()).map((rec, i) => (
                                        <p key={i} className="my-1.5">- {rec}</p>
                                      ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
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

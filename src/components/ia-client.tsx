'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Sparkles, LineChart, TrendingUp, HardHat, Package, Percent, Clock, FileDigit, Sun, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { forecastDemand, type ForecastDemandOutput } from '@/ai/flows/forecast-demand-flow';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData, CategoryDefinition, ProductDefinition } from '@/lib/types';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import KpiCard from './kpi-card';


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
        fetchedSummaries.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.week - b.week;
        });
        setAllSummaries(fetchedSummaries);

        const fetchedPlans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort client-side to avoid complex queries
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
  
  // --- Memoized Derived Data ---
  const historicalTrendData = React.useMemo(() => {
    return allSummaries.slice(-12).map(summary => ({
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
                    <SimulatorTab 
                      products={prefetchedProducts} 
                      categories={prefetchedCategories} 
                    />
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

function SimulatorTab({ products, categories }: {
    products: ProductDefinition[];
    categories: CategoryDefinition[];
}) {
    type SimInputState = {
        productId: string;
        machineSpeed: number; // fundas/min
        performanceLoss: number; // percentage
        unitsPerSack: number;
        numberOfMachines: number;
        hoursPerDayShift: number;
        hoursPerNightShift: number;
        activeDays: { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean; };
    }

    const categoryMap = React.useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
    const plannableProducts = React.useMemo(() => products.filter(p => p.isActive && categoryMap.get(p.categoryId)?.isPlanned), [products, categoryMap]);
    const [formattedWeeklyProduction, setFormattedWeeklyProduction] = React.useState<string>("...");


    const [simInput, setSimInput] = React.useState<SimInputState>({
        productId: plannableProducts[0]?.id || '',
        machineSpeed: 40,
        performanceLoss: 8,
        unitsPerSack: 50,
        numberOfMachines: 1,
        hoursPerDayShift: 11,
        hoursPerNightShift: 11,
        activeDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false },
    });
    
    React.useEffect(() => {
      if (!simInput.productId && plannableProducts.length > 0) {
        setSimInput(prev => ({...prev, productId: plannableProducts[0].id}));
      }
    }, [plannableProducts, simInput.productId]);

    const calculatedValues = React.useMemo(() => {
        // Optimal (Gross) Calculations
        const grossUnitsPerMinute = simInput.machineSpeed;
        const grossUnitsPerHour = grossUnitsPerMinute * 60;
        const grossSacksPerHour = simInput.unitsPerSack > 0 ? grossUnitsPerHour / simInput.unitsPerSack : 0;
        const optimalDailyProductionDayShift = grossSacksPerHour * simInput.hoursPerDayShift;

        // Realistic (Net) Calculations
        const netUnitsPerHour = grossUnitsPerHour * (1 - (simInput.performanceLoss / 100));
        const netSacksPerHour = simInput.unitsPerSack > 0 ? netUnitsPerHour / simInput.unitsPerSack : 0;
        const realisticDailyProductionDayShift = netSacksPerHour * simInput.hoursPerDayShift;
        const realisticDailyProductionNightShift = netSacksPerHour * simInput.hoursPerNightShift;
        
        const numberOfActiveDays = Object.values(simInput.activeDays).filter(Boolean).length;
        const weeklyProduction = (realisticDailyProductionDayShift + realisticDailyProductionNightShift) * numberOfActiveDays * simInput.numberOfMachines;
        
        const dailyBreakdown = Object.entries(simInput.activeDays)
            .filter(([, isActive]) => isActive)
            .map(([day]) => ({
                day: day.substring(0, 3),
                optimalProduction: optimalDailyProductionDayShift,
                realisticProjection: realisticDailyProductionDayShift,
            }));

        return { 
            grossUnitsPerMinute, 
            grossUnitsPerHour, 
            netUnitsPerHour, 
            netSacksPerHour,
            realisticDailyProductionDayShift,
            realisticDailyProductionNightShift,
            weeklyProduction,
            dailyBreakdown,
        };
    }, [simInput]);

    React.useEffect(() => {
        setFormattedWeeklyProduction(
            calculatedValues.weeklyProduction.toLocaleString(undefined, {
                maximumFractionDigits: 0,
            })
        );
    }, [calculatedValues.weeklyProduction]);

    const handleInputChange = (field: keyof Omit<SimInputState, 'activeDays' | 'productId'>, value: string | number) => {
        setSimInput(prev => ({ ...prev, [field]: Number(value) }));
    };
    
    const handleProductChange = (productId: string) => {
        setSimInput(p => ({...p, productId}));
    }

    const handleDayChange = (day: keyof SimInputState['activeDays'], checked: boolean) => {
        setSimInput(prev => ({ ...prev, activeDays: { ...prev, activeDays: { ...prev.activeDays, [day]: checked } } }));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><HardHat />Parámetros de Simulación</CardTitle>
                        <CardDescription>Ajusta las variables para proyectar la producción.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            <h3 className="font-semibold text-foreground text-xs">1. PARÁMETROS DEL PRODUCTO</h3>
                            <div className="space-y-1.5">
                                <Label htmlFor="product-select">Producto a Simular</Label>
                                <Select value={simInput.productId} onValueChange={handleProductChange} disabled={plannableProducts.length === 0}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                                    <SelectContent>
                                        {plannableProducts.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="units-per-sack">Unidades por Saco</Label>
                                <Input id="units-per-sack" type="number" value={simInput.unitsPerSack} onChange={e => handleInputChange('unitsPerSack', e.target.value)} required />
                            </div>
                        </div>

                         <div className="space-y-2">
                            <h3 className="font-semibold text-foreground text-xs">2. PARÁMETROS DE MAQUINARIA</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="machine-speed">Velocidad (fundas/min)</Label>
                                    <Input id="machine-speed" type="number" value={simInput.machineSpeed} onChange={e => handleInputChange('machineSpeed', e.target.value)} required />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="performance-loss">Pérdida (%)</Label>
                                    <Input id="performance-loss" type="number" value={simInput.performanceLoss} onChange={e => handleInputChange('performanceLoss', e.target.value)} required />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="number-of-machines">Número de Máquinas a Simular</Label>
                                <Input id="number-of-machines" type="number" value={simInput.numberOfMachines} onChange={e => handleInputChange('numberOfMachines', e.target.value)} required min="1" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-semibold text-foreground text-xs">3. HORARIO DE PRODUCCIÓN</h3>
                             <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="day-shift">Horas Turno Día</Label>
                                    <Input id="day-shift" type="number" value={simInput.hoursPerDayShift} onChange={e => handleInputChange('hoursPerDayShift', e.target.value)} required />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="night-shift">Horas Turno Noche</Label>
                                    <Input id="night-shift" type="number" value={simInput.hoursPerNightShift} onChange={e => handleInputChange('hoursPerNightShift', e.target.value)} required />
                                </div>
                            </div>
                            <div className="space-y-1.5 pt-1">
                                <Label className="font-semibold text-xs">Días Activos</Label>
                                <div className="flex flex-wrap gap-x-3 gap-y-1">
                                    {Object.keys(simInput.activeDays).map(day => (
                                        <div key={day} className="flex items-center space-x-1.5">
                                            <Checkbox id={day} checked={simInput.activeDays[day as keyof typeof simInput.activeDays]} onCheckedChange={(checked) => handleDayChange(day as keyof typeof simInput.activeDays, !!checked)} />
                                            <Label htmlFor={day} className="capitalize text-sm font-normal">{day.substring(0,3)}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Cálculo de Tasa de Producción</CardTitle>
                        <CardDescription>Desglose de la capacidad por máquina.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="grid grid-cols-2 gap-2">
                            <KpiCard title="Unidades/Minuto" value={calculatedValues.grossUnitsPerMinute} icon={FileDigit} description="Velocidad de la máquina en fundas por minuto." />
                            <KpiCard title="Unidades/Hora (Bruto)" value={calculatedValues.grossUnitsPerHour} icon={Clock} description="Producción teórica por hora sin considerar pérdidas." />
                            <KpiCard title="Unidades/Hora (Neto)" value={calculatedValues.netUnitsPerHour} icon={Percent} description="Producción por hora ajustada por la pérdida de rendimiento." />
                            <KpiCard title="Sacos por Hora (Neto)" value={calculatedValues.netSacksPerHour} fractionDigits={2} icon={Package} description="Tasa de producción final que se usará para la simulación de la IA." valueColor="text-primary" />
                            <KpiCard title="Producción Turno Día" value={calculatedValues.realisticDailyProductionDayShift} icon={Sun} description="Producción neta estimada para un solo turno de día." />
                            <KpiCard title="Producción Turno Noche" value={calculatedValues.realisticDailyProductionNightShift} icon={Moon} description="Producción neta estimada para un solo turno de noche." />
                         </div>
                         <div className="border-t pt-3 mt-3">
                            <p className="text-sm text-muted-foreground">Producción Semanal Estimada (Total)</p>
                            <p className="text-2xl font-bold text-primary">{formattedWeeklyProduction} Sacos</p>
                            <p className="text-xs text-muted-foreground">Considerando {simInput.numberOfMachines} máquina(s) y los días activos seleccionados.</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Desglose de Producción Diaria (1 Turno)</CardTitle>
                             <CardDescription>Comparación de la producción óptima vs. la realista para un turno de día en los días activos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={simulationChartConfig} className="w-full h-[260px]">
                                <ComposedChart data={calculatedValues.dailyBreakdown}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="day" tickMargin={5} fontSize={10} />
                                    <YAxis fontSize={10}/>
                                    <RechartsTooltip content={<ChartTooltipContent />} />
                                    <Legend content={<ChartLegendContent />} />
                                    <Bar dataKey="optimalProduction" fill="var(--color-optimalProduction)" radius={4} />
                                    <Bar dataKey="realisticProjection" fill="var(--color-realisticProjection)" radius={4} />
                                </ComposedChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
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

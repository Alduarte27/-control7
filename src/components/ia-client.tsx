'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Sparkles, LineChart, TrendingUp, HardHat, Package, Percent, Clock, FileDigit, Sun, Moon, Database, Donut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { forecastDemand, type ForecastDemandOutput } from '@/ai/flows/forecast-demand-flow';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData, CategoryDefinition, ProductDefinition } from '@/lib/types';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Line, Pie, PieChart, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import KpiCard from '@/components/kpi-card';

const trendChartConfig = {
  planned: { label: 'Planificado', color: 'hsl(var(--chart-2))' },
  actual: { label: 'Real (s/Plan)', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const KG_PER_QUINTAL = 50;

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
  initialPlanId?: string,
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
            <Tabs defaultValue="silo-simulator" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="silo-simulator"><Database className="mr-2" />Simulador de Silo</TabsTrigger>
                    <TabsTrigger value="forecast"><TrendingUp className="mr-2" />Pronóstico de Demanda</TabsTrigger>
                </TabsList>
                
                <TabsContent value="silo-simulator" className="mt-6">
                    <SiloSimulatorTab products={prefetchedProducts} categories={prefetchedCategories} />
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

function SiloSimulatorTab({ products, categories }: {
    products: ProductDefinition[];
    categories: CategoryDefinition[];
}) {
    const [siloMass, setSiloMass] = React.useState(25000); // Default 25 tons in kg
    const categoryMap = React.useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
    const plannableProducts = React.useMemo(() => products.filter(p => p.isActive && categoryMap.get(p.categoryId)?.isPlanned), [products, categoryMap]);
    
    const [machines, setMachines] = React.useState([
        { id: 1, active: true, productId: plannableProducts[0]?.id || '', speed: 40, loss: 8 },
        { id: 2, active: true, productId: plannableProducts[1]?.id || '', speed: 40, loss: 8 },
        { id: 3, active: false, productId: plannableProducts[2]?.id || '', speed: 40, loss: 8 },
    ]);

    const results = React.useMemo(() => {
        let totalNetSacksPerHour = 0;
        const machineResults: any[] = [];

        machines.forEach(machine => {
            if (!machine.active || !machine.productId) return;

            const product = products.find(p => p.id === machine.productId);
            if (!product) return;

            const sackWeight = product.sackWeight || 50;
            const grossUnitsPerHour = machine.speed * 60;
            const netSacksPerHour = (grossUnitsPerHour * (1 - machine.loss / 100)) / sackWeight;
            
            totalNetSacksPerHour += netSacksPerHour;
            machineResults.push({
                machineId: machine.id,
                productName: product.productName,
                netSacksPerHour: netSacksPerHour,
            });
        });

        if (totalNetSacksPerHour === 0) {
            return { timeToEmptyHours: 0, totalSacks: 0, totalQuintales: 0, machineContributions: [], pieData: [] };
        }

        const timeToEmptyHours = siloMass / (totalNetSacksPerHour * 50); // Assuming 50kg per sack for mass calculation
        const totalSacks = timeToEmptyHours * totalNetSacksPerHour;
        const totalQuintales = (totalSacks * 50) / KG_PER_QUINTAL;
        
        const machineContributions = machineResults.map(mr => ({
            ...mr,
            totalSacks: mr.netSacksPerHour * timeToEmptyHours,
        }));
        
        const pieData = machineContributions.map((mc, index) => ({
            name: `Máquina ${mc.machineId} (${mc.productName.slice(0,15)}...)`,
            value: mc.totalSacks,
            fill: `hsl(var(--chart-${index + 1}))`
        }));

        return { timeToEmptyHours, totalSacks, totalQuintales, machineContributions, pieData };
    }, [siloMass, machines, products]);

    const handleMachineChange = (id: number, field: string, value: any) => {
        setMachines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const formatTime = (hours: number) => {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}min`;
    };

    const pieChartConfig = results.pieData.reduce((acc, entry) => {
        acc[entry.name] = { label: entry.name, color: entry.fill };
        return acc;
    }, {} as ChartConfig);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Database />Parámetros de Simulación de Silo</CardTitle>
                        <CardDescription>Configura la masa del silo y los parámetros de cada máquina envasadora para estimar el tiempo de proceso.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="silo-mass">Masa de Azúcar en Silo (kg)</Label>
                            <Input id="silo-mass" type="number" value={siloMass} onChange={e => setSiloMass(Number(e.target.value))} />
                        </div>
                        <div className="space-y-4">
                            {machines.map(machine => (
                                <div key={machine.id} className="border p-3 rounded-md bg-muted/50 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-sm">Máquina Envasadora {machine.id}</h3>
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`active-${machine.id}`} className="text-xs">Activa</Label>
                                            <Checkbox id={`active-${machine.id}`} checked={machine.active} onCheckedChange={(checked) => handleMachineChange(machine.id, 'active', !!checked)} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div className="space-y-1">
                                            <Label htmlFor={`product-${machine.id}`} className="text-xs">Producto</Label>
                                            <Select value={machine.productId} onValueChange={(val) => handleMachineChange(machine.id, 'productId', val)} disabled={!machine.active}>
                                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                                <SelectContent>
                                                    {plannableProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`speed-${machine.id}`} className="text-xs">Velocidad (unid/min)</Label>
                                            <Input id={`speed-${machine.id}`} type="number" value={machine.speed} onChange={(e) => handleMachineChange(machine.id, 'speed', Number(e.target.value))} disabled={!machine.active} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`loss-${machine.id}`} className="text-xs">Pérdida (%)</Label>
                                            <Input id={`loss-${machine.id}`} type="number" value={machine.loss} onChange={(e) => handleMachineChange(machine.id, 'loss', Number(e.target.value))} disabled={!machine.active} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Resultados de la Simulación</CardTitle>
                        <CardDescription>Estimaciones basadas en los parámetros configurados.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <KpiCard title="Tiempo para Vaciar Silo" value={formatTime(results.timeToEmptyHours)} icon={Clock} description="Tiempo total estimado para procesar toda la masa del silo con las máquinas activas." />
                        <KpiCard title="Producción Total (Sacos)" value={results.totalSacks.toLocaleString(undefined, {maximumFractionDigits: 0})} icon={Package} description="Cantidad total de sacos que se producirán." />
                        <KpiCard title="Producción Total (QQ)" value={results.totalQuintales.toLocaleString(undefined, {maximumFractionDigits: 1})} icon={FileDigit} description="Cantidad total de quintales que se producirán." />
                        
                        <div className="border-t pt-4">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Donut />Contribución por Máquina</h4>
                            {results.pieData.length > 0 ? (
                                <ChartContainer config={pieChartConfig} className="w-full h-48">
                                    <PieChart>
                                        <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                        <Pie data={results.pieData} dataKey="value" nameKey="name" innerRadius={30} outerRadius={50} labelLine={false} label={({
                                                cx,
                                                cy,
                                                midAngle,
                                                innerRadius,
                                                outerRadius,
                                                percent,
                                            }) => {
                                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                                const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                                return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12">{`${(percent * 100).toFixed(0)}%`}</text>;
                                            }}>
                                        </Pie>
                                        <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                    </PieChart>
                                </ChartContainer>
                            ) : (
                                <p className="text-xs text-muted-foreground text-center py-4">Active al menos una máquina para ver los resultados.</p>
                            )}
                        </div>
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

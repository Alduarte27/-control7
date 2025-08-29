'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Sparkles, Bot, LineChart, TrendingUp, BarChart2, HardHat, BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { suggestProductionPlan, type SuggestPlanOutput, type SuggestPlanInput } from '@/ai/flows/suggest-plan-flow';
import { forecastDemand, type ForecastDemandOutput, type ForecastDemandInput } from '@/ai/flows/forecast-demand-flow';
import { simulateProduction, type SimulateProductionInput, type SimulateProductionOutput } from '@/ai/flows/simulate-production-flow';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData, CategoryDefinition, ProductDefinition } from '@/lib/types';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Line, BarChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import ComparisonCard from './comparison-card';
import { addWeeks, getISOWeek, getDay } from 'date-fns';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


// --- Shared Chart Configurations ---

const trendChartConfig = {
  planned: { label: 'Planificado', color: 'hsl(var(--chart-2))' },
  actual: { label: 'Real (s/Plan)', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const comparisonChartConfig = {
  plannedA: { label: 'Plan Semana A', color: 'hsl(var(--chart-1))' },
  actualA: { label: 'Real Semana A', color: 'hsl(var(--chart-2))' },
  plannedB: { label: 'Plan Semana B', color: 'hsl(var(--chart-3))' },
  actualB: { label: 'Real Semana B', color: 'hsl(var(--chart-4))' },
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

type ComparisonData = {
  totalPlannedA: number;
  totalActualA: number;
  totalPlannedB: number;
  totalActualB: number;
  productComparison: { name: string; plannedA: number; actualA: number; plannedB: number; actualB: number; }[];
};

// --- Main IA Client Component ---

export default function IAClient({ 
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
  const [categories] = React.useState<CategoryDefinition[]>(prefetchedCategories);
  
  // --- States for each Tab ---
  const [isSuggestingPlan, setIsSuggestingPlan] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<SuggestPlanOutput | null>(null);
  const [isForecasting, setIsForecasting] = React.useState(false);
  const [forecast, setForecast] = React.useState<ForecastDemandOutput | null>(null);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [simulationResult, setSimulationResult] = React.useState<SimulateProductionOutput | null>(null);

  const [selectedWeekA, setSelectedWeekA] = React.useState<string>('');
  const [selectedWeekB, setSelectedWeekB] = React.useState<string>('');
  const [comparisonData, setComparisonData] = React.useState<ComparisonData | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState('all');
  
  const [isApplyDialogOpen, setIsApplyDialogOpen] = React.useState(false);
  const [targetWeek, setTargetWeek] = React.useState<'current' | 'next'>('next');

  // --- Initial Data Fetching ---
  React.useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const [summariesSnapshot, plansSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'weeklySummaries'), orderBy('__name__'))),
            getDocs(query(collection(db, "productionPlans"), orderBy("__name__", "desc")))
        ]);

        const fetchedSummaries = summariesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklySummaryDoc));
        setAllSummaries(fetchedSummaries);

        const fetchedPlans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllPlans(fetchedPlans);
        
        if (fetchedSummaries.length >= 2) {
          setSelectedWeekA(fetchedSummaries[fetchedSummaries.length - 2].id);
          setSelectedWeekB(fetchedSummaries[fetchedSummaries.length - 1].id);
        } else if (fetchedSummaries.length === 1) {
          setSelectedWeekA(fetchedSummaries[0].id);
          setSelectedWeekB(fetchedSummaries[0].id);
        }

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
  const weekOptions = React.useMemo(() => {
    return [...allSummaries].sort((a, b) => b.year - a.year || b.week - a.week);
  }, [allSummaries]);
  
  const historicalTrendData = React.useMemo(() => {
    return allSummaries.slice(-12).map(summary => ({
        name: `S${summary.week}`,
        planned: summary.totalPlanned,
        actual: summary.totalActualForPlanned,
    }));
  }, [allSummaries]);

  // --- Logic for Comparison Tab ---
  React.useEffect(() => {
    const generateComparison = async () => {
      if (loading || !selectedWeekA || !selectedWeekB) return;
      const summaryA = allSummaries.find(s => s.id === selectedWeekA);
      const summaryB = allSummaries.find(s => s.id === selectedWeekB);
      if (!summaryA || !summaryB) return;

      try {
        const [planADoc, planBDoc] = await Promise.all([
          getDoc(doc(db, "productionPlans", selectedWeekA)),
          getDoc(doc(db, "productionPlans", selectedWeekB))
        ]);

        const productsA = planADoc.exists() ? (planADoc.data().products as ProductData[]) : [];
        const productsB = planBDoc.exists() ? (planBDoc.data().products as ProductData[]) : [];

        const filterProducts = (p: ProductData) => selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
        
        const allProductNames = Array.from(new Set([
          ...productsA.filter(filterProducts).map(p => p.productName), 
          ...productsB.filter(filterProducts).map(p => p.productName)
        ]));

        const calculateTotalActual = (p: ProductData) => Object.values(p.actual).reduce((sum, s) => sum + (s.day || 0) + (s.night || 0), 0);

        const productComparison = allProductNames.map(name => {
          const productA = productsA.find(p => p.productName === name);
          const productB = productsB.find(p => p.productName === name);
          return {
            name,
            plannedA: productA?.planned || 0,
            actualA: productA ? calculateTotalActual(productA) : 0,
            plannedB: productB?.planned || 0,
            actualB: productB ? calculateTotalActual(productB) : 0,
          };
        }).filter(p => p.plannedA > 0 || p.actualA > 0 || p.plannedB > 0 || p.actualB > 0);

        const totalsA = selectedCategoryId === 'all' ? { p: summaryA.totalPlanned, a: summaryA.totalActualForPlanned } : { p: summaryA.categoryTotals?.[selectedCategoryId]?.planned || 0, a: summaryA.categoryTotals?.[selectedCategoryId]?.actualForPlanned || 0 };
        const totalsB = selectedCategoryId === 'all' ? { p: summaryB.totalPlanned, a: summaryB.totalActualForPlanned } : { p: summaryB.categoryTotals?.[selectedCategoryId]?.planned || 0, a: summaryB.categoryTotals?.[selectedCategoryId]?.actualForPlanned || 0 };

        setComparisonData({ totalPlannedA: totalsA.p, totalActualA: totalsA.a, totalPlannedB: totalsB.p, totalActualB: totalsB.a, productComparison });
      } catch (error) {
        console.error("Error fetching comparison data:", error);
      }
    };
    generateComparison();
  }, [allSummaries, selectedWeekA, selectedWeekB, selectedCategoryId, loading]);

  // --- AI Flow Handlers ---
  const handleSuggestPlan = async () => {
    setIsSuggestingPlan(true);
    setSuggestion(null);
    toast({ title: 'Generando Sugerencia', description: 'La IA está analizando el historial...' });
    try {
        const historicalDataForAI = allPlans.slice(0, 8).map(plan => ({
            week: plan.week,
            year: plan.year,
            products: plan.products.map((p: ProductData) => ({
                id: p.id,
                productName: p.productName,
                totalActual: Object.values(p.actual).reduce((sum: any, s: any) => sum + s.day + s.night, 0),
                categoryIsPlanned: p.categoryIsPlanned ?? true,
            }))
        })).reverse();

        const activeProducts = prefetchedProducts.filter(p => p.isActive);
        const categoryMap = new Map(categories.map(doc => [doc.id, { isPlanned: doc.isPlanned ?? true }]));
        const allProductsWithCategoryInfo = activeProducts.map(p => ({
            id: p.id, productName: p.productName, categoryIsPlanned: categoryMap.get(p.categoryId)?.isPlanned ?? true,
        }));
        
        const result = await suggestProductionPlan({ historicalData: historicalDataForAI, allProducts: allProductsWithCategoryInfo });
        setSuggestion(result);
    } catch (error) {
        toast({ title: 'Error de la IA', description: 'No se pudo generar una sugerencia.', variant: 'destructive' });
    } finally {
        setIsSuggestingPlan(false);
    }
  };

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
              totalActual: Object.values(p.actual).reduce((sum: any, s: any) => sum + s.day + s.night, 0),
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
            const totalActual = Object.values(plan.productData.actual).reduce((sum: number, day: any) => sum + day.day + day.night, 0);
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
  
  // --- Plan Application Logic ---
  const handleOpenApplyDialog = () => {
    const isMonday = getDay(new Date()) === 1; // 1 for Monday
    const currentPlanId = `${new Date().getFullYear()}-W${getISOWeek(new Date())}`;
    const currentPlanExistsWithData = allPlans.some(p => p.id === currentPlanId && p.products.some((prod: ProductData) => prod.planned > 0));

    setTargetWeek((isMonday && !currentPlanExistsWithData) ? 'current' : 'next');
    setIsApplyDialogOpen(true);
  };

  const executeApplySuggestion = () => {
    if (!suggestion) return;
    const date = targetWeek === 'next' ? addWeeks(new Date(), 1) : new Date();
    const planId = `${date.getFullYear()}-W${getISOWeek(date)}`;
    sessionStorage.setItem('aiSuggestion', JSON.stringify(suggestion.suggestions));
    window.location.href = `/?planId=${planId}&applySuggestion=true`;
    setIsApplyDialogOpen(false);
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
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="simulator"><HardHat className="mr-2" />Simulador</TabsTrigger>
                    <TabsTrigger value="suggestion"><Bot className="mr-2" />Sugerencia de Plan</TabsTrigger>
                    <TabsTrigger value="forecast"><TrendingUp className="mr-2" />Pronóstico</TabsTrigger>
                    <TabsTrigger value="comparison"><BarChart2 className="mr-2" />Comparativo</TabsTrigger>
                </TabsList>
                
                <TabsContent value="simulator" className="mt-6">
                    <SimulatorTab onSimulate={handleSimulation} isSimulating={isSimulating} result={simulationResult} products={prefetchedProducts} />
                </TabsContent>
                <TabsContent value="suggestion" className="mt-6">
                    <SuggestionTab onSuggest={handleSuggestPlan} isSuggesting={isSuggestingPlan} suggestion={suggestion} onApply={handleOpenApplyDialog} />
                </TabsContent>
                <TabsContent value="forecast" className="mt-6">
                    <ForecastTab onForecast={handleForecastDemand} isForecasting={isForecasting} forecast={forecast} trendData={historicalTrendData} isLoading={loading} />
                </TabsContent>
                <TabsContent value="comparison" className="mt-6">
                    <ComparisonTab 
                        weekOptions={weekOptions} 
                        categories={categories}
                        selectedWeekA={selectedWeekA}
                        setSelectedWeekA={setSelectedWeekA}
                        selectedWeekB={selectedWeekB}
                        setSelectedWeekB={setSelectedWeekB}
                        selectedCategoryId={selectedCategoryId}
                        setSelectedCategoryId={setSelectedCategoryId}
                        comparisonData={comparisonData}
                        isLoading={loading}
                    />
                </TabsContent>
            </Tabs>
        </main>
      </div>

      <AlertDialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dónde aplicar la sugerencia?</AlertDialogTitle>
            <AlertDialogDescription>Elige la semana para el plan de producción sugerido.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
              <RadioGroup defaultValue={targetWeek} onValueChange={(value: 'current' | 'next') => setTargetWeek(value)}>
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="current" id="r-current" /><Label htmlFor="r-current">Semana Actual (S{getISOWeek(new Date())})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="next" id="r-next" /><Label htmlFor="r-next">Próxima Semana (S{getISOWeek(addWeeks(new Date(), 1))})</Label>
                  </div>
              </RadioGroup>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeApplySuggestion}>Aplicar a Semana Seleccionada</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    const [simInput, setSimInput] = React.useState<SimulateProductionInput>({
        productName: products.find(p => p.isActive)?.id || '',
        productionRate: 100,
        hoursPerDayShift: 8,
        hoursPerNightShift: 8,
        activeDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    });

    const handleInputChange = (field: keyof Omit<SimulateProductionInput, 'activeDays'>, value: string | number) => {
        setSimInput(prev => ({ ...prev, [field]: value }));
    };

    const handleDayChange = (day: keyof SimulateProductionInput['activeDays'], checked: boolean) => {
        setSimInput(prev => ({ ...prev, activeDays: { ...prev.activeDays, [day]: checked } }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSimulate(simInput);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><HardHat />Simulador de Producción Inteligente</CardTitle>
                <CardDescription>Estima la producción semanal basándote en parámetros operativos y compárala con proyecciones realistas basadas en el historial.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="product-select">Producto</Label>
                            <Select value={simInput.productName} onValueChange={(val) => handleInputChange('productName', val)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                                <SelectContent>{products.filter(p=>p.isActive).map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rate">Tasa de Producción (unidades/hora)</Label>
                            <Input id="rate" type="number" value={simInput.productionRate} onChange={e => handleInputChange('productionRate', Number(e.target.value))} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="day-shift">Horas Turno Día</Label>
                                <Input id="day-shift" type="number" value={simInput.hoursPerDayShift} onChange={e => handleInputChange('hoursPerDayShift', Number(e.target.value))} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="night-shift">Horas Turno Noche</Label>
                                <Input id="night-shift" type="number" value={simInput.hoursPerNightShift} onChange={e => handleInputChange('hoursPerNightShift', Number(e.target.value))} required />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Días de Producción Activos</Label>
                            <div className="flex flex-wrap gap-4">
                                {Object.keys(simInput.activeDays).map(day => (
                                    <div key={day} className="flex items-center space-x-2">
                                        <Checkbox id={day} checked={simInput.activeDays[day as keyof typeof simInput.activeDays]} onCheckedChange={(checked) => handleDayChange(day as keyof typeof simInput.activeDays, !!checked)} />
                                        <Label htmlFor={day} className="capitalize">{day}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {isSimulating ? <p>Simulando...</p> : result && (
                        <div className="space-y-4">
                             <div className="grid gap-4 grid-cols-2">
                                <ComparisonCard title="Producción Óptima Semanal" valueA={0} valueB={result.totalOptimalProduction} showPercentage={false} />
                                <ComparisonCard title="Proyección Realista Semanal" valueA={0} valueB={result.totalRealisticProjection} subValue={`Basado en ${result.averageEfficiency.toFixed(1)}% eficiencia hist.`} showPercentage={false} />
                            </div>
                            <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md w-full">
                                <h4 className="font-semibold">Recomendaciones de la IA</h4>
                                {result.recommendations.split('\n').map((line, i) => <p key={i} className="my-1">{line}</p>)}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSimulating}><BrainCircuit className="mr-2" />{isSimulating ? 'Calculando...' : 'Ejecutar Simulación'}</Button>
                </CardFooter>
            </form>
            {result && (
                <CardContent>
                    <Separator className="my-4" />
                    <h3 className="font-semibold mb-2">Desglose Diario y Proyección</h3>
                     <ChartContainer config={simulationChartConfig} className="w-full h-[300px]">
                        <BarChart data={result.dailyBreakdown}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="day" />
                            <YAxis />
                            <RechartsTooltip content={<ChartTooltipContent />} />
                            <Legend content={<ChartLegendContent />} />
                            <Bar dataKey="optimalProduction" fill="var(--color-optimalProduction)" radius={4} />
                            <Bar dataKey="realisticProjection" fill="var(--color-realisticProjection)" radius={4} />
                        </BarChart>
                    </ChartContainer>
                </CardContent>
            )}
        </Card>
    );
}


function SuggestionTab({ onSuggest, isSuggesting, suggestion, onApply }: {
    onSuggest: () => void;
    isSuggesting: boolean;
    suggestion: SuggestPlanOutput | null;
    onApply: () => void;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot />Asistente de Planificación</CardTitle>
                <CardDescription>Usa IA para analizar el historial y generar un plan semanal optimizado para productos planificables.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={onSuggest} disabled={isSuggesting}><Bot className={`mr-2 ${isSuggesting ? 'animate-spin' : ''}`} />{isSuggesting ? 'Generando...' : 'Generar Sugerencia de Plan'}</Button>
            </CardContent>
            {suggestion && (
                <CardFooter className="flex-col items-start gap-4 pt-6">
                    <Separator />
                    <h3 className="font-semibold text-lg pt-4">Análisis y Sugerencia de la IA</h3>
                    <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md w-full">{suggestion.analysis.split('\n').map((p, i) => <p key={i}>{p}</p>)}</div>
                    <Button onClick={onApply}>Aplicar Sugerencias...</Button>
                </CardFooter>
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
                {forecast && (
                    <CardFooter className="flex-col items-start gap-4 pt-6">
                        <Separator />
                        <h3 className="font-semibold text-lg pt-4">Pronóstico de Demanda (Análisis IA)</h3>
                        <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md w-full">{forecast.analysis.split('\n').map((p, i) => <p key={i}>{p}</p>)}</div>
                    </CardFooter>
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

function ComparisonTab({ weekOptions, categories, selectedWeekA, setSelectedWeekA, selectedWeekB, setSelectedWeekB, selectedCategoryId, setSelectedCategoryId, comparisonData, isLoading }: {
    weekOptions: any[], categories: CategoryDefinition[], selectedWeekA: string, setSelectedWeekA: (v: string) => void, selectedWeekB: string, setSelectedWeekB: (v: string) => void, selectedCategoryId: string, setSelectedCategoryId: (v: string) => void, comparisonData: ComparisonData | null, isLoading: boolean
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Análisis Comparativo Semanal</CardTitle>
                <CardDescription>Compara el rendimiento de dos semanas (solo productos con plan > 0). El filtro de categoría se aplica aquí también.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex-grow space-y-2"><Label>Filtrar por Categoría</Label>
                        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="flex-grow space-y-2"><Label>Semana A</Label>
                        <Select value={selectedWeekA} onValueChange={setSelectedWeekA}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{weekOptions.map(w=><SelectItem key={`A-${w.id}`} value={w.id}>S{w.week} ({w.year})</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="flex-grow space-y-2"><Label>Semana B</Label>
                        <Select value={selectedWeekB} onValueChange={setSelectedWeekB}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{weekOptions.map(w=><SelectItem key={`B-${w.id}`} value={w.id}>S{w.week} ({w.year})</SelectItem>)}</SelectContent></Select>
                    </div>
                </div>
                {isLoading ? <p>Cargando...</p> : comparisonData ? (
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <ComparisonCard title="Total Planificado" valueA={comparisonData.totalPlannedA} valueB={comparisonData.totalPlannedB} />
                            <ComparisonCard title="Total Real" valueA={comparisonData.totalActualA} valueB={comparisonData.totalActualB} />
                            <ComparisonCard title="Cumplimiento" valueA={comparisonData.totalPlannedA > 0 ? (comparisonData.totalActualA / comparisonData.totalPlannedA) * 100 : 0} valueB={comparisonData.totalPlannedB > 0 ? (comparisonData.totalActualB / comparisonData.totalPlannedB) * 100 : 0} isPercentage />
                            <ComparisonCard title="Varianza" valueA={comparisonData.totalActualA - comparisonData.totalPlannedA} valueB={comparisonData.totalActualB - comparisonData.totalPlannedB} showPercentage={false} />
                        </div>
                        <ChartContainer config={comparisonChartConfig} className="w-full h-[500px]">
                            <BarChart data={comparisonData.productComparison} margin={{bottom: 120}}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" angle={-60} textAnchor="end" interval={0} height={100} style={{fontSize:'0.75rem'}}/>
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
                                <Bar dataKey="plannedA" fill="var(--color-plannedA)" radius={4} />
                                <Bar dataKey="actualA" fill="var(--color-actualA)" radius={4} />
                                <Bar dataKey="plannedB" fill="var(--color-plannedB)" radius={4} />
                                <Bar dataKey="actualB" fill="var(--color-actualB)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    </div>
                ) : <p>Selecciona dos semanas para comparar.</p>}
            </CardContent>
        </Card>
    );
}

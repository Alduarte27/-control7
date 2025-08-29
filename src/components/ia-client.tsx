'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Sparkles, Bot, LineChart, TrendingUp, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { suggestProductionPlan, type SuggestPlanOutput, type SuggestPlanInput } from '@/ai/flows/suggest-plan-flow';
import { forecastDemand, type ForecastDemandOutput, type ForecastDemandInput } from '@/ai/flows/forecast-demand-flow';
import { collection, getDocs, query, orderBy, limit, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData, CategoryDefinition, ProductDefinition } from '@/lib/types';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Line, BarChart } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import ComparisonCard from './comparison-card';
import { addWeeks, getISOWeek, startOfISOWeek, endOfISOWeek, format, setISOWeek, getDay } from 'date-fns';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const trendChartConfig = {
  planned: {
    label: 'Planificado',
    color: 'hsl(var(--chart-2))',
  },
  actual: {
    label: 'Real (s/Plan)',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

const comparisonChartConfig = {
  plannedA: { label: 'Plan Semana A', color: 'hsl(var(--chart-1))' },
  actualA: { label: 'Real Semana A', color: 'hsl(var(--chart-2))' },
  plannedB: { label: 'Plan Semana B', color: 'hsl(var(--chart-3))' },
  actualB: { label: 'Real Semana B', color: 'hsl(var(--chart-4))' },
} satisfies ChartConfig;

type WeeklySummaryDoc = {
    id: string; // planId e.g., "2024-W35"
    week: number;
    year: number;
    totalPlanned: number;
    totalActualForPlanned: number;
    categoryTotals: {
        [categoryId: string]: {
            planned: number;
            actualForPlanned: number;
        }
    }
};

type ComparisonData = {
  totalPlannedA: number;
  totalActualA: number;
  totalPlannedB: number;
  totalActualB: number;
  productComparison: {
    name: string;
    plannedA: number;
    actualA: number;
    plannedB: number;
    actualB: number;
  }[];
};

type ForecastChartData = {
  name: string;
  [weekKey: string]: string | number;
};

const FORECAST_WEEKS = 4;

export default function IAClient({ 
  prefetchedCategories, 
  prefetchedProducts,
  initialPlanId 
}: { 
  prefetchedCategories: CategoryDefinition[], 
  prefetchedProducts: ProductDefinition[],
  initialPlanId?: string 
}) {
  const [isSuggestingPlan, setIsSuggestingPlan] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<SuggestPlanOutput | null>(null);
  const [isForecasting, setIsForecasting] = React.useState(false);
  const [forecast, setForecast] = React.useState<ForecastDemandOutput | null>(null);
  const [historicalTrendData, setHistoricalTrendData] = React.useState<any[]>([]);
  const [forecastChartData, setForecastChartData] = React.useState<ForecastChartData[]>([]);
  const [forecastChartConfig, setForecastChartConfig] = React.useState<ChartConfig>({});
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const { toast } = useToast();
  
  const [allSummaries, setAllSummaries] = React.useState<WeeklySummaryDoc[]>([]);
  const [categories] = React.useState<CategoryDefinition[]>(prefetchedCategories);
  
  // State for comparison view
  const [selectedWeekA, setSelectedWeekA] = React.useState<string>('');
  const [selectedWeekB, setSelectedWeekB] = React.useState<string>('');
  const [comparisonData, setComparisonData] = React.useState<ComparisonData | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState('all');

  // State for applying suggestion dialog
  const [isApplyDialogOpen, setIsApplyDialogOpen] = React.useState(false);
  const [targetWeek, setTargetWeek] = React.useState<'current' | 'next'>('next');

  const weekOptions = React.useMemo(() => {
    const sortedSummaries = [...allSummaries].sort((a, b) => a.year - b.year || a.week - b.week);
    if (sortedSummaries.length >= 2) {
      if (!selectedWeekA) setSelectedWeekA(sortedSummaries[sortedSummaries.length - 2].id);
      if (!selectedWeekB) setSelectedWeekB(sortedSummaries[sortedSummaries.length - 1].id);
    } else if (sortedSummaries.length === 1) {
      if (!selectedWeekA) setSelectedWeekA(sortedSummaries[0].id);
      if (!selectedWeekB) setSelectedWeekB(sortedSummaries[0].id);
    }
    return sortedSummaries;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSummaries]);


  React.useEffect(() => {
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const summariesSnapshot = await getDocs(query(collection(db, 'weeklySummaries'), orderBy('year'), orderBy('week')));
            const fetchedSummaries = summariesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklySummaryDoc));
            setAllSummaries(fetchedSummaries);

            const limitedHistory = fetchedSummaries
                .slice(-12) // Get last 12 summaries for the trend
                .map(summary => ({
                    name: `S${summary.week}`,
                    week: summary.week,
                    year: summary.year,
                    planned: summary.totalPlanned,
                    actual: summary.totalActualForPlanned,
                }));
            setHistoricalTrendData(limitedHistory);
        } catch (error) {
            console.error("Error fetching historical summaries:", error);
            toast({ title: 'Error al cargar historial', variant: 'destructive' });
        }
        setLoadingHistory(false);
    };
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

   React.useEffect(() => {
    const generateComparison = async () => {
        if (loadingHistory || !selectedWeekA || !selectedWeekB) return;

        const summaryA = allSummaries.find(s => s.id === selectedWeekA);
        const summaryB = allSummaries.find(s => s.id === selectedWeekB);

        if (!summaryA || !summaryB) {
            setComparisonData(null);
            return;
        }

        try {
            // Fetch detailed plan data only for the two selected weeks
            const [planADoc, planBDoc] = await Promise.all([
                getDoc(doc(db, "productionPlans", selectedWeekA)),
                getDoc(doc(db, "productionPlans", selectedWeekB))
            ]);

            const productsA = planADoc.exists() ? (planADoc.data().products as ProductData[]) : [];
            const productsB = planBDoc.exists() ? (planBDoc.data().products as ProductData[]) : [];

            const getFilteredProducts = (products: ProductData[]): ProductData[] => {
                if (selectedCategoryId === 'all') return products;
                return products.filter(p => p.categoryId === selectedCategoryId);
            };
            
            const filteredProductsA = getFilteredProducts(productsA);
            const filteredProductsB = getFilteredProducts(productsB);

            const allProductNames = Array.from(new Set([...filteredProductsA.map(p => p.productName), ...filteredProductsB.map(p => p.productName)]));
            
            const calculateTotalActual = (product: ProductData) =>
                Object.values(product.actual).reduce((sum, shifts) => sum + (shifts.day || 0) + (shifts.night || 0), 0);
            
            const productComparison = allProductNames.map(name => {
                const productA = filteredProductsA.find(p => p.productName === name);
                const productB = filteredProductsB.find(p => p.productName === name);
                const plannedA = productA?.planned || 0;
                const actualA = productA ? calculateTotalActual(productA) : 0;
                const plannedB = productB?.planned || 0;
                const actualB = productB ? calculateTotalActual(productB) : 0;
                return { name, plannedA, actualA, plannedB, actualB };
            }).filter(p => p.plannedA > 0 || p.actualA > 0 || p.plannedB > 0 || p.actualB > 0);

            // Get total from summaries for cards
            const totalsA = selectedCategoryId === 'all'
                ? { planned: summaryA.totalPlanned, actual: summaryA.totalActualForPlanned }
                : summaryA.categoryTotals?.[selectedCategoryId] || { planned: 0, actual: 0 };
            
            const totalsB = selectedCategoryId === 'all'
                ? { planned: summaryB.totalPlanned, actual: summaryB.totalActualForPlanned }
                : summaryB.categoryTotals?.[selectedCategoryId] || { planned: 0, actual: 0 };

            setComparisonData({
                totalPlannedA: totalsA.planned,
                totalActualA: totalsA.actual,
                totalPlannedB: totalsB.planned,
                totalActualB: totalsB.actual,
                productComparison,
            });

        } catch (error) {
            console.error("Error fetching comparison data:", error);
            setComparisonData(null);
        }
    };
    generateComparison();
  }, [allSummaries, selectedWeekA, selectedWeekB, selectedCategoryId, loadingHistory]);

  const handleSuggestPlan = async () => {
    setIsSuggestingPlan(true);
    setSuggestion(null);
    toast({
        title: 'Generando Sugerencia',
        description: 'La IA está analizando el historial de producción. Esto puede tardar un momento...',
    });
    try {
        const plansQuery = query(collection(db, "productionPlans"), orderBy("year", "desc"), orderBy("week", "desc"), limit(8));
        const plansSnapshot = await getDocs(plansQuery);

        const historicalDataForAI = plansSnapshot.docs.map(doc => {
            const plan = doc.data();
            return {
                week: plan.week,
                year: plan.year,
                products: plan.products.map((p: ProductData) => ({
                    id: p.id,
                    productName: p.productName,
                    totalActual: Object.values(p.actual).reduce((sum: any, s: any) => sum + s.day + s.night, 0),
                    categoryIsPlanned: p.categoryIsPlanned ?? true,
                }))
            }
        }).reverse();

        const activeProducts = prefetchedProducts.filter(p => p.isActive);
        
        const categoryMap = new Map(categories.map(doc => [doc.id, { isPlanned: doc.isPlanned ?? true }]));
        
        const allProductsWithCategoryInfo = activeProducts.map(p => ({
            id: p.id,
            productName: p.productName,
            categoryIsPlanned: categoryMap.get(p.categoryId)?.isPlanned ?? true,
        }));
        
        const input: SuggestPlanInput = { 
            historicalData: historicalDataForAI, 
            allProducts: allProductsWithCategoryInfo
        };

        const result = await suggestProductionPlan(input);
        setSuggestion(result);
        
    } catch (error: any) {
        let description = 'No se pudo generar una sugerencia. Por favor, inténtalo de nuevo.';
        if (error.message && (error.message.includes('API key not valid') || error.message.includes('permission denied'))) {
            description = 'La API Key de Gemini no es válida o no ha sido configurada. Revisa el archivo .env.';
        }
        toast({ title: 'Error de la IA', description, variant: 'destructive' });
    } finally {
        setIsSuggestingPlan(false);
    }
  };
  
  const handleForecastDemand = async () => {
      setIsForecasting(true);
      setForecast(null);
      setForecastChartData([]);
      toast({
          title: 'Generando Pronóstico',
          description: 'La IA está analizando tendencias para proyectar la demanda futura...',
      });
       try {
        const plansQuery = query(collection(db, "productionPlans"), orderBy("year", "desc"), orderBy("week", "desc"), limit(FORECAST_WEEKS));
        const plansSnapshot = await getDocs(plansQuery);

        const historicalDataForAI = plansSnapshot.docs.map(doc => {
            const plan = doc.data();
            return {
                week: plan.week,
                year: plan.year,
                products: plan.products.map((p: ProductData) => ({
                    productName: p.productName,
                    totalActual: Object.values(p.actual).reduce((sum: any, s: any) => sum + s.day + s.night, 0),
                    categoryIsPlanned: p.categoryIsPlanned ?? true,
                }))
            }
        }).reverse();
        
        const productMap: { [productName: string]: { [week: number]: number } } = {};
        const weekLabels: number[] = [];

        historicalDataForAI.forEach(weekData => {
            if (!weekLabels.includes(weekData.week)) {
                weekLabels.push(weekData.week);
            }
            weekData.products.forEach(p => {
                if (p.categoryIsPlanned) {
                    if (!productMap[p.productName]) productMap[p.productName] = {};
                    productMap[p.productName][weekData.week] = p.totalActual;
                }
            });
        });

        const chartData: ForecastChartData[] = Object.entries(productMap)
            .map(([productName, weekTotals]) => {
                const row: ForecastChartData = { name: productName };
                weekLabels.forEach(week => {
                    row[`S${week}`] = weekTotals[week] || 0;
                });
                return row;
            })
            .filter(row => Object.values(row).some(val => typeof val === 'number' && val > 0)); 
        
        setForecastChartData(chartData);

        const chartConfig: ChartConfig = {};
        weekLabels.forEach((week, index) => {
            chartConfig[`S${week}`] = {
                label: `Semana ${week}`,
                color: `hsl(var(--chart-${(index % 5) + 1}))`,
            };
        });
        setForecastChartConfig(chartConfig);
        
        const input: ForecastDemandInput = { historicalData: historicalDataForAI };
        const result = await forecastDemand(input);
        setForecast(result);

    } catch (error: any) {
        toast({ title: 'Error de Pronóstico', description: 'No se pudo generar un pronóstico.', variant: 'destructive' });
    } finally {
        setIsForecasting(false);
    }
  };

  const handleOpenApplyDialog = async () => {
    const isMonday = getDay(new Date()) === 1;
    const currentYear = new Date().getFullYear();
    const currentWeek = getISOWeek(new Date());
    const currentPlanId = `${currentYear}-W${currentWeek}`;

    let currentPlanIsEmpty = true;
    try {
        const planDoc = await getDoc(doc(db, "productionPlans", currentPlanId));
        if (planDoc.exists()) {
            const products = planDoc.data().products as ProductData[];
            if (products.some(p => p.planned > 0)) {
                currentPlanIsEmpty = false;
            }
        }
    } catch (error) {
        console.error("Error checking current week's plan:", error);
    }
    
    if (isMonday && currentPlanIsEmpty) {
        setTargetWeek('current');
    } else {
        setTargetWeek('next');
    }

    setIsApplyDialogOpen(true);
  };

  const executeApplySuggestion = async () => {
    if (!suggestion) return;
    try {
        const date = targetWeek === 'next' ? addWeeks(new Date(), 1) : new Date();
        const year = date.getFullYear();
        const week = getISOWeek(date);
        const planId = `${year}-W${week}`;
        
        sessionStorage.setItem('aiSuggestion', JSON.stringify(suggestion.suggestions));
        window.location.href = `/?planId=${planId}&applySuggestion=true`;

    } catch (error) {
        toast({ title: 'Error al aplicar sugerencia', variant: 'destructive' });
    } finally {
        setIsApplyDialogOpen(false);
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
          <Link href="/">
            <Button variant="outline">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Volver a la Planificación
            </Button>
          </Link>
        </header>
        <main className="p-4 md:p-8 space-y-6">
          <div className="grid md:grid-cols-1 gap-6">
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                      <Bot className="h-6 w-6" />
                      Asistente de Planificación de Producción
                  </CardTitle>
                  <CardDescription>
                      Utiliza el poder de la IA para analizar el historial de producción y generar un plan semanal optimizado para los productos planificables. 
                      El asistente identificará tendencias y patrones para ayudarte a minimizar el desperdicio y maximizar la eficiencia.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleSuggestPlan} disabled={isSuggestingPlan}>
                      <Bot className={`mr-2 h-4 w-4 ${isSuggestingPlan ? 'animate-spin' : ''}`} />
                      {isSuggestingPlan ? 'Generando Plan...' : 'Generar Sugerencia de Plan Semanal'}
                  </Button>
                </CardContent>

                {suggestion && (
                  <CardFooter className="flex-col items-start gap-4 pt-6">
                      <Separator />
                      <h3 className="font-semibold text-lg pt-4">Análisis y Sugerencia de la IA</h3>
                      <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md w-full">
                        {suggestion.analysis.split('\n').map((paragraph, index) => {
                            if (paragraph.startsWith('-')) {
                                return <p key={index} className="ml-4">{paragraph}</p>;
                            }
                            return <p key={index}>{paragraph}</p>;
                        })}
                      </div>
                      <Button onClick={handleOpenApplyDialog}>Aplicar Sugerencias...</Button>
                  </CardFooter>
                )}
              </Card>
              
              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5" />Tendencias de Producción</CardTitle>
                      <CardDescription>Evolución de la producción planificada vs. la producción real (solo de productos planificados) en las últimas semanas.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {loadingHistory ? <p className="text-center text-muted-foreground py-8">Cargando historial...</p> : historicalTrendData.length > 0 ? (
                        <ChartContainer config={trendChartConfig} className="w-full h-[300px]">
                              <ComposedChart data={historicalTrendData}>
                                  <CartesianGrid vertical={false} />
                                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                                  <YAxis stroke="hsl(var(--muted-foreground))" />
                                  <RechartsTooltip content={<ChartTooltipContent />} />
                                  <Legend content={<ChartLegendContent />} />
                                  <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                                  <Line type="monotone" dataKey="actual" stroke="var(--color-actual)" strokeWidth={2} dot={false} />
                              </ComposedChart>
                          </ChartContainer>
                      ) : (
                          <p className="text-muted-foreground text-center py-8">No hay suficientes datos históricos para mostrar tendencias.</p>
                      )}
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Proyecciones y Pronósticos</CardTitle>
                      <CardDescription>Utiliza la IA para generar un pronóstico cualitativo de la demanda para las próximas semanas basado en las tendencias históricas.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Button onClick={handleForecastDemand} disabled={isForecasting}>
                          <TrendingUp className={`mr-2 h-4 w-4 ${isForecasting ? 'animate-spin' : ''}`} />
                          {isForecasting ? 'Generando Pronóstico...' : 'Generar Pronóstico de Demanda'}
                      </Button>
                  </CardContent>
                  {forecast && (
                      <CardFooter className="flex-col items-start gap-4 pt-6">
                          <Separator />
                          <h3 className="font-semibold text-lg pt-4">Pronóstico de Demanda (Análisis IA)</h3>
                          <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md w-full">
                            {forecast.analysis.split('\n').map((paragraph, index) => (
                                <p key={index}>{paragraph}</p>
                            ))}
                          </div>
                          <h3 className="font-semibold text-lg pt-4">Datos Históricos Analizados</h3>
                          {forecastChartData.length > 0 ? (
                              <ChartContainer config={forecastChartConfig} className="w-full h-[400px]">
                                  <BarChart accessibilityLayer data={forecastChartData} margin={{ top: 20, right: 20, left: 0, bottom: 120 }}>
                                      <CartesianGrid vertical={false} />
                                      <XAxis 
                                          dataKey="name" 
                                          tickLine={false} 
                                          axisLine={false}
                                          tickMargin={10}
                                          angle={-60}
                                          textAnchor="end"
                                          interval={0}
                                          height={100}
                                          style={{
                                              fontSize: '0.75rem',
                                          }}
                                      />
                                      <YAxis />
                                      <RechartsTooltip content={<ChartTooltipContent />} />
                                      <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
                                      {Object.keys(forecastChartConfig).map(key => (
                                          <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
                                      ))}
                                  </BarChart>
                              </ChartContainer>
                          ) : (
                              <p className="text-muted-foreground text-center py-8">No se encontraron datos de producción para visualizar.</p>
                          )}
                      </CardFooter>
                  )}
              </Card>

              <Card className="md:col-span-1">
                  <CardHeader>
                      <CardTitle>Análisis Comparativo Semanal</CardTitle>
                      <CardDescription>
                          Compara el rendimiento de dos semanas (solo productos con plan > 0). El filtro de categoría se aplica aquí también.
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div className="flex flex-col md:flex-row items-center gap-4">
                          <div className="flex flex-col gap-1.5 w-full md:max-w-xs">
                              <Label htmlFor='category-filter-comparison'>Filtrar por Categoría</Label>
                              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                                  <SelectTrigger id="category-filter-comparison">
                                      <SelectValue placeholder="Seleccionar categoría" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="all">Todas las categorías</SelectItem>
                                      {categories.map(cat => (
                                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="flex flex-col gap-1.5 w-full md:max-w-xs">
                              <Label htmlFor="week-a-filter">Semana A</Label>
                              <Select value={selectedWeekA} onValueChange={setSelectedWeekA} disabled={weekOptions.length < 1}>
                                  <SelectTrigger id="week-a-filter">
                                      <SelectValue placeholder="Seleccionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {weekOptions.map(week => (
                                          <SelectItem key={`A-${week.id}`} value={String(week.id)}>Semana {week.week} ({week.year})</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="flex flex-col gap-1.5 w-full md:max-w-xs">
                              <Label htmlFor="week-b-filter">Semana B</Label>
                              <Select value={selectedWeekB} onValueChange={setSelectedWeekB} disabled={weekOptions.length < 1}>
                                  <SelectTrigger id="week-b-filter">
                                      <SelectValue placeholder="Seleccionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {weekOptions.map(week => (
                                          <SelectItem key={`B-${week.id}`} value={String(week.id)}>Semana {week.week} ({week.year})</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                      </div>
                      {loadingHistory ? <p className="text-center text-muted-foreground">Cargando...</p> : comparisonData ? (
                          <div className="space-y-6">
                              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                  <ComparisonCard title="Total Planificado" valueA={comparisonData.totalPlannedA} valueB={comparisonData.totalPlannedB} />
                                  <ComparisonCard title="Total Real" valueA={comparisonData.totalActualA} valueB={comparisonData.totalActualB} />
                                  <ComparisonCard title="Cumplimiento" valueA={comparisonData.totalPlannedA > 0 ? (comparisonData.totalActualA / comparisonData.totalPlannedA) * 100 : 0} valueB={comparisonData.totalPlannedB > 0 ? (comparisonData.totalActualB / comparisonData.totalPlannedB) * 100 : 0} isPercentage />
                                  <ComparisonCard title="Varianza" valueA={comparisonData.totalActualA - comparisonData.totalPlannedA} valueB={comparisonData.totalActualB - comparisonData.totalPlannedB} showPercentage={false} />
                              </div>
                              <div>
                                  <ChartContainer config={comparisonChartConfig} className="w-full h-[500px]">
                                      <BarChart accessibilityLayer data={comparisonData.productComparison} margin={{ top: 20, right: 20, left: 0, bottom: 120 }}>
                                          <CartesianGrid vertical={false} />
                                          <XAxis 
                                              dataKey="name" 
                                              tickLine={false} 
                                              axisLine={false}
                                              tickMargin={10}
                                              angle={-60}
                                              textAnchor="end"
                                              interval={0}
                                              height={100}
                                              style={{ fontSize: '0.75rem' }}
                                          />
                                          <YAxis />
                                          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                          <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
                                          <Bar dataKey="plannedA" fill="var(--color-plannedA)" radius={4} />
                                          <Bar dataKey="actualA" fill="var(--color-actualA)" radius={4} />
                                          <Bar dataKey="plannedB" fill="var(--color-plannedB)" radius={4} />
                                          <Bar dataKey="actualB" fill="var(--color-actualB)" radius={4} />
                                      </BarChart>
                                  </ChartContainer>
                              </div>
                          </div>
                      ) : (
                          <p className="text-center text-muted-foreground py-8">Selecciona dos semanas válidas para comparar.</p>
                      )}
                  </CardContent>
              </Card>
          </div>
        </main>
      </div>

      <AlertDialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dónde aplicar la sugerencia de la IA?</AlertDialogTitle>
            <AlertDialogDescription>
              Elige en qué semana quieres aplicar el plan de producción generado por la IA.
              Te recomendamos la opción preseleccionada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
              <RadioGroup defaultValue={targetWeek} onValueChange={(value: 'current' | 'next') => setTargetWeek(value)}>
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="current" id="r-current" />
                      <Label htmlFor="r-current">Semana Actual (S{getISOWeek(new Date())})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                      <RadioGroupItem value="next" id="r-next" />
                      <Label htmlFor="r-next">Próxima Semana (S{getISOWeek(addWeeks(new Date(), 1))})</Label>
                  </div>
              </RadioGroup>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeApplySuggestion}>Aplicar a la Semana Seleccionada</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

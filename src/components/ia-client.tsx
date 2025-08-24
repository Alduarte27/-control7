'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Sparkles, Bot, LineChart, TrendingUp, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { suggestProductionPlan, type SuggestPlanOutput, type SuggestPlanInput } from '@/ai/flows/suggest-plan-flow';
import { forecastDemand, type ForecastDemandOutput, type ForecastDemandInput } from '@/ai/flows/forecast-demand-flow';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData } from '@/lib/types';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Separator } from './ui/separator';

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

type ForecastChartData = {
  name: string;
  [weekKey: string]: string | number;
};

const FORECAST_WEEKS = 4;

export default function IAClient() {
  const [isSuggestingPlan, setIsSuggestingPlan] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<SuggestPlanOutput | null>(null);
  const [isForecasting, setIsForecasting] = React.useState(false);
  const [forecast, setForecast] = React.useState<ForecastDemandOutput | null>(null);
  const [historicalTrendData, setHistoricalTrendData] = React.useState<any[]>([]);
  const [forecastChartData, setForecastChartData] = React.useState<ForecastChartData[]>([]);
  const [forecastChartConfig, setForecastChartConfig] = React.useState<ChartConfig>({});
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const plansQuery = query(collection(db, "productionPlans"), orderBy("year", "desc"), orderBy("week", "desc"), limit(12));
            const plansSnapshot = await getDocs(plansQuery);

            const history = plansSnapshot.docs.map(doc => {
                const plan = doc.data();
                const plannedProducts = plan.products.filter((p: ProductData) => p.categoryIsPlanned && p.planned > 0);
                
                const totalPlanned = plannedProducts.reduce((sum: number, p: ProductData) => sum + p.planned, 0);
                const totalActualForPlanned = plannedProducts.reduce((sum: number, p: ProductData) => sum + Object.values(p.actual).reduce((s: any, d: any) => s + d.day + d.night, 0), 0);

                return {
                    name: `S${plan.week}`,
                    week: plan.week,
                    year: plan.year,
                    planned: totalPlanned,
                    actual: totalActualForPlanned,
                };
            }).reverse();
            setHistoricalTrendData(history);
        } catch (error) {
            console.error("Error fetching historical data:", error);
            toast({ title: 'Error al cargar historial', variant: 'destructive' });
        }
        setLoadingHistory(false);
    };
    fetchHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        const productsSnapshot = await getDocs(query(collection(db, "products"), orderBy("order")));
        const allProducts = productsSnapshot.docs
            .map(doc => ({ id: doc.id, isActive: true, ...doc.data() } as any))
            .filter(p => p.isActive);
        
        const categoriesSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name')));
        const categoryMap = new Map(categoriesSnapshot.docs.map(doc => [doc.id, { isPlanned: doc.data().isPlanned ?? true }]));
        
        const allProductsWithCategoryInfo = allProducts.map(p => ({
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
        
        // Prepare data for the chart
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
            .filter(row => Object.values(row).some(val => typeof val === 'number' && val > 0)); // Filter out products with no production
        
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

  const handleApplySuggestion = async () => {
    if (!suggestion) return;
    try {
        const currentWeek = getISOWeek(new Date());
        const currentYear = new Date().getFullYear();
        const planId = `${currentYear}-W${currentWeek}`;
        
        sessionStorage.setItem('aiSuggestion', JSON.stringify(suggestion.suggestions));
        window.location.href = `/?planId=${planId}&applySuggestion=true`;

    } catch (error) {
        toast({ title: 'Error al aplicar sugerencia', variant: 'destructive' });
    }
  };

  return (
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
                    <Button onClick={handleApplySuggestion}>Aplicar Sugerencias al Plan de la Semana Actual</Button>
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
        </div>
      </main>
    </div>
  );
}

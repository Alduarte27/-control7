'use client';

import React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ChevronLeft, Filter, Percent, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import type { ProductData, DailyProduction, CategoryDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import ComparisonCard from './comparison-card';
import { subWeeks, getISOWeek, getYear } from 'date-fns';


type WeeklySummaryData = {
  week: number;
  name: string;
  planned: number;
  totalActual: number;
  actualForPlanned: number;
  unplannedProduction: number;
};

type WeeklyShiftSummaryData = {
    name: string;
    day: number;
    night: number;
    week: number;
}

type DailySummaryData = {
  name: string;
  day: number;
  night: number;
}

type ProductSummaryData = {
  name: string;
  planned: number;
  actual: number;
  color?: string;
};

const weeklyChartConfig = {
  planned: {
    label: 'Planificado',
    color: 'hsl(var(--accent))',
  },
  actualForPlanned: {
    label: 'Ejecutado (s/Plan)',
    color: 'hsl(var(--chart-2))',
  },
  unplannedProduction: {
    label: 'No Programado',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

const shiftChartConfig = {
    day: {
        label: 'Turno Día',
        color: 'hsl(var(--chart-2))',
    },
    night: {
        label: 'Turno Noche',
        color: 'hsl(var(--chart-3))',
    }
} satisfies ChartConfig;
  
const dailyChartConfig = {
    day: {
      label: 'Turno Día',
      color: 'hsl(var(--chart-3))',
    },
    night: {
        label: 'Turno Noche',
        color: 'hsl(var(--chart-4))',
    }
} satisfies ChartConfig;

const productChartConfig = {
  planned: {
    label: "Planificado",
    color: "hsl(var(--accent))",
  },
  actual: {
    label: "Real",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

type AllPlansData = {
    id: string; // planId
    week: number;
    year: number;
    products: ProductData[];
};

type WeeklySummaryDoc = {
    id: string;
    week: number;
    year: number;
    totalPlanned: number;
    totalActualForPlanned: number;
    totalUnplannedProduction: number;
    totalActual: number;
    dailyTotals: { mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number };
    dailyShiftTotals: {
        mon: { day: number; night: number };
        tue: { day: number; night: number };
        wed: { day: number; night: number };
        thu: { day: number; night: number };
        fri: { day: number; night: number };
        sat: { day: number; night: number };
        sun: { day: number; night: number };
    };
};

const WeeklyTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as WeeklySummaryData;
      const variance = data.actualForPlanned - data.planned;
      const varianceColor = variance >= 0 ? 'text-green-600' : 'text-destructive';
      const VarianceIcon = variance >= 0 ? TrendingUp : TrendingDown;

      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
          <p className="font-bold mb-2">{label}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--accent))'}} />
              <span>Planificado:</span>
            </div>
            <span className="text-right font-medium">{data.planned.toLocaleString()}</span>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--chart-2))'}} />
              <span>Ejecutado (s/Plan):</span>
            </div>
            <span className="text-right font-medium">{data.actualForPlanned.toLocaleString()}</span>

            <div className={cn("flex items-center gap-2 pl-4 text-xs", varianceColor)}>
              <VarianceIcon className="h-3 w-3" />
              <span>Varianza (s/Plan):</span>
            </div>
            <span className={cn("text-right font-medium text-xs", varianceColor)}>{variance.toLocaleString()}</span>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--chart-3))'}} />
              <span>No Programado:</span>
            </div>
            <span className="text-right font-medium">{data.unplannedProduction.toLocaleString()}</span>

            <div className="col-span-2 border-t my-1"></div>
            
            <div className="flex items-center gap-2 font-bold">
              <div className="w-1 h-1 rounded-full bg-foreground/50 ml-1 mr-1" />
              <span>Producción Total:</span>
            </div>
            <span className="text-right font-bold">{data.totalActual.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
};


export default function DashboardClient({ prefetchedCategories }: { prefetchedCategories: CategoryDefinition[] }) {
  const [weeklySummaryData, setWeeklySummaryData] = React.useState<WeeklySummaryData[]>([]);
  const [weeklyShiftData, setWeeklyShiftData] = React.useState<WeeklyShiftSummaryData[]>([]);
  const [dailyData, setDailyData] = React.useState<DailySummaryData[]>([]);
  const [productData, setProductData] = React.useState<ProductSummaryData[]>([]);
  
  const [loading, setLoading] = React.useState(true);
  const [allSummaries, setAllSummaries] = React.useState<WeeklySummaryDoc[]>([]);
  const [categories] = React.useState<CategoryDefinition[]>(prefetchedCategories);
  const [selectedWeek, setSelectedWeek] = React.useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState('all');
  const [isFilterOpen, setIsFilterOpen] = React.useState(true);
  const [isCategoryPlannable, setIsCategoryPlannable] = React.useState(true);
  const [dateRange, setDateRange] = React.useState('12');


  const weekOptions = React.useMemo(() => {
    return allSummaries
      .map(summary => ({ week: summary.week, year: summary.year, id: summary.id }))
      .sort((a, b) => b.year - a.year || b.week - a.week);
  }, [allSummaries]);

  React.useEffect(() => {
    const fetchAllSummaries = async () => {
        setLoading(true);
        try {
            let summariesQuery;
            if (dateRange === 'all') {
                summariesQuery = query(collection(db, 'weeklySummaries'), orderBy('__name__', 'asc'));
            } else {
                const numberOfWeeks = parseInt(dateRange);
                const startDate = subWeeks(new Date(), numberOfWeeks);
                const startYear = getYear(startDate);
                const startWeek = getISOWeek(startDate);
                const startPlanId = `${startYear}-W${startWeek}`;
                
                summariesQuery = query(collection(db, 'weeklySummaries'), where('__name__', '>=', startPlanId), orderBy('__name__', 'asc'));
            }
            
            const summariesSnapshot = await getDocs(summariesQuery);
            const fetchedSummaries = summariesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklySummaryDoc));
            setAllSummaries(fetchedSummaries.reverse());
        } catch (error) {
            console.error('Failed to fetch weekly summaries from Firestore:', error);
        }
        setLoading(false);
    };

    fetchAllSummaries();
  }, [dateRange]);

  React.useEffect(() => {
    const processData = async () => {
        if (loading) return;

        const selectedCategory = categories.find(c => c.id === selectedCategoryId);
        const isPlannable = selectedCategoryId === 'all' || (selectedCategory?.isPlanned ?? true);
        setIsCategoryPlannable(isPlannable);
        
        // --- Data for Weekly Summary Charts (Unaffected by specific week filter) ---
        const weeklySummaryForChart: WeeklySummaryData[] = allSummaries.map(summary => ({
            week: summary.week,
            name: `Semana ${summary.week}`,
            planned: summary.totalPlanned,
            totalActual: summary.totalActual,
            actualForPlanned: summary.totalActualForPlanned,
            unplannedProduction: summary.totalUnplannedProduction,
        })).sort((a, b) => a.week - b.week);
        setWeeklySummaryData(weeklySummaryForChart);
        
        const weeklyShiftDataForChart = allSummaries.map(summary => {
            const totalDay = Object.values(summary.dailyShiftTotals).reduce((sum, s) => sum + s.day, 0);
            const totalNight = Object.values(summary.dailyShiftTotals).reduce((sum, s) => sum + s.night, 0);
            return {
                name: `Semana ${summary.week}`,
                day: totalDay,
                night: totalNight,
                week: summary.week
            };
        }).sort((a,b) => a.week - b.week);
        setWeeklyShiftData(weeklyShiftDataForChart);
        
        // --- Data for Detail Charts (Affected by specific week filter) ---
        const summariesForDetailCharts = selectedWeek === 'all'
            ? allSummaries
            : allSummaries.filter(summary => summary.id === selectedWeek);

        const dailyTotals = {
            mon: { day: 0, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 0, night: 0 }, 
            thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 }, 
            sun: { day: 0, night: 0 } 
        };

        summariesForDetailCharts.forEach(summary => {
            for (const day of Object.keys(dailyTotals) as (keyof typeof dailyTotals)[]) {
                dailyTotals[day].day += summary.dailyShiftTotals[day]?.day || 0;
                dailyTotals[day].night += summary.dailyShiftTotals[day]?.night || 0;
            }
        });

        setDailyData([
            { name: 'Lunes', day: dailyTotals.mon.day, night: dailyTotals.mon.night },
            { name: 'Martes', day: dailyTotals.tue.day, night: dailyTotals.tue.night },
            { name: 'Miércoles', day: dailyTotals.wed.day, night: dailyTotals.wed.night },
            { name: 'Jueves', day: dailyTotals.thu.day, night: dailyTotals.thu.night },
            { name: 'Viernes', day: dailyTotals.fri.day, night: dailyTotals.fri.night },
            { name: 'Sábado', day: dailyTotals.sat.day, night: dailyTotals.sat.night },
            { name: 'Domingo', day: dailyTotals.sun.day, night: dailyTotals.sun.night },
        ]);
        
        // --- Product Chart Logic (Only runs if a specific week is selected) ---
        if (selectedWeek !== 'all') {
            try {
                const planDocRef = doc(db, "productionPlans", selectedWeek);
                const planDocSnap = await getDoc(planDocRef);
                if (planDocSnap.exists()) {
                    const planData = planDocSnap.data() as { products: ProductData[] };
                    const productChartData = planData.products
                        .filter(p => p.categoryIsPlanned && (p.planned > 0 || Object.values(p.actual).some(d => d.day > 0 || d.night > 0)))
                        .map(p => ({
                            name: p.productName,
                            planned: p.planned,
                            actual: Object.values(p.actual).reduce((sum, dayVal) => sum + dayVal.day + dayVal.night, 0),
                            color: p.color,
                        }));
                    setProductData(productChartData);
                } else {
                    setProductData([]);
                }
            } catch (error) {
                console.error("Error fetching single plan for product chart:", error);
                setProductData([]);
            }
        } else {
            setProductData([]);
        }
    };

    processData();

  }, [allSummaries, selectedWeek, selectedCategoryId, categories, loading]);


  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-2 md:p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard General</h1>
        </div>
        <Link href="/">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver a la Planificación
          </Button>
        </Link>
      </header>
      <main className="p-4 md:p-8 space-y-6">
        <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen} className="space-y-2">
            <div className="flex justify-between items-center">
                <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Filter className="mr-2 h-4 w-4" />
                        {isFilterOpen ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                    </Button>
                </CollapsibleTrigger>
                <CardDescription className="text-right text-xs md:text-sm">
                    Elige el rango de datos a cargar. Filtra por semana específica.
                </CardDescription>
            </div>
            <CollapsibleContent>
                <div className="bg-card p-4 rounded-lg border flex flex-col md:flex-row items-center gap-4">
                    <div className="flex flex-col gap-1.5 w-full md:max-w-xs">
                        <Label htmlFor='date-range-filter'>Rango de Datos</Label>
                        <Select value={dateRange} onValueChange={setDateRange}>
                            <SelectTrigger id="date-range-filter">
                                <SelectValue placeholder="Seleccionar Rango" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="4">Últimas 4 semanas</SelectItem>
                                <SelectItem value="12">Últimas 12 semanas</SelectItem>
                                <SelectItem value="26">Últimas 26 semanas (6 meses)</SelectItem>
                                <SelectItem value="all">Todo el historial</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full md:max-w-xs">
                        <Label htmlFor='category-filter'>Filtrar por Categoría</Label>
                        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                            <SelectTrigger id="category-filter" disabled>
                                <SelectValue placeholder="Todas las categorías" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <p className='text-xs text-muted-foreground mt-1'>Filtrado por producto/categoría no disponible con esta optimización.</p>
                    </div>
                     <div className="flex flex-col gap-1.5 w-full md:max-w-xs">
                        <Label htmlFor='week-filter'>Filtrar por Semana Específica</Label>
                        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                            <SelectTrigger id="week-filter">
                                <SelectValue placeholder="Seleccionar semana" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las semanas del rango</SelectItem>
                                {weekOptions.map(option => (
                                    <SelectItem key={option.id} value={String(option.id)}>
                                        Semana {option.week} ({option.year})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Resumen de Producción por Semana</CardTitle>
            <CardDescription>
                Compara el plan con la producción real. La barra de producción real muestra el desglose entre lo ejecutado del plan y lo no programado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <p className="text-muted-foreground text-center py-8">Cargando datos del dashboard...</p>
            ) : weeklySummaryData.length > 0 ? (
              <ChartContainer config={weeklyChartConfig} className="w-full h-[250px] md:h-[350px]">
                <BarChart accessibilityLayer data={weeklySummaryData}>
                  <defs>
                    <linearGradient id="colorUnplannedProduction" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.9}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis />
                  <RechartsTooltip cursor={false} content={<WeeklyTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="planned" fill="hsl(var(--accent))" radius={4} barSize={40} />
                  <Bar dataKey="actualForPlanned" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="unplannedProduction" stackId="a" fill="url(#colorUnplannedProduction)" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ChartContainer>
            ) : (
                <p className="text-muted-foreground text-center py-8">
                  No hay suficientes datos guardados para mostrar el dashboard.
                </p>
            )}
          </CardContent>
        </Card>
        
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Producción por Turno y Semana</CardTitle>
                    <CardDescription>Producción por turno para el rango de fechas seleccionado.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : weeklyShiftData.length > 0 ? (
                        <ChartContainer config={shiftChartConfig} className="w-full h-[250px] md:h-[300px]">
                            <BarChart accessibilityLayer data={weeklyShiftData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="day" fill="var(--color-day)" radius={4} />
                                <Bar dataKey="night" fill="var(--color-night)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    ) : <p className="text-center text-muted-foreground py-4">No hay datos de producción por turno.</p>}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Producción por Día de la Semana</CardTitle>
                    <CardDescription>Total producido por turno cada día (considera el filtro de semana específica).</CardDescription>
                </CardHeader>
                <CardContent>
                     {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : dailyData.some(d => d.day > 0 || d.night > 0) ? (
                        <ChartContainer config={dailyChartConfig} className="w-full h-[250px] md:h-[300px]">
                            <BarChart accessibilityLayer data={dailyData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="day" fill="var(--color-day)" radius={4} />
                                <Bar dataKey="night" fill="var(--color-night)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                     ) : <p className="text-center text-muted-foreground py-4">No hay datos de producción.</p>}
                </CardContent>
            </Card>
            <Card className="md:col-span-2">
                <CardHeader>
                    <CardTitle>Producción por Producto (Cumplimiento de Plan)</CardTitle>
                    <CardDescription>
                        {selectedWeek === 'all'
                            ? "Selecciona una semana específica en los filtros para ver el detalle de producción por producto."
                            : `Mostrando datos para la semana ${allSummaries.find(s => s.id === selectedWeek)?.week || ''}`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedWeek === 'all' ? (
                         <p className="text-center text-muted-foreground py-8">Selecciona una semana para ver este gráfico y mantener la optimización de costos.</p>
                    ) : loading ? (
                        <p className="text-center text-muted-foreground py-8">Cargando datos del producto...</p>
                    ) : productData.length > 0 ? (
                        <ChartContainer config={productChartConfig} className="w-full h-[400px]">
                            <BarChart accessibilityLayer data={productData} margin={{ left: -20 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    tickFormatter={(value) => value.slice(0, 15) + (value.length > 15 ? '...' : '')}
                                />
                                <YAxis />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="planned" fill="var(--color-planned)" radius={4}>
                                    {productData.map((entry, index) => (
                                        <Cell key={`cell-planned-${index}`} fill={entry.color || 'hsl(var(--accent))'} opacity={0.5} />
                                    ))}
                                </Bar>
                                <Bar dataKey="actual" fill="var(--color-actual)" radius={4}>
                                    {productData.map((entry, index) => (
                                        <Cell key={`cell-actual-${index}`} fill={entry.color || 'hsl(var(--primary))'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No hay datos de productos planificados para esta semana.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

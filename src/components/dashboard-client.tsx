'use client';

import React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ChevronLeft, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ProductData, DailyProduction, ProductCategory } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type WeeklySummaryData = {
  week: number;
  name: string;
  planned: number;
  actual: number;
  variance: number;
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
};

const weeklyChartConfig = {
  planned: {
    label: 'Planificado',
    color: 'hsl(var(--accent))',
  },
  actual: {
    label: 'Real',
    color: 'hsl(var(--primary))',
  },
  variance: {
      label: 'Varianza',
  }
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
    color: "hsl(var(--chart-1))",
  },
  actual: {
    label: "Real",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;


type AllPlansData = {
    week: number;
    year: number;
    products: ProductData[];
};

// Custom Tooltip for Weekly Summary Chart
const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col space-y-1">
              <span className="text-[0.70rem] uppercase text-muted-foreground">
                {label}
              </span>
              <div className="font-bold text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--accent))'}} />
                    Planificado
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--primary))'}} />
                    Real
                </div>
                {'variance' in data && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-transparent" />
                    Varianza
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col space-y-1 text-right">
                <span className="text-[0.70rem] uppercase text-muted-foreground">&nbsp;</span>
                <div className="font-bold">
                    <div>{data.planned.toLocaleString()}</div>
                    <div>{data.actual.toLocaleString()}</div>
                    {'variance' in data && (
                      <div className={cn(data.variance >= 0 ? 'text-green-600' : 'text-destructive')}>
                          {data.variance.toLocaleString()}
                      </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      );
    }
  
    return null;
};

export default function DashboardClient() {
  const [summaryData, setSummaryData] = React.useState<WeeklySummaryData[]>([]);
  const [weeklyShiftData, setWeeklyShiftData] = React.useState<WeeklyShiftSummaryData[]>([]);
  const [dailyData, setDailyData] = React.useState<DailySummaryData[]>([]);
  const [productData, setProductData] = React.useState<ProductSummaryData[]>([]);

  const [loading, setLoading] = React.useState(true);
  const [allPlans, setAllPlans] = React.useState<AllPlansData[]>([]);
  const [selectedWeek, setSelectedWeek] = React.useState('all');
  const [selectedCategory, setSelectedCategory] = React.useState<ProductCategory | 'all'>('all');
  const [isFilterOpen, setIsFilterOpen] = React.useState(true);

  const weekOptions = React.useMemo(() => {
    return allPlans
      .map(plan => plan.week)
      .filter((value, index, self) => self.indexOf(value) === index) // Unique weeks
      .sort((a, b) => a - b);
  }, [allPlans]);

  React.useEffect(() => {
    const fetchAllPlans = async () => {
        setLoading(true);
        const fetchedPlans: AllPlansData[] = [];
        try {
            const plansSnapshot = await getDocs(collection(db, 'productionPlans'));
            plansSnapshot.forEach((doc) => {
                const plan = doc.data();
                if (plan.week && plan.year && plan.products) {
                    fetchedPlans.push({
                        week: plan.week,
                        year: plan.year,
                        products: plan.products
                    });
                }
            });
            setAllPlans(fetchedPlans);
        } catch (error) {
            console.error('Failed to fetch production plans from Firestore:', error);
        }
        setLoading(false);
    };

    fetchAllPlans();
  }, []);

  React.useEffect(() => {
    if (allPlans.length === 0) return;
    
    const getFilteredProducts = (products: ProductData[]): ProductData[] => {
      const productsWithDefaults = products.map(p => ({
        ...p,
        category: p.category || 'Familiar',
      }));

      if (selectedCategory === 'all') {
        return productsWithDefaults;
      }
      
      return productsWithDefaults.filter(p => p.category === selectedCategory);
    };

    // --- Data for charts that IGNORE week filter ---
    const weeklyDataMap: { [week: number]: { planned: number; actual: number } } = {};
    const weeklyShiftTotals: { [week: number]: { day: number; night: number } } = {};

    allPlans.forEach(plan => {
      const filteredProducts = getFilteredProducts(plan.products);

      if (!weeklyDataMap[plan.week]) weeklyDataMap[plan.week] = { planned: 0, actual: 0 };
      if (!weeklyShiftTotals[plan.week]) weeklyShiftTotals[plan.week] = { day: 0, night: 0 };

      filteredProducts.forEach(item => {
        weeklyDataMap[plan.week].planned += item.planned || 0;
        Object.values(item.actual).forEach(shifts => {
            const dayVal = shifts.day || 0;
            const nightVal = shifts.night || 0;
            weeklyShiftTotals[plan.week].day += dayVal;
            weeklyShiftTotals[plan.week].night += nightVal;
        });
      });
      weeklyDataMap[plan.week].actual = weeklyShiftTotals[plan.week].day + weeklyShiftTotals[plan.week].night
    });

    const weeklyData: WeeklySummaryData[] = Object.keys(weeklyDataMap)
        .map(weekStr => {
            const week = parseInt(weekStr, 10);
            const planned = weeklyDataMap[week].planned;
            const actual = weeklyDataMap[week].actual;
            return {
                week: week,
                name: `Semana ${week}`,
                planned: planned,
                actual: actual,
                variance: actual - planned,
            };
        })
        .sort((a, b) => a.week - b.week);
    setSummaryData(weeklyData);
    
    const processedWeeklyShiftData = Object.keys(weeklyShiftTotals)
        .map(week => ({
            name: `Semana ${week}`,
            day: weeklyShiftTotals[parseInt(week)].day,
            night: weeklyShiftTotals[parseInt(week)].night,
            week: parseInt(week)
        }))
        .sort((a, b) => a.week - b.week);
    setWeeklyShiftData(processedWeeklyShiftData);


    // --- Data for charts that RESPECT week filter ---
    const dailyTotals: { [key in keyof DailyProduction]: { day: number; night: number } } = { 
        mon: { day: 0, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 0, night: 0 }, 
        thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 }, 
        sun: { day: 0, night: 0 } 
    };
    const productTotals: { [productName: string]: { planned: number; actual: number } } = {};

    const plansToProcess = selectedWeek === 'all' 
      ? allPlans 
      : allPlans.filter(plan => String(plan.week) === selectedWeek);

    plansToProcess.forEach(plan => {
      const filteredProducts = getFilteredProducts(plan.products);
      
      filteredProducts.forEach(item => {
        if (!productTotals[item.productName]) productTotals[item.productName] = { planned: 0, actual: 0 };
        
        productTotals[item.productName].planned += item.planned || 0;
        const itemActualTotal = Object.values(item.actual).reduce((sum, shifts) => sum + (shifts.day || 0) + (shifts.night || 0), 0);
        productTotals[item.productName].actual += itemActualTotal;

        Object.entries(item.actual).forEach(([day, shifts]) => {
            const dayKey = day as keyof DailyProduction;
            dailyTotals[dayKey].day += shifts.day || 0;
            dailyTotals[dayKey].night += shifts.night || 0;
        });
      });
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

    const processedProductData = Object.keys(productTotals)
        .map(name => ({
            name,
            planned: productTotals[name].planned,
            actual: productTotals[name].actual,
        }))
        .filter(item => item.planned > 0 || item.actual > 0);
    setProductData(processedProductData);

  }, [allPlans, selectedWeek, selectedCategory]);


  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Dashboard General</h1>
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
                <CardDescription>
                    El filtro de semana solo aplica a los gráficos de producción por día y por producto.
                </CardDescription>
            </div>
            <CollapsibleContent>
                <div className="bg-card p-4 rounded-lg border flex items-center gap-4">
                    <div className="flex flex-col gap-1.5 w-full max-w-xs">
                        <Label htmlFor='week-filter'>Filtrar por Semana</Label>
                        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                            <SelectTrigger id="week-filter">
                                <SelectValue placeholder="Seleccionar semana" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las semanas</SelectItem>
                                {weekOptions.map(week => (
                                    <SelectItem key={week} value={String(week)}>
                                        Semana {week}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full max-w-xs">
                        <Label htmlFor='category-filter'>Filtrar por Categoría</Label>
                        <Select value={selectedCategory} onValueChange={(value: ProductCategory | 'all') => setSelectedCategory(value)}>
                            <SelectTrigger id="category-filter">
                                <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las categorías</SelectItem>
                                <SelectItem value="Familiar">Familiar</SelectItem>
                                <SelectItem value="Granel">Granel</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
        
        <div className="grid md:grid-cols-2 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Resumen de Producción por Semana</CardTitle>
                <CardDescription>Comparación de lo planificado vs. ejecutado. Ignora el filtro de semana.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                    <p className="text-muted-foreground text-center py-8">Cargando datos del dashboard...</p>
                ) : summaryData.length > 0 ? (
                  <ChartContainer config={weeklyChartConfig} className="w-full h-[350px]">
                    <BarChart accessibilityLayer data={summaryData}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                      />
                      <YAxis />
                      <ChartTooltip cursor={false} content={<CustomTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                      <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No hay suficientes datos guardados para mostrar el dashboard.
                    </p>
                )}
              </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Producción por Turno y Semana</CardTitle>
                    <CardDescription>Producción por turno. Ignora el filtro de semana.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : weeklyShiftData.length > 0 ? (
                        <ChartContainer config={shiftChartConfig} className="w-full h-[300px]">
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
                    <CardDescription>Total producido por turno cada día.</CardDescription>
                </CardHeader>
                <CardContent>
                     {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : dailyData.some(d => d.day > 0 || d.night > 0) ? (
                        <ChartContainer config={dailyChartConfig} className="w-full h-[300px]">
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
                    <CardTitle>Producción por Producto</CardTitle>
                    <CardDescription>Planificado vs. Real para cada producto en el período seleccionado.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : productData.length > 0 ? (
                        <ChartContainer config={productChartConfig} className="w-full h-[400px]">
                            <BarChart accessibilityLayer data={productData} margin={{ top: 20, right: 20, left: 20, bottom: 80 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis 
                                    dataKey="name" 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickMargin={10}
                                    angle={-45}
                                    textAnchor="end"
                                    interval={0}
                                />
                                <YAxis />
                                <ChartTooltip cursor={false} content={<CustomTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                                <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    ) : <p className="text-center text-muted-foreground py-4">No hay datos de producción para los filtros seleccionados.</p>}
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

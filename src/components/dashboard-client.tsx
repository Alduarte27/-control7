'use client';

import React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ChevronLeft, Filter, Percent, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { ProductData, DailyProduction, CategoryDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import ComparisonCard from './comparison-card';


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
    week: number;
    year: number;
    products: ProductData[];
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


export default function DashboardClient() {
  const [weeklySummaryData, setWeeklySummaryData] = React.useState<WeeklySummaryData[]>([]);
  const [weeklyShiftData, setWeeklyShiftData] = React.useState<WeeklyShiftSummaryData[]>([]);
  const [dailyData, setDailyData] = React.useState<DailySummaryData[]>([]);
  const [productData, setProductData] = React.useState<ProductSummaryData[]>([]);
  
  const [loading, setLoading] = React.useState(true);
  const [allPlans, setAllPlans] = React.useState<AllPlansData[]>([]);
  const [categories, setCategories] = React.useState<CategoryDefinition[]>([]);
  const [selectedWeek, setSelectedWeek] = React.useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState('all');
  const [isFilterOpen, setIsFilterOpen] = React.useState(true);
  const [isCategoryPlannable, setIsCategoryPlannable] = React.useState(true);


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
            const categoriesSnapshot = await getDocs(query(collection(db, "categories"), orderBy("name")));
            const categoriesList = categoriesSnapshot.docs.map(doc => ({ id: doc.id, isPlanned: true, ...doc.data() } as CategoryDefinition));
            setCategories(categoriesList);

            const plansSnapshot = await getDocs(collection(db, 'productionPlans'));
            plansSnapshot.forEach((doc) => {
                const plan = doc.data();
                if (plan.week && plan.year && plan.products) {
                    fetchedPlans.push({
                        week: plan.week,
                        year: plan.year,
                        products: plan.products,
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
    if (loading) return;

    const selectedCategory = categories.find(c => c.id === selectedCategoryId);
    const isPlannable = selectedCategoryId === 'all' || (selectedCategory?.isPlanned ?? true);
    setIsCategoryPlannable(isPlannable);

    const getFilteredProducts = (products: ProductData[]): ProductData[] => {
        if (selectedCategoryId === 'all') return products;
        return products.filter(p => p.categoryId === selectedCategoryId);
    };
    
    // Function to calculate total actual production for a product
    const calculateTotalActual = (product: ProductData) =>
      Object.values(product.actual).reduce((sum, shifts) => sum + (shifts.day || 0) + (shifts.night || 0), 0);


    const weeklyMap: { [week: number]: { planned: number; totalActual: number; actualForPlanned: number, unplannedProduction: number } } = {};
    const weeklyShiftTotals: { [week: number]: { day: number; night: number } } = {};

    allPlans.forEach(plan => {
        const filteredProducts = getFilteredProducts(plan.products);

        if (!weeklyMap[plan.week]) weeklyMap[plan.week] = { planned: 0, totalActual: 0, actualForPlanned: 0, unplannedProduction: 0 };
        if (!weeklyShiftTotals[plan.week]) weeklyShiftTotals[plan.week] = { day: 0, night: 0 };

        filteredProducts.forEach(item => {
            const totalActualForItem = calculateTotalActual(item);
            
            if (item.categoryIsPlanned && item.planned > 0) {
                weeklyMap[plan.week].planned += item.planned || 0;
            }
            
            weeklyMap[plan.week].totalActual += totalActualForItem;

            if (item.categoryIsPlanned && (item.planned || 0) > 0) {
                weeklyMap[plan.week].actualForPlanned += totalActualForItem;
            } else if (totalActualForItem > 0) {
                weeklyMap[plan.week].unplannedProduction += totalActualForItem;
            }
            
            // Logic for shift totals (includes all production)
            Object.values(item.actual).forEach(shifts => {
                weeklyShiftTotals[plan.week].day += shifts.day || 0;
                weeklyShiftTotals[plan.week].night += shifts.night || 0;
            });
        });
    });
    
    const summaryData: WeeklySummaryData[] = Object.keys(weeklyMap)
        .map(weekStr => {
            const week = parseInt(weekStr, 10);
            const data = weeklyMap[week];
            return {
                week: week,
                name: `Semana ${week}`,
                planned: data.planned,
                totalActual: data.totalActual,
                actualForPlanned: data.actualForPlanned,
                unplannedProduction: data.unplannedProduction,
            };
        })
        .sort((a, b) => a.week - b.week);
    setWeeklySummaryData(summaryData);

    const processedWeeklyShiftData = Object.keys(weeklyShiftTotals)
        .map(week => ({
            name: `Semana ${week}`,
            day: weeklyShiftTotals[parseInt(week)].day,
            night: weeklyShiftTotals[parseInt(week)].night,
            week: parseInt(week)
        }))
        .sort((a, b) => a.week - b.week);
    setWeeklyShiftData(processedWeeklyShiftData);

    const dailyTotals: { [key in keyof DailyProduction]: { day: number; night: number } } = { 
        mon: { day: 0, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 0, night: 0 }, 
        thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 }, 
        sun: { day: 0, night: 0 } 
    };
    const productTotals: { [productName: string]: { planned: number; actual: number; color?: string; } } = {};

    const plansToProcess = selectedWeek === 'all' 
      ? allPlans 
      : allPlans.filter(plan => String(plan.week) === selectedWeek);

    plansToProcess.forEach(plan => {
      const filteredProducts = getFilteredProducts(plan.products);
      
      filteredProducts.forEach(item => {
        if (!productTotals[item.productName]) {
          productTotals[item.productName] = { planned: 0, actual: 0, color: item.color };
        }
        
        const itemActualTotal = calculateTotalActual(item);
        
        if (item.categoryIsPlanned && item.planned > 0) {
            productTotals[item.productName].planned += item.planned || 0;
            productTotals[item.productName].actual += itemActualTotal;
        } else if (!item.categoryIsPlanned) {
            productTotals[item.productName].actual += itemActualTotal;
        }


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
            color: productTotals[name].color,
        }))
        .filter(item => item.planned > 0 || item.actual > 0);
    setProductData(processedProductData);

  }, [allPlans, selectedWeek, selectedCategoryId, categories, loading]);


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
                <CardDescription className="text-right">
                    El filtro de categoría aplica a todos los gráficos. El filtro de semana solo a los gráficos por día y producto.
                </CardDescription>
            </div>
            <CollapsibleContent>
                <div className="bg-card p-4 rounded-lg border flex flex-col md:flex-row items-center gap-4">
                    <div className="flex flex-col gap-1.5 w-full md:max-w-xs">
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
                    <div className="flex flex-col gap-1.5 w-full md:max-w-xs">
                        <Label htmlFor='category-filter'>Filtrar por Categoría</Label>
                        <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                            <SelectTrigger id="category-filter">
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
                  <ChartTooltip cursor={false} content={<WeeklyTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="planned" fill="hsl(var(--accent))" radius={4} barSize={60} />
                  <Bar dataKey="actualForPlanned" stackId="a" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} barSize={60} />
                  <Bar dataKey="unplannedProduction" stackId="a" fill="url(#colorUnplannedProduction)" radius={[4, 4, 0, 0]} barSize={60} />
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
                    <CardDescription>Producción por turno. Ignora el filtro de semana.</CardDescription>
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
                    <CardDescription>Total producido por turno cada día.</CardDescription>
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
                         {isCategoryPlannable
                            ? 'Planificado vs. Real para cada producto con plan > 0 en el período seleccionado.'
                            : 'Producción real para cada producto en el período seleccionado.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : productData.length > 0 ? (
                        <ChartContainer config={productChartConfig} className="w-full h-[500px]">
                            <BarChart accessibilityLayer data={productData} margin={{ top: 20, right: 20, left: 0, bottom: 120 }}>
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
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <ChartLegend verticalAlign="top" content={<ChartLegendContent />} />
                                {isCategoryPlannable && <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />}
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

'use client';

import React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ChevronLeft, Filter, TrendingUp, TrendingDown, Activity, Box, PackageCheck, ClipboardCheck, ClipboardPlus, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import type { ProductData, CategoryDefinition, ProductDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { Checkbox } from './ui/checkbox';
import KpiCard from './kpi-card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const KG_PER_QUINTAL = 50;

type WeeklySummaryData = {
  week: number;
  name: string;
  planned: number;
  totalActual: number;
  actualForPlanned: number;
  unplannedProduction: number;
  plannedQQ: number;
  actualForPlannedQQ: number;
  unplannedProductionQQ: number;
  totalActualQQ: number;
};

type WeeklyShiftSummaryData = {
    name: string;
    day: number;
    night: number;
    week: number;
    dayQQ: number;
    nightQQ: number;
}

type DailySummaryData = {
  name: string;
  day: number;
  night: number;
  dayQQ: number;
  nightQQ: number;
}

type ProductSummaryData = {
  name: string;
  planned: number;
  actual: number;
  color?: string;
  sackWeight: number;
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
    categoryTotals: {
        [categoryId: string]: {
            planned: number;
            actualForPlanned: number;
            unplannedProduction: number;
            totalActual: number;
        }
    }
};

type FullPlanDoc = {
  id: string;
  products: ProductData[];
  week: number;
  year: number;
}

const ProductTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ProductSummaryData;
      const sackWeight = data.sackWeight || 50;

      const plannedQQ = (data.planned * sackWeight) / KG_PER_QUINTAL;
      const actualQQ = (data.actual * sackWeight) / KG_PER_QUINTAL;

      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm text-sm min-w-[250px]">
          <p className="font-bold mb-2">{label}</p>
          <div className="grid grid-cols-[1fr,auto] gap-x-4 gap-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--accent))'}} />
              <span>Planificado:</span>
            </div>
            <span className="text-right font-medium">{data.planned.toLocaleString()} sacos ({plannedQQ.toFixed(1)} qq)</span>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--chart-2))'}} />
              <span>Real:</span>
            </div>
            <span className="text-right font-medium">{data.actual.toLocaleString()} sacos ({actualQQ.toFixed(1)} qq)</span>
          </div>
        </div>
      );
    }
    return null;
};

const CustomShiftTooltipContent = ({ active, payload, label, config }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
        <p className="font-bold mb-2">{label}</p>
        {payload.map((item: any) => (
          <div key={item.dataKey} className="grid grid-cols-[1fr,auto] gap-x-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{config[item.dataKey]?.label}:</span>
            </div>
            <span className="text-right font-medium">
              {item.value.toLocaleString()} sacos ({item.payload[`${item.dataKey}QQ`]?.toFixed(1)} qq)
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const WeeklyTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as WeeklySummaryData;
      const variance = data.actualForPlanned - data.planned;
      const varianceQQ = data.actualForPlannedQQ - data.plannedQQ;
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
            <span className="text-right font-medium">{data.planned.toLocaleString()} ({data.plannedQQ.toFixed(1)} qq)</span>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--chart-2))'}} />
              <span>Ejecutado (s/Plan):</span>
            </div>
            <span className="text-right font-medium">{data.actualForPlanned.toLocaleString()} ({data.actualForPlannedQQ.toFixed(1)} qq)</span>

            <div className={cn("flex items-center gap-2 pl-4 text-xs", varianceColor)}>
              <VarianceIcon className="h-3 w-3" />
              <span>Varianza (s/Plan):</span>
            </div>
            <span className={cn("text-right font-medium text-xs", varianceColor)}>{variance.toLocaleString()} ({varianceQQ.toFixed(1)} qq)</span>
            
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: 'hsl(var(--chart-3))'}} />
              <span>No Programado:</span>
            </div>
            <span className="text-right font-medium">{data.unplannedProduction.toLocaleString()} ({data.unplannedProductionQQ.toFixed(1) } qq)</span>

            <div className="col-span-2 border-t my-1"></div>
            
            <div className="flex items-center gap-2 font-bold">
              <div className="w-1 h-1 rounded-full bg-foreground/50 ml-1 mr-1" />
              <span>Producción Total:</span>
            </div>
            <span className="text-right font-bold">{data.totalActual.toLocaleString()} ({data.totalActualQQ.toFixed(1)} qq)</span>
          </div>
        </div>
      );
    }
    return null;
};

const ShiftKpiCard = ({ daySacos, dayQq, nightSacos, nightQq }: { daySacos: number; dayQq: number; nightSacos: number; nightQq: number; }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Producción por Turno</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sun className="h-4 w-4" />
                  <span>Turno Día</span>
                </div>
                <p className="text-xl font-bold">{daySacos.toLocaleString()}</p>
                <p className="text-xs font-medium text-muted-foreground">{dayQq.toLocaleString(undefined, { maximumFractionDigits: 1 })} qq</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Moon className="h-4 w-4" />
                  <span>Turno Noche</span>
                </div>
                <p className="text-xl font-bold">{nightSacos.toLocaleString()}</p>
                <p className="text-xs font-medium text-muted-foreground">{nightQq.toLocaleString(undefined, { maximumFractionDigits: 1 })} qq</p>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p>Suma total de la producción real para cada turno en el período y filtros seleccionados.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ProductionMixKpiCard = ({ plannedSacos, plannedQq, plannedPercentage, unplannedSacos, unplannedQq, unplannedPercentage }: { plannedSacos: number; plannedQq: number; plannedPercentage: number; unplannedSacos: number; unplannedQq: number; unplannedPercentage: number; }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mix de Producción</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardCheck className="h-4 w-4" />
                  <span>Planificado</span>
                </div>
                <p className="text-xl font-bold">{plannedSacos.toLocaleString()}</p>
                <p className="text-xs font-medium text-muted-foreground">{plannedQq.toLocaleString(undefined, { maximumFractionDigits: 1 })} qq ({plannedPercentage.toFixed(1)}%)</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardPlus className="h-4 w-4" />
                  <span>No Planificado</span>
                </div>
                <p className="text-xl font-bold">{unplannedSacos.toLocaleString()}</p>
                <p className="text-xs font-medium text-muted-foreground">{unplannedQq.toLocaleString(undefined, { maximumFractionDigits: 1 })} qq ({unplannedPercentage.toFixed(1)}%)</p>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p>Desglose de la producción real entre lo que estaba planificado y lo que no.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};


export default function DashboardClient({ prefetchedCategories, prefetchedProducts }: { prefetchedCategories: CategoryDefinition[], prefetchedProducts: ProductDefinition[]}) {
  const [weeklySummaryData, setWeeklySummaryData] = React.useState<WeeklySummaryData[]>([]);
  const [weeklyShiftData, setWeeklyShiftData] = React.useState<WeeklyShiftSummaryData[]>([]);
  const [dailyData, setDailyData] = React.useState<DailySummaryData[]>([]);
  const [productData, setProductData] = React.useState<ProductSummaryData[]>([]);
  const [aggregatedProductData, setAggregatedProductData] = React.useState<ProductSummaryData[]>([]);
  
  const [loading, setLoading] = React.useState(true);
  const [allSummaries, setAllSummaries] = React.useState<WeeklySummaryDoc[]>([]);
  const [allPlans, setAllPlans] = React.useState<FullPlanDoc[]>([]);
  const [filteredSummaries, setFilteredSummaries] = React.useState<WeeklySummaryDoc[]>([]);
  const [categories] = React.useState<CategoryDefinition[]>(prefetchedCategories);
  const [products] = React.useState<ProductDefinition[]>(prefetchedProducts);
  const [selectedWeek, setSelectedWeek] = React.useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState('all');
  const [isFilterOpen, setIsFilterOpen] = React.useState(true);
  const [dateRange, setDateRange] = React.useState('12');
  const [showOnlyPlannedInHistory, setShowOnlyPlannedInHistory] = React.useState(true);

  // New state for KPIs
  const [productionMix, setProductionMix] = React.useState({
      plannedSacos: 0,
      plannedQq: 0,
      plannedPercentage: 0,
      unplannedSacos: 0,
      unplannedQq: 0,
      unplannedPercentage: 0,
  });
  const [shiftTotals, setShiftTotals] = React.useState({
    daySacos: 0,
    dayQq: 0,
    nightSacos: 0,
    nightQq: 0,
  });
  const [totalPeriodProduction, setTotalPeriodProduction] = React.useState({ sacos: 0, qq: 0 });

  const weekOptions = React.useMemo(() => {
    return filteredSummaries
      .map(summary => ({ week: summary.week, year: summary.year, id: summary.id }))
      .sort((a, b) => b.year - a.year || b.week - a.week);
  }, [filteredSummaries]);

  React.useEffect(() => {
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [summariesSnapshot, plansSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'weeklySummaries'))),
                getDocs(query(collection(db, 'productionPlans'))),
            ]);
            
            const fetchedSummaries = summariesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklySummaryDoc));
            fetchedSummaries.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.week - a.week;
            });
            setAllSummaries(fetchedSummaries);

            const fetchedPlans = plansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FullPlanDoc));
            setAllPlans(fetchedPlans);
        } catch (error) {
            console.error('Failed to fetch data from Firestore:', error);
        }
        setLoading(false);
    };

    fetchAllData();
  }, []);

  React.useEffect(() => {
    if (dateRange === 'all') {
        setFilteredSummaries(allSummaries);
    } else {
        const numberOfWeeks = parseInt(dateRange, 10);
        setFilteredSummaries(allSummaries.slice(0, numberOfWeeks));
    }
  }, [dateRange, allSummaries]);

  React.useEffect(() => {
    if (loading) return;
    
    const plansMap = new Map(allPlans.map(p => [p.id, p]));
    const plannableCategoryIds = new Set(categories.filter(c => c.isPlanned).map(c => c.id));
    
    // --- Data for Weekly Summary Charts (Unaffected by specific week filter) ---
    const summariesForCharts = filteredSummaries;
    
    const weeklySummaryForChart: WeeklySummaryData[] = summariesForCharts.map(summary => {
        const plan = plansMap.get(summary.id);
        
        let totalPlannedSacks = 0;
        let actualForPlannedSacks = 0;
        let unplannedProductionSacks = 0;

        let totalPlannedWeight = 0;
        let actualForPlannedWeight = 0;
        let unplannedProductionWeight = 0;

        if (plan) {
            plan.products.forEach(p => {
                const categoryMatch = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
                if (!categoryMatch) return;

                const productTotalActual = Object.values(p.actual).reduce((sum, day) => sum + (day.day || 0) + (day.night || 0), 0);
                const sackWeight = p.sackWeight || 50;
                
                if (plannableCategoryIds.has(p.categoryId)) {
                  if (p.planned > 0) {
                    totalPlannedSacks += p.planned || 0;
                    actualForPlannedSacks += productTotalActual;
                    totalPlannedWeight += (p.planned || 0) * sackWeight;
                    actualForPlannedWeight += productTotalActual * sackWeight;
                  } else if (productTotalActual > 0) {
                    unplannedProductionSacks += productTotalActual;
                    unplannedProductionWeight += productTotalActual * sackWeight;
                  }
                }
            });
        }
        
        const totalActualSacks = actualForPlannedSacks + unplannedProductionSacks;
        // QQ Calculations for tooltip
        const plannedQQ = totalPlannedWeight / KG_PER_QUINTAL;
        const actualForPlannedQQ = actualForPlannedWeight / KG_PER_QUINTAL;
        const unplannedProductionQQ = unplannedProductionWeight / KG_PER_QUINTAL;
        
        return {
            week: summary.week,
            name: `S${summary.week}`,
            planned: totalPlannedSacks,
            actualForPlanned: actualForPlannedSacks,
            unplannedProduction: unplannedProductionSacks,
            totalActual: totalActualSacks,
            plannedQQ,
            actualForPlannedQQ,
            unplannedProductionQQ,
            totalActualQQ: actualForPlannedQQ + unplannedProductionQQ,
        };
    }).reverse();
    setWeeklySummaryData(weeklySummaryForChart);
    
    const weeklyShiftDataForChart = summariesForCharts.map(summary => {
        const plan = plansMap.get(summary.id);
        let totalDayQQ = 0, totalNightQQ = 0;
        
        let totalDaySacks = 0;
        let totalNightSacks = 0;
        if(plan) {
            plan.products.forEach(p => {
                const categoryMatch = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
                if (!categoryMatch) return;

                const sackWeight = p.sackWeight || 50;
                for(const day of Object.values(p.actual)) {
                    totalDaySacks += day.day || 0;
                    totalNightSacks += day.night || 0;
                    totalDayQQ += (day.day || 0) * sackWeight / KG_PER_QUINTAL;
                    totalNightQQ += (day.night || 0) * sackWeight / KG_PER_QUINTAL;
                }
            });
        }

        return {
            name: `S${summary.week}`,
            day: totalDaySacks,
            night: totalNightSacks,
            week: summary.week,
            dayQQ: totalDayQQ,
            nightQQ: totalNightQQ,
        };
    }).reverse();
    setWeeklyShiftData(weeklyShiftDataForChart);
    
    // --- Data for Detail Charts (Affected by specific week filter) ---
    const summariesForDetailCharts = selectedWeek === 'all'
        ? summariesForCharts
        : summariesForCharts.filter(summary => summary.id === selectedWeek);

    const plansForDetailCharts = summariesForDetailCharts.map(s => plansMap.get(s.id)).filter(p => !!p) as FullPlanDoc[];

    const dailyTotals = {
        mon: { day: 0, night: 0, dayQQ: 0, nightQQ: 0 }, 
        tue: { day: 0, night: 0, dayQQ: 0, nightQQ: 0 }, 
        wed: { day: 0, night: 0, dayQQ: 0, nightQQ: 0 }, 
        thu: { day: 0, night: 0, dayQQ: 0, nightQQ: 0 }, 
        fri: { day: 0, night: 0, dayQQ: 0, nightQQ: 0 }, 
        sat: { day: 0, night: 0, dayQQ: 0, nightQQ: 0 }, 
        sun: { day: 0, night: 0, dayQQ: 0, nightQQ: 0 } 
    };

    plansForDetailCharts.forEach(plan => {
        plan.products.forEach(product => {
            const categoryMatch = selectedCategoryId === 'all' || product.categoryId === selectedCategoryId;
            if (!categoryMatch) return;

            const sackWeight = product.sackWeight || 50;
            for (const day of Object.keys(dailyTotals) as (keyof typeof dailyTotals)[]) {
                const shiftData = product.actual[day];
                if (shiftData) {
                    dailyTotals[day].day += shiftData.day || 0;
                    dailyTotals[day].night += shiftData.night || 0;
                    dailyTotals[day].dayQQ += (shiftData.day || 0) * sackWeight / KG_PER_QUINTAL;
                    dailyTotals[day].nightQQ += (shiftData.night || 0) * sackWeight / KG_PER_QUINTAL;
                }
            }
        });
    });

    setDailyData([
        { name: 'Lunes', ...dailyTotals.mon },
        { name: 'Martes', ...dailyTotals.tue },
        { name: 'Miércoles', ...dailyTotals.wed },
        { name: 'Jueves', ...dailyTotals.thu },
        { name: 'Viernes', ...dailyTotals.fri },
        { name: 'Sábado', ...dailyTotals.sat },
        { name: 'Domingo', ...dailyTotals.sun },
    ]);
    
    // --- Single Week Product Chart Logic (Only runs if a specific week is selected) ---
    if (selectedWeek !== 'all') {
        const plan = allPlans.find(p => p.id === selectedWeek);
        if (plan) {
            const productChartData = plan.products
                .filter((p: ProductData) => {
                    if (showOnlyPlannedInHistory && !plannableCategoryIds.has(p.categoryId)) {
                        return false;
                    }
                    const categoryMatch = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
                    const hasActivity = p.planned > 0 || Object.values(p.actual).some(d => d.day > 0 || d.night > 0);
                    return categoryMatch && hasActivity;
                })
                .map((p: ProductData) => ({
                    name: p.productName,
                    planned: p.planned,
                    actual: Object.values(p.actual).reduce((sum, dayVal) => sum + (dayVal.day || 0) + (dayVal.night || 0), 0),
                    color: p.color,
                    sackWeight: p.sackWeight || 50,
                }));
            setProductData(productChartData);
        } else {
            setProductData([]);
        }
    } else {
        setProductData([]);
    }

    // --- Aggregated Product Chart Logic & KPIs ---
    const filteredPlanIds = new Set(summariesForCharts.map(s => s.id));
    const relevantPlans = allPlans.filter(p => filteredPlanIds.has(p.id));
    const productTotals: { [productId: string]: { name: string; planned: number; actual: number; color?: string; sackWeight: number; } } = {};
    
    let kpiPlannedSacos = 0;
    let kpiPlannedQq = 0;
    let kpiUnplannedSacos = 0;
    let kpiUnplannedQq = 0;
    let kpiTotalDaySacos = 0;
    let kpiTotalDayQq = 0;
    let kpiTotalNightSacos = 0;
    let kpiTotalNightQq = 0;
    let totalProductionAllCategoriesSacos = 0;
    let totalProductionAllCategoriesQq = 0;

    relevantPlans.forEach(plan => {
        plan.products.forEach((product: ProductData) => {
            const totalActual = Object.values(product.actual).reduce((sum, dayVal) => sum + (dayVal.day || 0) + (dayVal.night || 0), 0);
            const sackWeight = product.sackWeight || 50;
            const totalActualQq = totalActual * sackWeight / KG_PER_QUINTAL;
            
            // Grand Total KPI (ignores category filter, respects date range)
            totalProductionAllCategoriesSacos += totalActual;
            totalProductionAllCategoriesQq += totalActualQq;
            
            // Mix de Producción & Shift Totals KPI Calculation
            const categoryMatch = selectedCategoryId === 'all' || product.categoryId === selectedCategoryId;
            
            if (categoryMatch) {
              if ((product.planned || 0) > 0) {
                  kpiPlannedSacos += totalActual;
                  kpiPlannedQq += totalActualQq;
              } else if (totalActual > 0) {
                  kpiUnplannedSacos += totalActual;
                  kpiUnplannedQq += totalActualQq;
              }
              
              for (const day of Object.values(product.actual)) {
                  kpiTotalDaySacos += day.day || 0;
                  kpiTotalNightSacos += day.night || 0;
                  kpiTotalDayQq += (day.day || 0) * sackWeight / KG_PER_QUINTAL;
                  kpiTotalNightQq += (day.night || 0) * sackWeight / KG_PER_QUINTAL;
              }
            }

            // "Rendimiento Histórico" chart
            if (showOnlyPlannedInHistory && !plannableCategoryIds.has(product.categoryId)) {
                return;
            }

            const hasActivity = (product.planned || 0) > 0 || totalActual > 0;
            
            if (categoryMatch && hasActivity) {
                 if (!productTotals[product.id]) {
                    productTotals[product.id] = { name: product.productName, planned: 0, actual: 0, color: product.color, sackWeight: product.sackWeight || 50 };
                }
                productTotals[product.id].planned += product.planned || 0;
                productTotals[product.id].actual += totalActual;
            }
        });
    });


    const aggregatedData = Object.values(productTotals).filter(p => (p.planned > 0 || p.actual > 0));
    setAggregatedProductData(aggregatedData);
    
    setTotalPeriodProduction({ sacos: totalProductionAllCategoriesSacos, qq: totalProductionAllCategoriesQq });

    const totalMixProduction = kpiPlannedSacos + kpiUnplannedSacos;
    setProductionMix({
        plannedSacos: kpiPlannedSacos,
        plannedQq: kpiPlannedQq,
        plannedPercentage: totalMixProduction > 0 ? (kpiPlannedSacos / totalMixProduction) * 100 : 0,
        unplannedSacos: kpiUnplannedSacos,
        unplannedQq: kpiUnplannedQq,
        unplannedPercentage: totalMixProduction > 0 ? (kpiUnplannedSacos / totalMixProduction) * 100 : 0,
    });

    setShiftTotals({
        daySacos: kpiTotalDaySacos,
        dayQq: kpiTotalDayQq,
        nightSacos: kpiTotalNightSacos,
        nightQq: kpiTotalNightQq,
    });


  }, [filteredSummaries, selectedWeek, selectedCategoryId, categories, loading, allPlans, showOnlyPlannedInHistory, products]);


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
                <div className="flex items-center gap-2">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                            <Filter className="mr-2 h-4 w-4" />
                            {isFilterOpen ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                        </Button>
                    </CollapsibleTrigger>
                    {isFilterOpen && (
                         <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => {
                             setSelectedCategoryId('all');
                             setSelectedWeek('all');
                             setDateRange('12');
                         }}>
                             Limpiar Filtros
                         </Button>
                    )}
                </div>
                <CardDescription className="text-right text-xs md:text-sm">
                    Elige el rango de datos a cargar. Filtra por semana específica o categoría.
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
                            <SelectTrigger id="category-filter">
                                <SelectValue placeholder="Todas las categorías" />
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             <KpiCard
                title="Producción Total en Período"
                value={totalPeriodProduction.sacos}
                subValue={`${totalPeriodProduction.qq.toLocaleString(undefined, { maximumFractionDigits: 1, })} qq`}
                icon={PackageCheck}
                description="Suma total de la producción real de TODAS las categorías en el período seleccionado, ignorando filtros."
                fractionDigits={0}
            />
             <ProductionMixKpiCard {...productionMix} />
            <ShiftKpiCard 
                daySacos={shiftTotals.daySacos} 
                dayQq={shiftTotals.dayQq} 
                nightSacos={shiftTotals.nightSacos} 
                nightQq={shiftTotals.nightQq} 
            />
        </div>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Resumen de Producción por Semana</CardTitle>
            <CardDescription>
                Compara el plan con la producción real para el rango de fechas seleccionado.
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
                    <CardDescription>Producción por turno para el rango de fechas seleccionado (todos los productos).</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : weeklyShiftData.length > 0 ? (
                        <ChartContainer config={shiftChartConfig} className="w-full h-[250px] md:h-[300px]">
                            <BarChart accessibilityLayer data={weeklyShiftData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis />
                                <RechartsTooltip cursor={false} content={<CustomShiftTooltipContent config={shiftChartConfig} />} />
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
                    <CardDescription>Total producido por turno cada día (considera filtro de semana, todos los productos).</CardDescription>
                </CardHeader>
                <CardContent>
                     {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : dailyData.some(d => d.day > 0 || d.night > 0) ? (
                        <ChartContainer config={dailyChartConfig} className="w-full h-[250px] md:h-[300px]">
                            <BarChart accessibilityLayer data={dailyData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis />
                                <RechartsTooltip cursor={false} content={<CustomShiftTooltipContent config={dailyChartConfig} />} />
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
                    <CardTitle>Producción por Producto (Cumplimiento de Plan Semanal)</CardTitle>
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
                                <RechartsTooltip cursor={false} content={<ProductTooltipContent />} />
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
                        <p className="text-center text-muted-foreground py-8">No hay datos de productos planificados para esta semana o categoría.</p>
                    )}
                </CardContent>
            </Card>
            <Card className="md:col-span-2">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Rendimiento Histórico por Producto</CardTitle>
                            <CardDescription>
                                Total planificado vs. real para cada producto en el rango de fechas seleccionado.
                            </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="show-only-planned-history"
                                checked={showOnlyPlannedInHistory}
                                onCheckedChange={(checked) => setShowOnlyPlannedInHistory(!!checked)}
                            />
                            <Label htmlFor="show-only-planned-history" className="text-sm font-normal">
                                Mostrar solo categorías planificadas
                            </Label>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-center text-muted-foreground py-8">Calculando rendimiento histórico...</p>
                    ) : aggregatedProductData.length > 0 ? (
                        <ChartContainer config={productChartConfig} className="w-full h-[400px]">
                            <BarChart accessibilityLayer data={aggregatedProductData} margin={{ left: -20 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    tickMargin={10}
                                    axisLine={false}
                                    tickFormatter={(value) => value.slice(0, 15) + (value.length > 15 ? '...' : '')}
                                />
                                <YAxis />
                                <RechartsTooltip cursor={false} content={<ProductTooltipContent />} />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar dataKey="planned" fill="var(--color-planned)" radius={4}>
                                    {aggregatedProductData.map((entry, index) => (
                                        <Cell key={`cell-planned-${index}`} fill={entry.color || 'hsl(var(--accent))'} opacity={0.5} />
                                    ))}
                                </Bar>
                                <Bar dataKey="actual" fill="var(--color-actual)" radius={4}>
                                    {aggregatedProductData.map((entry, index) => (
                                        <Cell key={`cell-actual-${index}`} fill={entry.color || 'hsl(var(--primary))'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No hay datos de productos en el rango seleccionado para mostrar.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

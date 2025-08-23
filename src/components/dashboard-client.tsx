'use client';

import React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { ProductData, DailyProduction } from '@/lib/types';


type WeeklySummaryData = {
  week: number;
  name: string;
  planned: number;
  actual: number;
};

type ShiftSummaryData = {
  name: string;
  total: number;
};

type DailySummaryData = {
  name: string;
  total: number;
}

const weeklyChartConfig = {
  planned: {
    label: 'Planificado',
    color: 'hsl(var(--accent))',
  },
  actual: {
    label: 'Real',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const shiftChartConfig = {
    total: {
      label: 'Total Producido',
      color: 'hsl(var(--chart-2))',
    },
} satisfies ChartConfig;
  
const dailyChartConfig = {
    total: {
      label: 'Total Producido',
      color: 'hsl(var(--chart-3))',
    },
} satisfies ChartConfig;

export default function DashboardClient() {
  const [summaryData, setSummaryData] = React.useState<WeeklySummaryData[]>([]);
  const [shiftData, setShiftData] = React.useState<ShiftSummaryData[]>([]);
  const [dailyData, setDailyData] = React.useState<DailySummaryData[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAllPlans = async () => {
        setLoading(true);
        const weeklyData: WeeklySummaryData[] = [];
        let totalDayShift = 0;
        let totalNightShift = 0;
        const dailyTotals: { [key in keyof DailyProduction]: number } = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };

        try {
            const plansSnapshot = await getDocs(collection(db, 'productionPlans'));
            plansSnapshot.forEach((doc) => {
                const plan = doc.data();
                const products: ProductData[] = plan.products || [];

                const totalPlanned = products.reduce((sum, item) => sum + (item.planned || 0), 0);
                
                let weeklyActual = 0;
                products.forEach(item => {
                    Object.entries(item.actual).forEach(([day, shifts]) => {
                        const dayKey = day as keyof DailyProduction;
                        totalDayShift += shifts.day || 0;
                        totalNightShift += shifts.night || 0;
                        dailyTotals[dayKey] += (shifts.day || 0) + (shifts.night || 0);
                        weeklyActual += (shifts.day || 0) + (shifts.night || 0);
                    });
                });

                if (plan.week && !isNaN(plan.week)) {
                    weeklyData.push({
                        week: plan.week,
                        name: `Semana ${plan.week}`,
                        planned: totalPlanned,
                        actual: weeklyActual,
                    });
                }
            });

            weeklyData.sort((a, b) => a.week - b.week);
            setSummaryData(weeklyData);

            setShiftData([
                { name: 'Turno Día', total: totalDayShift },
                { name: 'Turno Noche', total: totalNightShift },
            ]);

            setDailyData([
                { name: 'Lunes', total: dailyTotals.mon },
                { name: 'Martes', total: dailyTotals.tue },
                { name: 'Miércoles', total: dailyTotals.wed },
                { name: 'Jueves', total: dailyTotals.thu },
                { name: 'Viernes', total: dailyTotals.fri },
                { name: 'Sábado', total: dailyTotals.sat },
                { name: 'Domingo', total: dailyTotals.sun },
            ]);

        } catch (error) {
            console.error('Failed to fetch production plans from Firestore:', error);
        }
        setLoading(false);
    };

    fetchAllPlans();
  }, []);

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
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Producción por Semana</CardTitle>
            <CardDescription>Comparación de lo planificado vs. lo ejecutado a lo largo del tiempo.</CardDescription>
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
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                  <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
                <p className="text-muted-foreground text-center py-8">
                  No hay suficientes datos guardados para mostrar el dashboard. Guarda al menos un plan semanal.
                </p>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Producción por Turno</CardTitle>
                    <CardDescription>Total producido en el turno de día vs. noche.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : shiftData.length > 0 && (shiftData[0].total > 0 || shiftData[1].total > 0) ? (
                        <ChartContainer config={shiftChartConfig} className="w-full h-[300px]">
                            <BarChart accessibilityLayer data={shiftData} layout="vertical">
                                <CartesianGrid horizontal={false} />
                                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} />
                                <XAxis type="number" hide />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="total" fill="var(--color-total)" radius={4} layout="vertical">
                                </Bar>
                            </BarChart>
                        </ChartContainer>
                    ) : <p className="text-center text-muted-foreground py-4">No hay datos de producción.</p>}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Producción por Día</CardTitle>
                    <CardDescription>Total producido cada día de la semana.</CardDescription>
                </CardHeader>
                <CardContent>
                     {loading ? <p className="text-center text-muted-foreground">Cargando...</p> : dailyData.some(d => d.total > 0) ? (
                        <ChartContainer config={dailyChartConfig} className="w-full h-[300px]">
                            <BarChart accessibilityLayer data={dailyData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                            </BarChart>
                        </ChartContainer>
                     ) : <p className="text-center text-muted-foreground py-4">No hay datos de producción.</p>}
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

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
import type { ProductData } from '@/lib/types';


type WeeklySummaryData = {
  week: number;
  name: string;
  planned: number;
  actual: number;
};

const chartConfig = {
  planned: {
    label: 'Planificado',
    color: 'hsl(var(--accent))',
  },
  actual: {
    label: 'Real',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export default function DashboardClient() {
  const [summaryData, setSummaryData] = React.useState<WeeklySummaryData[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAllPlans = async () => {
        setLoading(true);
        const weeklyData: WeeklySummaryData[] = [];
        try {
            const plansSnapshot = await getDocs(collection(db, 'productionPlans'));
            plansSnapshot.forEach((doc) => {
                const plan = doc.data();
                const products: ProductData[] = plan.products || [];

                const totalPlanned = products.reduce((sum, item) => sum + (item.planned || 0), 0);
                const totalActual = products.reduce((sum, item) =>
                    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0),
                    0
                );

                if (plan.week && !isNaN(plan.week)) {
                    weeklyData.push({
                        week: plan.week,
                        name: `Semana ${plan.week}`,
                        planned: totalPlanned,
                        actual: totalActual,
                    });
                }
            });

            weeklyData.sort((a, b) => a.week - b.week);
            setSummaryData(weeklyData);

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
          <h1 className="text-2xl font-bold text-foreground">Dashboard Semanal</h1>
        </div>
        <Link href="/">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver a la Planificación
          </Button>
        </Link>
      </header>
      <main className="p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Producción por Semana</CardTitle>
            <CardDescription>Comparación de lo planificado vs. lo ejecutado a lo largo del tiempo.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <p className="text-muted-foreground text-center py-8">Cargando datos del dashboard...</p>
            ) : summaryData.length > 0 ? (
              <ChartContainer config={chartConfig} className="w-full h-[350px]">
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
      </main>
    </div>
  );
}

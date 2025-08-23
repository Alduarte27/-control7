'use client';

import React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Factory, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProductData } from '@/lib/types';

const LOCAL_STORAGE_KEY_PREFIX = 'control7-semana-';

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

  React.useEffect(() => {
    const weeklyData: WeeklySummaryData[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
        try {
          const week = parseInt(key.replace(LOCAL_STORAGE_KEY_PREFIX, ''), 10);
          const savedData = localStorage.getItem(key);
          if (savedData) {
            const parsedData: ProductData[] = JSON.parse(savedData);
            
            const totalPlanned = parsedData.reduce((sum, item) => sum + item.planned, 0);
            const totalActual = parsedData.reduce((sum, item) => 
              sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + dayVal.day + dayVal.night, 0), 0
            );

            if (!isNaN(week)) {
              weeklyData.push({
                week,
                name: `Semana ${week}`,
                planned: totalPlanned,
                actual: totalActual,
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse data for key:', key, error);
        }
      }
    }
    // Sort data by week number
    weeklyData.sort((a, b) => a.week - b.week);
    setSummaryData(weeklyData);
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
            {summaryData.length > 0 ? (
              <ChartContainer config={chartConfig} className="w-full" style={{ height: "400px" }}>
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

'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import type { ProductData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type WeeklySummaryProps = {
  data: ProductData[];
};

const chartConfig = {
  planned: {
    label: 'Planificado',
    color: 'hsl(var(--accent))',
  },
  actualForPlanned: {
    label: 'Real (s/Plan)',
    color: 'hsl(var(--primary))',
  },
  unplannedProduction: {
    label: 'No Programado',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig;

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const plannedValue = data.planned || 0;
        const actualValue = data.actualForPlanned || data.unplannedProduction || 0;

        return (
            <div className="rounded-lg border bg-background p-2 shadow-sm text-sm">
                <p className="font-bold mb-2">{label}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {plannedValue > 0 && (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--accent))' }} />
                                <span>Planificado:</span>
                            </div>
                            <span className="text-right font-medium">{plannedValue.toLocaleString()}</span>
                        </>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ 
                            backgroundColor: plannedValue > 0 ? 'hsl(var(--primary))' : 'hsl(var(--chart-3))' 
                        }} />
                        <span>Real:</span>
                    </div>
                    <span className="text-right font-medium">{actualValue.toLocaleString()}</span>
                </div>
            </div>
        );
    }

    return null;
};


export default function WeeklySummary({ data }: WeeklySummaryProps) {
  const chartData = data
    .map(item => {
      const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
      return {
        name: item.productName,
        planned: item.planned,
        actualForPlanned: item.planned > 0 ? totalActual : 0,
        unplannedProduction: item.planned === 0 ? totalActual : 0,
      }
    })
    .filter(item => item.planned > 0 || item.actualForPlanned > 0 || item.unplannedProduction > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Semanal por Producto</CardTitle>
        <CardDescription>Producción Planificada vs. Real (solo productos con actividad).</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full h-[400px]">
            <BarChart accessibilityLayer data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 12)}...` : value}
                angle={-45}
                textAnchor='end'
                height={80}
                />
                <YAxis />
                <ChartTooltip cursor={false} content={<CustomTooltip />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                <Bar dataKey="actualForPlanned" fill="var(--color-actualForPlanned)" radius={4} />
                <Bar dataKey="unplannedProduction" fill="var(--color-unplannedProduction)" radius={4} />
            </BarChart>
            </ChartContainer>
        ) : (
            <p className="text-center text-muted-foreground py-8">
                No hay datos de producción. Introduce un plan para ver el resumen.
            </p>
        )}
      </CardContent>
    </Card>
  );
}

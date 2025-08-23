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
  actual: {
    label: 'Real',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export default function WeeklySummary({ data }: WeeklySummaryProps) {
  const chartData = data.map(item => ({
    name: item.productName,
    planned: item.planned,
    actual: Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Semanal</CardTitle>
        <CardDescription>Producción Planificada vs. Real por Producto</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full h-[350px]">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.length > 15 ? `${value.slice(0, 12)}...` : value}
              angle={-45}
              textAnchor='end'
              height={60}
            />
            <YAxis />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
            <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

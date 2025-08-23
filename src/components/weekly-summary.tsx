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
    label: 'Planned',
    color: 'hsl(var(--accent))',
  },
  actual: {
    label: 'Actual',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export default function WeeklySummary({ data }: WeeklySummaryProps) {
  const chartData = data.map(item => ({
    name: item.productName,
    planned: item.planned,
    actual: Object.values(item.actual).reduce((sum, val) => sum + (val || 0), 0),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Summary</CardTitle>
        <CardDescription>Planned vs. Actual Production by Product</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
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

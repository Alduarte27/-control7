'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import type { ProductData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import React from 'react';

type WeeklySummaryProps = {
  data: ProductData[];
};

const productChartConfig = {
  planned: {
    label: 'Planificado',
    color: 'hsl(var(--accent))',
  },
  actual: {
    label: 'Real',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const dailyChartConfig = {
    total: {
        label: "Producción Total",
        color: "hsl(var(--chart-2))",
    }
} satisfies ChartConfig;


const CustomDailyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        
        const productsByCategory = data.products.reduce((acc: { [key: string]: any[] }, p: any) => {
            const category = p.category || 'Sin Categoría';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(p);
            return acc;
        }, {});

        return (
            <div className="rounded-lg border bg-background p-2 shadow-sm text-sm max-w-xs">
                <p className="font-bold mb-1">{label}</p>
                <p className="text-muted-foreground text-xs mb-2">Total: <span className="font-bold text-foreground">{data.total.toLocaleString()}</span></p>
                
                <div className="border-t pt-2 mt-2">
                    <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
                        {Object.keys(productsByCategory).length > 0 ? Object.entries(productsByCategory).map(([category, products]) => (
                           <li key={category}>
                                <h4 className="font-semibold mb-1 text-primary">{category}</h4>
                                <ul className="space-y-1 pl-2">
                                    {(products as any[]).map(p => (
                                        <li key={p.name} className="flex justify-between items-start">
                                            <span className="flex-1 pr-2">{p.name}</span>
                                            <span className="font-medium ml-2">{p.value.toLocaleString()}</span>
                                        </li>
                                    ))}
                                </ul>
                           </li>
                        )) : (
                            <li>No hubo producción.</li>
                        )}
                    </ul>
                </div>
            </div>
        );
    }
    return null;
};


export default function WeeklySummary({ data }: WeeklySummaryProps) {
  const productChartData = data
    .map(item => {
      const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
      return {
        name: item.productName,
        planned: item.planned,
        actual: totalActual,
      }
    })
    .filter(item => item.planned > 0 || item.actual > 0);
  
  const dailyChartData = React.useMemo(() => {
    const dailyTotals: { [key: string]: { total: number; products: { name: string; value: number, category: string }[] } } = {
      Lunes: { total: 0, products: [] },
      Martes: { total: 0, products: [] },
      Miércoles: { total: 0, products: [] },
      Jueves: { total: 0, products: [] },
      Viernes: { total: 0, products: [] },
      Sábado: { total: 0, products: [] },
      Domingo: { total: 0, products: [] },
    };

    const dayMap: { [key: string]: string } = {
      mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves',
      fri: 'Viernes', sat: 'Sábado', sun: 'Domingo'
    };
    
    data.forEach(product => {
      for (const [dayKey, dayName] of Object.entries(dayMap)) {
        // @ts-ignore
        const dayProduction = (product.actual[dayKey]?.day || 0) + (product.actual[dayKey]?.night || 0);
        if (dayProduction > 0) {
          dailyTotals[dayName].total += dayProduction;
          dailyTotals[dayName].products.push({ 
              name: product.productName, 
              value: dayProduction,
              category: product.categoryName 
          });
        }
      }
    });

    return Object.entries(dailyTotals).map(([day, values]) => ({ day, ...values }));

  }, [data]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle>Producción Total por Día</CardTitle>
            <CardDescription>Suma de toda la producción para cada día de la semana.</CardDescription>
        </CardHeader>
        <CardContent>
             {dailyChartData.some(d => d.total > 0) ? (
                <ChartContainer config={dailyChartConfig} className="w-full h-[300px]">
                    <BarChart accessibilityLayer data={dailyChartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="day"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <YAxis />
                        <ChartTooltip cursor={{ fill: 'hsl(var(--accent))', radius: 4 }} content={<CustomDailyTooltip />} />
                        <Bar dataKey="total" fill="var(--color-total)" radius={4} barSize={60} />
                    </BarChart>
                </ChartContainer>
            ) : (
                <p className="text-center text-muted-foreground py-8">
                    No se ha registrado producción real esta semana.
                </p>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen Semanal por Producto</CardTitle>
          <CardDescription>Producción Planificada vs. Real (solo productos con actividad).</CardDescription>
        </CardHeader>
        <CardContent>
          {productChartData.length > 0 ? (
              <ChartContainer config={productChartConfig} className="w-full h-[400px]">
              <BarChart accessibilityLayer data={productChartData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    interval={0}
                    tickFormatter={(value) => value.length > 20 ? `${value.slice(0, 18)}...` : value}
                    angle={-45}
                    textAnchor='end'
                  />
                  <YAxis />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                  <Bar dataKey="actual" fill="var(--color-actual)" radius={4} />
              </BarChart>
              </ChartContainer>
          ) : (
              <p className="text-center text-muted-foreground py-8">
                  No hay datos de producción. Introduce un plan para ver el resumen.
              </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

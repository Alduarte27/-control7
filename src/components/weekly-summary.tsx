'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import type { ProductData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import React from 'react';

type WeeklySummaryProps = {
  data: ProductData[];
};

const productChartConfig = {
  planned: {
    label: 'Planificado (Unids.)',
    color: 'hsl(var(--muted-foreground))',
  },
  actual: {
    label: 'Real (Unids.)',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const dailyChartConfig = {
    total: {
        label: "Producción Total (Unids.)",
        color: "hsl(var(--chart-2))",
    }
} satisfies ChartConfig;

const KG_PER_QUINTAL = 50;

const CustomDailyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const totalWeightKg = data.products.reduce((sum: number, p: any) => sum + p.weight, 0);
        const quintales = totalWeightKg / KG_PER_QUINTAL;
        
        const productsByCategory = data.products.reduce((acc: { [key: string]: any[] }, p: any) => {
            const category = p.category || 'Sin Categoría';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(p);
            return acc;
        }, {});

        return (
            <div className="rounded-lg border bg-background p-2 shadow-sm text-sm text-foreground max-w-xs">
                <p className="font-bold mb-1">{label}</p>
                <p className="text-muted-foreground text-xs mb-2">
                  Total: <span className="font-bold text-foreground">{data.total.toLocaleString()}</span> unids.
                  (<span className="font-bold text-foreground">{quintales.toLocaleString(undefined, {maximumFractionDigits: 1})} qq</span>)
                </p>
                
                <div className="border-t pt-2 mt-2">
                    <ul className="space-y-2 max-h-48 overflow-y-auto text-xs">
                        {Object.keys(productsByCategory).length > 0 ? Object.entries(productsByCategory).map(([category, products]) => (
                           <li key={category}>
                                <h4 className="font-semibold mb-1 text-primary">{category}</h4>
                                <ul className="space-y-1 pl-2">
                                    {(products as any[]).map(p => (
                                        <li key={p.name} className="flex justify-between items-start">
                                            <span className="flex-1 pr-2">{p.name}</span>
                                            <span className="font-medium ml-2">{p.value.toLocaleString()} unids.</span>
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

const CustomProductTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const product = payload[0].payload;
      const isFardo = product.primaryPackaging === 'fardo' || !!product.bundleWeight;
      const weightPerUnit = isFardo ? (product.bundleWeight || 12) : (product.sackWeight || 50);
      const unitName = isFardo ? 'fardos' : 'sacos';

      const plannedWeightKg = (product.planned || 0) * weightPerUnit;
      const actualWeightKg = (product.actual || 0) * weightPerUnit;
      const plannedQuintales = plannedWeightKg / KG_PER_QUINTAL;
      const actualQuintales = actualWeightKg / KG_PER_QUINTAL;

      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm text-sm text-foreground">
          <p className="font-bold mb-2">{label}</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
            <React.Fragment key="planned">
              <div className="flex items-center gap-2 font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--muted-foreground))' }} />
                <span>Planificado:</span>
              </div>
              <span className="text-right font-mono">
                {product.planned.toLocaleString()} {unitName} ({plannedQuintales.toLocaleString(undefined, {maximumFractionDigits: 1})} qq)
              </span>
            </React.Fragment>
            <React.Fragment key="actual">
              <div className="flex items-center gap-2 font-medium" style={{ color: 'hsl(var(--primary))' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                <span>Real:</span>
              </div>
              <span className="text-right font-mono">
                {product.actual.toLocaleString()} {unitName} ({actualQuintales.toLocaleString(undefined, {maximumFractionDigits: 1})} qq)
              </span>
            </React.Fragment>
          </div>
        </div>
      );
    }
    return null;
};


const CustomizedAxisTick = (props: any) => {
  const { x, y, payload } = props;
  const words = payload.value.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  words.forEach((word: string) => {
    if ((currentLine + word).length > 18) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine) lines.push(currentLine.trim());
  
  const displayLines = lines.slice(0, 3);
  if (lines.length > 3) {
    displayLines[2] = displayLines[2].slice(0, 15) + '...';
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={9}>
        {displayLines.map((line, index) => (
          <tspan x={0} dy={index === 0 ? 0 : 10} key={index}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};


export default function WeeklySummary({ data }: WeeklySummaryProps) {
  const productChartData = data
    .map(item => {
      const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
      return {
        name: item.productName,
        planned: item.planned,
        actual: totalActual,
        sackWeight: item.sackWeight || 50,
        bundleWeight: item.bundleWeight,
        primaryPackaging: item.primaryPackaging,
        color: item.color,
      }
    })
    .filter(item => item.planned > 0 || item.actual > 0);
  
  const dailyChartData = React.useMemo(() => {
    const dailyTotals: { [key: string]: { total: number; products: { name: string; value: number, category: string, weight: number }[] } } = {
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
          const isFardo = product.primaryPackaging === 'fardo' || !!product.bundleWeight;
          const weightPerUnit = isFardo ? (product.bundleWeight || 12) : (product.sackWeight || 50);
          const weight = dayProduction * weightPerUnit;
          dailyTotals[dayName].products.push({ 
              name: product.productName, 
              value: dayProduction,
              category: product.categoryName,
              weight: weight,
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
            <CardTitle className="text-sm font-bold">Producción Total por Día (Unids.)</CardTitle>
            <CardDescription className="text-[10px]">Suma de toda la producción para cada día de la semana.</CardDescription>
        </CardHeader>
        <CardContent>
             {dailyChartData.some(d => d.total > 0) ? (
                <ChartContainer config={dailyChartConfig} className="w-full h-[200px]">
                    <BarChart accessibilityLayer data={dailyChartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="day"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <YAxis />
                        <ChartTooltip cursor={false} content={<CustomDailyTooltip />} />
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
          <CardTitle className="text-sm font-bold">Resumen Semanal por Producto</CardTitle>
          <CardDescription className="text-[10px]">Producción Planificada vs. Real (solo productos con actividad).</CardDescription>
        </CardHeader>
        <CardContent>
          {productChartData.length > 0 ? (
              <ChartContainer config={productChartConfig} className="w-full h-[300px]">
              <BarChart accessibilityLayer data={productChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    interval={0}
                    height={50}
                    tick={<CustomizedAxisTick />}
                  />
                  <YAxis />
                  <ChartTooltip cursor={false} content={<CustomProductTooltip />} />
                  <ChartLegend verticalAlign="bottom" wrapperStyle={{ paddingTop: '30px' }} content={<ChartLegendContent />} />
                  <Bar dataKey="planned" fill="var(--color-planned)" radius={4} />
                  <Bar dataKey="actual" fill="var(--color-actual)" radius={4}>
                    {productChartData.map((entry, index) => (
                      <Cell key={`cell-actual-${index}`} fill={entry.color || 'var(--color-actual)'} />
                    ))}
                  </Bar>
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

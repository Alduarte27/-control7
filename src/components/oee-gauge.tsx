'use client';

import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type OeeGaugeProps = {
  label: string;
  value: number;
  color: string;
  icon: LucideIcon;
  description: string;
  isPrimary?: boolean;
};

const OeeGauge = ({ label, value, color, icon: Icon, description, isPrimary = false }: OeeGaugeProps) => {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const data = [
    { name: 'value', value: value },
    { name: 'remainder', value: 100 - value },
  ];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={cn("flex flex-col", isPrimary && "lg:col-span-1 md:col-span-2 col-span-1")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                {label}
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center pt-2">
              {isClient ? (
                <div className="relative w-[140px] h-[140px] flex items-center justify-center">
                  <PieChart width={140} height={140}>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={65}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill={color} />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold" style={{ color }}>
                        {value.toFixed(1)}%
                      </span>
                  </div>
                </div>
              ) : (
                <div className="h-[140px] flex items-center justify-center">
                   <span className="text-3xl font-bold">-</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default OeeGauge;

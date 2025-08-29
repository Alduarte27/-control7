import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React from 'react';

export type KpiCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  valueColor?: string;
  subValue?: string;
  subValueColor?: string;
  fractionDigits?: number;
};

export default function KpiCard({ title, value, icon: Icon, description, valueColor, subValue, subValueColor, fractionDigits }: KpiCardProps) {
  const [formattedValue, setFormattedValue] = React.useState<string | number>('-');

  React.useEffect(() => {
    if (typeof value === 'number' && !isNaN(value)) {
      setFormattedValue(value.toLocaleString(undefined, {
        maximumFractionDigits: fractionDigits,
        minimumFractionDigits: fractionDigits,
      }));
    } else {
      setFormattedValue(value);
    }
  }, [value, fractionDigits]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className={cn("text-2xl font-bold", valueColor)}>{formattedValue}</div>
              <p className={cn("text-xs font-medium h-[16px]", subValueColor)}>
                  {subValue || ''}
              </p>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

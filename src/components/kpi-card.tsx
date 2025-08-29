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
};

export default function KpiCard({ title, value, icon: Icon, description, valueColor, subValue, subValueColor }: KpiCardProps) {
  const [formattedValue, setFormattedValue] = React.useState<string | number>(value);

  React.useEffect(() => {
    // Only format if it's a number. This avoids re-formatting percentages or other strings.
    if (typeof value === 'number' && !isNaN(value)) {
        setFormattedValue(value.toLocaleString());
    } else {
        setFormattedValue(value);
    }
  }, [value]);

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

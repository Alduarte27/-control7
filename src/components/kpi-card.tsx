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
  suffix?: string;
};

export default function KpiCard({ title, value, icon: Icon, description, valueColor, subValue, subValueColor, fractionDigits, suffix }: KpiCardProps) {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const formattedValue = React.useMemo(() => {
    if (typeof value === 'number') {
      if (Number.isFinite(value)) {
        return value.toLocaleString(undefined, {
          maximumFractionDigits: fractionDigits,
          minimumFractionDigits: fractionDigits,
        });
      }
      return value === Infinity ? '∞' : '0';
    }
    return value ?? '-';
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
              {isClient ? (
                <>
                  <div className={cn("text-2xl font-bold", valueColor)}>
                    {formattedValue}{suffix}
                  </div>
                  <p className={cn("text-xs font-medium h-[16px]", subValueColor)}>
                    {subValue || <>&nbsp;</>}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold">-</div>
                  <p className="text-xs font-medium h-[16px]">&nbsp;</p>
                </>
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
}

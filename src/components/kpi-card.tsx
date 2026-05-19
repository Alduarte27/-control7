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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0.5">
              <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">{title}</CardTitle>
              <Icon className="h-3 w-3 text-primary" />
            </CardHeader>
            <CardContent className="pt-0">
              {isClient ? (
                <>
                  <div className={cn("text-lg font-black tracking-tight", valueColor)}>
                    {formattedValue}{suffix}
                  </div>
                  <p className={cn("text-[9px] font-bold h-[14px] mt-0.5 opacity-80", subValueColor)}>
                    {subValue || <>&nbsp;</>}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-lg font-black">-</div>
                  <p className="text-[9px] font-bold h-[14px]">&nbsp;</p>
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

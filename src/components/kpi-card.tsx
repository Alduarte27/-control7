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
  subValue?: React.ReactNode;
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
          <Card className="p-3 pt-2.5 pb-3 flex flex-col justify-center relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-border/50 bg-white dark:bg-card backdrop-blur-sm group">
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="flex items-center justify-between mb-2 relative z-10">
              <span className="text-[10px] font-bold uppercase text-muted-foreground/80 leading-none tracking-widest pr-1 line-clamp-1" title={title}>
                {title}
              </span>
              <div className="p-1.5 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300 flex-shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            
            {isClient ? (
              <div className="flex flex-col relative z-10">
                <span className={cn("text-xl font-black tracking-tight text-foreground leading-none drop-shadow-sm", valueColor)}>
                  {formattedValue}{suffix}
                </span>
                {subValue && (
                  <span className={cn("text-[10px] font-medium opacity-90 text-muted-foreground mt-1.5 leading-tight", subValueColor)}>
                    {subValue}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col relative z-10">
                <span className="text-xl font-black text-foreground leading-none drop-shadow-sm">-</span>
              </div>
            )}
          </Card>
        </TooltipTrigger>
        <TooltipContent>
          <p>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

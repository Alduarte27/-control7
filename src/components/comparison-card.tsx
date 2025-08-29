'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, ArrowUp, Minus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

type ComparisonCardProps = {
  title: string;
  valueA: number;
  valueB: number;
  isPercentage?: boolean;
  showPercentage?: boolean;
  description?: string;
};

export default function ComparisonCard({ title, valueA, valueB, isPercentage = false, showPercentage = true, description }: ComparisonCardProps) {
  const [formattedValueA, setFormattedValueA] = React.useState<string>('-');
  const [formattedValueB, setFormattedValueB] = React.useState<string>('-');

  React.useEffect(() => {
    const formatValue = (value: number) => {
      if (typeof value !== 'number' || isNaN(value)) {
        return '-';
      }
      if (isPercentage) {
        return `${value.toFixed(1)}%`;
      }
      return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    setFormattedValueA(formatValue(valueA));
    setFormattedValueB(formatValue(valueB));
  }, [valueA, valueB, isPercentage]);


  const calculateChange = () => {
    if (valueA === 0 && valueB > 0) return 100;
    if (valueA === 0 && valueB === 0) return 0;
    if (valueA > 0 && valueB === 0) return -100;
    if (typeof valueA !== 'number' || typeof valueB !== 'number' || isNaN(valueA) || isNaN(valueB)) return 0;
    return ((valueB - valueA) / valueA) * 100;
  };

  const change = calculateChange();
  const changeText = isNaN(change) ? 'N/A' : `${change.toFixed(1)}%`;

  const getChangeColor = () => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };
  
  const ChangeIcon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : Minus;

  const CardContentWrapper = ({ children }: { children: React.ReactNode }) => {
    if (description) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent><p>{description}</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return <>{children}</>;
  };

  return (
    <CardContentWrapper>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>{title}</span>
            {description && <Info className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formattedValueB}</div>
          <div className="text-xs text-muted-foreground">
            Semana A: {formattedValueA}
          </div>
          {showPercentage && (
              <div className={cn("flex items-center text-xs mt-1", getChangeColor())}>
                  <ChangeIcon className="h-3 w-3 mr-1" />
                  <span>{changeText}</span>
              </div>
          )}
        </CardContent>
      </Card>
    </CardContentWrapper>
  );
}

'use client';

import KpiCard from './kpi-card';
import { Target, PackageCheck, ArrowLeftRight, Goal } from 'lucide-react';
import type { ProductData } from '@/lib/types';
import type { KpiCardProps } from './kpi-card';

type KpiDashboardProps = {
  data: ProductData[];
};

export default function KpiDashboard({ data }: KpiDashboardProps) {
  // Calculate totals for products that were actually planned
  const plannedProducts = data.filter(item => (item.planned || 0) > 0);
  
  const totalPlannedForCompliance = plannedProducts.reduce((sum, item) => sum + (item.planned || 0), 0);
  const totalActualForCompliance = plannedProducts.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );

  // Calculate totals for all products for overall variance and display
  const totalPlanned = data.reduce((sum, item) => sum + (item.planned || 0), 0);
  const totalActual = data.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );

  const variance = totalActual - totalPlanned;
  const completion = totalPlannedForCompliance > 0 ? (totalActualForCompliance / totalPlannedForCompliance) * 100 : 0;
  
  const getVarianceColor = (): KpiCardProps['valueColor'] => {
    if (variance >= 0) return 'text-green-600';
    return 'text-destructive';
  };
  
  const getCompletionColor = (): KpiCardProps['valueColor'] => {
    if (completion >= 95) return 'text-green-600';
    if (completion >= 85) return 'text-yellow-500';
    return 'text-destructive';
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard title="Total Planificado" value={totalPlanned.toLocaleString()} icon={Target} />
      <KpiCard title="Total Real" value={totalActual.toLocaleString()} icon={PackageCheck} />
      <KpiCard title="Varianza" value={variance.toLocaleString()} icon={ArrowLeftRight} valueColor={getVarianceColor()} />
      <KpiCard title="Cumplimiento" value={`${completion.toFixed(1)}%`} icon={Goal} valueColor={getCompletionColor()} />
    </div>
  );
}

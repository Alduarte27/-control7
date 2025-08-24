'use client';

import KpiCard from './kpi-card';
import { Target, PackageCheck, ArrowLeftRight, Goal, CheckCircle2, ClipboardPlus } from 'lucide-react';
import type { ProductData } from '@/lib/types';
import type { KpiCardProps } from './kpi-card';

type KpiDashboardProps = {
  data: ProductData[];
};

export default function KpiDashboard({ data }: KpiDashboardProps) {
  // Products that are part of a planned category AND have a plan > 0 for the week
  const productsForCompliance = data.filter(
    item => item.categoryIsPlanned && item.planned > 0
  );
  
  const totalPlannedForCompliance = productsForCompliance.reduce((sum, item) => sum + (item.planned || 0), 0);
  const totalActualForCompliance = productsForCompliance.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );
  const varianceForCompliance = totalActualForCompliance - totalPlannedForCompliance;

  // Production from planned categories that had no plan for the week (plan === 0)
  const unplannedProductionProducts = data.filter(
    item => item.categoryIsPlanned && (item.planned || 0) === 0
  );
  const totalUnplannedProduction = unplannedProductionProducts.reduce((sum, item) =>
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );

  // Calculate totals for all products for overall display
  const totalPlanned = data.reduce((sum, item) => sum + (item.planned || 0), 0);
  const totalActual = data.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );

  const completion = totalPlannedForCompliance > 0 ? (totalActualForCompliance / totalPlannedForCompliance) * 100 : 0;
  
  const getVarianceColor = (value: number): KpiCardProps['valueColor'] => {
    if (value >= 0) return 'text-green-600';
    return 'text-destructive';
  };
  
  const getCompletionColor = (): KpiCardProps['valueColor'] => {
    if (completion >= 95) return 'text-green-600';
    if (completion >= 85) return 'text-yellow-500';
    return 'text-destructive';
  }

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      <KpiCard 
        title="Total Planificado" 
        value={totalPlanned.toLocaleString()} 
        icon={Target}
        description="Suma total de la producción planificada para todos los productos de categorías planificables." 
      />
      <KpiCard 
        title="Real s/Plan" 
        value={totalActualForCompliance.toLocaleString()} 
        icon={CheckCircle2}
        description="Suma de la producción real que responde directamente a un plan (productos de categorías planificables con plan > 0)."
        subValue={`${varianceForCompliance.toLocaleString()} Varianza s/Plan`}
        subValueColor={getVarianceColor(varianceForCompliance)}
      />
      <KpiCard
        title="No Programado"
        value={totalUnplannedProduction.toLocaleString()}
        icon={ClipboardPlus}
        description="Producción real de productos de categorías planificables que NO tenían un plan para la semana (plan = 0)."
      />
      <KpiCard 
        title="Producción Total Real" 
        value={totalActual.toLocaleString()} 
        icon={PackageCheck}
        description="Suma total de toda la producción real, incluyendo planificada, no programada y de categorías no planificadas."
      />
      <KpiCard 
        title="Cumplimiento del Plan" 
        value={`${completion.toFixed(1)}%`} 
        icon={Goal} 
        valueColor={getCompletionColor()}
        description="Porcentaje de producción 'Real s/Plan' vs. 'Total Planificado s/Plan', reflejando qué tan bien se siguió el plan."
      />
    </div>
  );
}

'use client';

import KpiCard from './kpi-card';
import { Target, PackageCheck, ArrowLeftRight, Goal, CheckCircle2 } from 'lucide-react';
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
  const varianceForCompliance = totalActualForCompliance - totalPlannedForCompliance;

  // Calculate totals for all products for overall variance and display
  const totalPlanned = data.reduce((sum, item) => sum + (item.planned || 0), 0);
  const totalActual = data.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );

  const variance = totalActual - totalPlanned;
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
        description="Suma total de la producción planificada para todos los productos en la semana." 
      />
      <KpiCard 
        title="Real s/Plan" 
        value={totalActualForCompliance.toLocaleString()} 
        icon={CheckCircle2}
        description="Suma de la producción real, contando únicamente los productos que tenían un plan."
        subValue={`${varianceForCompliance.toLocaleString()} Varianza`}
        subValueColor={getVarianceColor(varianceForCompliance)}
      />
      <KpiCard 
        title="Total Real" 
        value={totalActual.toLocaleString()} 
        icon={PackageCheck}
        description="Suma total de la producción real de todos los productos, incluyendo los no planificados."
      />
      <KpiCard 
        title="Varianza General" 
        value={variance.toLocaleString()} 
        icon={ArrowLeftRight} 
        valueColor={getVarianceColor(variance)}
        description="Diferencia entre el 'Total Real' y el 'Total Planificado' de todos los productos."
      />
      <KpiCard 
        title="Cumplimiento" 
        value={`${completion.toFixed(1)}%`} 
        icon={Goal} 
        valueColor={getCompletionColor()}
        description="Porcentaje de la producción real completada en comparación con lo planificado (solo de productos con plan)."
      />
    </div>
  );
}

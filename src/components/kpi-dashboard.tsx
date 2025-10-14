'use client';

import KpiCard from './kpi-card';
import { Target, PackageCheck, CheckCircle2, ClipboardPlus, ClipboardCheck, Sun, Moon } from 'lucide-react';
import type { ProductData } from '@/lib/types';
import type { KpiCardProps } from './kpi-card';

type KpiDashboardProps = {
  data: ProductData[];
};

const KG_PER_QUINTAL = 50;

export default function KpiDashboard({ data }: KpiDashboardProps) {
  // --- Helper function to calculate total weight ---
  const calculateWeight = (products: ProductData[], type: 'planned' | 'actual' | 'day' | 'night'): number => {
    return products.reduce((totalWeight, item) => {
      let sacks = 0;
      if (type === 'planned') {
        sacks = item.planned || 0;
      } else if (type === 'actual') {
        sacks = Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0);
      } else { // 'day' or 'night'
        sacks = Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal[type] || 0), 0);
      }
      const itemWeight = sacks * (item.sackWeight || 50); // Default to 50kg if not specified
      return totalWeight + itemWeight;
    }, 0);
  };
  
  // --- KPI Calculations ---

  // Products that are part of a planned category AND have a plan > 0 for the week
  const productsForCompliance = data.filter(
    item => item.categoryIsPlanned && item.planned > 0
  );
  
  const totalPlannedForComplianceSacks = productsForCompliance.reduce((sum, item) => sum + (item.planned || 0), 0);
  const totalPlannedForComplianceQuintales = calculateWeight(productsForCompliance, 'planned') / KG_PER_QUINTAL;

  // Production from planned categories that had no plan for the week (plan === 0)
  const unplannedProductionProducts = data.filter(
    item => item.categoryIsPlanned && (item.planned || 0) === 0
  );

  // Calculate totals for all products for overall display
  const totalActualSacks = data.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );
  const totalActualQuintales = calculateWeight(data, 'actual') / KG_PER_QUINTAL;

  const totalActualForComplianceSacks = productsForCompliance.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );

  const plannedProductionSacos = totalActualForComplianceSacks;
  const plannedProductionQq = calculateWeight(productsForCompliance, 'actual') / KG_PER_QUINTAL;

  const unplannedProductionSacos = unplannedProductionProducts.reduce((sum, item) =>
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );
  const unplannedProductionQq = calculateWeight(unplannedProductionProducts, 'actual') / KG_PER_QUINTAL;
  
  const totalMixProduction = plannedProductionSacos + unplannedProductionSacos;
  const plannedPercentage = totalMixProduction > 0 ? (plannedProductionSacos / totalMixProduction) * 100 : 0;
  const unplannedPercentage = totalMixProduction > 0 ? (unplannedProductionSacos / totalMixProduction) * 100 : 0;

  // Shift totals
  const totalDaySacks = data.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0), 0), 0
  );
  const totalDayQuintales = calculateWeight(data, 'day') / KG_PER_QUINTAL;

  const totalNightSacks = data.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.night || 0), 0), 0
  );
  const totalNightQuintales = calculateWeight(data, 'night') / KG_PER_QUINTAL;


  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <KpiCard 
        title="Total Planificado (Sacos)" 
        value={totalPlannedForComplianceSacks.toLocaleString()} 
        icon={Target}
        description="Suma total de la producción planificada para todos los productos de categorías planificables."
        subValue={`(${totalPlannedForComplianceQuintales.toLocaleString(undefined, {maximumFractionDigits:1})} qq)`}
      />
      <KpiCard 
        title="Producción Total Real (Sacos)" 
        value={totalActualSacks.toLocaleString()} 
        icon={PackageCheck}
        description="Suma total de toda la producción real, incluyendo planificada, no programada y de categorías no planificadas."
        subValue={`(${totalActualQuintales.toLocaleString(undefined, {maximumFractionDigits:1})} qq)`}
      />
       <KpiCard
        title="Producción Planificada"
        value={plannedProductionSacos.toLocaleString()}
        subValue={`${plannedProductionQq.toFixed(1)} qq (${plannedPercentage.toFixed(1)}%)`}
        icon={ClipboardCheck}
        description="Producción real que correspondía a un producto con un plan > 0. El porcentaje es sobre el total real de producción planificable."
        fractionDigits={0}
      />
      <KpiCard
        title="Producción No Planificada"
        value={unplannedProductionSacos.toLocaleString()}
        subValue={`${unplannedProductionQq.toFixed(1)} qq (${unplannedPercentage.toFixed(1)}%)`}
        icon={ClipboardPlus}
        description="Producción real de productos planificables que tenían un plan de 0. El porcentaje es sobre el total real de producción planificable."
        fractionDigits={0}
      />
      <KpiCard 
        title="Producción Turno Día" 
        value={totalDaySacks.toLocaleString()} 
        icon={Sun}
        description="Suma de toda la producción real registrada en el turno de día."
        subValue={`(${totalDayQuintales.toLocaleString(undefined, {maximumFractionDigits:1})} qq)`}
      />
      <KpiCard
        title="Producción Turno Noche"
        value={totalNightSacks.toLocaleString()}
        icon={Moon}
        description="Suma de toda la producción real registrada en el turno de noche."
        subValue={`(${totalNightQuintales.toLocaleString(undefined, {maximumFractionDigits:1})} qq)`}
      />
    </div>
  );
}

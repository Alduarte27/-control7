'use client';

import KpiCard from './kpi-card';
import { Target, PackageCheck, CheckCircle2, TrendingUp, TrendingDown, ClipboardPlus } from 'lucide-react';
import type { ProductData } from '@/lib/types';
import type { KpiCardProps } from './kpi-card';

type KpiDashboardProps = {
  data: ProductData[];
};

const KG_PER_QUINTAL = 50;

export default function KpiDashboard({ data }: KpiDashboardProps) {
  // --- Helper function to calculate total weight ---
  const calculateWeight = (products: ProductData[], type: 'planned' | 'actual'): number => {
    return products.reduce((totalWeight, item) => {
      const sacks = type === 'planned'
        ? (item.planned || 0)
        : Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0);
      const itemWeight = sacks * (item.sackWeight || 50);
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

  const unplannedProductionSacos = unplannedProductionProducts.reduce((sum, item) =>
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );
  const unplannedProductionQq = calculateWeight(unplannedProductionProducts, 'actual') / KG_PER_QUINTAL;

  // Calculate totals for all products for overall display
  const totalActualSacks = data.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );
  const totalActualQuintales = calculateWeight(data, 'actual') / KG_PER_QUINTAL;
  
  const totalActualForComplianceSacks = productsForCompliance.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
  );
  const totalActualForComplianceQuintales = calculateWeight(productsForCompliance, 'actual') / KG_PER_QUINTAL;

  const variance = totalActualForComplianceSacks - totalPlannedForComplianceSacks;
  const compliancePercentage = totalPlannedForComplianceSacks > 0
    ? (totalActualForComplianceSacks / totalPlannedForComplianceSacks) * 100
    : 0;

  const kpiCards: KpiCardProps[] = [
    {
      title: "Total Planificado (Sacos)",
      value: totalPlannedForComplianceSacks,
      icon: Target,
      description: "Suma de producción planificada para productos en categorías planificables.",
      subValue: `(${totalPlannedForComplianceQuintales.toLocaleString(undefined, {maximumFractionDigits:1})} qq)`,
    },
    {
      title: "Real s/Plan (Sacos)",
      value: totalActualForComplianceSacks,
      icon: PackageCheck,
      description: "Producción real de los productos que tenían un plan.",
      subValue: `(${totalActualForComplianceQuintales.toLocaleString(undefined, {maximumFractionDigits:1})} qq)`,
    },
    {
      title: "No Programado (Sacos)",
      value: unplannedProductionSacos,
      icon: ClipboardPlus,
      description: "Producción de productos planificables que no tenían un plan (plan = 0).",
      subValue: `(${unplannedProductionQq.toLocaleString(undefined, {maximumFractionDigits:1})} qq)`,
    },
    {
      title: "Producción Total Real (Sacos)",
      value: totalActualSacks,
      icon: PackageCheck,
      description: "Suma de toda la producción real, incluyendo no programada y no planificable.",
      subValue: `(${totalActualQuintales.toLocaleString(undefined, {maximumFractionDigits:1})} qq)`,
    },
    {
      title: "Varianza vs. Plan Total",
      value: variance,
      icon: variance >= 0 ? TrendingUp : TrendingDown,
      valueColor: variance >= 0 ? 'text-green-600' : 'text-destructive',
      description: "Diferencia entre la producción real (sobre plan) y la producción planificada.",
    },
    {
      title: "Cumplimiento del Plan",
      value: `${compliancePercentage.toFixed(1)}%`,
      icon: CheckCircle2,
      description: "Porcentaje de la producción planificada que se logró.",
      valueColor: compliancePercentage >= 95 ? 'text-green-600' : compliancePercentage >= 90 ? 'text-yellow-600' : 'text-destructive',
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpiCards.map((props) => <KpiCard key={props.title} {...props} />)}
    </div>
  );
}

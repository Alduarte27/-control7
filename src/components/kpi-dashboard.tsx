import KpiCard from './kpi-card';
import { Target, PackageCheck, ArrowLeftRight, Goal } from 'lucide-react';
import type { ProductData } from '@/lib/types';

type KpiDashboardProps = {
  data: ProductData[];
};

export default function KpiDashboard({ data }: KpiDashboardProps) {
  const totalPlanned = data.reduce((sum, item) => sum + item.planned, 0);
  const totalActual = data.reduce((sum, item) => 
    sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + dayVal, 0), 0
  );
  const variance = totalActual - totalPlanned;
  const completion = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard title="Total Planificado" value={totalPlanned.toLocaleString()} icon={Target} />
      <KpiCard title="Total Real" value={totalActual.toLocaleString()} icon={PackageCheck} />
      <KpiCard title="Varianza" value={variance.toLocaleString()} icon={ArrowLeftRight} />
      <KpiCard title="Cumplimiento" value={`${completion.toFixed(1)}%`} icon={Goal} />
    </div>
  );
}

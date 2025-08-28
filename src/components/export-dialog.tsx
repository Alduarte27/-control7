'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, where, and, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData } from '@/lib/types';

type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type SavedPlanMeta = {
  id: string; // e.g., "2024-W35"
  week: number;
  year: number;
};

export default function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [availablePlans, setAvailablePlans] = React.useState<SavedPlanMeta[]>([]);
  const [startWeek, setStartWeek] = React.useState<string>('');
  const [endWeek, setEndWeek] = React.useState<string>('');
  const [isExporting, setIsExporting] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!open) return;

    const fetchAvailablePlans = async () => {
      try {
        const plansSnapshot = await getDocs(collection(db, 'productionPlans'));
        const plans: SavedPlanMeta[] = [];
        plansSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.week && data.year) {
            plans.push({ id: doc.id, week: data.week, year: data.year });
          }
        });
        plans.sort((a, b) => a.year - b.year || a.week - b.week);
        setAvailablePlans(plans);

        if (plans.length > 0) {
            setStartWeek(plans[0].id);
            setEndWeek(plans[plans.length - 1].id);
        }
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudieron cargar las semanas disponibles.', variant: 'destructive' });
      }
    };

    fetchAvailablePlans();
  }, [open, toast]);

  const handleExport = async () => {
    if (!startWeek || !endWeek) {
        toast({ title: 'Error', description: 'Por favor, selecciona un rango de semanas.', variant: 'destructive' });
        return;
    }
    setIsExporting(true);

    try {
        const startIndex = availablePlans.findIndex(p => p.id === startWeek);
        const endIndex = availablePlans.findIndex(p => p.id === endWeek);
        const selectedPlanIds = availablePlans.slice(startIndex, endIndex + 1).map(p => p.id);

        if (selectedPlanIds.length === 0) {
            toast({ title: 'Advertencia', description: 'No hay planes en el rango seleccionado.', variant: 'destructive'});
            setIsExporting(false);
            return;
        }

        // Firestore 'in' query is limited to 30 items. If more, we need to batch.
        const BATCH_SIZE = 30;
        const planPromises = [];
        for (let i = 0; i < selectedPlanIds.length; i += BATCH_SIZE) {
            const batchIds = selectedPlanIds.slice(i, i + BATCH_SIZE);
            planPromises.push(getDocs(query(collection(db, 'productionPlans'), where('__name__', 'in', batchIds))));
        }

        const querySnapshots = await Promise.all(planPromises);
        
        const allPlansData: (ProductData[] & { week: number, year: number })[] = [];
        querySnapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                const data = doc.data();
                allPlansData.push({ ...data.products, week: data.week, year: data.year, products: data.products });
            });
        });
        
        // Sort data chronologically
        allPlansData.sort((a, b) => a.year - b.year || a.week - b.week);

        const headers = [
            'Año',
            'Semana',
            'Producto',
            'Categoría',
            'Plan Semanal',
            'Lote Lun', 'Real Lun',
            'Lote Mar', 'Real Mar',
            'Lote Mié', 'Real Mié',
            'Lote Jue', 'Real Jue',
            'Lote Vie', 'Real Vie',
            'Lote Sáb', 'Real Sáb',
            'Lote Dom', 'Real Dom',
            'Total Real',
            'Varianza',
            'Cumplimiento (%)',
        ];

        const rows: string[] = [];
        allPlansData.forEach(plan => {
            plan.products.forEach((item: ProductData) => {
                const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
                const variance = totalActual - item.planned;
                const compliance = item.planned > 0 ? ((totalActual / item.planned) * 100).toFixed(1) : '0.0';

                const dailyTotals = {
                    mon: (item.actual.mon?.day || 0) + (item.actual.mon?.night || 0),
                    tue: (item.actual.tue?.day || 0) + (item.actual.tue?.night || 0),
                    wed: (item.actual.wed?.day || 0) + (item.actual.wed?.night || 0),
                    thu: (item.actual.thu?.day || 0) + (item.actual.thu?.night || 0),
                    fri: (item.actual.fri?.day || 0) + (item.actual.fri?.night || 0),
                    sat: (item.actual.sat?.day || 0) + (item.actual.sat?.night || 0),
                    sun: (item.actual.sun?.day || 0) + (item.actual.sun?.night || 0),
                };
      
                const lotNumbers = {
                    mon: item.actual.mon?.lotNumber || '',
                    tue: item.actual.tue?.lotNumber || '',
                    wed: item.actual.wed?.lotNumber || '',
                    thu: item.actual.thu?.lotNumber || '',
                    fri: item.actual.fri?.lotNumber || '',
                    sat: item.actual.sat?.lotNumber || '',
                    sun: item.actual.sun?.lotNumber || '',
                };

                const row = [
                    plan.year,
                    plan.week,
                    `"${item.productName.replace(/"/g, '""')}"`,
                    item.categoryName,
                    item.planned,
                    lotNumbers.mon, dailyTotals.mon,
                    lotNumbers.tue, dailyTotals.tue,
                    lotNumbers.wed, dailyTotals.wed,
                    lotNumbers.thu, dailyTotals.thu,
                    lotNumbers.fri, dailyTotals.fri,
                    lotNumbers.sat, dailyTotals.sat,
                    lotNumbers.sun, dailyTotals.sun,
                    totalActual,
                    variance,
                    compliance,
                ].join(',');
                rows.push(row);
            });
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `reporte-produccion-${startWeek}-a-${endWeek}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({ title: 'Exportación Exitosa', description: `Se ha generado el reporte para ${allPlansData.length} semanas.` });
        onOpenChange(false);
    } catch (error) {
        console.error("Error exporting data:", error);
        toast({ title: 'Error de Exportación', description: 'No se pudo generar el archivo CSV.', variant: 'destructive' });
    } finally {
        setIsExporting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar Reporte de Producción a CSV</DialogTitle>
          <DialogDescription>
            Selecciona el rango de semanas que deseas incluir en el reporte.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="start-week">Semana de Inicio</Label>
            <Select value={startWeek} onValueChange={setStartWeek} disabled={availablePlans.length === 0}>
              <SelectTrigger id="start-week">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {availablePlans.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    Semana {plan.week}, {plan.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-week">Semana de Fin</Label>
            <Select value={endWeek} onValueChange={setEndWeek} disabled={availablePlans.length === 0}>
              <SelectTrigger id="end-week">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {availablePlans.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    Semana {plan.week}, {plan.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exportando...' : 'Generar y Descargar CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData } from '@/lib/types';
import { FileText, Download } from 'lucide-react';
import ReportPreviewDialog from './report-preview-dialog'; // Import the new component

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
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [reportData, setReportData] = React.useState<ProductData[] | null>(null);
  const [reportWeek, setReportWeek] = React.useState(0);
  const [reportYear, setReportYear] = React.useState(0);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setReportData(null);
      return;
    };

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
        plans.sort((a, b) => b.year - a.year || b.week - a.week); // Show newest first
        setAvailablePlans(plans);

        if (plans.length > 0) {
            setStartWeek(plans[0].id);
            setEndWeek(plans[0].id);
        }
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudieron cargar las semanas disponibles.', variant: 'destructive' });
      }
    };

    fetchAvailablePlans();
  }, [open, toast]);

  const fetchRangeData = async (): Promise<{ allPlansData: any[], selectedPlanIds: string[] }> => {
    const startIndex = availablePlans.findIndex(p => p.id === startWeek);
    const endIndex = availablePlans.findIndex(p => p.id === endWeek);
    
    // Ensure chronological order for processing
    const sortedPlans = [...availablePlans].sort((a,b) => a.year - b.year || a.week - b.week);
    const sortedStartIndex = sortedPlans.findIndex(p => p.id === startWeek);
    const sortedEndIndex = sortedPlans.findIndex(p => p.id === endWeek);

    if (sortedStartIndex > sortedEndIndex) {
        toast({ title: 'Error de Rango', description: 'La semana de inicio debe ser anterior o igual a la semana de fin.', variant: 'destructive'});
        throw new Error("Invalid range");
    }
    
    const selectedPlanIds = sortedPlans.slice(sortedStartIndex, sortedEndIndex + 1).map(p => p.id);

    if (selectedPlanIds.length === 0) {
        toast({ title: 'Advertencia', description: 'No hay planes en el rango seleccionado.', variant: 'destructive'});
        throw new Error("No plans in range");
    }

    const BATCH_SIZE = 30;
    const planPromises = [];
    for (let i = 0; i < selectedPlanIds.length; i += BATCH_SIZE) {
        const batchIds = selectedPlanIds.slice(i, i + BATCH_SIZE);
        planPromises.push(getDocs(query(collection(db, 'productionPlans'), where('__name__', 'in', batchIds))));
    }

    const querySnapshots = await Promise.all(planPromises);
    
    const allPlansData: any[] = [];
    querySnapshots.forEach(snapshot => {
        snapshot.forEach(doc => {
            const data = doc.data();
            allPlansData.push({ ...data, id: doc.id });
        });
    });
    
    // Sort data chronologically to match IDs
    allPlansData.sort((a, b) => a.id.localeCompare(b.id));
    return { allPlansData, selectedPlanIds };
  }

  const handleGenerateReport = async () => {
      if (!startWeek || !endWeek) {
          toast({ title: 'Error', description: 'Por favor, selecciona un rango de semanas.', variant: 'destructive' });
          return;
      }
      setIsProcessing(true);
      try {
          const { allPlansData } = await fetchRangeData();

          if (allPlansData.length > 1) {
              toast({ title: 'Advertencia', description: 'La vista previa de reporte solo funciona para una semana. Generando reporte para la primera semana del rango.', variant: 'default'});
          }

          const singlePlan = allPlansData[0];
          setReportData(singlePlan.products);
          setReportWeek(singlePlan.week);
          setReportYear(singlePlan.year);
          // The ReportPreviewDialog will be rendered because reportData is not null
      } catch (error: any) {
          if (error.message !== "Invalid range" && error.message !== "No plans in range") {
            console.error("Error generating report:", error);
            toast({ title: 'Error de Reporte', description: 'No se pudo obtener los datos para el reporte.', variant: 'destructive' });
          }
      } finally {
          setIsProcessing(false);
      }
  }

  const handleExportCSV = async () => {
    if (!startWeek || !endWeek) {
        toast({ title: 'Error', description: 'Por favor, selecciona un rango de semanas.', variant: 'destructive' });
        return;
    }
    setIsProcessing(true);

    try {
        const { allPlansData } = await fetchRangeData();
        
        const headers = [
            'Año', 'Semana', 'Producto', 'Categoría', 'Plan Semanal',
            'Lote Lun', 'Real Lun', 'Incidencia Día Lun', 'Incidencia Noche Lun',
            'Lote Mar', 'Real Mar', 'Incidencia Día Mar', 'Incidencia Noche Mar',
            'Lote Mié', 'Real Mié', 'Incidencia Día Mié', 'Incidencia Noche Mié',
            'Lote Jue', 'Real Jue', 'Incidencia Día Jue', 'Incidencia Noche Jue',
            'Lote Vie', 'Real Vie', 'Incidencia Día Vie', 'Incidencia Noche Vie',
            'Lote Sáb', 'Real Sáb', 'Incidencia Día Sáb', 'Incidencia Noche Sáb',
            'Lote Dom', 'Real Dom', 'Incidencia Día Dom', 'Incidencia Noche Dom',
            'Total Real', 'Varianza', 'Cumplimiento (%)',
        ];

        const rows: string[] = [];
        allPlansData.forEach(plan => {
            plan.products.forEach((item: ProductData) => {
                const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
                const variance = totalActual - item.planned;
                const compliance = item.planned > 0 ? ((totalActual / item.planned) * 100).toFixed(1) : '0.0';

                const dailyData = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).flatMap(day => {
                    const dayInfo = item.actual[day] || {};
                    return [
                        dayInfo.lotNumber || '',
                        (dayInfo.day || 0) + (dayInfo.night || 0),
                        `"${(dayInfo.dayNote || '').replace(/"/g, '""')}"`,
                        `"${(dayInfo.nightNote || '').replace(/"/g, '""')}"`,
                    ];
                });

                const row = [
                    plan.year, plan.week, `"${item.productName.replace(/"/g, '""')}"`, item.categoryName, item.planned,
                    ...dailyData,
                    totalActual, variance, compliance,
                ].join(',');
                rows.push(row);
            });
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        const startPlan = availablePlans.find(p=>p.id === startWeek);
        const endPlan = availablePlans.find(p=>p.id === endWeek);
        link.setAttribute('download', `reporte-produccion-${startPlan?.year}-S${startPlan?.week}-a-${endPlan?.year}-S${endPlan?.week}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({ title: 'Exportación Exitosa', description: `Se ha generado el reporte para ${allPlansData.length} semanas.` });
    } catch (error: any) {
        if (error.message !== "Invalid range" && error.message !== "No plans in range") {
            console.error("Error exporting data:", error);
            toast({ title: 'Error de Exportación', description: 'No se pudo generar el archivo CSV.', variant: 'destructive' });
        }
    } finally {
        setIsProcessing(false);
    }
  };
  
  if (reportData) {
    return (
        <ReportPreviewDialog
            open={!!reportData}
            onOpenChange={(isOpen) => {
                if (!isOpen) setReportData(null);
            }}
            data={reportData}
            week={reportWeek}
            year={reportYear}
        />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar o Generar Reporte</DialogTitle>
          <DialogDescription>
            Selecciona el rango de semanas y elige el formato de salida.
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
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGenerateReport} disabled={isProcessing}>
            <FileText className="mr-2 h-4 w-4" />
            {isProcessing ? 'Generando...' : 'Generar Reporte Visual (PDF)'}
          </Button>
          <Button onClick={handleExportCSV} disabled={isProcessing}>
            <Download className="mr-2 h-4 w-4" />
            {isProcessing ? 'Exportando...' : 'Descargar como CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

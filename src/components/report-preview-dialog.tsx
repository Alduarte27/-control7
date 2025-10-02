'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Factory, Printer } from 'lucide-react';
import type { ProductData } from '@/lib/types';
import KpiDashboard from './kpi-dashboard';
import WeeklySummary from './weekly-summary';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { cn } from '@/lib/utils';
import { Progress } from './ui/progress';

type ReportPreviewDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: ProductData[];
    week: number;
    year: number;
};

const getVarianceColorClass = (variance: number, compliance: number): string => {
    if (variance > 0) return 'bg-green-100 text-green-700';
    if (compliance >= 95) return 'bg-green-50 text-green-600';
    if (compliance >= 90) return 'bg-yellow-100 text-yellow-700';
    if (variance < 0) return 'bg-red-100 text-red-700';
    return '';
};

const getComplianceColorClass = (compliance: number): string => {
    if (compliance >= 95) return 'bg-green-600';
    if (compliance >= 90) return 'bg-yellow-500';
    return 'bg-red-600';
};


export default function ReportPreviewDialog({ open, onOpenChange, data, week, year }: ReportPreviewDialogProps) {

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Reporte Semana ${week} - ${year}.pdf`;
    window.print();
    document.title = originalTitle;
  };

  const productsWithActivity = data.filter(item => item.planned > 0 || Object.values(item.actual).some(d => (d.day || 0) + (d.night || 0) > 0));

  // The entire dialog content is what will be controlled for printing.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col print-area">
        <div className="no-print">
            <DialogHeader>
            <DialogTitle>Vista Previa de Reporte Semanal</DialogTitle>
            <DialogDescription>
                Revisa el reporte gerencial para la semana {week}, {year}. Puedes imprimirlo o guardarlo como PDF.
            </DialogDescription>
            </DialogHeader>
        </div>
        <div className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-6 -mr-6">
                {/* The div below is the actual content that gets printed */}
                <div className="print-content bg-white text-black p-4 rounded-lg">
                    <header className="flex items-center justify-between pb-4 border-b mb-6">
                        <div className="flex items-center gap-3">
                            <Factory className="h-8 w-8 text-primary" />
                            <h1 className="text-2xl font-bold">Reporte de Producción Semanal</h1>
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-semibold">Semana {week}</p>
                            <p className="text-lg text-gray-600">{year}</p>
                        </div>
                    </header>
                    <main className="space-y-6">
                        <section>
                            <h2 className="text-xl font-semibold mb-4 text-primary">Indicadores Clave de Rendimiento</h2>
                            <KpiDashboard data={data} />
                        </section>

                        <Separator />

                        <section>
                            <h2 className="text-xl font-semibold mb-4 text-primary">Tabla de Cumplimiento</h2>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-left">Producto</TableHead>
                                        <TableHead className="text-right">Plan (Sacos)</TableHead>
                                        <TableHead className="text-right">Real (Sacos)</TableHead>
                                        <TableHead className="text-right">Varianza</TableHead>
                                        <TableHead>Cumplimiento</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {productsWithActivity.map(item => {
                                        const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
                                        const variance = totalActual - item.planned;
                                        const compliance = item.planned > 0 ? (totalActual / item.planned) * 100 : 0;
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell className="text-left font-medium">{item.productName}</TableCell>
                                                <TableCell className="text-right">{item.planned.toLocaleString()}</TableCell>
                                                <TableCell className="text-right">{totalActual.toLocaleString()}</TableCell>
                                                <TableCell className={cn("text-right font-medium", getVarianceColorClass(variance, compliance))}>
                                                    {variance.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Progress value={compliance > 100 ? 100 : compliance} className="w-[60%]" indicatorClassName={getComplianceColorClass(compliance)} />
                                                        <span className="text-xs font-medium w-[45px] text-right">{compliance.toFixed(1)}%</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </section>
                        
                        <Separator />

                        <section>
                            <h2 className="text-xl font-semibold mb-4 text-primary">Resumen Gráfico de la Semana</h2>
                            <WeeklySummary data={data} />
                        </section>
                    </main>
                    <footer className="text-center text-xs text-gray-500 pt-8 mt-8 border-t">
                        <p>Reporte generado el {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })} a las {new Date().toLocaleTimeString('es-ES')}</p>
                        <p>Control 7 - Planificación y Seguimiento de la Producción</p>
                    </footer>
                </div>
            </ScrollArea>
        </div>
        <DialogFooter className="sm:justify-end no-print">
            <DialogClose asChild>
                <Button type="button" variant="secondary">Cerrar</Button>
            </DialogClose>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Guardar como PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

type ReportPreviewDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: ProductData[];
    week: number;
    year: number;
};

export default function ReportPreviewDialog({ open, onOpenChange, data, week, year }: ReportPreviewDialogProps) {

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col no-print">
        <DialogHeader>
          <DialogTitle>Vista Previa de Reporte Semanal</DialogTitle>
          <DialogDescription>
            Revisa el reporte gerencial para la semana {week}, {year}. Puedes imprimirlo o guardarlo como PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-6 -mr-6">
                <div id="report-content" className="print-area bg-white text-black p-4 rounded-lg">
                    {/* Contenido del reporte que también se imprimirá */}
                    <div className="print-content">
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
                                <h2 className="text-xl font-semibold mb-4 text-primary">Resumen Gráfico de la Semana</h2>
                                <WeeklySummary data={data} />
                            </section>
                        </main>
                        <footer className="text-center text-xs text-gray-500 pt-8 mt-8 border-t">
                            <p>Reporte generado el {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })} a las {new Date().toLocaleTimeString('es-ES')}</p>
                            <p>Control 7 - Planificación y Seguimiento de la Producción</p>
                        </footer>
                    </div>
                </div>
            </ScrollArea>
        </div>
        <DialogFooter className="sm:justify-end">
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

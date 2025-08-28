'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import { Target, PackageCheck, Bot, Goal, CheckCircle2, LayoutDashboard, History, Settings, Download, Copy, Factory, BarChart2, TrendingUp, Zap, Hash } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

type InfoDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const FeatureItem = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="flex items-start gap-4">
        <div className="p-2 bg-primary/10 rounded-md text-primary mt-1">
            <Icon className="h-5 w-5" />
        </div>
        <div>
            <h4 className="font-semibold text-foreground">{title}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    </div>
);

export default function InfoDialog({ open, onOpenChange }: InfoDialogProps) {
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      const storedPreference = localStorage.getItem('showInfoDialogOnStartup');
      setDontShowAgain(storedPreference === 'false');
    }
  }, [open]);

  const handleCheckedChange = (checked: boolean) => {
    setDontShowAgain(checked);
    localStorage.setItem('showInfoDialogOnStartup', String(!checked));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Factory className="h-7 w-7 text-primary" />
            Bienvenido a Control 7
          </DialogTitle>
          <DialogDescription>
            Tu centro de mando para la planificación y seguimiento de la producción. Aquí tienes un resumen de lo que puedes hacer:
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6 -mr-6">
          <div className="space-y-6 py-4">
            
            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Funcionalidades Principales</h3>
                <div className="space-y-4">
                    <FeatureItem 
                        icon={Target}
                        title="Planificación Semanal"
                        description="Define tus metas de producción para cada producto en la tabla principal. Simplemente haz clic en la celda 'Plan Semanal' e ingresa el valor."
                    />
                    <FeatureItem 
                        icon={Hash}
                        title="Registro de Producción y Lotes por Turno"
                        description="Haz clic en el icono de lápiz (Editar) para registrar la producción por turno y el número de lote de cada día, que se sugiere automáticamente."
                    />
                     <FeatureItem 
                        icon={Copy}
                        title="Copiar Plan de la Semana Anterior"
                        description="Ahorra tiempo utilizando el botón 'Copiar Plan Anterior'. Esto cargará automáticamente los valores planificados de la semana previa."
                    />
                </div>
            </div>

             <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Centro de Análisis con IA</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={Bot}
                        title="Sugerencia de Planificación Inteligente"
                        description="En la página 'Análisis IA', el asistente analiza el historial y propone un plan optimizado que ahora se muestra directamente en la página para tu revisión."
                    />
                    <FeatureItem 
                        icon={TrendingUp}
                        title="Pronóstico de Demanda"
                        description="La IA puede generar un pronóstico cualitativo de la demanda futura, acompañado de gráficos históricos para una mejor comprensión de las tendencias."
                    />
                     <FeatureItem 
                        icon={BarChart2}
                        title="Análisis Comparativo Semanal"
                        description="Compara el rendimiento detallado entre dos semanas, con KPIs y gráficos producto a producto, todo dentro de la misma sección de análisis."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Dashboard y Visualizaciones</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={Zap}
                        title="Dashboard Optimizado y Rápido"
                        description="Gracias a la nueva arquitectura de datos, el Dashboard General ahora carga de forma casi instantánea, consumiendo muchos menos recursos."
                    />
                    <FeatureItem 
                        icon={LayoutDashboard}
                        title="Gráfico de Resumen Semanal Avanzado"
                        description="El gráfico principal del Dashboard ahora es una barra apilada que te permite ver la composición de tu producción real (ejecutado vs. no programado) en comparación con tu plan."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Gestión y Herramientas</h3>
                <div className="space-y-4">
                    <FeatureItem 
                        icon={History}
                        title="Historial de Planes Optimizado"
                        description="La sección 'Historial' ahora carga los planes por páginas, haciendo la navegación mucho más rápida y eficiente a medida que crecen tus datos."
                    />
                    <FeatureItem 
                        icon={Settings}
                        title="Administración Centralizada y con Caché"
                        description="Gestiona productos y categorías. Los datos se guardan en caché en el servidor para una carga más rápida en toda la aplicación."
                    />
                    <FeatureItem 
                        icon={Download}
                        title="Exportación a CSV por Rango de Fechas"
                        description="Usa el botón 'Exportar' para abrir un diálogo donde podrás seleccionar un rango de semanas y generar un reporte CSV personalizado."
                    />
                </div>
            </div>

            <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">Desarrollado por Alexander Ayavaca Duarte.</p>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="sm:justify-start">
          <div className="flex items-center space-x-2">
            <Checkbox id="dont-show-again" checked={dontShowAgain} onCheckedChange={handleCheckedChange} />
            <Label htmlFor="dont-show-again" className="text-sm text-muted-foreground">No volver a mostrar este mensaje</Label>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

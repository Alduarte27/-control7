'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import { Target, HardHat, Bot, NotebookPen, CheckCircle2, LayoutDashboard, History, Settings, Download, Copy, Factory, BarChart2, TrendingUp, Zap, Hash, FileText, Database, PlayCircle, Edit, Upload } from 'lucide-react';
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
                        icon={NotebookPen}
                        title="Registro de Incidencias"
                        description="Usa el botón de libreta para añadir notas o incidencias por turno. Esto es clave para entender las variaciones y mejorar a futuro."
                    />
                     <FeatureItem 
                        icon={Copy}
                        title="Copiar Plan de la Semana Anterior"
                        description="Ahorra tiempo utilizando el botón 'Copiar Plan Anterior'. Esto cargará automáticamente los valores planificados de la semana previa."
                    />
                </div>
            </div>

             <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Centro de Operaciones y Simulación</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={Edit}
                        title="Configura tu Planta Virtual"
                        description="En 'Operaciones', haz clic en el icono de lápiz en cada componente (Tachos, Silos, Envasadoras, Enfardadoras) para ajustar sus parámetros como velocidad, capacidad, mermas y más."
                    />
                     <FeatureItem 
                        icon={Upload}
                        title="Personaliza con tus Propias Imágenes"
                        description="Puedes subir tus propias fotos para cada máquina y silo. Simplemente edita un componente y haz clic en 'Cambiar Foto' para darle a la simulación un toque realista."
                    />
                    <FeatureItem 
                        icon={PlayCircle}
                        title="Simulación Dinámica del Proceso"
                        description="Inicia, pausa y acelera una simulación en tiempo real para visualizar el flujo de producción, desde el consumo de materia prima hasta el empaque final. Ideal para formación y análisis."
                    />
                    <FeatureItem 
                        icon={TrendingUp}
                        title="Detección de Cuellos de Botella"
                        description="El simulador analiza la configuración de tu línea de producción y te alerta si la capacidad de las enfardadoras está limitando la producción de las envasadoras, ayudándote a optimizar el flujo."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Reportes y Dashboards</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={Zap}
                        title="Dashboard Optimizado y Rápido"
                        description="Gracias a la nueva arquitectura de datos, el Dashboard General ahora carga de forma casi instantánea, consumiendo muchos menos recursos."
                    />
                    <FeatureItem 
                        icon={FileText}
                        title="Página de Reportes Profesionales"
                        description="Usa el botón 'Exportar' para generar un reporte visual profesional de un rango de semanas. Incluye KPIs, tabla de cumplimiento, y gráficos consolidados, listo para imprimir o guardar como PDF."
                    />
                    <FeatureItem 
                        icon={Download}
                        title="Exportación a CSV"
                        description="Desde el mismo diálogo de 'Exportar', puedes descargar un CSV detallado con todos los datos de producción del rango de semanas que elijas."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Gestión y Administración</h3>
                <div className="space-y-4">
                    <FeatureItem 
                        icon={History}
                        title="Historial de Planes Optimizado"
                        description="La sección 'Historial' ahora carga los planes por páginas, haciendo la navegación mucho más rápida y eficiente a medida que crecen tus datos."
                    />
                    <FeatureItem 
                        icon={Settings}
                        title="Sincronización de Datos Históricos"
                        description="Desde 'Admin', usa el botón 'Sincronizar' para actualizar todos los planes antiguos con los nombres y categorías más recientes de tus productos."
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

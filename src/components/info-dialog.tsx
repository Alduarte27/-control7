'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import { Target, PackageCheck, ArrowLeftRight, Goal, CheckCircle2, LayoutDashboard, History, Settings, Download, Copy, Factory } from 'lucide-react';

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
        <ScrollArea className="max-h-[70vh] pr-6 -mr-6">
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
                        icon={PackageCheck}
                        title="Registro de Producción Real por Turno"
                        description="Haz clic en el icono de lápiz (Editar) al final de cada fila para abrir un detalle y registrar la producción real de los turnos de día y noche para cada día de la semana."
                    />
                     <FeatureItem 
                        icon={Copy}
                        title="Copiar Plan de la Semana Anterior"
                        description="Ahorra tiempo utilizando el botón 'Copiar Plan Anterior' en la barra de filtros. Esto cargará automáticamente los valores planificados de la semana previa."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Dashboard de KPIs</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={CheckCircle2}
                        title="Indicadores Clave (KPIs)"
                        description="En la parte superior, tienes un dashboard con métricas vitales que se actualizan en tiempo real. Pasa el mouse sobre cada tarjeta para entender qué significa."
                    />
                    <FeatureItem 
                        icon={LayoutDashboard}
                        title="Dashboard General"
                        description="Accede a una vista macro de tu producción a lo largo del tiempo. Compara el rendimiento entre semanas, turnos y productos con gráficos interactivos."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Gestión y Herramientas</h3>
                <div className="space-y-4">
                    <FeatureItem 
                        icon={History}
                        title="Historial de Planes"
                        description="Navega a la sección 'Historial' para ver y cargar cualquier plan de producción que hayas guardado anteriormente. Ideal para auditorías o consultas."
                    />
                    <FeatureItem 
                        icon={Settings}
                        title="Administración Centralizada"
                        description="En 'Administración', puedes añadir nuevas categorías y productos, así como reordenarlos. ¡Mantén tu catálogo de productos siempre al día!"
                    />
                    <FeatureItem 
                        icon={Download}
                        title="Exportación a CSV"
                        description="Con un solo clic en el botón 'Exportar CSV', puedes descargar un reporte completo de la semana actual para analizarlo en Excel u otras herramientas."
                    />
                </div>
            </div>

            <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">Desarrollado por Alexander Ayavaca Duarte.</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

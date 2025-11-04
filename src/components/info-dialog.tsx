'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import { Target, HardHat, Bot, NotebookPen, CheckCircle2, LayoutDashboard, History, Settings, Download, Copy, Factory, BarChart2, TrendingUp, Zap, Hash, FileText, Database, PlayCircle, Edit, Upload, Activity, AlertTriangle, Clock, Shuffle } from 'lucide-react';
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
                <h3 className="text-lg font-semibold mb-3 text-primary">Análisis de Paradas y OEE</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={Activity}
                        title="Dashboard de OEE"
                        description="Accede al análisis OEE desde la bitácora para ver gráficos del tiempo total de parada por máquina, un desglose por motivo, y la distribución del tiempo productivo vs. paradas."
                    />
                     <FeatureItem 
                        icon={Zap}
                        title="KPIs de Fiabilidad (MTBF/MTTR)"
                        description="El dashboard de OEE ahora incluye el Tiempo Promedio Entre Fallas (MTBF) y el Tiempo Promedio de Reparación (MTTR) por máquina, indicadores clave para medir la fiabilidad y eficiencia del mantenimiento."
                    />
                     <FeatureItem 
                        icon={BarChart2}
                        title="OEE Detallado por Máquina"
                        description="Analiza la Disponibilidad, Rendimiento, Calidad y el OEE general de forma individual para cada máquina, permitiéndote identificar cuellos de botella con precisión."
                    />
                     <FeatureItem 
                        icon={Clock}
                        title="Análisis de Paradas por Hora"
                        description="Un nuevo gráfico te muestra los minutos de parada acumulados en cada hora del turno, ayudándote a detectar patrones y problemas recurrentes en momentos específicos del día."
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
                        icon={AlertTriangle}
                        title="Detección de Cuellos de Botella"
                        description="El simulador analiza la configuración de tu línea y te alerta en tiempo real si la materia prima es insuficiente para la demanda o si el empaque está limitando la producción."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Reportes y Datos</h3>
                <div className="space-y-4">
                    <FeatureItem 
                        icon={HardHat}
                        title="Bitácora de Producción Detallada"
                        description="En 'Bitácora', documenta eventos en intervalos de 30 minutos. Registra paradas, velocidad, peso por saco, flujo de masa, análisis de calidad (NS, color, humedad) y novedades de empaque."
                    />
                    <FeatureItem 
                        icon={Shuffle}
                        title="Dos Formatos de Exportación CSV"
                        description="Usa el botón 'Importar / Exportar' en la bitácora. Ahora puedes elegir entre un 'Resumen de Paradas' (ideal para OEE) o una 'Bitácora Completa por Intervalo' con todos los datos del turno."
                    />
                    <FeatureItem 
                        icon={Database}
                        title="Backup y Restauración con JSON"
                        description="Desde el mismo modal de exportación, puedes descargar una copia de seguridad completa de tus bitácoras en formato JSON. Estos archivos se pueden usar para importar y restaurar datos en cualquier momento."
                    />
                    <FeatureItem 
                        icon={FileText}
                        title="Página de Reportes Profesionales"
                        description="Usa el botón 'Exportar / Reportes' en la página principal para generar un reporte visual profesional, listo para imprimir o guardar como PDF."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Gestión y Administración</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={Settings}
                        title="Gestión de Catálogos"
                        description="Desde la bitácora, haz clic en 'Configuración' para añadir y administrar motivos de parada, tipos de mantenimiento, operadores y supervisores, estandarizando tus registros."
                    />
                    <FeatureItem 
                        icon={History}
                        title="Historial de Planes y Bitácoras"
                        description="Navega por los planes de producción y las bitácoras de días anteriores de forma rápida y paginada desde sus respectivas secciones de 'Historial'."
                    />
                    <FeatureItem 
                        icon={CheckCircle2}
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

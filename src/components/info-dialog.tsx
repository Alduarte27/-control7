'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import { Target, HardHat, Bot, NotebookPen, CheckCircle2, LayoutDashboard, History, Settings, Download, Copy, Factory, BarChart2, TrendingUp, Zap, Hash, FileText, Database, PlayCircle, Edit, Upload, Activity, AlertTriangle, Clock, Shuffle, PackageCheck, Boxes, QrCode, Smartphone } from 'lucide-react';
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
                <h3 className="text-lg font-semibold mb-3 text-primary">Planificación y Control</h3>
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
                <h3 className="text-lg font-semibold mb-3 text-primary">Control de Materiales de Empaque</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={Boxes}
                        title="Gestión de Inventario en Tiempo Real"
                        description="Registra la entrada de cada rollo o paca de sacos en el área de empaque. Visualiza al instante qué material está 'Recibido', 'En Uso' o 'Consumido'."
                    />
                     <FeatureItem 
                        icon={QrCode}
                        title="Registro Rápido con Código QR"
                        description="Usa el botón 'Escanear' para leer los códigos de las etiquetas de los proveedores. El sistema extraerá automáticamente el código, cantidad y peso, minimizando errores."
                    />
                    <FeatureItem 
                        icon={Smartphone}
                        title="Sincronización con Escáner Móvil"
                        description="Conecta tu teléfono a la computadora para usarlo como un escáner remoto. Ideal para registrar materiales sin tener que llevarlos hasta el escritorio."
                    />
                    <FeatureItem 
                        icon={PackageCheck}
                        title="Trazabilidad y Rendimiento"
                        description="Sigue el ciclo de vida de cada material, desde que se recibe hasta que se pesa la tara. Calcula el rendimiento real de cada rollo o paca para controlar mermas."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Análisis y Reportes</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={HardHat}
                        title="Bitácora de Producción Detallada"
                        description="En 'Bitácora', documenta paradas, velocidad, peso y datos de calidad en intervalos de 30 minutos, creando un registro completo de cada turno."
                    />
                     <FeatureItem 
                        icon={Activity}
                        title="Dashboard de OEE y Fiabilidad"
                        description="Accede al análisis OEE desde la bitácora para ver gráficos del tiempo total de parada, MTBF, MTTR, y la distribución del tiempo productivo vs. paradas."
                    />
                    <FeatureItem 
                        icon={Database}
                        title="Importación y Exportación Avanzada"
                        description="Desde la bitácora, puedes exportar un 'Resumen de Paradas' para OEE o una 'Bitácora Completa'. También puedes importar datos masivamente desde un archivo CSV."
                    />
                    <FeatureItem 
                        icon={FileText}
                        title="Reportes Profesionales"
                        description="Usa el botón 'Exportar / Reportes' en la página principal para generar un reporte visual profesional, listo para imprimir o guardar como PDF."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Simulación y Administración</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={PlayCircle}
                        title="Simulador de Planta Virtual"
                        description="En 'Operaciones', configura y ejecuta una simulación dinámica de tu línea de producción para visualizar flujos, detectar cuellos de botella y entrenar personal."
                    />
                    <FeatureItem 
                        icon={Settings}
                        title="Gestión Centralizada de Catálogos"
                        description="Desde la bitácora ('Configuración') o el módulo de materiales, puedes añadir y administrar motivos de parada, proveedores, operadores y más."
                    />
                    <FeatureItem 
                        icon={History}
                        title="Historial de Planes y Bitácoras"
                        description="Navega por los planes de producción y las bitácoras de días anteriores de forma rápida y paginada desde sus respectivas secciones de 'Historial'."
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

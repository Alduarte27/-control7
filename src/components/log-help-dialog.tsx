
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { HardHat, Calendar, Clock, Edit, AlertTriangle, Save, Download, Upload, Settings, Lock, HelpCircle } from 'lucide-react';

type LogHelpDialogProps = {
    isOpen: boolean;
    onClose: () => void;
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

export default function LogHelpDialog({ isOpen, onClose }: LogHelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <HelpCircle className="h-7 w-7 text-primary" />
            Guía de la Bitácora de Producción
          </DialogTitle>
          <DialogDescription>
            Aprende a registrar, gestionar y analizar los datos de tus turnos de producción.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-6 -mr-6">
          <div className="space-y-6 py-4">
            
            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">1. Configuración del Turno</h3>
                <div className="space-y-4">
                    <FeatureItem 
                        icon={Calendar}
                        title="Seleccionar Fecha y Turno"
                        description="Usa los controles en la parte superior para elegir el día y el turno (Día/Noche) que deseas registrar. El lote se sugiere automáticamente, pero puedes editarlo."
                    />
                    <FeatureItem 
                        icon={HardHat}
                        title="Asignar Personal y Producto"
                        description="Selecciona el Operador y Supervisor del turno. Para cada máquina, elige el producto que se está envasando. Esto es clave para los cálculos de OEE."
                    />
                </div>
            </div>
            
             <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">2. Registro de Paradas</h3>
                <div className="space-y-4">
                     <FeatureItem 
                        icon={Edit}
                        title="Añadir una Parada"
                        description="Haz clic en cualquier celda de la columna 'Observación' de una máquina. Se abrirá un modal para que registres la hora de inicio, fin, tipo, motivo y detalles de la parada."
                    />
                     <FeatureItem 
                        icon={AlertTriangle}
                        title="Editar o Ver Detalles"
                        description="Una vez registrada, la parada aparecerá como una píldora de color en la tabla. Haz clic sobre ella para editarla o simplemente pasa el ratón por encima para ver todos sus detalles."
                    />
                </div>
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">3. Registro de Datos Operativos</h3>
                <div className="space-y-4">
                    <FeatureItem 
                        icon={Edit}
                        title="Ingresar Datos por Intervalo"
                        description="Cada fila representa un intervalo de 30 minutos. Puedes hacer clic directamente en las celdas para registrar el peso por saco, la velocidad de la máquina, datos de calidad (Masa, Flujo, NS), y cualquier novedad de empaque."
                    />
                    <FeatureItem 
                        icon={Save}
                        title="Guardado Automático y Manual"
                        description="Si estás trabajando en el día actual, tus cambios se guardarán automáticamente. Para fechas pasadas, deberás usar el botón 'Guardar Cambios'."
                    />
                </div>
            </div>

             <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">4. Herramientas Avanzadas</h3>
                <div className="space-y-4">
                    <FeatureItem 
                        icon={Download}
                        title="Importar y Exportar"
                        description="Usa el botón de 'Importar / Exportar' para descargar una copia de seguridad (JSON) o generar reportes detallados en CSV (Resumen de Paradas o Bitácora Completa)."
                    />
                     <FeatureItem 
                        icon={Settings}
                        title="Configuración de Catálogos"
                        description="Haz clic en 'Configuración' para añadir o eliminar motivos de parada, operadores, supervisores y tipos de mantenimiento. Esto estandariza tus registros."
                    />
                     <FeatureItem 
                        icon={Lock}
                        title="Modo Administrador"
                        description="Activa el 'Modo Admin' (si tienes la clave) para poder eliminar registros de paradas directamente desde la tabla, haciendo clic en la 'x' que aparece sobre ellas."
                    />
                </div>
            </div>

          </div>
        </ScrollArea>
        <DialogFooter>
            <DialogClose asChild>
                <Button>Entendido</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

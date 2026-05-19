'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from './ui/badge';
import { 
  Target, 
  Factory, 
  Activity, 
  Boxes, 
  Package, 
  Settings, 
  CheckCircle2, 
  LayoutDashboard, 
  History, 
  Download, 
  Copy, 
  BarChart2, 
  TrendingUp, 
  Zap, 
  FileText, 
  Database, 
  PlayCircle, 
  Edit, 
  Upload, 
  AlertTriangle, 
  Clock, 
  PackageCheck, 
  QrCode, 
  Smartphone, 
  Wifi, 
  MousePointerClick, 
  Layers,
  Sunrise,
  Sunset,
  Scale,
  Shuffle,
  Bot,
  Volume2
} from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

type InfoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FeatureItem = ({ icon: Icon, title, description, isNew = false }: { icon: React.ElementType, title: string, description: string, isNew?: boolean }) => (
  <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
    <div className="p-2 bg-primary/10 rounded-md text-primary mt-1 shrink-0">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
        {title}
        {isNew && <Badge variant="default" className="text-[10px] h-4 px-1.5 bg-emerald-500 hover:bg-emerald-600 border-none">Nuevo</Badge>}
      </h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
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
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 pb-2 bg-gradient-to-r from-primary/10 via-background to-background">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary rounded-xl text-primary-foreground shadow-lg shadow-primary/20">
              <Factory className="h-6 w-6" />
            </div>
            <DialogTitle className="text-3xl font-bold tracking-tight">
              Control 7 <span className="text-primary text-sm font-normal align-top ml-1">v1.0.0</span>
            </DialogTitle>
          </div>
          <DialogDescription className="text-base text-muted-foreground">
            Sistema avanzado de gestión de producción, materiales y proyección industrial.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-8 py-4">
            
            {/* --- SECCIÓN: MÓDULOS DEL MENÚ --- */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2 px-1">
                <Layers className="h-4 w-4" /> Guía de Navegación (Módulos)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <FeatureItem
                  icon={Factory}
                  title="Producción"
                  description="Tablero principal de planificación. Define metas semanales, registra lotes y documenta incidencias por turno."
                />
                <FeatureItem
                  icon={Target}
                  title="Proyección (Zafra/No Zafra)"
                  description="Análisis de balance de masas. Proyecta el uso de azúcar según suministro del ingenio o disponibilidad en silos, calculando el balance de Granel QQ."
                  isNew={true}
                />
                <FeatureItem
                  icon={Activity}
                  title="Simulador Process"
                  description="Planta virtual en tiempo real. Visualiza el flujo desde Tachos y Recibidores hasta Silos y Empaque."
                />
                <FeatureItem
                  icon={History}
                  title="Historial de Planes"
                  description="Consulta y recupera proyecciones guardadas anteriormente. Compara escenarios históricos para evaluar la eficiencia."
                />
                <FeatureItem
                  icon={Bot}
                  title="Planta Copilot (IA)"
                  description="Asistente de Inteligencia Artificial con Smart Engine. Planifica y simula escenarios de envasado mediante comandos de voz."
                  isNew={true}
                />
                <FeatureItem
                  icon={Settings}
                  title="Configuración"
                  description="Administración de perfiles de acceso, catálogos de proveedores, operadores y motivos de parada."
                />
              </div>
            </section>

            {/* --- SECCIÓN: NOVEDADES Y SIMULACIÓN --- */}
            <section className="bg-muted/30 rounded-2xl p-4 border border-border/50">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2 px-1">
                <Zap className="h-4 w-4" /> Novedades y Control Inteligente
              </h3>
              <div className="space-y-3">
                <FeatureItem
                  icon={Volume2}
                  title="Copilot de Voz Interactivo"
                  description="Detección de habla continua en español con autocierre inteligente tras 1.8 segundos de silencio y respuesta acústica premium."
                  isNew={true}
                />
                <FeatureItem
                  icon={Zap}
                  title="Control de Interfaz Autónomo"
                  description="Comanda verbalmente el cambio a Zafra/No Zafra, activa el modo manual de proyección o inyecta combinaciones en vivo."
                  isNew={true}
                />
                <FeatureItem
                  icon={Scale}
                  title="Control de Turnos y Mano de Obra"
                  description="Visualización avanzada del personal máximo activo por turnos (Día y Noche), garantizando consistencia de cálculo en el dashboard."
                  isNew={true}
                />
                <FeatureItem
                  icon={FileText}
                  title="Reportes PDF de Alta Fidelidad"
                  description="Exportación de reportes PDF optimizada con ajuste automático de texto e imágenes sin desbordamiento."
                  isNew={true}
                />
              </div>
            </section>

            {/* --- SECCIÓN: TRAZABILIDAD Y QR --- */}
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2 px-1">
                <QrCode className="h-4 w-4" /> Trazabilidad de Materiales
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <FeatureItem
                  icon={Smartphone}
                  title="Escaneo Móvil y QR"
                  description="Usa tu smartphone como escáner remoto para registrar materiales al instante mediante códigos QR."
                />
                <FeatureItem
                  icon={PackageCheck}
                  title="Ciclo de Vida del Material"
                  description="Seguimiento desde 'Recibido' hasta 'Consumido' con cálculo automático de mermas y rendimientos."
                />
              </div>
            </section>

            <div className="text-center pt-6 border-t border-border/50 pb-6">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Sistema operativo y actualizado
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 italic">Desarrollado por Alexander Ayavaca Duarte.</p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-muted/20 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="dont-show-again" 
              checked={dontShowAgain} 
              onCheckedChange={handleCheckedChange} 
              className="border-primary/50 data-[state=checked]:bg-primary"
            />
            <Label htmlFor="dont-show-again" className="text-sm font-medium text-muted-foreground cursor-pointer">
              No volver a mostrar al iniciar
            </Label>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-2.5 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            Entendido
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

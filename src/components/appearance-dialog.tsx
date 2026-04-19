'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Monitor, Moon, Sun, Palette, Check, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export type AppearanceConfig = {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  radius: number;
};

export const ACCENT_COLORS = [
  { name: 'Azul Industrial', value: '221 83% 53%', class: 'bg-[#0f62fe]' },
  { name: 'Naranja de Seguridad', value: '24 95% 53%', class: 'bg-[#f7630c]' },
  { name: 'Verde Eficiencia', value: '142 76% 36%', class: 'bg-[#107c10]' },
  { name: 'Acero Moderno', value: '215 16% 47%', class: 'bg-[#607d8b]' },
  { name: 'Púrpura Control', value: '262 83% 58%', class: 'bg-[#8a3ffc]' },
  { name: 'Rojo Alerta', value: '0 84% 60%', class: 'bg-[#e81123]' },
];

interface AppearanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: AppearanceConfig;
  onConfigChange: (config: AppearanceConfig) => void;
}

export default function AppearanceDialog({ open, onOpenChange, config, onConfigChange }: AppearanceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Personalizar Apariencia
          </DialogTitle>
          <DialogDescription>
            Ajusta el tema y los colores para adaptar el simulador a tu entorno de trabajo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tema */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tema Visual</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', icon: Sun, label: 'Claro' },
                { id: 'dark', icon: Moon, label: 'Oscuro' },
                { id: 'system', icon: Monitor, label: 'Sistema' },
              ].map((item) => (
                <Button
                  key={item.id}
                  variant={config.theme === item.id ? 'default' : 'outline'}
                  className={cn(
                    "flex flex-col items-center gap-2 h-auto py-3 px-2 border-2",
                    config.theme === item.id ? "border-primary" : "border-transparent"
                  )}
                  onClick={() => onConfigChange({ ...config, theme: item.id as any })}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Color de Acento */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Color de Acento (Industrial)</Label>
            <div className="grid grid-cols-3 gap-3">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-md border-2 p-2 transition-all hover:bg-muted",
                    config.accentColor === color.value ? "border-primary bg-muted" : "border-transparent"
                  )}
                  onClick={() => onConfigChange({ ...config, accentColor: color.value })}
                >
                  <div className={cn("h-4 w-4 rounded-full shrink-0 shadow-sm", color.class)} />
                  <span className="text-[10px] font-medium leading-tight text-left">{color.name}</span>
                  {config.accentColor === color.value && (
                    <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-2 w-2" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Radio de Bordes */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estética de Bordes</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={config.radius === 0 ? 'default' : 'outline'}
                className={cn(
                  "justify-start gap-2 border-2",
                  config.radius === 0 ? "border-primary" : "border-transparent"
                )}
                onClick={() => onConfigChange({ ...config, radius: 0 })}
              >
                <div className="h-4 w-4 border-2 border-current rounded-none" />
                <span className="text-xs italic">Industrial (Recto)</span>
              </Button>
              <Button
                variant={config.radius === 0.5 ? 'default' : 'outline'}
                className={cn(
                  "justify-start gap-2 border-2",
                  config.radius === 0.5 ? "border-primary" : "border-transparent"
                )}
                onClick={() => onConfigChange({ ...config, radius: 0.5 })}
              >
                <div className="h-4 w-4 border-2 border-current rounded-sm" />
                <span className="text-xs">Moderno (Redondeado)</span>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button className="w-full">Aplicar y Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

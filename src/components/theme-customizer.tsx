
'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { useTheme } from 'next-themes';
import { Check, Moon, Palette, Sun, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { themes, applyTheme, type CustomThemeConfig } from '@/lib/themes';


export default function ThemeCustomizer({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { theme: mode, resolvedTheme, setTheme } = useTheme();
  const [activeTheme, setActiveTheme] = useState('Violeta Profundo');
  const [activeRadius, setActiveRadius] = useState(0.5);

  const applyTheme = (config: CustomThemeConfig) => {
    const root = document.documentElement;
    if (config.colors) {
      for (const [key, value] of Object.entries(config.colors)) {
        root.style.setProperty(`--${key}`, value);
      }
    }
    if (config.radius !== undefined) {
      root.style.setProperty('--radius', `${config.radius}rem`);
    }
  };

  const handlePresetSelect = (themeName: string) => {
    const selected = themes.find(t => t.name === themeName);
    if (!selected) return;

    const colors = mode === 'dark' ? selected.dark : selected.light;
    
    applyTheme({ colors });
    setActiveTheme(themeName);
    localStorage.setItem('control7-theme-preset', themeName);
  };
  
  const handleRadiusChange = (value: number[]) => {
      const newRadius = value[0];
      applyTheme({ radius: newRadius });
      setActiveRadius(newRadius);
      localStorage.setItem('control7-radius', String(newRadius));
  };
  
  const handleReset = () => {
    localStorage.removeItem('control7-theme-preset');
    localStorage.removeItem('control7-radius');
    window.location.reload();
  }

  useEffect(() => {
    const preset = localStorage.getItem('control7-theme-preset') || 'Violeta Profundo';
    const radius = localStorage.getItem('control7-radius');

    const selectedTheme = themes.find(t => t.name === preset);
    if (selectedTheme) {
        const isDarkMode = document.documentElement.classList.contains('dark');
        applyTheme({ colors: isDarkMode ? selectedTheme.dark : selectedTheme.light });
        setActiveTheme(preset);
    }
    if (radius) {
        const numRadius = Number(radius);
        applyTheme({ radius: numRadius });
        setActiveRadius(numRadius);
    }
  }, []);

  useEffect(() => {
    const preset = localStorage.getItem('control7-theme-preset') || 'Violeta Profundo';
    const selectedTheme = themes.find(t => t.name === preset);
    
    if (selectedTheme) {
        const colors = resolvedTheme === 'dark' ? selectedTheme.dark : selectedTheme.light;
        applyTheme({ colors });
    }
  }, [resolvedTheme]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Palette/> Personalizar Apariencia</DialogTitle>
          <DialogDescription>
            Elige un tema y estilos para adaptar la aplicación a tu gusto.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-8">
            <div className="space-y-3">
                 <h3 className="font-semibold">Temas Recomendados</h3>
                 <ScrollArea className="h-48">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pr-4">
                        {themes.map((t) => (
                            <Card key={t.name} className="overflow-hidden cursor-pointer" onClick={() => handlePresetSelect(t.name)}>
                            <div className="p-4 space-y-2 relative">
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-black" style={{ background: `hsl(${t.light.primary})`}}></div>
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-black" style={{ background: `hsl(${t.light.background})`}}></div>
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-black" style={{ background: `hsl(${t.light.accent})`}}></div>
                                </div>
                                <p className="text-sm font-medium">{t.name}</p>
                                {activeTheme === t.name && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3" />
                                    </div>
                                )}
                            </div>
                            </Card>
                        ))}
                    </div>
                 </ScrollArea>
            </div>

            <div className="space-y-4">
                <h3 className="font-semibold">Apariencia</h3>
                <div className="flex gap-2">
                    <Button variant={mode === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')} className="flex-1">
                        <Sun className="mr-2 h-4 w-4"/> Claro
                    </Button>
                    <Button variant={mode === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')} className="flex-1">
                        <Moon className="mr-2 h-4 w-4"/> Oscuro
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                 <h3 className="font-semibold">Bordes</h3>
                 <div className="space-y-2">
                    <Label>Radio del Borde</Label>
                    <Slider value={[activeRadius]} max={2} min={0} step={0.1} onValueChange={handleRadiusChange} />
                 </div>
            </div>

            <Button variant="ghost" className="text-sm text-muted-foreground" onClick={handleReset}>
                <Undo2 className="mr-2 h-4 w-4"/> Restaurar a Valores por Defecto
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

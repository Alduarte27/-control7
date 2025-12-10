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

type Theme = {
  name: string;
  primary: { light: string; dark: string };
  background: { light: string; dark: string };
  accent: { light: string; dark: string };
};

const themes: Theme[] = [
  {
    name: 'Violeta Profundo',
    primary: { light: '261 39% 48%', dark: '261 39% 68%' },
    background: { light: '270 44% 95%', dark: '261 39% 10%' },
    accent: { light: '211 29% 79%', dark: '211 29% 40%' },
  },
  {
    name: 'Océano Nocturno',
    primary: { light: '221 83% 53%', dark: '217 91% 60%' },
    background: { light: '216 33% 97%', dark: '224 71% 4%' },
    accent: { light: '210 40% 96%', dark: '215 28% 17%' },
  },
  {
    name: 'Bosque Esmeralda',
    primary: { light: '142 76% 36%', dark: '143 71% 45%' },
    background: { light: '120 60% 97%', dark: '150 14% 10%' },
    accent: { light: '140 40% 96%', dark: '147 13% 17%' },
  },
  {
    name: 'Industrial',
    primary: { light: '240 6% 10%', dark: '0 0% 98%' },
    background: { light: '0 0% 94%', dark: '240 10% 4%' },
    accent: { light: '240 5% 96%', dark: '240 4% 16%' },
  },
];

type CustomThemeConfig = {
  primary: string;
  background: string;
  accent: string;
  radius: number;
};

const defaultHSL = {
    primary: '261 39% 48%',
    background: '270 44% 95%',
    accent: '211 29% 79%',
};

function hexToHsl(hex: string): string | null {
    if (!hex) return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    return `${h} ${s}% ${l}%`;
}

export default function ThemeCustomizer({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { theme, setTheme } = useTheme();
  const [activeTheme, setActiveTheme] = useState('Violeta Profundo');

  const applyTheme = (config: Partial<CustomThemeConfig>, isDarkMode: boolean) => {
    const root = document.documentElement;
    if (config.primary) root.style.setProperty('--primary', config.primary);
    if (config.background) root.style.setProperty('--background', config.background);
    if (config.accent) root.style.setProperty('--accent', config.accent);
    if (config.radius !== undefined) root.style.setProperty('--radius', `${config.radius}rem`);
  };

  const handlePresetSelect = (themeName: string) => {
    const selected = themes.find(t => t.name === themeName);
    if (!selected) return;

    const isDarkMode = document.documentElement.classList.contains('dark');
    const newConfig = {
      primary: isDarkMode ? selected.primary.dark : selected.primary.light,
      background: isDarkMode ? selected.background.dark : selected.background.light,
      accent: isDarkMode ? selected.accent.dark : selected.accent.light,
    };
    
    applyTheme(newConfig, isDarkMode);
    setActiveTheme(themeName);
    localStorage.setItem('control7-theme-preset', themeName);
    localStorage.removeItem('control7-custom-theme');
  };
  
  const handleRadiusChange = (value: number[]) => {
      const newRadius = value[0];
      applyTheme({ radius: newRadius }, theme === 'dark');
      localStorage.setItem('control7-radius', String(newRadius));
  };

  const handleReset = () => {
    localStorage.removeItem('control7-theme-preset');
    localStorage.removeItem('control7-custom-theme');
    localStorage.removeItem('control7-radius');
    window.location.reload();
  }

  useEffect(() => {
    const preset = localStorage.getItem('control7-theme-preset');
    const radius = localStorage.getItem('control7-radius');

    if (preset) {
        const selected = themes.find(t => t.name === preset);
        if (selected) {
            handlePresetSelect(preset);
        }
    }
    if (radius) {
        applyTheme({ radius: Number(radius) }, document.documentElement.classList.contains('dark'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]); // Re-apply preset when light/dark mode changes


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Palette/> Personalizar Apariencia</DialogTitle>
          <DialogDescription>
            Elige un tema o personaliza los colores y estilos a tu gusto.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
            <div className="space-y-3">
                 <h3 className="font-semibold">Temas Recomendados</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {themes.map((t) => (
                        <Card key={t.name} className="overflow-hidden cursor-pointer" onClick={() => handlePresetSelect(t.name)}>
                           <div className="p-4 space-y-2 relative">
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full" style={{ background: `hsl(${t.primary.light})`}}></div>
                                    <div className="w-6 h-6 rounded-full" style={{ background: `hsl(${t.background.light})`}}></div>
                                    <div className="w-6 h-6 rounded-full" style={{ background: `hsl(${t.accent.light})`}}></div>
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
            </div>

             <div className="space-y-4">
                <h3 className="font-semibold">Modo de Apariencia</h3>
                <div className="flex gap-2">
                    <Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')} className="flex-1">
                        <Sun className="mr-2 h-4 w-4"/> Claro
                    </Button>
                    <Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')} className="flex-1">
                        <Moon className="mr-2 h-4 w-4"/> Oscuro
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                 <h3 className="font-semibold">Bordes</h3>
                 <div className="space-y-2">
                    <Label>Radio del Borde</Label>
                    <Slider defaultValue={[0.5]} max={2} min={0} step={0.1} onValueChange={handleRadiusChange} />
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

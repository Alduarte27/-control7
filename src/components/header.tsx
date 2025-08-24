'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, Save, History, LayoutDashboard, Settings, Download, Sun, Moon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import InfoDialog from './info-dialog';


type HeaderProps = {
  onSave: () => void;
  onExport: () => void;
  hasUnsavedChanges: boolean;
  setIsInfoDialogOpen: (open: boolean) => void;
};

const NavButton = ({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string; }) => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <Link href={href}>
                    <Button variant="outline" className="w-10 h-10 p-0 md:w-auto md:h-auto md:px-4 md:py-2">
                        <Icon className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">{label}</span>
                    </Button>
                </Link>
            </TooltipTrigger>
            <TooltipContent className="md:hidden">
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);


export default function Header({ onSave, onExport, hasUnsavedChanges, setIsInfoDialogOpen }: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex items-center justify-between p-2 md:p-4 border-b bg-card sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <Factory className="h-8 w-8 text-primary" />
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Control 7</h1>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>
                </TooltipTrigger>
                 <TooltipContent className="md:hidden">
                    <p>Cambiar tema</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
        
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsInfoDialogOpen(true)}
                    >
                        <Info className="h-[1.2rem] w-[1.2rem]" />
                        <span className="sr-only">Información de la App</span>
                    </Button>
                </TooltipTrigger>
                 <TooltipContent className="md:hidden">
                    <p>Información</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>

        <NavButton href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavButton href="/history" icon={History} label="Historial" />
        <NavButton href="/admin" icon={Settings} label="Administración" />
        
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button onClick={onExport} variant="outline" className="w-10 h-10 p-0 md:w-auto md:h-auto md:px-4 md:py-2">
                        <Download className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Exportar CSV</span>
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="md:hidden">
                    <p>Exportar CSV</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button onClick={onSave} className="w-10 h-10 p-0 md:w-auto md:h-auto md:px-4 md:py-2 relative">
                        <Save className="h-4 w-4 md:mr-2" />
                        <span className="hidden md:inline">Guardar Plan</span>
                        {hasUnsavedChanges && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500"></span>}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="md:hidden">
                    <p>Guardar Plan</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, Save, History, LayoutDashboard, Settings, Download, Sun, Moon, Info, Sparkles, MoreVertical, HardHat, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ExportDialog from './export-dialog';

type HeaderProps = {
  onSave: () => void;
  hasUnsavedChanges: boolean;
  setIsInfoDialogOpen: (open: boolean) => void;
};

const NavButton = ({ href, icon: Icon, label, tooltipText }: { href: string; icon: React.ElementType; label: string; tooltipText: string; }) => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <Link href={href}>
                    <Button variant="outline" className="w-10 h-10 p-0 lg:w-auto lg:px-4">
                        <Icon className="h-4 w-4 lg:mr-2" />
                        <span className="hidden lg:inline">{label}</span>
                    </Button>
                </Link>
            </TooltipTrigger>
            <TooltipContent className="lg:hidden">
                <p>{tooltipText}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

export default function Header({ onSave, hasUnsavedChanges, setIsInfoDialogOpen }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);

  return (
    <>
      <header className="flex items-center justify-between p-2 md:p-4 border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-2 md:gap-3">
          <Factory className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          <h1 className="text-lg md:text-2xl font-bold text-foreground">Control 7</h1>
        </div>
        
        {/* Desktop & Tablet Navigation */}
        <div className="hidden md:flex items-center gap-1 md:gap-2">
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
                  <TooltipContent>
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
                  <TooltipContent>
                      <p>Información</p>
                  </TooltipContent>
              </Tooltip>
          </TooltipProvider>
          
          <NavButton href="/ia" icon={Sparkles} label="Operaciones" tooltipText="Operaciones y Simulación" />
          <NavButton href="/dashboard" icon={LayoutDashboard} label="Dashboard" tooltipText="Dashboard General" />
          <NavButton href="/stops" icon={HardHat} label="Bitácora" tooltipText="Bitácora de Producción" />
          <NavButton href="/oee" icon={Activity} label="OEE" tooltipText="Análisis de Paradas" />
          <NavButton href="/history" icon={History} label="Historial" tooltipText="Historial de Planes" />
          <NavButton href="/admin" icon={Settings} label="Admin" tooltipText="Administración" />
          
          <TooltipProvider>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Button onClick={() => setIsExportDialogOpen(true)} variant="outline" className="w-10 h-10 p-0 lg:w-auto lg:px-4">
                          <Download className="h-4 w-4 lg:mr-2" />
                          <span className="hidden lg:inline">Exportar / Reportes</span>
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Exportar / Reportes</p>
                  </TooltipContent>
              </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Button onClick={onSave} className="w-10 h-10 p-0 lg:w-auto lg:px-4 relative">
                          <Save className="h-4 w-4 lg:mr-2" />
                          <span className="hidden lg-inline">Guardar</span>
                          {hasUnsavedChanges && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500"></span>}
                      </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                      <p>Guardar Plan</p>
                  </TooltipContent>
              </Tooltip>
          </TooltipProvider>
        </div>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center gap-1">
            <Button onClick={onSave} size="icon" className="relative">
                <Save className="h-4 w-4" />
                {hasUnsavedChanges && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500"></span>}
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild><Link href="/ia" className="flex items-center"><Sparkles className="mr-2 h-4 w-4" />Operaciones</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard" className="flex items-center"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/stops" className="flex items-center"><HardHat className="mr-2 h-4 w-4" />Bitácora</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/oee" className="flex items-center"><Activity className="mr-2 h-4 w-4" />OEE</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/history" className="flex items-center"><History className="mr-2 h-4 w-4" />Historial</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/admin" className="flex items-center"><Settings className="mr-2 h-4 w-4" />Admin</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsExportDialogOpen(true)}><Download className="mr-2 h-4 w-4" />Exportar / Reportes</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsInfoDialogOpen(true)}><Info className="mr-2 h-4 w-4" />Información</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                          {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                          <span>Cambiar Tema</span>
                      </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>
      <ExportDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen} />
    </>
  );
}

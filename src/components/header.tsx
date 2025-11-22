
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Factory, Save, History, LayoutDashboard, Settings, Download, Sun, Moon, Info, Sparkles, MoreVertical, HardHat, Activity, CalendarCheck2, Boxes, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ExportDialog from './export-dialog';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from './ui/skeleton';

type NavButtonProps = { 
  href: string; 
  icon: React.ElementType; 
  label: string; 
  tooltipText: string; 
  isVisible: boolean;
};

const NavButton = ({ href, icon: Icon, label, tooltipText, isVisible }: NavButtonProps) => {
  if (!isVisible) return null;
  return (
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
};

const MobileNavItem = ({ href, icon: Icon, label, isVisible }: { href: string; icon: React.ElementType; label: string; isVisible: boolean }) => {
    if (!isVisible) return null;
    return (
        <DropdownMenuItem asChild>
            <Link href={href} className="flex items-center">
                <Icon className="mr-2 h-4 w-4" />{label}
            </Link>
        </DropdownMenuItem>
    );
};


type UserPermissions = {
    [key: string]: boolean;
};

export default function Header({ onSave, hasUnsavedChanges, setIsInfoDialogOpen }: {
  onSave: () => void;
  hasUnsavedChanges: boolean;
  setIsInfoDialogOpen: (open: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  useEffect(() => {
    const profileIdFromUrl = searchParams.get('profileId');
    let profileId: string | null = null;

    if (profileIdFromUrl) {
        localStorage.setItem('userProfileId', profileIdFromUrl);
        profileId = profileIdFromUrl;

        // Clean the URL
        const newParams = new URLSearchParams(window.location.search);
        newParams.delete('profileId');
        const newUrl = window.location.pathname + (newParams.toString() ? `?${newParams.toString()}` : '');
        router.replace(newUrl, { scroll: false });
    } else {
        profileId = localStorage.getItem('userProfileId');
    }

    if (profileId) {
        const fetchPermissions = async () => {
            setLoadingPermissions(true);
            try {
                const profileDoc = await getDoc(doc(db, 'accessProfiles', profileId!));
                if (profileDoc.exists()) {
                    setPermissions(profileDoc.data().permissions || {});
                } else {
                    // Profile not found, remove from local storage and grant full access
                    localStorage.removeItem('userProfileId');
                    setPermissions({});
                }
            } catch (error) {
                console.error("Error fetching permissions:", error);
                setPermissions({}); // Default to full access on error
            }
            setLoadingPermissions(false);
        };
        fetchPermissions();
    } else {
        // No profile, grant full access
        setPermissions({});
        setLoadingPermissions(false);
    }
  }, [searchParams, router]);
  
  const hasPermission = (moduleId: string) => {
      // If permissions object is null (loading) or empty (full access), grant permission
      return permissions === null || Object.keys(permissions).length === 0 || permissions[moduleId];
  };

  const navModules = [
      { id: 'ia', href: '/ia', icon: Sparkles, label: 'Operaciones', tooltip: 'Operaciones y Simulación' },
      { id: 'dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', tooltip: 'Dashboard General' },
      { id: 'stops', href: '/stops', icon: HardHat, label: 'Bitácora', tooltip: 'Bitácora de Producción' },
      { id: 'materials', href: '/materials', icon: Boxes, label: 'Materiales', tooltip: 'Control de Materiales' },
      { id: 'history', href: '/history', icon: History, label: 'Historial Planes', tooltip: 'Historial de Planes' },
      { id: 'access', href: '/access', icon: Shield, label: 'Acceso', tooltip: 'Gestión de Acceso' },
      { id: 'admin', href: '/admin', icon: Settings, label: 'Admin', tooltip: 'Administración' },
  ];

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
          
            {loadingPermissions ? (
              <>
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </>
            ) : (
                navModules.map(mod => (
                    <NavButton
                        key={mod.id}
                        href={mod.href}
                        icon={mod.icon}
                        label={mod.label}
                        tooltipText={mod.tooltip}
                        isVisible={hasPermission(mod.id)}
                    />
                ))
            )}
          
            {hasPermission('export') && (
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
            )}

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
                    {loadingPermissions ? <DropdownMenuItem>Cargando...</DropdownMenuItem> : navModules.map(mod => (
                       <MobileNavItem
                          key={mod.id}
                          href={mod.href}
                          icon={mod.icon}
                          label={mod.label}
                          isVisible={hasPermission(mod.id)}
                        />
                    ))}
                    {hasPermission('export') && (
                      <DropdownMenuItem onClick={() => setIsExportDialogOpen(true)}><Download className="mr-2 h-4 w-4" />Exportar / Reportes</DropdownMenuItem>
                    )}
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

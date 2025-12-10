'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Factory, Save, History, LayoutDashboard, Settings, Download, Sun, Moon, Info, Sparkles, MoreVertical, HardHat, Activity, CalendarCheck2, Boxes, Shield, Package, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from './ui/skeleton';
import ThemeCustomizer from './theme-customizer';

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
  const searchParams = useSearchParams();
  const router = useRouter();

  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  useEffect(() => {
    const profileIdFromUrl = searchParams.get('profileId');
    let profileId: string | null = null;

    if (profileIdFromUrl) {
        localStorage.setItem('userProfileId', profileIdFromUrl);
        profileId = profileIdFromUrl;

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
                    localStorage.removeItem('userProfileId');
                    setPermissions({});
                }
            } catch (error) {
                console.error("Error fetching permissions:", error);
                setPermissions({}); 
            }
            setLoadingPermissions(false);
        };
        fetchPermissions();
    } else {
        setPermissions({});
        setLoadingPermissions(false);
    }
  }, [searchParams, router]);
  
  const hasPermission = (moduleId: string) => {
      return permissions === null || Object.keys(permissions).length === 0 || permissions[moduleId];
  };

  const navModules = [
      { id: 'ia', href: '/ia', icon: Sparkles, label: 'Operaciones', tooltip: 'Operaciones y Simulación' },
      { id: 'dashboard', href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', tooltip: 'Dashboard General' },
      { id: 'stops', href: '/stops', icon: HardHat, label: 'Bitácora', tooltip: 'Bitácora de Producción' },
      { id: 'materials', href: '/materials', icon: Boxes, label: 'Material Empaque', tooltip: 'Control de Materiales de Empaque' },
      { id: 'melaza', href: '/material-melaza', icon: Package, label: 'Material Melaza', tooltip: 'Control de Sacos de Melaza' },
      { id: 'admin', href: '/admin', icon: Settings, label: 'Admin', tooltip: 'Administración' },
  ];

  return (
    <>
      <header className="flex items-center justify-between p-2 md:p-4 border-b bg-card sticky top-0 z-20">
        <div className="flex items-center gap-2 md:gap-3">
          <Factory className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          <h1 className="text-lg md:text-2xl font-bold text-foreground">Control 7</h1>
        </div>
        
        <div className="hidden md:flex items-center flex-wrap justify-end gap-1 md:gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsCustomizerOpen(true)}
                        >
                            <Palette className="h-[1.2rem] w-[1.2rem]" />
                            <span className="sr-only">Personalizar Apariencia</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Personalizar Apariencia</p>
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
                    <DropdownMenuItem onClick={() => setIsCustomizerOpen(true)}><Palette className="mr-2 h-4 w-4" />Apariencia</DropdownMenuItem>
                    {hasPermission('export') && (
                      <DropdownMenuItem><Download className="mr-2 h-4 w-4" />Exportar / Reportes</DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setIsInfoDialogOpen(true)}><Info className="mr-2 h-4 w-4" />Información</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>
      <ThemeCustomizer open={isCustomizerOpen} onOpenChange={setIsCustomizerOpen} />
    </>
  );
}

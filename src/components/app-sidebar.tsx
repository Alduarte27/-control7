'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { 
  Factory, 
  Activity,
  LayoutDashboard, 
  Boxes,
  Settings, 
  Target,
  ChevronLeft,
  ChevronRight,
  Palette,
  Info,
  Gauge,
  HardHat,
  Sparkles
} from 'lucide-react';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar
} from '@/components/ui/sidebar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import ThemeCustomizer from './theme-customizer';
import InfoDialog from './info-dialog';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';

type UserPermissions = {
    [key: string]: boolean;
};

const navModules = [
    { id: 'production', href: '/', icon: Factory, label: 'Producción' },
    { id: 'projection', href: '/ia?view=projection', icon: Target, label: 'Proyección' },
    { id: 'materials', href: '/materials', icon: Boxes, label: 'Materiales Empaque' },
    { id: 'stops', href: '/stops', icon: HardHat, label: 'Bitácora' },
    { id: 'ia', href: '/ia', icon: Activity, label: 'Simulador' },
];

export function AppSidebar() {
  const { proceedTo } = useUnsavedChanges();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state, isMobile, setOpen } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

  useEffect(() => {
    const showDialogPreference = localStorage.getItem('showInfoDialogOnStartup');
    const hasBeenShownThisSession = sessionStorage.getItem('infoDialogShownThisSession');

    if ((showDialogPreference === null || showDialogPreference === 'true') && !hasBeenShownThisSession) {
      setIsInfoDialogOpen(true);
      sessionStorage.setItem('infoDialogShownThisSession', 'true');
    }
  }, []);

  useEffect(() => {
    const profileIdFromUrl = searchParams.get('profileId');
    let profileId: string | null = null;

    if (profileIdFromUrl) {
        localStorage.setItem('userProfileId', profileIdFromUrl);
        profileId = profileIdFromUrl;
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
                    setPermissions({});
                }
            } catch (error) {
                console.error("Error fetching permissions for sidebar:", error);
                setPermissions({}); 
            }
            setLoadingPermissions(false);
        };
        fetchPermissions();
    } else {
        setPermissions({});
        setLoadingPermissions(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isMobile && state === 'expanded') {
        const target = e.target as Element;
        if (!target.closest('[data-sidebar="sidebar"]')) {
          setOpen(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, state, setOpen]);

  const hasPermission = (moduleId: string) => {
      return permissions === null || Object.keys(permissions).length === 0 || permissions[moduleId];
  };

  const isItemActive = (href: string) => {
    if (href === '/ia?view=projection') {
      return pathname === '/ia' && searchParams.get('view') === 'projection';
    }
    if (href === '/ia') {
      return pathname === '/ia' && !searchParams.get('view');
    }
    return pathname === href;
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className="border-r sidebar-smooth"
      onDoubleClick={() => !isMobile && state === 'collapsed' && setOpen(true)}
    >
      <SidebarHeader className="h-16 flex items-center justify-center border-b px-4 bg-gradient-to-b from-card/50 to-transparent backdrop-blur-sm">
        <div className="flex items-center gap-3 w-full overflow-hidden">
          <div className="flex items-center justify-center min-w-8 h-8 rounded-lg bg-primary shadow-lg shadow-primary/20 text-primary-foreground shrink-0 sidebar-icon-pulse">
            <Gauge className="h-5 w-5" />
          </div>
          {!isCollapsed && (
            <span className="font-bold text-lg truncate bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 sidebar-label-enter">
              Control 7 SGP
            </span>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={cn(isCollapsed && "hidden")}>
            Navegación
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {loadingPermissions ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuItem key={i} className="px-2 py-1">
                    <Skeleton className="h-8 w-full" />
                  </SidebarMenuItem>
                ))
              ) : (
                navModules.map((item) => {
                  const visible = hasPermission(item.id);
                  if (!visible) return null;
                  
                  const active = isItemActive(item.href);
                  
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "transition-all duration-300 rounded-xl mx-1 my-0.5",
                          active 
                            ? "bg-primary shadow-md shadow-primary/20 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active-btn-pulse" 
                            : "hover:bg-primary/10 hover:text-primary"
                        )}
                      >
                        <Link 
                          href={item.href} 
                          className="flex items-center gap-3 py-2 px-3"
                          onClick={(e) => {
                            e.preventDefault();
                            if (item.id === 'projection') {
                              localStorage.setItem('control7_projections_cleared', 'true');
                            }
                            proceedTo(item.href);
                          }}
                        >
                          <item.icon className={cn("h-5 w-5 shrink-0 sidebar-icon-pulse", active ? "text-primary-foreground" : "text-muted-foreground")} />
                          {!isCollapsed && (
                            <span className="font-medium sidebar-label-enter">
                              {item.label}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

            <SidebarGroup className="mt-auto pb-4">
          <SidebarGroupLabel className={cn(isCollapsed && "hidden", "px-4")}>
            Herramientas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/ai'}
                  tooltip="Asistente IA"
                  className={cn(
                    "rounded-xl mx-1 transition-all duration-300",
                    pathname === '/ai'
                      ? "bg-primary shadow-md shadow-primary/20 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Link
                    href="/ai"
                    className="flex items-center gap-3"
                    onClick={(e) => {
                      e.preventDefault();
                      proceedTo('/ai');
                    }}
                  >
                    <Sparkles className={cn("h-4 w-4 ml-1", pathname === '/ai' ? "text-primary-foreground" : "")} />
                    <span>Asistente IA</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {hasPermission('admin') && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild
                    isActive={pathname === '/admin'}
                    tooltip="Configuración de Sistema"
                    className={cn(
                      "rounded-xl mx-1 transition-all duration-300",
                      pathname === '/admin' 
                        ? "bg-primary shadow-md shadow-primary/20 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" 
                        : "hover:bg-primary/10 hover:text-primary"
                    )}
                  >
                    <Link 
                      href="/admin" 
                      className="flex items-center gap-3"
                      onClick={(e) => {
                        e.preventDefault();
                        proceedTo('/admin');
                      }}
                    >
                      <Settings className={cn("h-4 w-4 ml-1", pathname === '/admin' ? "text-primary-foreground" : "")} />
                      <span>Configuración</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => setIsCustomizerOpen(true)}
                  tooltip="Personalizar Apariencia"
                  className="rounded-xl mx-1 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                >
                  <Palette className="h-4 w-4 ml-1" />
                  <span>Personalizar</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => setIsInfoDialogOpen(true)}
                  tooltip="Información de la App"
                  className="rounded-xl mx-1 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                >
                  <Info className="h-4 w-4 ml-1" />
                  <span>Información</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t p-4 bg-muted/20 backdrop-blur-sm">
        {!isCollapsed && (
          <div className="text-[10px] text-muted-foreground text-center font-medium tracking-wider uppercase">
            v1.0.0 &copy; 2026 Control 7 SGP
          </div>
        )}
      </SidebarFooter>

      <ThemeCustomizer open={isCustomizerOpen} onOpenChange={setIsCustomizerOpen} />
      <InfoDialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen} />
    </Sidebar>
  );
}

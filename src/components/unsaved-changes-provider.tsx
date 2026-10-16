'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

type UnsavedChangesContextType = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
  proceedTo: (href: string) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const router = useRouter();

  // Also listen to beforeunload globally
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const proceedTo = (href: string) => {
    if (hasUnsavedChanges) {
      setPendingHref(href);
    } else {
      router.push(href);
    }
  };

  const handleConfirm = () => {
    setHasUnsavedChanges(false);
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  };

  const handleCancel = () => {
    setPendingHref(null);
  };

  return (
    <UnsavedChangesContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges, proceedTo }}>
      {children}
      
      <AlertDialog open={pendingHref !== null} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent className="border border-destructive/20 max-w-[400px] rounded-2xl">
          <AlertDialogHeader className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center p-3 rounded-full bg-destructive/10 text-destructive mb-3 animate-pulse">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-lg font-bold">¿Descartar cambios sin guardar?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
              Tienes cambios pendientes de guardar. Si sales ahora, perderás toda la información ingresada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 mt-4 sm:flex-row sm:justify-end">
            <AlertDialogCancel 
              onClick={handleCancel}
              className="mt-0 border border-muted hover:bg-muted/50 rounded-xl"
            >
              Volver y guardar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirm}
              className="bg-destructive hover:bg-destructive/90 text-white shadow-sm shadow-destructive/20 rounded-xl"
            >
              Sí, salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
}

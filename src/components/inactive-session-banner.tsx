'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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

export function InactiveSessionBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 10 minutes for tab backgrounding, 10 minutes for general idle
    const TAB_INACTIVITY_LIMIT = 10 * 60 * 1000;
    const IDLE_LIMIT = 10 * 60 * 1000;

    let lastInteractionTime = Date.now();
    let hiddenTime = 0;
    let idleTimeout: NodeJS.Timeout;

    const resetIdleTimer = () => {
      const now = Date.now();
      
      // If we were idle for too long and user interacts again, show the banner
      if (now - lastInteractionTime > IDLE_LIMIT) {
        setShowBanner(true);
      }
      
      lastInteractionTime = now;
      clearTimeout(idleTimeout);
      
      idleTimeout = setTimeout(() => {
        // User has been idle for IDLE_LIMIT without interaction
        setShowBanner(true);
      }, IDLE_LIMIT);
    };

    // Initialize idle timer
    idleTimeout = setTimeout(() => {
      setShowBanner(true);
    }, IDLE_LIMIT);

    // Track user interactions
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    });

    // Track visibility changes (tab active/inactive)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else {
        if (hiddenTime > 0) {
          const inactiveDuration = Date.now() - hiddenTime;
          if (inactiveDuration > TAB_INACTIVITY_LIMIT) {
            setShowBanner(true);
          }
          hiddenTime = 0; // reset
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(idleTimeout);
      events.forEach(event => {
        window.removeEventListener(event, resetIdleTimer);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <AlertDialog open={showBanner} onOpenChange={setShowBanner}>
      <AlertDialogContent className="border border-destructive/20 max-w-[400px] rounded-2xl">
        <AlertDialogHeader className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center p-3 rounded-full bg-destructive/10 text-destructive mb-3 animate-pulse">
            <RefreshCw className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-lg font-bold">¡Bienvenido de vuelta!</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
            La sesión ha estado inactiva. Para asegurar que tienes los últimos datos, te recomendamos recargar la página.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-2 gap-2 mt-4 sm:flex-row sm:justify-end">
          <AlertDialogCancel 
            onClick={() => setShowBanner(false)}
            className="mt-0 border border-muted hover:bg-muted/50 rounded-xl"
          >
            Ignorar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => window.location.reload()}
            className="bg-destructive hover:bg-destructive/90 text-white shadow-sm shadow-destructive/20 rounded-xl"
          >
            Recargar página
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

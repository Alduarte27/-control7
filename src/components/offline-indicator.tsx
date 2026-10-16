'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    // Verificar estado inicial
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setShowBackOnline(true);
      // Ocultar mensaje de "conexión restaurada" después de 3 segundos
      setTimeout(() => setShowBackOnline(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowBackOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showBackOnline) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out`}>
      <div 
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium ${
          isOffline 
            ? 'bg-red-500/90 text-white backdrop-blur-md border border-red-400' 
            : 'bg-green-500/90 text-white backdrop-blur-md border border-green-400'
        }`}
      >
        {isOffline ? (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Sin conexión - Cambios guardados localmente</span>
          </>
        ) : (
          <>
            <Wifi className="h-4 w-4" />
            <span>Conexión restaurada - Sincronizando...</span>
          </>
        )}
      </div>
    </div>
  );
}

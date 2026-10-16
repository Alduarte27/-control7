'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface SplashScreenProps {
  appName?: string;
  isFinishing?: boolean;
}

const MESSAGES = [
  "Iniciando el sistema...",
  "Conectando a servicios en la nube...",
  "Autenticando usuario...",
  "Descargando catálogos de productos...",
  "Cargando registros de producción...",
  "Calculando métricas y KPIs...",
  "Sincronizando configuraciones...",
  "Preparando interfaz de usuario..."
];

export default function SplashScreen({ appName = "Control 7 SGP", isFinishing = false }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (isFinishing) {
      setProgress(100);
      return;
    }

    // Animate progress smoothly but randomly to simulate real loading
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress >= 90) {
          return 90; // Hold at 90% until the parent component finishes actual loading
        }
        // Slower increment to match the 7.5s duration
        const diff = Math.random() * 8 + 3;
        return Math.min(oldProgress + diff, 90);
      });
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, [isFinishing]);

  useEffect(() => {
    // Cycle through messages while loading
    const messageTimer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 1000); // Change message every 1000ms

    return () => clearInterval(messageTimer);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Esferas de luz desvanecidas (Background Blobs) */}
      <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/20 blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-sky-500/20 blur-[140px] animate-pulse pointer-events-none" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      <div className="absolute top-[20%] right-[10%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/15 blur-[100px] animate-pulse pointer-events-none" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      
      {/* Main Content */}
      <div className="flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-700 max-w-md w-full px-8 relative z-10 backdrop-blur-sm">
        {/* Logo Container */}
        <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-primary/60 shadow-2xl shadow-primary/30 ring-1 ring-primary/20">
          <img src="/icon.svg" alt="App Logo" className="h-16 w-16 animate-pulse object-contain" />
          <div className="absolute -bottom-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-xl ring-1 ring-border">
             <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        </div>
        
        {/* Texts */}
        <div className="flex flex-col items-center space-y-3 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-sky-600">
            {appName}
          </h1>
          <p className="text-muted-foreground text-sm font-medium animate-pulse">
            {MESSAGES[messageIndex]}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-2 pt-4">
           <Progress value={progress} className="h-2.5 w-full rounded-full overflow-hidden bg-primary/10" />
           <div className="flex justify-end">
              <span className="text-xs font-bold text-muted-foreground">{Math.round(progress)}%</span>
           </div>
        </div>
      </div>
    </div>
  );
}

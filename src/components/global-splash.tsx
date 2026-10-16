'use client';

import React, { useState, useEffect } from 'react';
import SplashScreen from './splash-screen';

export function GlobalSplash() {
  // Inicializamos en true para que el HTML inicial (SSR) lo contenga
  // y no haya un parpadeo del contenido de la app antes de la hidratación.
  const [show, setShow] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    
    if (!hasSeenSplash) {
      setShow(true);
      // Simulate the time it takes to load all global data and records
      // The progress bar inside SplashScreen takes care of the visual animation
      // Start the timers
      const finishTimer = setTimeout(() => {
        setIsFinishing(true);
      }, 7500); // Trigger the jump to 100%

      const hideTimer = setTimeout(() => {
        setShow(false);
        sessionStorage.setItem('hasSeenSplash', 'true');
      }, 8200); // Hide completely after it reached 100%
      
      return () => {
        clearTimeout(finishTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  return (
    <div id="global-splash-wrapper" suppressHydrationWarning>
      <SplashScreen appName="Control 7 SGP" isFinishing={isFinishing} />
    </div>
  );
}

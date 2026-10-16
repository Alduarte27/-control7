'use client';

import { useEffect } from 'react';
import { applyTheme, CustomThemeConfig } from '@/lib/themes';

export function ThemeInitializer() {
  useEffect(() => {
    // Desactivar el menú contextual del navegador para emular aplicación nativa
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);

    // Registrar Service Worker para PWA (instalación)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registrado con alcance:', reg.scope))
        .catch((err) => console.error('Error al registrar Service Worker:', err));
    }

    // Intentar cargar la configuración del tema desde localStorage
    const savedConfig = localStorage.getItem('theme-config');
    if (savedConfig) {
      try {
        const config: CustomThemeConfig = JSON.parse(savedConfig);
        applyTheme(config);
      } catch (e) {
        console.error('Error al inicializar el tema:', e);
      }
    }

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return null;
}

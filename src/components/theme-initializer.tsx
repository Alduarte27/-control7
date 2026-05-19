'use client';

import { useEffect } from 'react';
import { applyTheme, CustomThemeConfig } from '@/lib/themes';

export function ThemeInitializer() {
  useEffect(() => {
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
  }, []);

  return null;
}

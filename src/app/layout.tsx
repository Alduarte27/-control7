import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Control 7 SGP',
  description: 'Sistema de Gestión de Producción',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
};

import React, { Suspense } from 'react';

import { ThemeInitializer } from '@/components/theme-initializer';
import { InactiveSessionBanner } from '@/components/inactive-session-banner';
import { UnsavedChangesProvider } from '@/components/unsaved-changes-provider';
import { GlobalSplash } from '@/components/global-splash';
import { OfflineIndicator } from '@/components/offline-indicator';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedConfig = localStorage.getItem('theme-config');
                if (savedConfig) {
                  const config = JSON.parse(savedConfig);
                  const root = document.documentElement;
                  if (config.colors) {
                    for (const [key, value] of Object.entries(config.colors)) {
                      root.style.setProperty('--' + key, value);
                    }
                  }
                  if (config.radius !== undefined) {
                    root.style.setProperty('--radius', config.radius + 'rem');
                  }
                }
                
                if (sessionStorage.getItem('hasSeenSplash')) {
                  document.documentElement.classList.add('hide-splash');
                }
              } catch (e) {}
            `,
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: `
          .hide-splash #global-splash-wrapper {
            display: none !important;
          }
        `}} />
      </head>
      <body className={cn('font-sans antialiased', inter.variable)}>
        <GlobalSplash />
        <ThemeInitializer />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <UnsavedChangesProvider>
            <SidebarProvider defaultOpen={false}>
              <Suspense fallback={<div className="w-[var(--sidebar-width)] h-full bg-sidebar animate-pulse" />}>
                <AppSidebar />
              </Suspense>
              <SidebarInset>
                <Suspense fallback={<div className="flex-1 h-full animate-pulse bg-muted" />}>
                  {children}
                </Suspense>
              </SidebarInset>
            </SidebarProvider>
            <Toaster />
            <InactiveSessionBanner />
            <OfflineIndicator />
          </UnsavedChangesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

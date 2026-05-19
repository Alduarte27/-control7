import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Control 7',
  description: 'Planificación y Seguimiento de la Producción',
};

import React, { Suspense } from 'react';

import { ThemeInitializer } from '@/components/theme-initializer';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head />
      <body className={cn('font-sans antialiased', inter.variable)}>
        <ThemeInitializer />
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
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
        </ThemeProvider>
      </body>
    </html>
  );
}

'use client';

import React from 'react';
import { Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';


export default function Header({ onSave, hasUnsavedChanges = false, children, title, icon: Icon, centerTitle = false, onBack }: {
  onSave?: () => void;
  hasUnsavedChanges?: boolean;
  children?: React.ReactNode;
  title?: string;
  icon?: React.ElementType;
  centerTitle?: boolean;
  onBack?: () => void;
}) {

  return (
    <>
      <header className="flex items-center justify-between p-2 md:p-4 border-b bg-card/80 backdrop-blur-md sticky top-0 z-20 relative">
        {/* Left-aligned title (default) */}
        {!centerTitle && (
          <div className="flex items-center gap-2 md:gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 flex-shrink-0" title="Volver">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {title && (
              <h1 className="text-sm md:text-lg font-bold text-foreground truncate max-w-[200px] sm:max-w-none ml-1">{title}</h1>
            )}
          </div>
        )}
        {/* Centered title */}
        {centerTitle && (
          <>
            <div className="flex items-center gap-2 md:gap-3 invisible">
              <div className="h-8 w-8" />
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
              {title && (
                <h1 className="text-sm md:text-lg font-black text-foreground truncate max-w-[300px] sm:max-w-none uppercase tracking-wide">{title}</h1>
              )}
            </div>
          </>
        )}
        
        <div className="flex items-center gap-2">
            {children}

            {onSave && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                              onClick={onSave} 
                              size="icon"
                              className={cn(
                                "relative h-8 w-8 overflow-hidden transition-all duration-300",
                                hasUnsavedChanges ? "bg-primary hover:bg-primary/90 shadow-lg scale-105" : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                              disabled={!hasUnsavedChanges}
                            >
                                <Save className="h-4 w-4" />
                                {hasUnsavedChanges && (
                                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{hasUnsavedChanges ? 'Guardar Cambios' : 'No hay cambios'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
      </header>
    </>
  );
}

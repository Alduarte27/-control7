'use client';

import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';


export default function Header({ onSave, hasUnsavedChanges = false, children, title, icon: Icon }: {
  onSave?: () => void;
  hasUnsavedChanges?: boolean;
  children?: React.ReactNode;
  title?: string;
  icon?: React.ElementType;
}) {

  return (
    <>
      <header className="flex items-center justify-between p-2 md:p-4 border-b bg-card/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2 md:gap-3">
          {Icon && (
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
          {title && (
            <h1 className="text-sm md:text-lg font-bold text-foreground truncate max-w-[200px] sm:max-w-none ml-1">{title}</h1>
          )}
        </div>
        
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

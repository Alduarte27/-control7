'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot } from 'lucide-react';
import type { SuggestPlanOutput } from '@/ai/flows/suggest-plan-flow';

type SuggestionDialogProps = {
  suggestion: SuggestPlanOutput;
  onClose: () => void;
  onApply: () => void;
};

export default function SuggestionDialog({ suggestion, onClose, onApply }: SuggestionDialogProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Bot className="h-7 w-7 text-primary" />
            Sugerencia del Asistente de IA
          </DialogTitle>
          <DialogDescription>
            He analizado el historial de producción reciente y he preparado la siguiente sugerencia para el plan de esta semana.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[50vh] pr-6 -mr-6">
            <div className="space-y-4 py-4">
                <h3 className="font-semibold text-lg">Análisis de Producción</h3>
                <div className="prose prose-sm dark:prose-invert bg-muted/50 p-4 rounded-md">
                    {suggestion.analysis.split('\n').map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                    ))}
                </div>
            </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={onApply}>Aplicar Sugerencias</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import React from 'react';

const TimeBar = ({
  color,
  label,
  lossLabel,
  lossAmount,
  lossExamples,
  isTotal = false,
  isFinal = false,
}: {
  color: string;
  label: string;
  lossLabel?: string;
  lossAmount?: string;
  lossExamples?: string;
  isTotal?: boolean;
  isFinal?: boolean;
}) => {
  const lossPercentage = isFinal ? 'w-[20%]' : 'w-[25%]';

  return (
    <div className="flex items-center gap-2 md:gap-4">
      <div className={cn("h-8 rounded-sm", isTotal ? 'bg-gray-300 w-full' : 'w-[75%]', color)}>
        <span className="flex items-center justify-center h-full text-xs font-semibold text-black/80">{label}</span>
      </div>
      {lossLabel && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn("h-8 flex-shrink-0 rounded-sm bg-red-500", lossPercentage)}>
                <span className="flex items-center justify-center h-full text-xs font-semibold text-white/90">{lossLabel}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-bold">{lossAmount}</p>
              <p className="text-xs text-muted-foreground">{lossExamples}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

const FactorCard = ({
  title,
  formula,
  children,
  color,
}: {
  title: string;
  formula: string;
  children: React.ReactNode;
  color: string;
}) => (
  <div className="flex flex-col md:flex-row items-start gap-4">
    <div className={cn("p-4 rounded-lg text-center w-full md:w-40 flex-shrink-0", color)}>
      <h3 className="font-bold text-lg text-white">{title}</h3>
      <p className="text-sm text-white/80 font-mono">{formula}</p>
    </div>
    <div className="w-full space-y-2">{children}</div>
  </div>
);

export default function OeeExplanation() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            ¿Cómo se calcula el OEE?
        </CardTitle>
        <CardDescription>
            El OEE descompone la eficiencia en tres factores: Disponibilidad, Rendimiento y Calidad. Pasa el ratón sobre las pérdidas para ver ejemplos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {/* Tiempo Total */}
        <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg text-center w-full md:w-40 flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                <h3 className="font-semibold">Planificación</h3>
            </div>
            <div className="w-full">
                <TimeBar color="bg-gray-300 dark:bg-gray-600" label="Tiempo Total" isTotal />
            </div>
        </div>

        {/* Disponibilidad */}
        <FactorCard title="Disponibilidad" formula="(B / A)" color="bg-blue-500">
          <TimeBar
            color="bg-blue-400"
            label="A: Tiempo disponible"
            lossLabel="Tiempo de paro planificado"
            lossAmount="Pérdidas por Disponibilidad"
            lossExamples="Refrigerio, Mantenimiento Preventivo, Reuniones"
          />
          <TimeBar
            color="bg-blue-400"
            label="B: Tiempo productivo"
            lossLabel="Tiempo muerto"
            lossAmount="Pérdidas por Paradas No Planificadas"
            lossExamples="Arranque, cambios de producto, averías, esperas"
          />
        </FactorCard>

        {/* Rendimiento */}
        <FactorCard title="Rendimiento" formula="(D / C)" color="bg-yellow-500">
            <p className="text-xs text-muted-foreground pl-1">Capacidad productiva = Tiempo productivo * Velocidad teórica</p>
          <TimeBar
            color="bg-yellow-400"
            label="C: Capacidad productiva"
          />
          <TimeBar
            color="bg-yellow-400"
            label="D: Producción Real"
            lossLabel="Pérdidas de velocidad"
            lossAmount="Pérdidas por Rendimiento"
            lossExamples="Velocidad reducida, microparadas"
          />
        </FactorCard>

        {/* Calidad */}
        <FactorCard title="Calidad" formula="(F / E)" color="bg-green-600">
           <TimeBar
            color="bg-green-500"
            label="E: Producción Real"
          />
          <TimeBar
            color="bg-green-500"
            label="F: Piezas buenas"
            lossLabel="Pérdidas de calidad"
            lossAmount="Pérdidas por Calidad"
            lossExamples="Productos defectuosos, retrabajos"
            isFinal={true}
          />
        </FactorCard>

        {/* OEE Formula */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
             <div className="p-4 rounded-lg text-center w-full md:w-40 flex-shrink-0 bg-green-700">
                <h3 className="font-bold text-lg text-white">OEE</h3>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center w-full">
                <p className="text-base md:text-lg font-bold font-mono text-foreground">Disponibilidad * Rendimiento * Calidad</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

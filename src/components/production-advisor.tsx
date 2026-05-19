'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { analyzeProductionScenarios } from '@/app/actions/production-actions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

export function ProductionAdvisor({
  goals,
  machines,
  shifts,
  efficiency,
  availableDays,
  season,
  projectionMode,
  labor,
  supply,
  maxDays,
  maxWeeks,
  holidays,
  safeCombinations,
  prohibitedCombinations,
  scenarios,
  onScenariosChange,
  plannedSpeeds,
  onApplyScenario,
  history
}: {
  goals: any[],
  machines: any[],
  shifts: any,
  efficiency: number,
  availableDays: string,
  season: string,
  projectionMode: string,
  labor: any,
  supply: number,
  maxDays: number,
  maxWeeks: number,
  holidays: string[],
  safeCombinations: any[],
  prohibitedCombinations: any[],
  scenarios: any[] | null,
  onScenariosChange: (scenarios: any[] | null) => void,
  plannedSpeeds: Record<string, number>,
  onApplyScenario: (scenario: any) => Promise<void>,
  history?: any[]
}) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [currentTip, setCurrentTip] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tips = [
    "💡 Tip: El fardo de 12kg Don Antonio es el producto estrella de la planta.",
    "🍯 Dato: La Máquina #3 es la única que procesa presentaciones de 5kg.",
    "⚡ Sabías que: Un turno nocturno rinde un 5% menos por fatiga, pero es clave en Zafra.",
    "🛡️ Regla: Nunca operamos 2 máquinas en 1kg simultáneamente por seguridad del silo.",
    "🏭 Planta: El mantenimiento preventivo mensual es vital para evitar paradas críticas.",
    "⏳ Historia: Los mejores registros de producción se dan en la semana 40.",
    "🚀 Meta: Tu objetivo hoy es alcanzar el 95% de eficiencia operativa.",
    "📉 Tip: El Granel 50kg es ideal para liberar espacio en el silo rápidamente.",
  ];

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setProgress(0);
    setProgressText("Recolectando datos de la planta e historial...");
    setCurrentTip(tips[Math.floor(Math.random() * tips.length)]);

    // Estimate duration based on weeks (AI takes longer with more weeks)
    const estimatedTotalMs = 10000 + (maxWeeks * 800); // Base 10s + 0.8s per week
    const stepMs = 500;
    const totalSteps = estimatedTotalMs / stepMs;
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 99) return 99;

        // Asymptotic increment: moves slower as it gets higher
        // (100 - prev) / (remainingSteps * factor)
        const remaining = 100 - prev;
        const jump = Math.max(0.1, remaining / (totalSteps * 0.5));
        let next = prev + jump;
        
        if (next >= 99.5) next = 99.5;

        if (next > 90) setProgressText("🚀 ¡Casi listo! Calibrando los últimos sacos...");
        else if (next > 80) setProgressText("👔 Negociando con el sindicato las horas extra...");
        else if (next > 70) setProgressText("🧩 Armando el rompecabezas de los bloques semanales...");
        else if (next > 60) setProgressText("⚖️ Balanceando carga entre la M1, M2, M3 y M4...");
        else if (next > 50) setProgressText("🧪 Analizando flujo de masa y cuellos de botella...");
        else if (next > 40) setProgressText("🚜 Coordinando logística de suministro de azúcar...");
        else if (next > 30) setProgressText("🏗️ Verificando niveles en los silos de almacenamiento...");
        else if (next > 20) setProgressText("⚙️ Engrasando los engranajes de la planta...");
        else if (next > 10) setProgressText("🔋 Encendiendo motores de las envasadoras...");
        
        if (prev < 30 && next >= 30) setCurrentTip(tips[Math.floor(Math.random() * tips.length)]);
        if (prev < 60 && next >= 60) setCurrentTip(tips[Math.floor(Math.random() * tips.length)]);
        if (prev < 90 && next >= 90) setCurrentTip(tips[Math.floor(Math.random() * tips.length)]);

        return next;
      });
    }, 500);

    try {
      const result = await analyzeProductionScenarios({
        goals,
        machines,
        shifts,
        efficiency,
        availableDays,
        season,
        projectionMode,
        labor,
        supply,
        maxDays: maxDays - (Math.floor(maxDays / 30) * 2), // Subtract maintenance days
        maxWeeks,
        plannedSpeeds,
        holidays,
        safeCombinations,
        prohibitedCombinations,
        history: history ? JSON.parse(JSON.stringify(history)) : []
      });
      onScenariosChange(result.scenarios);
      setProgressText("¡Escenarios generados con éxito!");
      setProgress(100);
    } catch (err: any) {
      setError(err.message || "Error al analizar escenarios.");
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setLoading(false), 500);
    }
  };

  const handleApply = async (scenario: any) => {
    setApplying(true);
    setProgress(0);
    setProgressText("Mapeando productos y máquinas...");
    setCurrentTip(tips[Math.floor(Math.random() * tips.length)]);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        let next = prev + 15;
        if (next >= 98) next = 98;

        if (next > 85) setProgressText("✅ ¡Listo! Abriendo las compuertas de salida...");
        else if (next > 70) setProgressText("📏 Validando reglas de seguridad y matriz de flujo...");
        else if (next > 50) setProgressText("📅 Rellenando el calendario semana a semana...");
        else if (next > 30) setProgressText("👥 Asignando personal de turno Día y Noche...");
        else if (next > 10) setProgressText("🔍 Mapeando productos en cada envasadora...");

        if (prev < 50 && next >= 50) setCurrentTip(tips[Math.floor(Math.random() * tips.length)]);
        return next;
      });
    }, 250);

    try {
      await onApplyScenario(scenario);
      setProgressText("¡Calendario actualizado!");
      setProgress(100);
    } catch (err: any) {
      setError(err.message || "Error al aplicar el escenario.");
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setApplying(false), 500);
    }
  };

  return (
    <>
      <Card className="border-indigo-200 shadow-md bg-indigo-50/30">
        <CardHeader className="pb-3 border-b border-indigo-100">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg font-black text-indigo-900 flex items-center gap-2">
                <Bot className="h-5 w-5 text-indigo-600" />
                Asesor IA de Producción
              </CardTitle>
              <CardDescription className="text-indigo-700/70 text-xs mt-1">
                Optimizado con Gemini 2.5 Pro
              </CardDescription>
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              size="sm"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analizando...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generar Escenarios</>
              )}
            </Button>
            {scenarios && (
              <Button
                onClick={() => onScenariosChange(null)}
                variant="outline"
                size="sm"
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-100"
              >
                Limpiar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {!scenarios && !loading && !error && (
            <div className="text-center py-6 text-indigo-400">
              <p className="text-sm font-medium">Haz clic en generar para simular escenarios logísticos basados en tus máquinas, turnos y eficiencia actual.</p>
              <div className="mt-2 text-[10px] text-indigo-300">
                * Se descontarán automáticamente {Math.floor(maxDays / 30) * 2} días de parada por mantenimiento ({Math.floor(maxDays / 30)} meses).
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {scenarios && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scenarios.map((scenario, index) => (
                <Card key={index} className="border-indigo-100 shadow-sm flex flex-col">
                  <CardHeader className="pb-2 bg-indigo-50/50">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-sm font-black text-indigo-900 leading-tight">
                        {scenario.name}
                      </CardTitle>
                      <Badge variant={index === 0 ? "default" : "secondary"} className="text-[10px] whitespace-nowrap ml-2">
                        {scenario.estimatedDays} Días
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 flex-1">
                    <p className="text-xs text-muted-foreground mb-3">{scenario.description}</p>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600">
                        <div className={scenario.requiresNightShift ? "text-amber-600" : "text-emerald-600"}>
                          {scenario.requiresNightShift ? "Turnos de Noche Requeridos" : "Solo Turnos de Día"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600">
                        <div className={scenario.requiresWeekends ? "text-amber-600" : "text-emerald-600"}>
                          {scenario.requiresWeekends ? "Incluye Fines de Semana" : "Sin Fines de Semana"}
                        </div>
                      </div>
                    </div>

                    {scenario.weeklyBlocks && scenario.weeklyBlocks.length > 0 && (
                      <div className="space-y-1 mb-3 bg-white/50 p-2 rounded border border-indigo-50">
                        <span className="text-[9px] font-bold text-slate-800 uppercase tracking-wider">Resumen de Planificación:</span>
                        <ul className="text-[10px] text-muted-foreground list-none space-y-1 mt-1">
                          {scenario.weeklyBlocks.slice(0, 2).map((block: any) => (
                            <li key={block.weekNumber} className="border-l-2 border-indigo-300 pl-2 flex flex-col gap-0.5">
                              <span className="font-semibold text-indigo-700">Semana {block.weekNumber}:</span>
                              <span className="text-[9px] leading-tight">
                                {block.allocations.map((a: any) => `M${a.machineId}(${a.productName})`).join(' • ')}
                              </span>
                            </li>
                          ))}
                          {scenario.weeklyBlocks.length > 2 && (
                            <li className="text-[9px] text-indigo-400 italic pl-2">
                              ... y {scenario.weeklyBlocks.length - 2} semanas más programadas.
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="space-y-1 mb-3">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase">Pros:</span>
                      <ul className="list-disc pl-3 text-[10px] text-muted-foreground">
                        {scenario.pros.map((pro: string, i: number) => <li key={i}>{pro}</li>)}
                      </ul>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-800 uppercase">A Considerar:</span>
                      <ul className="list-disc pl-3 text-[10px] text-muted-foreground">
                        {scenario.cons.map((con: string, i: number) => <li key={i}>{con}</li>)}
                      </ul>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0 pb-3 px-4">
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-8 text-xs font-bold"
                      onClick={() => handleApply(scenario)}
                      disabled={applying || loading}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Aplicar a la Proyección
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generation Modal */}
      <Dialog open={loading}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-indigo-900 flex flex-col items-center gap-3">
              <Bot className="h-10 w-10 text-indigo-600 animate-pulse" />
              Creando el mejor escenario...
            </DialogTitle>
            <DialogDescription className="text-center pt-2 font-medium min-h-[60px] flex flex-col justify-center text-indigo-700">
              <span className="text-sm">{progressText}</span>
              {currentTip && <span className="text-[10px] text-indigo-400 mt-2 italic">{currentTip}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Progress value={progress} className="h-2 w-full" />
            <p className="text-center text-xs text-muted-foreground mt-3">{Math.round(progress)}% Completado</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Application Modal */}
      <Dialog open={applying}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-emerald-900 flex flex-col items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 animate-pulse" />
              Aplicando Escenario a la Proyección...
            </DialogTitle>
            <DialogDescription className="text-center pt-2 font-medium min-h-[60px] flex flex-col justify-center text-emerald-700">
              <span className="text-sm">{progressText}</span>
              {currentTip && <span className="text-[10px] text-emerald-400 mt-2 italic">{currentTip}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Progress value={progress} className="h-2 w-full [&>div]:bg-emerald-600" />
            <p className="text-center text-xs text-muted-foreground mt-3">{Math.round(progress)}% Completado</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

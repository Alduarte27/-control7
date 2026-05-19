'use client';

import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bot, Check, X, Mic, ChevronRight, Calendar, Cpu, Package, Clock } from 'lucide-react';
import { FloatingCopilot } from '@/components/floating-copilot';
import { runSmartPlannerEngine } from '@/lib/smart-planner-engine';
import { format, addDays, getMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getWeekDateRange(zafraStartDate: string, weekNumber: number): { start: string; end: string; month: string } {
    const start = new Date(zafraStartDate);
    const weekStart = addDays(start, (weekNumber - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    const monthIdx = weekStart.getMonth();
    return {
        start: format(weekStart, 'dd/MM'),
        end: format(weekEnd, 'dd/MM'),
        month: MONTH_NAMES[monthIdx],
    };
}

function AllocationBadge({ alloc, products }: { alloc: any; products: any[] }) {
    if (!alloc) return <span className="text-slate-600 text-[10px]">—</span>;
    const prod = products.find((p: any) => p.id === alloc.productId);
    const name = prod ? prod.productName : (alloc.productName || alloc.productId || '?');
    const isDouble = alloc.shiftsPerDay === 2;
    const shortName = name.length > 22 ? name.slice(0, 22) + '…' : name;
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-slate-100 font-bold text-[11px] leading-tight">{shortName}</span>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <span className={cn(
                    'px-1.5 py-0.5 rounded-[3px] text-[8px] font-black uppercase tracking-widest border',
                    isDouble
                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                )}>
                    {isDouble ? '2 turnos' : '1 turno'}
                </span>
                <span className="text-slate-500 text-[8px] font-bold">{alloc.daysActive}d</span>
            </div>
        </div>
    );
}

function ScenarioTable({ plan, products, zafraStartDate }: { plan: any; products: any[]; zafraStartDate: string }) {
    const activeMachineIds = React.useMemo(() => {
        const ids = new Set<number>();
        plan.weeklyBlocks?.forEach((block: any) => {
            block.allocations?.forEach((a: any) => ids.add(Number(a.machineId)));
        });
        return Array.from(ids).sort((a, b) => a - b);
    }, [plan]);

    if (!plan.weeklyBlocks || plan.weeklyBlocks.length === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-500 italic text-sm">
                El plan no contiene semanas de producción.
            </div>
        );
    }

    return (
        <div className="overflow-auto flex-1 rounded-2xl border border-slate-800 bg-slate-900/40 shadow-2xl backdrop-blur-md">
            <table className="w-full text-sm border-collapse min-w-[640px]">
                <thead className="bg-slate-900/90 sticky top-0 backdrop-blur-md z-10">
                    <tr>
                        <th className="p-3 text-left font-black text-slate-400 text-[9px] uppercase tracking-widest border-b border-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />Mes</div>
                        </th>
                        <th className="p-3 text-left font-black text-slate-400 text-[9px] uppercase tracking-widest border-b border-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-1"><Clock className="h-3 w-3" />Semana</div>
                        </th>
                        <th className="p-3 text-left font-black text-slate-400 text-[9px] uppercase tracking-widest border-b border-slate-800 whitespace-nowrap">
                            Rango
                        </th>
                        {activeMachineIds.map(mid => (
                            <th key={mid} className="p-3 text-left font-black text-[9px] uppercase tracking-widest border-b border-slate-800 whitespace-nowrap min-w-[170px]">
                                <div className="flex items-center gap-1">
                                    <div className="flex items-center justify-center w-5 h-5 rounded bg-blue-600/20 border border-blue-500/30">
                                        <Cpu className="h-2.5 w-2.5 text-blue-400" />
                                    </div>
                                    <span className="text-blue-300">Máquina {mid}</span>
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                    {plan.weeklyBlocks.map((block: any, bIdx: number) => {
                        const weekNum = block.weekNumber || (bIdx + 1);
                        const range = getWeekDateRange(zafraStartDate, weekNum);
                        const allocByMachine: Record<number, any> = {};
                        block.allocations?.forEach((a: any) => {
                            allocByMachine[Number(a.machineId)] = a;
                        });
                        const isEven = bIdx % 2 === 0;
                        return (
                            <tr key={bIdx} className={cn(
                                'transition-colors hover:bg-blue-500/8 group',
                                isEven ? 'bg-slate-900/20' : 'bg-slate-950/20'
                            )}>
                                {/* Mes */}
                                <td className="p-3 px-4 align-top">
                                    <span className="inline-block bg-blue-600/20 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                                        {range.month}
                                    </span>
                                </td>
                                {/* Semana */}
                                <td className="p-3 px-4 align-top">
                                    <span className="font-black text-slate-200 text-sm">S{weekNum}</span>
                                </td>
                                {/* Rango de fechas */}
                                <td className="p-3 px-4 align-top">
                                    <span className="text-slate-400 text-[11px] font-semibold whitespace-nowrap">
                                        {range.start} – {range.end}
                                    </span>
                                </td>
                                {/* Una columna por máquina */}
                                {activeMachineIds.map(mid => (
                                    <td key={mid} className="p-3 px-4 align-top border-l border-slate-800/50">
                                        <AllocationBadge alloc={allocByMachine[mid]} products={products} />
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function AutonomousAgentView({
    isOpen,
    onClose,
    onApplyOverrides,
    products = [],
    machines = [],
    plannedGoals,
    plannedSpeeds,
    dailySupply,
    machineConfig,
    safeCombinations,
    prohibitedCombinations,
    season,
    projectionMode,
    zafraStartDate,
    zafraEndDate,
    setPlannedGoals,
    setPlannedSpeeds,
    setDailySupply,
    setMachineConfig,
    setSeason,
    setProjectionMode,
    setSafeCombinations,
    setProhibitedCombinations,
    setZafraStartDate,
    setZafraEndDate,
    advisorInput,
    groupedWeeks,
    classifyProduct,
    generateAutoLabel,
}: any) {
    const [projectedScenario, setProjectedScenario] = useState<any>(null);

    // Live preview: called every time copilot sets a pendingPlan
    const handlePendingPlan = useCallback((plan: any | null) => {
        if (plan) {
            setProjectedScenario(plan);
        }
    }, []);

    const handleApply = () => {
        if (!projectedScenario) return;
        const smartEngineOverrides = runSmartPlannerEngine(projectedScenario.weeklyBlocks, {
            zafraStartDate,
            maxWeeks: groupedWeeks?.reduce((acc: any, g: any) => acc + g.weeks.length, 0) || 52,
            products, machines, plannedSpeeds,
            holidays: [],
            safeCombinations, prohibitedCombinations, classifyProduct, generateAutoLabel
        });
        onApplyOverrides(smartEngineOverrides, projectedScenario.name);
        onClose();
    };

    const handleDiscard = () => {
        setProjectedScenario(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[97vw] h-[93vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-slate-800 shadow-2xl rounded-2xl">
                {/* Header */}
                <DialogHeader className="shrink-0 px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/80">
                    <DialogTitle className="flex items-center gap-3 text-slate-100">
                        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30">
                            <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <div className="text-base font-black tracking-tight">Agente IA — Planificación Autónoma</div>
                            <div className="text-[11px] font-semibold text-slate-400 tracking-wide mt-0.5">
                                Planta Copilot · Smart Engine v2
                            </div>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            {projectedScenario && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-white hover:bg-slate-800 font-bold uppercase text-[10px] tracking-wider h-8 px-3"
                                        onClick={handleDiscard}
                                    >
                                        <X className="h-3.5 w-3.5 mr-1.5" /> Descartar
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white shadow-lg shadow-emerald-500/20 font-bold uppercase text-[10px] tracking-wider border-0 h-8 px-4"
                                        onClick={handleApply}
                                    >
                                        <Check className="h-3.5 w-3.5 mr-1.5" /> Aplicar al Calendario
                                    </Button>
                                </>
                            )}
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT: Copilot Panel */}
                    <div className="w-[380px] min-w-[340px] shrink-0 border-r border-slate-800 flex flex-col bg-slate-900 relative">
                        <FloatingCopilot
                            isOpen={true}
                            onOpenChange={() => {}}
                            productCount={products?.length ?? 0}
                            machineCount={machines?.length ?? 0}
                            products={products}
                            machines={machines}
                            plannedGoals={plannedGoals}
                            plannedSpeeds={plannedSpeeds}
                            dailySupply={dailySupply}
                            machineConfig={machineConfig}
                            safeCombinations={safeCombinations}
                            prohibitedCombinations={prohibitedCombinations}
                            season={season}
                            projectionMode={projectionMode}
                            zafraStartDate={zafraStartDate}
                            zafraEndDate={zafraEndDate}
                            setPlannedGoals={setPlannedGoals}
                            setPlannedSpeeds={setPlannedSpeeds}
                            setDailySupply={setDailySupply}
                            setMachineConfig={setMachineConfig}
                            setSeason={setSeason}
                            setProjectionMode={setProjectionMode}
                            setSafeCombinations={setSafeCombinations}
                            setProhibitedCombinations={setProhibitedCombinations}
                            setZafraStartDate={setZafraStartDate}
                            setZafraEndDate={setZafraEndDate}
                            overrides={{}}
                            setOverrides={() => {}}
                            activeSnapshotId={null}
                            activeSnapshotName={''}
                            isHistoryOpen={false}
                            setIsHistoryOpen={() => {}}
                            isSummaryView={false}
                            setIsSummaryView={() => {}}
                            onSaveSnapshot={() => {}}
                            onGeneratePDF={() => {}}
                            advisorInput={advisorInput}
                            onApplyScenario={(scenario) => {
                                setProjectedScenario(scenario);
                            }}
                            onPendingPlan={handlePendingPlan}
                            inline={true}
                        />
                    </div>

                    {/* RIGHT: Projected Scenario Table */}
                    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
                        {/* Ambient glows */}
                        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 right-0 w-72 h-72 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

                        {!projectedScenario ? (
                            /* Empty state */
                            <div className="flex-1 flex flex-col items-center justify-center opacity-70 relative z-10 px-8">
                                <div className="p-7 bg-slate-900/60 rounded-full border border-slate-800 mb-6 shadow-xl">
                                    <Mic className="h-14 w-14 text-slate-500 animate-pulse" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-300 tracking-tight text-center">
                                    Esperando Plan del Agente
                                </h3>
                                <p className="text-slate-500 mt-3 text-center max-w-sm font-medium leading-relaxed text-sm">
                                    Pide al Copilot que genere un plan de producción. Aparecerá aquí automáticamente para que lo revises semana a semana.
                                </p>
                                <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-sm">
                                    {[
                                        { icon: <Calendar className="h-4 w-4" />, label: 'Mes' },
                                        { icon: <Clock className="h-4 w-4" />, label: 'Semana' },
                                        { icon: <Cpu className="h-4 w-4" />, label: 'Máquinas' },
                                    ].map((item, i) => (
                                        <div key={i} className="flex flex-col items-center gap-1.5 p-3 bg-slate-900/40 border border-slate-800 rounded-xl">
                                            <div className="text-slate-500">{item.icon}</div>
                                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* Scenario table */
                            <div className="flex flex-col h-full relative z-10 p-5 gap-4">
                                {/* Plan header */}
                                <div className="shrink-0 flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl px-5 py-3 backdrop-blur-sm">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30">
                                        <Package className="h-4 w-4 text-emerald-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Plan Generado</p>
                                        <p className="text-sm font-black text-white truncate">{projectedScenario.name}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider shrink-0">
                                        <span className="text-slate-200 text-base font-black">
                                            {projectedScenario.weeklyBlocks?.length ?? 0}
                                        </span>
                                        semanas
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                                    <div className="text-[10px] text-slate-400 font-semibold shrink-0">
                                        Revisa y aplica al calendario →
                                    </div>
                                </div>

                                {/* The table */}
                                <ScenarioTable
                                    plan={projectedScenario}
                                    products={products}
                                    zafraStartDate={zafraStartDate || new Date().toISOString().slice(0, 10)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

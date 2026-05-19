'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Sparkles, Maximize2, Minimize2, Zap, CheckCircle, Loader2, ChevronRight, BrainCircuit, AlertTriangle, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeProductionScenarios, chatWithCopilot, saveCopilotMemory, getCopilotMemories } from '@/app/actions/production-actions';
import { Progress } from './ui/progress';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  scenarios?: any[];
  isLoading?: boolean;
  executedActions?: { type: string; description: string }[];
}

interface FloatingCopilotProps {
  onApplyScenario: (scenario: any) => void;
  advisorInput?: any;
  productCount: number;
  machineCount: number;

  // Live state values and setters for dynamic interactive actions
  products?: any[];
  machines?: any[];
  plannedGoals?: Record<string, number>;
  plannedSpeeds?: Record<string, number>;
  dailySupply?: number;
  machineConfig?: any;
  safeCombinations?: any[];
  prohibitedCombinations?: any[];
  season?: 'zafra' | 'no-zafra';
  projectionMode?: 'manual' | 'auto';
  zafraStartDate?: string;
  zafraEndDate?: string;

  setPlannedGoals?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setPlannedSpeeds?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setDailySupply?: React.Dispatch<React.SetStateAction<number>>;
  setMachineConfig?: React.Dispatch<React.SetStateAction<any>>;
  setSeason?: (season: 'zafra' | 'no-zafra') => void;
  setProjectionMode?: (mode: 'manual' | 'auto') => void;
  setSafeCombinations?: React.Dispatch<React.SetStateAction<any[]>>;
  setProhibitedCombinations?: React.Dispatch<React.SetStateAction<any[]>>;
  setZafraStartDate?: (date: string) => void;
  setZafraEndDate?: (date: string) => void;

  // Cell control and scenario parameters
  overrides?: Record<string, any>;
  setOverrides?: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeSnapshotId?: string | null;
  activeSnapshotName?: string | null;
  
  // Views and sidebars
  isHistoryOpen?: boolean;
  setIsHistoryOpen?: (open: boolean) => void;
  isSummaryView?: boolean;
  setIsSummaryView?: (open: boolean) => void;
  
  // Custom action triggers
  onSaveSnapshot?: (name: string) => Promise<void>;
  onGeneratePDF?: (mode: 'dia' | 'semana' | 'visual') => void;

  // External open states
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  inline?: boolean;
  onPendingPlan?: (plan: any | null) => void;
}

const renderFormattedContent = (text: string) => {
  if (!text) return null;
  
  // Pre-process text to insert newlines before inline numbered items (e.g. "puedo:1. " becomes "puedo:\n1. ")
  const formattedText = text.replace(/([^\n])(\b\d+\.\s)/g, '$1\n$2');
  
  // Split into lines to format lists and paragraphs
  const lines = formattedText.split('\n');
  
  return (
    <div className="space-y-1">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        const isBullet = trimmed.startsWith('*') && trimmed.charAt(1) === ' ';
        const isNumbered = /^\d+\.\s/.test(trimmed);
        
        // Helper to format bold text inside a string
        const formatBolds = (str: string) => {
          const parts = str.split(/(\*\*.*?\*\*)/g);
          return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={i} className="font-extrabold text-blue-600 dark:text-blue-400">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });
        };
        
        if (isBullet) {
          const cleanLine = trimmed.substring(2).trim();
          return (
            <div key={lineIdx} className="flex items-start gap-1.5 pl-1.5 my-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/80 dark:bg-blue-400/80 shrink-0 mt-1.5" />
              <span className="flex-1 text-slate-700 dark:text-slate-300">
                {formatBolds(cleanLine)}
              </span>
            </div>
          );
        }

        if (isNumbered) {
          const match = trimmed.match(/^(\d+\.)\s*(.*)$/);
          const numStr = match ? match[1] : '';
          const cleanLine = match ? match[2] : trimmed;
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1.5 my-1">
              <span className="font-extrabold text-blue-600 dark:text-blue-400 shrink-0 text-sm leading-tight min-w-[1.25rem]">
                {numStr}
              </span>
              <span className="flex-1 text-slate-700 dark:text-slate-300 leading-tight">
                {formatBolds(cleanLine)}
              </span>
            </div>
          );
        }
        
        // Standard line
        return (
          <p key={lineIdx} className="min-h-[1em]">
            {formatBolds(line)}
          </p>
        );
      })}
    </div>
  );
};

const normalizeWeeklyBlocks = (rawBlocks: any): any[] => {
  if (!rawBlocks) return [];
  
  let blocksArr: any[] = [];
  if (Array.isArray(rawBlocks)) {
    blocksArr = rawBlocks;
  } else if (typeof rawBlocks === 'object' && rawBlocks !== null) {
    blocksArr = Object.values(rawBlocks);
  }
  
  return blocksArr
    .filter(wb => wb !== null && wb !== undefined && typeof wb === 'object')
    .map((wb, index) => {
      const weekNum = typeof wb.weekNumber === 'number' 
        ? wb.weekNumber 
        : (typeof wb.week === 'number' ? wb.week : index + 1);
        
      const rawAllocs = wb.allocations || wb.allocation || [];
      let allocsArr: any[] = [];
      if (Array.isArray(rawAllocs)) {
        allocsArr = rawAllocs;
      } else if (typeof rawAllocs === 'object' && rawAllocs !== null) {
        allocsArr = Object.values(rawAllocs);
      }
      
      const cleanedAllocs = allocsArr
        .filter(alloc => alloc !== null && alloc !== undefined && typeof alloc === 'object')
        .map(alloc => ({
          machineId: typeof alloc.machineId === 'number' ? alloc.machineId : parseInt(alloc.machineId) || 1,
          productId: String(alloc.productId || alloc.product || 'off'),
          productName: String(alloc.productName || alloc.productId || ''),
          shiftsPerDay: typeof alloc.shiftsPerDay === 'number' ? alloc.shiftsPerDay : parseInt(alloc.shiftsPerDay) || 1,
          daysActive: typeof alloc.daysActive === 'number' ? alloc.daysActive : parseInt(alloc.daysActive) || 5
        }));
        
      return {
        weekNumber: weekNum,
        allocations: cleanedAllocs
      };
    });
};


export function FloatingCopilot({
  onApplyScenario,
  advisorInput,
  productCount,
  machineCount,
  products = [],
  machines = [],
  plannedGoals = {},
  plannedSpeeds = {},
  dailySupply = 3500,
  machineConfig = {},
  safeCombinations = [],
  prohibitedCombinations = [],
  season = 'zafra',
  projectionMode = 'auto',
  zafraStartDate = '2026-08-01',
  zafraEndDate = '2026-12-31',
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
  overrides = {},
  setOverrides,
  activeSnapshotId,
  activeSnapshotName,
  isHistoryOpen = false,
  setIsHistoryOpen,
  isSummaryView = false,
  setIsSummaryView,
  onSaveSnapshot,
  onGeneratePDF,
  isOpen: controlledIsOpen,
  onOpenChange,
  inline = false,
  onPendingPlan
}: FloatingCopilotProps) {
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : localIsOpen;
  const setIsOpen = useCallback((open: boolean) => {
    setLocalIsOpen(open);
    if (onOpenChange) onOpenChange(open);
  }, [onOpenChange]);

  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveState, setLiveState] = useState<'silent' | 'listening' | 'thinking' | 'speaking'>('silent');
  const [learnedPreferences, setLearnedPreferences] = useState<any[]>([]);

  const fetchLearnedPreferences = useCallback(async () => {
    try {
      const memories = await getCopilotMemories(50);
      const preferences = memories.filter((m: any) => m.actionType === 'LEARNED_PREFERENCE');
      setLearnedPreferences(preferences);
    } catch (e) {
      console.error("[Memory Error] Failed to fetch learned preferences", e);
    }
  }, []);

  const fetchMemoriesRef = useRef<any>(null);
  useEffect(() => {
    fetchMemoriesRef.current = fetchLearnedPreferences;
  }, [fetchLearnedPreferences]);

  useEffect(() => {
    fetchLearnedPreferences();
  }, [fetchLearnedPreferences]);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const shouldBeListeningRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Synchronize dynamic status refs to fully circumvent stale closures in voice drivers
  const isLiveModeRef = useRef(false);
  const liveStateRef = useRef<'silent' | 'listening' | 'thinking' | 'speaking'>('silent');
  const isVoiceEnabledRef = useRef(true);

  useEffect(() => {
    isLiveModeRef.current = isLiveMode;
  }, [isLiveMode]);

  useEffect(() => {
    liveStateRef.current = liveState;
  }, [liveState]);

  useEffect(() => {
    isVoiceEnabledRef.current = isVoiceEnabled;
  }, [isVoiceEnabled]);

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping speech recognition:", e);
      }
    }
    setIsListening(false);
    if (isLiveModeRef.current && liveStateRef.current === 'listening') {
      setLiveState('silent');
    }
  }, []);

  // Stable references for circular hooks
  const startListeningRef = useRef<any>(null);
  const speakTextRef = useRef<any>(null);
  const handleSendRef = useRef<any>(null);

  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !isVoiceEnabledRef.current) return;
    window.speechSynthesis.cancel();
    
    let speechFriendlyText = text;
    speechFriendlyText = speechFriendlyText
      .replace(/\*\*|__/g, '')
      .replace(/\*|_/g, '')
      .replace(/#+\s+/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[\s*-+•]+|^\s*\d+\.\s+/gm, '')
      .replace(/\bQQ\b/gi, ' quintales ')
      .replace(/\bqq\b/gi, ' quintales ')
      .replace(/\bKg\b/gi, ' kilogramos ')
      .replace(/\bkg\b/gi, ' kilogramos ')
      .replace(/\bg\b/gi, ' gramos ')
      .replace(/\bbpm\b/gi, ' golpes por minuto ')
      .replace(/\bBPM\b/gi, ' golpes por minuto ')
      .replace(/\bIA\b/gi, ' inteligencia artificial ')
      .replace(/#/g, ' número ')
      .replace(/(\d+),(\d{3})/g, '$1$2')
      .replace(/(\d+)\.(\d{3})/g, '$1$2')
      .replace(/(\d+)[.,](\d+)/g, '$1 con $2')
      .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
      .replace(/⚠️|✅|❌|⚡|🎯|💰|✨|🔧|🚜/g, '')
      .trim();

    if (!speechFriendlyText) return;
    const utterance = new SpeechSynthesisUtterance(speechFriendlyText);
    utterance.lang = 'es-ES';
    
    utterance.volume = 1.0; 
    utterance.rate = 0.96;   
    utterance.pitch = 1.03;  

    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.toLowerCase().includes('es')) || voices.find(v => v.lang.startsWith('es'));
    if (esVoice) utterance.voice = esVoice;

    utterance.onstart = () => {
      if (isLiveModeRef.current) {
        setLiveState('speaking');
      }
    };

    utterance.onend = () => {
      if (isLiveModeRef.current) {
        setLiveState('listening');
        // Let it start listening with a tiny delay to ensure audio resources are released
        setTimeout(() => {
          if (isLiveModeRef.current && startListeningRef.current) {
            startListeningRef.current();
          }
        }, 400);
      }
    };

    utterance.onerror = () => {
      if (isLiveModeRef.current) {
        setLiveState('silent');
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `¡Hola! Soy tu **Planta Copilot** con Smart Engine. Tengo acceso a **${productCount} productos** y **${machineCount} máquinas**.\n\nPuedo generar planes de producción completos, activar/desactivar envasadoras, cambiar metas o ajustar suministros mediante comandos de voz o texto directo. ¿En qué te ayudo hoy?`
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingPlan, setPendingPlan] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notify parent in real-time when a pendingPlan is ready (for inline preview)
  useEffect(() => {
    if (onPendingPlan) onPendingPlan(pendingPlan);
  }, [pendingPlan, onPendingPlan]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Sync welcome narration greeting
  useEffect(() => {
    if (isOpen) {
      const activeMachineCount = machines.filter(m => machineConfig[m.id]?.active !== false).length;
      const activeGoalCount = products.filter(p => {
        const goal = plannedGoals[p.id];
        return typeof goal === 'number' && goal > 0;
      }).length;
      const totalProductCount = products.length || productCount || 10;
      const totalMachineCount = machines.length || machineCount || 4;

      const greetings = [
        `¡Hola! Qué gran gusto saludarte. Soy tu Planta Copilot con Smart Engine y estoy lista para optimizar nuestra jornada de producción. Actualmente tenemos ${activeMachineCount} ${activeMachineCount === 1 ? 'máquina activa' : 'máquinas activas'} de un total de ${totalMachineCount}, y veo ${activeGoalCount} ${activeGoalCount === 1 ? 'producto con meta activa' : 'productos con metas activas'} de los ${totalProductCount} registrados. ¿Qué plan estratégico o comando de envasado ejecutamos hoy?`,
        `¡Saludos! Es un excelente día para maximizar la eficiencia y rendimiento de nuestra planta. Tengo mapeados los ${totalProductCount} productos, de los cuales ${activeGoalCount} tienen ${activeGoalCount === 1 ? 'meta de producción activa' : 'metas de producción activas'}, y veo ${activeMachineCount} ${activeMachineCount === 1 ? 'envasadora operativa' : 'envasadoras operativas'}. Dime qué meta quieres alcanzar hoy o pídeme que genere el mejor plan inteligente.`,
        `¡Hola! Qué excelente momento para coordinar operaciones. Estoy conectada en tiempo real a las ${activeMachineCount} ${activeMachineCount === 1 ? 'envasadora operativa' : 'envasadoras operativas'} y observo ${activeGoalCount} ${activeGoalCount === 1 ? 'producto con meta asignada' : 'productos con metas asignadas'} listos de un total de ${totalProductCount}. Planifiquemos juntos una zafra impecable y libre de conflictos. ¿Por dónde empezamos hoy?`
      ];
      
      const randomIdx = Math.floor(Math.random() * greetings.length);
      const selectedGreeting = greetings[randomIdx];

      setMessages(prev => {
        const markdownGreeting = selectedGreeting
          .replace("Planta Copilot", "**Planta Copilot**")
          .replace("Smart Engine", "**Smart Engine**")
          .replace(`${activeMachineCount} máquina activa`, `**${activeMachineCount} máquina activa**`)
          .replace(`${activeMachineCount} máquinas activas`, `**${activeMachineCount} máquinas activas**`)
          .replace(`${activeMachineCount} máquina operativa`, `**${activeMachineCount} máquina operativa**`)
          .replace(`${activeMachineCount} máquinas operativas`, `**${activeMachineCount} máquinas operativas**`)
          .replace(`${activeMachineCount} envasadora operativa`, `**${activeMachineCount} envasadora operativa**`)
          .replace(`${activeMachineCount} envasadoras operativas`, `**${activeMachineCount} envasadoras operativas**`)
          .replace(`${activeGoalCount} producto con meta activa`, `**${activeGoalCount} producto con meta activa**`)
          .replace(`${activeGoalCount} productos con metas activas`, `**${activeGoalCount} productos con metas activas**`)
          .replace(`${activeGoalCount} producto con meta asignada`, `**${activeGoalCount} producto con meta asignada**`)
          .replace(`${activeGoalCount} productos con metas asignadas`, `**${activeGoalCount} productos con metas asignadas**`);
        
        if (prev.length <= 1) {
          return [{ role: 'assistant', content: markdownGreeting }];
        }
        return prev;
      });

      const timer = setTimeout(() => {
        speakText(selectedGreeting);
      }, 600);

      return () => clearTimeout(timer);
    } else {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  }, [isOpen, speakText, productCount, machineCount, products, machines, plannedGoals, machineConfig]);

  const startProgressSimulation = useCallback((durationMs: number) => {
    setProgress(0);
    const steps = 60;
    const interval = durationMs / steps;
    let step = 0;
    progressRef.current = setInterval(() => {
      step++;
      const pct = Math.min(95, Math.round((Math.log(step + 1) / Math.log(steps + 1)) * 100));
      setProgress(pct);
      if (step >= steps) {
        if (progressRef.current) clearInterval(progressRef.current);
      }
    }, interval);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 800);
  }, []);

  const handleGenerateScenarios = useCallback(async () => {
    if (!advisorInput || productCount === 0) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Necesitas configurar **metas de producción** antes de generar un plan. Ve a **Metas** y asigna valores a los productos.'
      }]);
      return;
    }

    setIsGenerating(true);
    setMessages(prev => [...prev,
      { role: 'user', content: '🎯 Generar Plan de Producción' },
      { role: 'assistant', content: '', isLoading: true }
    ]);

    startProgressSimulation(35000);

    try {
      const result = await analyzeProductionScenarios(advisorInput);
      stopProgress();

      const scenarios = result?.scenarios || [];
      if (scenarios.length === 0) {
        setMessages(prev => {
          const updated = prev.filter(m => !m.isLoading);
          return [...updated, {
            role: 'assistant',
            content: '⚠️ No se pudieron generar escenarios. Verifica que las metas estén configuradas correctamente.'
          }];
        });
      } else {
        setMessages(prev => {
          const updated = prev.filter(m => !m.isLoading);
          return [...updated, {
            role: 'assistant',
            content: `✅ **${scenarios.length} escenarios generados** por el Smart Engine. Selecciona uno para aplicarlo al calendario de proyección:`,
            scenarios
          }];
        });
      }
    } catch (err: any) {
      stopProgress();
      setMessages(prev => {
        const updated = prev.filter(m => !m.isLoading);
        return [...updated, {
          role: 'assistant',
          content: `❌ Error al generar: ${err.message || 'Error desconocido. Inténtalo de nuevo.'}`
        }];
      });
    } finally {
      setIsGenerating(false);
    }
  }, [advisorInput, productCount, startProgressSimulation, stopProgress]);

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim();
    if (!text || isGenerating) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '36px';
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (isListening) {
      stopListening();
    }

    if (text === '__GENERATE__') {
      await handleGenerateScenarios();
      return;
    }

    setMessages(prev => [...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: 'Planta Copilot está pensando...', isLoading: true }
    ]);

    setIsGenerating(true);
    if (isLiveModeRef.current) {
      setLiveState('thinking');
    }

    // Save user message memory episode in Firestore (Fase 2)
    try {
      await saveCopilotMemory('user', text, 'USER_MESSAGE');
    } catch (e) {
      console.error("[Memory Error] Failed to write user message to Firestore", e);
    }

    try {
      const context = {
        products,
        machines,
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
        shifts: advisorInput?.shifts || { dayHours: 8, nightHours: 8 },
        efficiency: advisorInput?.efficiency || 0.85,
        labor: advisorInput?.labor || { type: 'payroll', dayRate: 0, nightRate: 0 },
        overrides: overrides || {},
        activeSnapshotId: activeSnapshotId || null,
        activeSnapshotName: activeSnapshotName || null,
        isHistoryOpen: isHistoryOpen || false,
        isSummaryView: isSummaryView || false
      };

      const result = await chatWithCopilot(text, context);
      
      let executedActions: { type: string; description: string }[] = [];
 
      if (result.suggestedActions && result.suggestedActions.length > 0) {
        for (const action of result.suggestedActions) {
          if (!action || typeof action !== 'object' || !action.type) continue;
          const payload = action.payload || {};
          switch (action.type) {
            case 'SET_MACHINE_STATUS':
              if (!payload.machineId) continue;
              if (setMachineConfig) {
                setMachineConfig((prev: any) => {
                  const updated = { ...prev };
                  if (updated[payload.machineId]) {
                    updated[payload.machineId] = { ...updated[payload.machineId], active: payload.active };
                  } else {
                    updated[payload.machineId] = { active: payload.active, productId: 'off', speed: 100 };
                  }
                  return updated;
                });
                executedActions.push({
                  type: 'Máquina',
                  description: `Envasadora ${payload.machineId} establecida como ${payload.active ? 'Activa' : 'Inactiva'}`
                });
              }
              break;
 
            case 'UPDATE_GOAL':
              if (!payload.productId || payload.targetQQ === undefined) continue;
              if (setPlannedGoals) {
                setPlannedGoals((prev: any) => ({
                  ...prev,
                  [payload.productId]: payload.targetQQ
                }));
                const prod = products.find(p => p.id === payload.productId);
                executedActions.push({
                  type: 'Meta',
                  description: `Meta de ${prod ? prod.productName : payload.productId} ajustada a ${payload.targetQQ} QQ`
                });
              }
              break;
 
            case 'UPDATE_SPEED':
              if (!payload.machineId || payload.speed === undefined) continue;
              if (setPlannedSpeeds) {
                setPlannedSpeeds((prev: any) => ({
                  ...prev,
                  [payload.machineId]: payload.speed
                }));
                executedActions.push({
                  type: 'Velocidad',
                  description: `Velocidad de Envasadora ${payload.machineId} ajustada a ${payload.speed} bpm`
                });
              }
              break;
 
            case 'UPDATE_SUPPLY':
              if (payload.supply === undefined) continue;
              if (setDailySupply) {
                setDailySupply(payload.supply);
                executedActions.push({
                  type: 'Suministro',
                  description: `Suministro diario de azúcar ajustado a ${payload.supply} QQ`
                });
              }
              break;
 
            case 'APPLY_PLAN':
              const rawBlocks = payload.weeklyBlocks || payload.blocks || (Array.isArray(payload) ? payload : null);
              if (!rawBlocks) continue;
              const cleanBlocks = normalizeWeeklyBlocks(rawBlocks);
              if (cleanBlocks.length === 0) continue;
              
              setPendingPlan({ name: 'Plan IA Directo', weeklyBlocks: cleanBlocks });
              executedActions.push({
                type: 'Planificación',
                description: `Propuesta de plan inteligente estructurada (Esperando aprobación)`
              });
              break;
 
            case 'SET_PROJECTION_MODE':
              if (!payload.mode) continue;
              if (setProjectionMode) {
                const userQuery = (text || '').toLowerCase();
                const isExplicitManualRequest = userQuery.includes('manual');
                const targetMode = isExplicitManualRequest ? payload.mode : 'auto';
 
                setProjectionMode(targetMode);
                executedActions.push({
                  type: 'Modo',
                  description: `Modo de proyección establecido en ${targetMode === 'manual' ? 'Manual' : 'Automático / IA'}`
                });
              }
              break;
 
            case 'SET_SEASON':
              if (!payload.season) continue;
              if (setSeason) {
                setSeason(payload.season);
                executedActions.push({
                  type: 'Temporada',
                  description: `Modo operativo cambiado a ${payload.season === 'zafra' ? 'ZAFRA' : 'NO ZAFRA'}`
                });
              }
              break;

            case 'SET_ZAFRA_DATES':
              if (payload.startDate && setZafraStartDate) {
                setZafraStartDate(payload.startDate);
              }
              if (payload.endDate && setZafraEndDate) {
                setZafraEndDate(payload.endDate);
              }
              executedActions.push({
                type: 'Zafra',
                description: `Fechas de zafra actualizadas: del ${payload.startDate || zafraStartDate} al ${payload.endDate || zafraEndDate}`
              });
              break;

            case 'ADD_SAFE_COMBINATION':
              if (setSafeCombinations) {
                const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
                setSafeCombinations((prev: any[]) => [
                  ...prev,
                  { id, m1: payload.m1 || '(Cualquiera)', m2: payload.m2 || '(Cualquiera)', m3: payload.m3 || '(Cualquiera)', label: payload.label || 'Combo IA' }
                ]);
                executedActions.push({
                  type: 'Combinación',
                  description: `Combinación permitida creada: "${payload.label || 'Combo IA'}"`
                });
              }
              break;

            case 'ADD_PROHIBITED_COMBINATION':
              if (setProhibitedCombinations) {
                const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
                setProhibitedCombinations((prev: any[]) => [
                  ...prev,
                  { id, m1: payload.m1 || '(Cualquiera)', m2: payload.m2 || '(Cualquiera)', m3: payload.m3 || '(Cualquiera)', label: payload.label || 'Bloqueo IA' }
                ]);
                executedActions.push({
                  type: 'Bloqueo',
                  description: `Combinación prohibida creada: "${payload.label || 'Bloqueo IA'}"`
                });
              }
              break;

            case 'LEARNED_PREFERENCE':
              if (payload.preference) {
                try {
                  await saveCopilotMemory('system', payload.preference, 'LEARNED_PREFERENCE');
                  if (fetchMemoriesRef.current) {
                    await fetchMemoriesRef.current();
                  }
                } catch (e) {
                  console.error("Failed to save learned preference", e);
                }
                
                executedActions.push({
                  type: 'Preferencia Aprendida',
                  description: `Regla registrada en memoria: "${payload.preference}"`
                });
              }
              break;

            case 'OPEN_DETAILED_REPORT':
              if (setIsSummaryView) {
                setIsSummaryView(true);
                executedActions.push({
                  type: 'Vista',
                  description: 'Vista de reporte detallado abierta'
                });
              }
              break;

            case 'CLOSE_DETAILED_REPORT':
              if (setIsSummaryView) {
                setIsSummaryView(false);
                executedActions.push({
                  type: 'Vista',
                  description: 'Vista de cuadrícula de planificación restaurada'
                });
              }
              break;

            case 'OPEN_HISTORY':
              if (setIsHistoryOpen) {
                setIsHistoryOpen(true);
                executedActions.push({
                  type: 'Sidebar',
                  description: 'Historial de proyecciones abierto'
                });
              }
              break;

            case 'CLOSE_HISTORY':
              if (setIsHistoryOpen) {
                setIsHistoryOpen(false);
                executedActions.push({
                  type: 'Sidebar',
                  description: 'Historial de proyecciones cerrado'
                });
              }
              break;

            case 'GENERATE_PDF':
              if (onGeneratePDF) {
                const mode = payload.mode || 'semana';
                onGeneratePDF(mode);
                executedActions.push({
                  type: 'Reporte',
                  description: `Generando y descargando reporte PDF en formato ${mode}`
                });
              }
              break;

            case 'SAVE_PLAN':
              if (onSaveSnapshot && payload.name) {
                try {
                  await onSaveSnapshot(payload.name);
                  executedActions.push({
                    type: 'Guardado',
                    description: `Escenario guardado con el nombre "${payload.name}"`
                  });
                } catch (e) {
                  console.error("Failed to save snapshot from copilot action", e);
                }
              }
              break;

            case 'UPDATE_CELL':
              if (setOverrides && payload.machineId !== undefined && payload.date && payload.shift) {
                const key = `${payload.machineId}-${payload.date}-${payload.shift}`;
                const prod = products.find(p => p.id === payload.productId);
                setOverrides((prev: any) => ({
                  ...prev,
                  [key]: {
                    productId: payload.productId || 'off',
                    speed: payload.speed,
                    inactive: payload.inactive || payload.productId === 'off'
                  }
                }));
                executedActions.push({
                  type: 'Edición Celda',
                  description: `Celda ${payload.date} [${payload.shift === 'dia' ? 'Día' : 'Noche'}] en M${payload.machineId} cambiada a ${payload.productId === 'off' ? 'Inactiva (OFF)' : (prod ? prod.productName : payload.productId)}`
                });
              }
              break;
          }
        }
      }

      const reply = result.message || 'Entendido. Procesé tus cambios con éxito.';
      speakText(reply);

      setMessages(prev => {
        const updated = prev.filter(m => !m.isLoading);
        return [...updated, {
          role: 'assistant',
          content: reply,
          executedActions: executedActions.length > 0 ? executedActions : undefined
        }];
      });

      // Save assistant reply memory episode in Firestore (Fase 2)
      try {
        await saveCopilotMemory('assistant', reply, 'ASSISTANT_REPLY', { executedActions });
      } catch (e) {
        console.error("[Memory Error] Failed to write assistant response to Firestore", e);
      }

    } catch (err: any) {
      const errMsg = `Error al interactuar con el Copilot: ${err.message || 'Error desconocido.'}`;
      speakText(errMsg);
      setMessages(prev => {
        const updated = prev.filter(m => !m.isLoading);
        return [...updated, {
          role: 'assistant',
          content: `❌ ${errMsg}`
        }];
      });
      if (isLiveModeRef.current) {
        setLiveState('silent');
      }
    } finally {
      setIsGenerating(false);
    }
  }, [
    input,
    isGenerating,
    handleGenerateScenarios,
    products,
    machines,
    plannedGoals,
    plannedSpeeds,
    dailySupply,
    machineConfig,
    safeCombinations,
    prohibitedCombinations,
    setPlannedGoals,
    setPlannedSpeeds,
    setDailySupply,
    setMachineConfig,
    onApplyScenario,
    speakText,
    isListening,
    stopListening
  ]);

  const handleApplyScenario = useCallback((scenario: any) => {
    onApplyScenario(scenario);
    const msg = `Escenario ${scenario.name} aplicado con Smart Engine de forma exitosa.`;
    speakText(msg);
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `⚡ **Escenario "${scenario.name}" aplicado** con Smart Engine. El calendario de proyección ha sido actualizado con validación de la Matriz de Combinaciones.`
    }]);
  }, [onApplyScenario, speakText]);

  // Wire up the circular dependency binders cleanly
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta el reconocimiento de voz nativo. Te recomendamos usar Google Chrome o Microsoft Edge.");
      return;
    }

    shouldBeListeningRef.current = true;
    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    
    rec.onstart = () => {
      setIsListening(true);
      if (isLiveModeRef.current) {
        setLiveState('listening');
      }
      transcriptRef.current = '';
    };

    rec.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      const cleanText = (finalTranscript || interimTranscript).trim();
      if (cleanText) {
        setInput(cleanText);
        transcriptRef.current = cleanText;
      }

      // Live hands-free auto-submission loop (Siri/Gemini style)
      if (isLiveModeRef.current && finalTranscript.trim()) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          const textToSubmit = transcriptRef.current;
          if (textToSubmit && textToSubmit.trim()) {
            shouldBeListeningRef.current = false;
            try {
              rec.stop();
            } catch (e) {}
            setIsListening(false);
            if (handleSendRef.current) {
              handleSendRef.current(textToSubmit);
            }
          }
        }, 1200); // 1.2s silence threshold for conversational cadence
      }
    };

    rec.onerror = (e: any) => {
      const errType = e?.error || 'desconocido';
      console.warn("Speech recognition warning:", errType);
      
      if (errType === 'not-allowed') {
        shouldBeListeningRef.current = false;
        setIsListening(false);
        if (isLiveModeRef.current) setLiveState('silent');
        setMessages(prev => [
          ...prev,
          {
            role: 'system',
            content: '⚠️ Permiso de micrófono denegado. Por favor, habilita el acceso en tu navegador.'
          }
        ]);
      } else if (errType === 'audio-capture') {
        shouldBeListeningRef.current = false;
        setIsListening(false);
        if (isLiveModeRef.current) setLiveState('silent');
        setMessages(prev => [
          ...prev,
          {
            role: 'system',
            content: '⚠️ No se puede acceder al micrófono. Verifica que no esté en uso por otra aplicación.'
          }
        ]);
      }
    };

    rec.onend = () => {
      if (shouldBeListeningRef.current) {
        try {
          rec.start();
        } catch (err) {
          console.warn("Failed to restart speech recognition:", err);
        }
      } else {
        setIsListening(false);
        if (isLiveModeRef.current && liveStateRef.current === 'listening') {
          setLiveState('silent');
        }
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, []);

  // Update hooks refs for circular callbacks
  useEffect(() => {
    startListeningRef.current = startListening;
    speakTextRef.current = speakText;
    handleSendRef.current = handleSend;
  });

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Live Hands-free hands-off toggling
  const toggleLiveMode = useCallback(() => {
    if (isLiveMode) {
      setIsLiveMode(false);
      setLiveState('silent');
      stopListening();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } else {
      setIsLiveMode(true);
      setLiveState('listening');
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setTimeout(() => {
        startListening();
      }, 300);
    }
  }, [isLiveMode, startListening, stopListening]);

  return (
    <div className={cn(
      inline ? "w-full h-full flex flex-col items-end" : "fixed bottom-6 right-6 z-50 flex flex-col items-end"
    )}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
              inline ? "w-full h-full rounded-none border-0" : `mb-4 rounded-2xl ${isExpanded ? 'w-[520px] h-[680px]' : 'w-[360px] h-[540px]'}`
            )}
          >
            {/* Header */}
            <div className="shrink-0 p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="bg-white/20 p-1.5 rounded-xl backdrop-blur-md shrink-0">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <h3 className="font-black text-sm tracking-tight leading-none mb-1 truncate w-full flex items-center gap-1.5">
                    Planta Copilot
                  </h3>
                  <div className="flex items-center gap-1.5 leading-none">
                    <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse shrink-0" />
                    <span className="text-[9px] text-blue-100 font-semibold uppercase tracking-wider font-mono truncate max-w-[160px] sm:max-w-none">Smart Engine Activo</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Hands-free voice mode trigger button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "h-7 px-2.5 gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-white border transition-all duration-300 animate-none",
                    isLiveMode 
                      ? "bg-red-500 border-red-500 hover:bg-red-600 text-white animate-pulse" 
                      : "bg-white/10 border-white/10 hover:bg-white/20 text-white"
                  )}
                  title={isLiveMode ? "Cerrar Modo En Vivo" : "Activar Modo En Vivo / Manos Libres"}
                  onClick={toggleLiveMode}
                >
                  <Sparkles className="h-3 w-3 animate-spin [animation-duration:6s]" />
                  <span>En Vivo</span>
                </Button>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/15 rounded-lg animate-none" 
                  title={isVoiceEnabled ? "Silenciar Copilot" : "Activar voz del Copilot"}
                  onClick={() => {
                    const nextVal = !isVoiceEnabled;
                    setIsVoiceEnabled(nextVal);
                    if (!nextVal) {
                      window.speechSynthesis.cancel();
                    } else {
                      const utterance = new SpeechSynthesisUtterance("Voz activada");
                      utterance.lang = "es-ES";
                      window.speechSynthesis.speak(utterance);
                    }
                  }}
                >
                  {isVoiceEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/15 rounded-lg animate-none" onClick={() => setIsExpanded(!isExpanded)}>
                  {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/15 rounded-lg animate-none" onClick={() => setIsOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Progress bar (only during generation) */}
            {isGenerating && progress > 0 && (
              <div className="shrink-0 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900">
                <div className="flex items-center justify-between text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-1.5 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Generando escenarios...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5 bg-blue-100 dark:bg-blue-900" />
              </div>
            )}

            {/* Live Hands-Free Mode Overlay screen (Fase 3) */}
            {isLiveMode ? (
              <div className="flex-1 flex flex-col items-center justify-between p-6 bg-slate-950 text-white relative overflow-hidden select-none">
                {/* Ambient dynamic glowing vectors */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />

                {/* Micro Status bar */}
                <div className="z-10 flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none">
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    liveState === 'listening' ? 'bg-emerald-400 animate-pulse' :
                    liveState === 'thinking' ? 'bg-blue-400 animate-pulse' :
                    liveState === 'speaking' ? 'bg-violet-400 animate-pulse' : 'bg-slate-500'
                  )} />
                  <span>
                    {liveState === 'listening' ? 'Escuchando' :
                     liveState === 'thinking' ? 'Pensando' :
                     liveState === 'speaking' ? 'Hablando' : 'Silencioso'}
                  </span>
                </div>

                {/* Interactive Breathing Sound Wave Orb */}
                <div className="z-10 flex flex-col items-center justify-center flex-1 my-6 relative w-full">
                  <AnimatePresence>
                    {liveState === 'listening' && (
                      <>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.45, 1] }}
                          exit={{ opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                          className="absolute w-48 h-48 rounded-full border-2 border-emerald-500/30"
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: [0.05, 0.25, 0.05], scale: [1, 1.9, 1] }}
                          exit={{ opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut", delay: 0.5 }}
                          className="absolute w-48 h-48 rounded-full border border-emerald-500/20"
                        />
                      </>
                    )}
                    {liveState === 'speaking' && (
                      <>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: [0.15, 0.5, 0.15], scale: [1, 1.35, 1] }}
                          exit={{ opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                          className="absolute w-48 h-48 rounded-full border-2 border-violet-500/30"
                        />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: [0.05, 0.3, 0.05], scale: [1, 1.7, 1] }}
                          exit={{ opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 2.3, ease: "easeInOut", delay: 0.3 }}
                          className="absolute w-48 h-48 rounded-full border border-indigo-500/20"
                        />
                      </>
                    )}
                  </AnimatePresence>

                  <motion.div
                    animate={
                      liveState === 'listening' ? { scale: [1, 1.06, 1] } :
                      liveState === 'speaking' ? { scale: [1, 1.14, 0.97, 1.06, 1], y: [0, -3, 2, -1, 0] } :
                      liveState === 'thinking' ? { rotate: 360 } : { scale: 1 }
                    }
                    transition={
                      liveState === 'listening' ? { repeat: Infinity, duration: 2, ease: "easeInOut" } :
                      liveState === 'speaking' ? { repeat: Infinity, duration: 1.4, ease: "easeInOut" } :
                      liveState === 'thinking' ? { repeat: Infinity, duration: 3.5, ease: "linear" } : {}
                    }
                    className={cn(
                      "w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative cursor-pointer",
                      liveState === 'listening' ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.4)]' :
                      liveState === 'thinking' ? 'bg-gradient-to-tr from-violet-600 via-pink-500 to-cyan-500 shadow-pink-500/40 shadow-[0_0_50px_rgba(236,72,153,0.3)]' :
                      liveState === 'speaking' ? 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/50 shadow-[0_0_50px_rgba(139,92,246,0.4)] border border-violet-400/20' :
                      'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-slate-950/50'
                    )}
                    onClick={() => {
                      if (liveState === 'speaking') {
                        if (window.speechSynthesis) window.speechSynthesis.cancel();
                        setLiveState('silent');
                      } else if (liveState === 'listening') {
                        stopListening();
                      } else {
                        startListening();
                      }
                    }}
                  >
                    {liveState === 'listening' && <Mic className="h-9 w-9 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]" />}
                    {liveState === 'thinking' && <BrainCircuit className="h-9 w-9 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]" />}
                    {liveState === 'speaking' && <Volume2 className="h-9 w-9 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]" />}
                    {liveState === 'silent' && <MicOff className="h-9 w-9 text-slate-400" />}
                  </motion.div>

                  {/* Equalizer spectrum nodes */}
                  <div className="h-8 mt-8 flex items-center justify-center gap-1.5 w-48">
                    {liveState === 'listening' ? (
                      Array.from({ length: 9 }).map((_, bi) => (
                        <motion.div
                          key={bi}
                          animate={{ height: [4, 18, 5, 26, 4] }}
                          transition={{ repeat: Infinity, duration: 0.7 + (bi % 3) * 0.15, ease: "easeInOut", delay: bi * 0.05 }}
                          className="w-1 bg-emerald-400 rounded-full"
                        />
                      ))
                    ) : liveState === 'speaking' ? (
                      Array.from({ length: 9 }).map((_, bi) => (
                        <motion.div
                          key={bi}
                          animate={{ height: [4, 24, 4, 14, 4] }}
                          transition={{ repeat: Infinity, duration: 0.6 + (bi % 2) * 0.2, ease: "easeInOut", delay: bi * 0.08 }}
                          className="w-1 bg-violet-400 rounded-full"
                        />
                      ))
                    ) : (
                      <div className="w-16 h-[2.5px] bg-white/10 rounded-full" />
                    )}
                  </div>
                </div>

                {/* Subtitles & text visualization */}
                <div className="z-10 text-center px-4 max-w-sm mb-4">
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1.5">
                    {liveState === 'listening' ? 'Tú dices:' : 'Copilot responde:'}
                  </p>
                  <p className="text-[13px] font-semibold leading-relaxed min-h-[3em] line-clamp-3 text-slate-200 font-sans tracking-wide">
                    {liveState === 'listening' ? (
                      input || <span className="text-slate-600 italic">"Te escucho... dime qué planificamos"</span>
                    ) : liveState === 'thinking' ? (
                      <span className="text-blue-400 animate-pulse font-semibold">Razonando plan de envasado seguro...</span>
                    ) : liveState === 'speaking' ? (
                      messages[messages.length - 1]?.content ? (
                        messages[messages.length - 1].content.length > 110 
                          ? messages[messages.length - 1].content.slice(0, 110) + '...'
                          : messages[messages.length - 1].content
                      ) : 'Hablando...'
                    ) : (
                      <span className="text-slate-600">Copilot Silenciado. Pulsa el orbe para hablar.</span>
                    )}
                  </p>
                </div>

                {/* Quick actions hands free */}
                <div className="z-10 flex flex-col gap-2 w-full max-w-xs shrink-0">
                  {liveState === 'silent' && (
                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-5 font-bold text-xs gap-1.5 animate-none"
                      onClick={startListening}
                    >
                      <Mic className="h-4 w-4" /> Empezar a Hablar
                    </Button>
                  )}
                  {liveState === 'listening' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl py-5 font-bold text-xs gap-1.5 animate-none"
                      onClick={stopListening}
                    >
                      <MicOff className="h-4 w-4" /> Silenciar Micrófono
                    </Button>
                  )}
                  {liveState === 'speaking' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl py-5 font-bold text-xs gap-1.5 animate-none"
                      onClick={() => {
                        if (window.speechSynthesis) window.speechSynthesis.cancel();
                        setLiveState('silent');
                      }}
                    >
                      <VolumeX className="h-4 w-4" /> Detener Voz
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full hover:bg-white/5 hover:text-white text-slate-400 rounded-xl font-bold text-[10px] uppercase tracking-widest leading-none mt-1 animate-none"
                    onClick={toggleLiveMode}
                  >
                    Salir de Modo En Vivo
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Messages Panel */}
                <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
                  <div className="space-y-3">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[90%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/50 dark:border-slate-700/50'
                        }`}>
                          {m.isLoading ? (
                            <div className="space-y-2.5 py-0.5">
                              <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300 font-semibold animate-pulse leading-normal">
                                <BrainCircuit className="h-4 w-4 text-blue-500 shrink-0 mt-0.5 animate-spin [animation-duration:4s]" />
                                <span>{m.content || "Planta Copilot está pensando..."}</span>
                              </div>
                              <div className="flex gap-1 pl-6">
                                <div className="h-1 w-1 bg-slate-400 rounded-full animate-bounce" />
                                <div className="h-1 w-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                                <div className="h-1 w-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                              </div>
                            </div>
                          ) : (
                            <span style={{ whiteSpace: 'pre-wrap' }}>
                              {renderFormattedContent(m.content)}
                            </span>
                          )}
                        </div>

                        {/* Executed Actions Indicators */}
                        {m.executedActions && m.executedActions.length > 0 && (
                          <div className="mt-1.5 space-y-1 w-[85%] self-start">
                            {m.executedActions.map((act, ai) => (
                              <div key={ai} className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl text-[10px] font-medium transition-all duration-200",
                                act.type === 'Preferencia Aprendida'
                                  ? "bg-indigo-50/80 dark:bg-indigo-950/20 border-indigo-200/50 dark:border-indigo-900/50 text-indigo-800 dark:text-indigo-300 hover:shadow-sm"
                                  : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                              )}>
                                {act.type === 'Preferencia Aprendida' ? (
                                  <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[7px] font-black uppercase tracking-wider shrink-0 px-1 py-0 border-0">
                                    ✨ Aprendido
                                  </Badge>
                                ) : (
                                  <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                                )}
                                <span><strong>[{act.type}]:</strong> {act.description}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Scenario Cards */}
                        {m.scenarios && m.scenarios.length > 0 && (
                          <div className="w-full mt-2 space-y-2">
                            {m.scenarios.map((sc: any, si: number) => (
                              <div key={si} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-tight">{sc.name}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{sc.description}</p>
                                  </div>
                                  <Badge className="shrink-0 text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0">
                                    #{si + 1}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                  {sc.requiresWeekends && <Badge variant="outline" className="text-[9px] py-0 border-slate-200 dark:border-slate-700">Fines de semana</Badge>}
                                  {sc.requiresNightShift && <Badge variant="outline" className="text-[9px] py-0 border-slate-200 dark:border-slate-700">Turno noche</Badge>}
                                  {sc.weeklyBlocks?.length > 0 && <Badge variant="outline" className="text-[9px] py-0 border-slate-200 dark:border-slate-700">{sc.weeklyBlocks.length} semanas</Badge>}
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full h-7 text-[10px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5 animate-none"
                                  onClick={() => handleApplyScenario(sc)}
                                >
                                  <Zap className="h-3 w-3" /> Aplicar con Smart Engine
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Draft Scenario Interactive Approve Card */}
                {pendingPlan && (
                  <div className="shrink-0 p-3 bg-amber-50/90 dark:bg-amber-950/20 border-t border-b border-amber-200/50 dark:border-amber-900/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-start gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 leading-tight">
                          Propuesta de Plan de Producción de IA
                        </p>
                        <p className="text-[9.5px] text-amber-600 dark:text-amber-400/80 mt-0.5 leading-snug">
                          La IA ha diseñado un escenario de distribución para las próximas semanas. Revisa y aprueba este plan antes de inyectarlo en el calendario:
                        </p>
                      </div>
                    </div>

                    <div className="max-h-28 overflow-y-auto mb-2.5 rounded-lg border border-amber-200/40 dark:border-amber-900/30 bg-white/70 dark:bg-slate-900/50 p-2 space-y-1.5 no-scrollbar">
                      {pendingPlan.weeklyBlocks
                        .filter((wb: any) => wb !== null && wb !== undefined)
                        .map((wb: any, wi: number) => (
                        <div key={wi} className="text-[9.5px] text-slate-700 dark:text-slate-300 font-medium">
                          <span className="font-bold text-blue-600 dark:text-blue-400">Semana {wb.weekNumber || (wi + 1)}:</span>
                          <div className="pl-2 mt-0.5 space-y-0.5">
                            {wb.allocations?.map((alloc: any, ai: number) => {
                              const prod = products.find(p => p.id === alloc.productId);
                              const productName = prod ? prod.productName : (alloc.productName || alloc.productId);
                              return (
                                <div key={ai} className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>Envasadora {alloc.machineId}: <strong className="text-slate-900 dark:text-slate-100">{productName}</strong> ({alloc.shiftsPerDay === 2 ? 'Turno Doble' : 'Turno Único'}, {alloc.daysActive} días)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1 animate-none"
                        onClick={async () => {
                          onApplyScenario(pendingPlan);
                          setPendingPlan(null);
                          speakText("Excelente. El plan de producción inteligente ha sido aprobado e inyectado con éxito en el calendario.");
                          setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: `✅ **Plan de Producción aprobado y aplicado.** El calendario de proyección ha sido actualizado de forma segura con el escenario estructurado por la IA.`
                          }]);
                          
                          // Save plan approval to Firestore Memory (Fase 2)
                          try {
                            await saveCopilotMemory('system', 'El operador aprobó y aplicó un plan de producción inteligente estructurado por la IA.', 'APPLY_PLAN_APPROVED', pendingPlan);
                          } catch (e) {
                            console.error("[Memory Error] Failed to write plan approval to Firestore", e);
                          }
                        }}
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Aprobar y Aplicar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-3 text-[10px] font-bold border-slate-200 dark:border-slate-800 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg animate-none"
                        onClick={async () => {
                          setPendingPlan(null);
                          speakText("Plan descartado. Puedes darme otra indicación para planificar de forma distinta.");
                          
                          // Save plan discardment to Firestore Memory (Fase 2)
                          try {
                            await saveCopilotMemory('system', 'El operador rechazó y descartó un plan de producción inteligente estructurado por la IA.', 'APPLY_PLAN_REJECTED', pendingPlan);
                          } catch (e) {
                            console.error("[Memory Error] Failed to write plan rejection to Firestore", e);
                          }
                        }}
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input panel */}
                <div className="shrink-0 p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex gap-2 items-center w-full">
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-9 w-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 transition-all duration-300 animate-none",
                        isListening 
                          ? "bg-red-500 border-red-500 hover:bg-red-600 text-white animate-pulse" 
                          : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                      )}
                      title={isListening ? "Escuchando... Haz clic para detener" : "Hablar por micrófono"}
                      onClick={toggleListening}
                      disabled={isGenerating}
                    >
                      {isListening ? <MicOff className="h-4 w-4 text-white" /> : <Mic className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
                    </Button>
                    <textarea
                      ref={textareaRef}
                      placeholder={isListening ? "Escuchando... habla ahora" : "Escribe o habla por micrófono..."}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs px-3 py-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none flex-1 resize-none h-9 min-h-[36px] max-h-[120px] transition-all no-scrollbar leading-normal"
                      value={input}
                      onChange={e => {
                        setInput(e.target.value);
                        const textarea = e.target;
                        textarea.style.height = '36px';
                        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      disabled={isGenerating || isListening}
                      rows={1}
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-xl animate-none"
                      onClick={() => handleSend()}
                      disabled={isGenerating || !input.trim() || isListening}
                    >
                      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
                    </Button>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1.5 text-center flex items-center justify-center gap-1 uppercase tracking-widest font-semibold font-sans">
                    <Sparkles className="h-2.5 w-2.5 text-blue-500" /> Gemini + Smart Engine — Control 7
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main floating FAB button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative h-14 w-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 ${
          isOpen ? 'bg-slate-800 rotate-90' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
        }`}
      >
        {isOpen
          ? <X className="h-6 w-6 text-white" />
          : <BrainCircuit className="h-6 w-6 text-white" />
        }
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
          </span>
        )}
      </motion.button>
    </div>
  );
}

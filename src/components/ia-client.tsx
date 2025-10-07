'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, PackageCheck, ArrowRight, AlertTriangle, Upload, Edit, Beaker, Play, Pause, RefreshCw, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProductDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/kpi-card';
import { Separator } from '@/components/ui/separator';
import { Pie, Cell, ResponsiveContainer, PieChart, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';


const KG_PER_QUINTAL = 45.3592;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

type MachineState = {
    id: number;
    productId: string;
    speed: number;
    loss: number;
    unitsPerSack: number;
    imageUrl: string | null;
};

type RawMaterialSource = {
  id: string;
  name: string;
  quantityQQ: number;
  imageUrl: string | null;
};

type SimulationState = {
    elapsedTime: number; // in seconds
    machineTotals: { [machineId: number]: number };
    wrapperBuffer: number;
    currentBundleProgress: number;
    totalBundles: number;
    isFinished: boolean;
};

function MachineEditDialog({
    machine,
    products,
    open,
    onOpenChange,
    onSave,
}: {
    machine: MachineState;
    products: ProductDefinition[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedMachine: MachineState) => void;
}) {
    const [editedMachine, setEditedMachine] = React.useState(machine);

    React.useEffect(() => {
        setEditedMachine(machine);
    }, [machine]);

    const handleFieldChange = (field: keyof MachineState, value: any) => {
        const newMachine = { ...editedMachine, [field]: value };
        if (field === 'productId') {
            const product = products.find(p => p.id === value);
            newMachine.unitsPerSack = product?.unitsPerSack || 1;
        }
        setEditedMachine(newMachine);
    };

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            handleFieldChange('imageUrl', reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const fileInputId = `modal-image-upload-${machine.id}`;
    
    const handleSaveChanges = () => {
        onSave(editedMachine);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Máquina {machine.id}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                     <div className="space-y-2">
                        <Label>Previsualización de la Imagen</Label>
                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                            <Image 
                                src={editedMachine.imageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"} 
                                alt={`Máquina ${editedMachine.id}`}
                                width={600}
                                height={400}
                                className="object-contain w-full h-full"
                            />
                        </div>
                        <input
                            type="file"
                            id={fileInputId}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                        />
                        <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById(fileInputId)?.click()}>
                            <Upload className="mr-2 h-3 w-3" />
                            Cambiar Foto
                        </Button>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={`product-${machine.id}`}>Producto</Label>
                        <Select value={editedMachine.productId} onValueChange={(val) => handleFieldChange('productId', val)}>
                            <SelectTrigger id={`product-${machine.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="inactive">-- Inactiva --</SelectItem>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor={`speed-${machine.id}`}>Velocidad (fundas/min)</Label>
                            <Input id={`speed-${machine.id}`} type="number" value={editedMachine.speed} onChange={e => handleFieldChange('speed', Number(e.target.value))}/>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`loss-${machine.id}`}>Merma (%)</Label>
                            <Input id={`loss-${machine.id}`} type="number" value={editedMachine.loss} onChange={e => handleFieldChange('loss', Number(e.target.value))}/>
                        </div>
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor={`units-${machine.id}`}>Unidades por Saco/Fardo</Label>
                        <Input id={`units-${machine.id}`} type="number" value={editedMachine.unitsPerSack} onChange={e => handleFieldChange('unitsPerSack', Number(e.target.value))}/>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSaveChanges}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function OperationsClient({ 
  prefetchedProducts,
}: { 
  prefetchedProducts: ProductDefinition[],
}) {
    const [isClient, setIsClient] = React.useState(false);
    const products = React.useMemo(() => prefetchedProducts.filter(p => p.isActive), [prefetchedProducts]);
    const [editingMachine, setEditingMachine] = React.useState<MachineState | null>(null);
    
    const [rawMaterials, setRawMaterials] = React.useState<RawMaterialSource[]>([
        { id: 'tachos', name: 'Tachos', quantityQQ: 0, imageUrl: null },
        { id: 'familiar', name: 'Silo Familiar', quantityQQ: 0, imageUrl: null },
        { id: 'granel', name: 'Silo a Granel', quantityQQ: 700, imageUrl: null },
    ]);

    const handleRawMaterialChange = (id: string, field: 'quantityQQ' | 'imageUrl', value: any) => {
        setRawMaterials(prev => prev.map(rm => rm.id === id ? { ...rm, [field]: value } : rm));
    };

    const handleRawMaterialImageUpload = (id: string, file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            handleRawMaterialChange(id, 'imageUrl', reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const tachosQQ = rawMaterials.find(rm => rm.id === 'tachos')?.quantityQQ || 0;
    const silosQQ = (rawMaterials.find(rm => rm.id === 'familiar')?.quantityQQ || 0) + (rawMaterials.find(rm => rm.id === 'granel')?.quantityQQ || 0);
    const totalQuintales = tachosQQ + silosQQ;
    const siloAmount = totalQuintales * KG_PER_QUINTAL;

    const [machines, setMachines] = React.useState<MachineState[]>(() => {
        const firstProduct = prefetchedProducts.find(p => p.isActive);
        return [
            { id: 1, productId: firstProduct?.id || 'inactive', speed: 40, loss: 2, unitsPerSack: firstProduct?.unitsPerSack || 1, imageUrl: null },
            { id: 2, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null },
            { id: 3, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null },
            { id: 4, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null },
        ];
    });

    const [wrapperCapacity, setWrapperCapacity] = React.useState(110);
    const [unitsPerBundle, setUnitsPerBundle] = React.useState(12);
    const [wrapperImageUrl, setWrapperImageUrl] = React.useState<string | null>(null);

    const handleWrapperImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setWrapperImageUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // --- Simulation State ---
    const [isSimulating, setIsSimulating] = React.useState(false);
    const initialSimState: SimulationState = {
        elapsedTime: 0,
        machineTotals: { 1: 0, 2: 0, 3: 0, 4: 0 },
        wrapperBuffer: 0,
        currentBundleProgress: 0,
        totalBundles: 0,
        isFinished: false,
    };
    const [simulationState, setSimulationState] = React.useState<SimulationState>(initialSimState);
    const simulationIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const [timeMultiplier, setTimeMultiplier] = React.useState(1);
    const [startTime, setStartTime] = React.useState('08:00');
    const [endTime, setEndTime] = React.useState('16:00');
    const TICK_RATE_MS = 100;


    const simulationResults = React.useMemo(() => {
        const activeMachines = machines.filter(m => m.productId !== 'inactive');
        
        const packingCapacity = activeMachines.map(machine => {
            const product = products.find(p => p.id === machine.productId);
            if (!product) return { machineId: machine.id, bagsPerMinute: 0, kgPerMinute: 0, productName: 'N/A' };
            const effectiveBagsPerMinute = machine.speed * (1 - machine.loss / 100);
            return {
                machineId: machine.id,
                bagsPerMinute: effectiveBagsPerMinute,
                kgPerMinute: effectiveBagsPerMinute * (product.sackWeight || 50),
                productName: product.productName,
            };
        });

        const totalBagsPerMinuteFromPackers = packingCapacity.reduce((sum, m) => sum + m.bagsPerMinute, 0);
        const totalKgPerMinuteFromPackers = packingCapacity.reduce((sum, m) => sum + m.kgPerMinute, 0);

        const isWrapperBottleneck = totalBagsPerMinuteFromPackers > wrapperCapacity;
        
        const effectiveBagsPerMinute = Math.min(totalBagsPerMinuteFromPackers, wrapperCapacity);
        const bundlesPerMinute = unitsPerBundle > 0 ? Math.floor(effectiveBagsPerMinute / unitsPerBundle) : 0;
        
        let effectiveKgPerMinute = 0;
        if (totalBagsPerMinuteFromPackers > 0) {
            const reductionFactor = isWrapperBottleneck ? wrapperCapacity / totalBagsPerMinuteFromPackers : 1;
            effectiveKgPerMinute = totalKgPerMinuteFromPackers * reductionFactor;
        }

        const bottleneckDescription = `La enfardadora (cap: ${wrapperCapacity.toLocaleString()} fundas/min) limita a las envasadoras (cap: ${totalBagsPerMinuteFromPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} fundas/min).`;
        const noBottleneckDescription = `Las envasadoras (cap: ${totalBagsPerMinuteFromPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} fundas/min) operan dentro de la capacidad de la enfardadora (${wrapperCapacity.toLocaleString()} fundas/min).`;

        const timeToEmptyHours = effectiveKgPerMinute > 0 ? (siloAmount / effectiveKgPerMinute) / 60 : 0;
        const totalBagsProduced = effectiveBagsPerMinute * 60 * timeToEmptyHours;
        
        const machineContribution = packingCapacity.map(m => ({ 
            name: `Máq. ${m.machineId} (${m.productName})`, 
            value: isNaN(m.bagsPerMinute / totalBagsPerMinuteFromPackers * totalBagsProduced) ? 0 : (m.bagsPerMinute / totalBagsPerMinuteFromPackers * totalBagsProduced) 
        }));

        return {
            timeToEmptyHours,
            totalBagsProduced,
            isWrapperBottleneck,
            bottleneckDescription,
            noBottleneckDescription,
            machineProduction: packingCapacity.map(m => {
                const totalKgProduced = effectiveKgPerMinute * 60 * timeToEmptyHours;
                const machineKgShare = totalKgPerMinuteFromPackers > 0 ? m.kgPerMinute / totalKgPerMinuteFromPackers : 0;
                return {
                    id: m.machineId,
                    productName: m.productName,
                    sacks: (totalBagsPerMinuteFromPackers > 0 ? m.bagsPerMinute / totalBagsPerMinuteFromPackers : 0) * totalBagsProduced,
                    weight: machineKgShare * totalKgProduced,
                }
            }),
            machineContribution,
            totalBagsPerMinuteFromPackers,
            totalBagsPerHourFromAllPackers: totalBagsPerMinuteFromPackers * 60,
            effectiveWrapperBagsPerHour: wrapperCapacity * 60,
            bundlesPerMinute,
        };

    }, [siloAmount, machines, products, wrapperCapacity, unitsPerBundle]);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const parseTimeToSeconds = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return (hours * 3600) + (minutes * 60);
    };

    const formatElapsedTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    
    const startSimulation = () => {
        if (isSimulating) return;
        setSimulationState(prev => ({...prev, isFinished: false}));
        setIsSimulating(true);

        const activeMachinesConfig = machines
            .filter(m => m.productId !== 'inactive')
            .map(m => ({
                id: m.id,
                bagsPerSecond: (m.speed * (1 - m.loss / 100)) / 60
            }));

        const wrapperBagsPerSecond = wrapperCapacity / 60;
        const totalDurationSeconds = parseTimeToSeconds(endTime) - parseTimeToSeconds(startTime);

        simulationIntervalRef.current = setInterval(() => {
            setSimulationState(prev => {
                if (prev.elapsedTime >= totalDurationSeconds) {
                    stopSimulation();
                    return {...prev, isFinished: true};
                }

                const elapsedIncrement = (TICK_RATE_MS / 1000) * timeMultiplier;
                const newElapsedTime = prev.elapsedTime + elapsedIncrement;

                const newMachineTotals = { ...prev.machineTotals };
                let newWrapperBuffer = prev.wrapperBuffer;
                let newCurrentBundleProgress = prev.currentBundleProgress;
                let newTotalBundles = prev.totalBundles;

                activeMachinesConfig.forEach(m => {
                    const bagsProducedThisTick = m.bagsPerSecond * elapsedIncrement;
                    newMachineTotals[m.id] += bagsProducedThisTick;
                    newWrapperBuffer += bagsProducedThisTick;
                });

                let bagsToProcessThisTick = wrapperBagsPerSecond * elapsedIncrement;
                const bagsAvailable = newWrapperBuffer + newCurrentBundleProgress;
                bagsToProcessThisTick = Math.min(bagsToProcessThisTick, bagsAvailable);
                
                const consumedFromBuffer = Math.min(newWrapperBuffer, bagsToProcessThisTick);
                newWrapperBuffer -= consumedFromBuffer;
                newCurrentBundleProgress += bagsToProcessThisTick;

                if (newCurrentBundleProgress >= unitsPerBundle && unitsPerBundle > 0) {
                    const bundlesCreated = Math.floor(newCurrentBundleProgress / unitsPerBundle);
                    newTotalBundles += bundlesCreated;
                    newCurrentBundleProgress %= unitsPerBundle;
                }

                return {
                    elapsedTime: newElapsedTime > totalDurationSeconds ? totalDurationSeconds : newElapsedTime,
                    machineTotals: newMachineTotals,
                    wrapperBuffer: newWrapperBuffer,
                    currentBundleProgress: newCurrentBundleProgress,
                    totalBundles: newTotalBundles,
                    isFinished: newElapsedTime >= totalDurationSeconds,
                };
            });
        }, TICK_RATE_MS);
    };

    const stopSimulation = () => {
        setIsSimulating(false);
        if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
        }
    };
    
    const resetSimulation = () => {
        stopSimulation();
        setSimulationState(initialSimState);
    };
    
    React.useEffect(() => {
      return () => stopSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSaveMachine = (updatedMachine: MachineState) => {
        setMachines(prev => prev.map(m => m.id === updatedMachine.id ? updatedMachine : m));
    };
    
    const formatTime = (hours: number) => {
        if (!isFinite(hours) || hours <= 0) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };
    
  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Panel de Operaciones</h1>
        </div>
        <Link href="/"><Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver a la Planificación</Button></Link>
      </header>
      
      <main className="p-4 md:p-8 space-y-8">
        {!isClient ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-muted-foreground">Cargando panel de operaciones...</p>
          </div>
        ) : (
        <>
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-center mb-4">Flujo del Proceso de Producción</h3>
                <div className="flex justify-around items-center p-4 border rounded-lg bg-muted/30">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <Beaker className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Tachos</h4>
                                    <p className="text-sm text-muted-foreground">{tachosQQ.toLocaleString()} QQ</p>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Materia prima en etapa inicial.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <Warehouse className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Silos</h4>
                                    <p className="text-sm text-muted-foreground">{silosQQ.toLocaleString()} QQ</p>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Materia prima total en silos (Familiar + Granel).</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />
                    
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className={cn("flex flex-col items-center gap-2 text-center p-2 rounded-md", simulationResults.isWrapperBottleneck && 'bg-destructive/10')}>
                                    <Package className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Envasadoras</h4>
                                    <p className={cn("text-sm", simulationResults.isWrapperBottleneck ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                                        {(simulationResults.totalBagsPerMinuteFromPackers).toLocaleString(undefined, {maximumFractionDigits: 0})} fundas/min
                                    </p>
                                </div>
                            </TooltipTrigger>
                             <TooltipContent>
                                <p>Producción total de las envasadoras activas.</p>
                                {simulationResults.isWrapperBottleneck && <p className="text-destructive font-semibold">¡Limitadas por la enfardadora!</p>}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />
                    
                    <TooltipProvider>
                         <Tooltip>
                            <TooltipTrigger>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <PackageCheck className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Enfardadora</h4>
                                    <p className={cn("text-sm", simulationResults.isWrapperBottleneck ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                                        {simulationResults.bundlesPerMinute.toLocaleString(undefined, {maximumFractionDigits: 0})} fardos/min
                                    </p>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Producción efectiva de la línea de empaque final.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
            
            <div className="space-y-8">
                <Card>
                    <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <CardTitle>Controles de Simulación</CardTitle>
                        <div className="flex items-center gap-2">
                             <Button onClick={startSimulation} disabled={isSimulating || simulationState.isFinished} variant="secondary">
                                <Play className="mr-2" /> Iniciar
                            </Button>
                            <Button onClick={stopSimulation} disabled={!isSimulating} variant="destructive">
                                <Pause className="mr-2" /> Detener
                            </Button>
                            <Button onClick={resetSimulation} variant="outline">
                                <RefreshCw className="mr-2" /> Reiniciar
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="sim-start-time">Hora de Inicio</Label>
                                    <Input id="sim-start-time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={isSimulating} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="sim-end-time">Hora de Fin</Label>
                                    <Input id="sim-end-time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={isSimulating} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sim-speed">Acelerador de Tiempo ({timeMultiplier}x)</Label>
                                <Slider
                                    id="sim-speed"
                                    min={1}
                                    max={1000}
                                    step={1}
                                    value={[timeMultiplier]}
                                    onValueChange={(val) => setTimeMultiplier(val[0])}
                                    disabled={isSimulating}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-muted/30 border rounded-lg p-4">
                            <Clock className="h-6 w-6 text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Tiempo de Simulación Transcurrido</p>
                            <p className="text-4xl font-bold font-mono text-primary">{formatElapsedTime(simulationState.elapsedTime)}</p>
                            {simulationState.isFinished && <p className="text-green-600 font-semibold mt-2">¡Simulación Completada!</p>}
                        </div>
                    </CardContent>
                </Card>


                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">1. Materia Prima</CardTitle>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Disponible</p>
                            <p className="text-2xl font-bold text-primary">{totalQuintales.toLocaleString()} QQ</p>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {rawMaterials.map((rm) => (
                            <div key={rm.id} className="p-4 border rounded-lg space-y-3 bg-background">
                                <Label className="font-bold text-primary">{rm.name}</Label>
                                <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                                    <Image
                                        src={rm.imageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"}
                                        alt={rm.name}
                                        width={600}
                                        height={400}
                                        className="object-contain w-full h-full"
                                    />
                                </div>
                                 <input
                                    type="file"
                                    id={`rm-image-upload-${rm.id}`}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => e.target.files && handleRawMaterialImageUpload(rm.id, e.target.files[0])}
                                />
                                <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById(`rm-image-upload-${rm.id}`)?.click()}>
                                    <Upload className="mr-2 h-3 w-3" />
                                    Cambiar Foto
                                </Button>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`rm-qq-${rm.id}`}>Cantidad (QQ)</Label>
                                    <Input
                                        id={`rm-qq-${rm.id}`}
                                        type="number"
                                        value={rm.quantityQQ}
                                        onChange={(e) => handleRawMaterialChange(rm.id, 'quantityQQ', Number(e.target.value))}
                                        min="0"
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">2. Configuración de Envasadoras</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            {machines.map((machine) => {
                                const product = products.find(p => p.id === machine.productId);
                                const unitsPerMinuteNeto = machine.speed * (1 - machine.loss / 100);
                                const sacksPerMinuteNeto = (machine.unitsPerSack > 0) ? (unitsPerMinuteNeto / machine.unitsPerSack) : 0;
                                const cycleProgress = isSimulating ? (simulationState.elapsedTime * 1000 / TICK_RATE_MS * ((unitsPerMinuteNeto/60) * (TICK_RATE_MS/1000)) % unitsPerMinuteNeto) / unitsPerMinuteNeto * 100 : 0;

                                return (
                                    <div key={machine.id} className="p-3 border rounded-lg space-y-3 bg-background relative">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold text-primary">Máquina {machine.id}</Label>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMachine(machine)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        
                                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                                            <Image 
                                                src={machine.imageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"} 
                                                alt={`Máquina ${machine.id}`}
                                                width={600}
                                                height={400}
                                                className="object-contain w-full h-full"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">Producto</p>
                                            <p className="font-semibold truncate" title={product?.productName || 'Inactiva'}>
                                                {product?.productName || 'Inactiva'}
                                            </p>
                                        </div>

                                        {machine.productId !== 'inactive' && (
                                          <>
                                            <div className="space-y-2 rounded-lg bg-muted/30 p-2 border text-xs">
                                                <h3 className="font-semibold text-center text-muted-foreground">Configuración Clave</h3>
                                                <div className="grid grid-cols-3 gap-1 text-center">
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Velocidad</p>
                                                        <p className="font-bold text-sm">{machine.speed} <span className="text-xs font-normal">f/min</span></p>
                                                    </div>
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Merma</p>
                                                        <p className="font-bold text-sm">{machine.loss}%</p>
                                                    </div>
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Unidades</p>
                                                        <p className="font-bold text-sm">{machine.unitsPerSack}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2 rounded-lg bg-muted/30 p-2 border text-xs">
                                                <h3 className="font-semibold text-center text-muted-foreground">Rendimiento (Neto)</h3>
                                                <div className="grid grid-cols-2 gap-2 text-center">
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Fundas/Min</p>
                                                        <p className="font-bold text-sm">{unitsPerMinuteNeto.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                                    </div>
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Sacos/Min</p>
                                                        <p className="font-bold text-sm text-green-600">{sacksPerMinuteNeto.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Producción Total</Label>
                                                <p className="text-lg font-bold text-center text-primary">{Math.floor(simulationState.machineTotals[machine.id] || 0).toLocaleString()}</p>
                                                <Progress value={cycleProgress} className="h-1" />
                                            </div>
                                          </>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">3. Enfardadora y Empaque Final</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 border rounded-lg space-y-3 bg-background md:col-span-1">
                            <Label className="font-bold text-primary">Enfardadora</Label>
                            <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                                <Image
                                    src={wrapperImageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"}
                                    alt="Enfardadora"
                                    width={600}
                                    height={400}
                                    className="object-contain w-full h-full"
                                />
                            </div>
                            <input
                                type="file"
                                id="wrapper-image-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => e.target.files && handleWrapperImageUpload(e.target.files[0])}
                            />
                            <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById('wrapper-image-upload')?.click()}>
                                <Upload className="mr-2 h-3 w-3" />
                                Cambiar Foto
                            </Button>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="wrapper-capacity">Capacidad Máxima (fundas/min)</Label>
                                <Input id="wrapper-capacity" type="number" value={wrapperCapacity} onChange={e => setWrapperCapacity(Number(e.target.value))}/>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="units-per-bundle">Unidades por Fardo</Label>
                                <Input id="units-per-bundle" type="number" value={unitsPerBundle} onChange={e => setUnitsPerBundle(Number(e.target.value))}/>
                            </div>
                             <div className="sm:col-span-2 space-y-4 rounded-lg bg-muted/30 p-3 border">
                                 <div className="grid grid-cols-2 gap-2 text-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Buffer de Entrada</p>
                                        <p className="font-bold text-lg text-blue-600">{Math.floor(simulationState.wrapperBuffer).toLocaleString()} <span className="text-sm font-normal">fundas</span></p>
                                    </div>
                                     <div>
                                        <p className="text-xs text-muted-foreground">Total Fardos</p>
                                        <p className="font-bold text-lg text-green-600">{simulationState.totalBundles.toLocaleString()}</p>
                                    </div>
                                 </div>
                                 <div>
                                     <Label className="text-xs">Fardo Actual ({Math.floor(simulationState.currentBundleProgress)}/{unitsPerBundle} fundas)</Label>
                                     <Progress value={(simulationState.currentBundleProgress / (unitsPerBundle || 1)) * 100} />
                                 </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <div className="space-y-6">
                    <h3 className="font-semibold text-xl text-center">Resultados Globales de la Línea</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KpiCard title="Tiempo para Agotar Silo" value={formatTime(simulationResults.timeToEmptyHours)} icon={Factory} description="Tiempo total estimado para procesar toda la materia prima." />
                        <KpiCard title="Producción Total (Sacos)" value={simulationResults.totalBagsProduced} icon={Package} description="Cantidad total de sacos que se producirán." fractionDigits={0} />
                        <KpiCard title="Producción Total (QQ)" value={simulationResults.machineProduction.reduce((sum, p) => sum + p.weight, 0) / KG_PER_QUINTAL} icon={Warehouse} description={`Basado en la cantidad del silo (${totalQuintales.toLocaleString()} QQ).`} fractionDigits={1}/>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">Análisis de Cuello de Botella</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-sm p-3 rounded-md flex items-start gap-3", simulationResults.isWrapperBottleneck ? 'bg-destructive/10 text-destructive' : 'bg-green-600/10 text-green-700')}>
                                <AlertTriangle className="h-5 w-5 mt-0.5" />
                                <div>
                                    <h4 className="font-bold mb-1">{simulationResults.isWrapperBottleneck ? "¡Cuello de Botella Detectado!" : "Operación Eficiente"}</h4>
                                    <p>{simulationResults.isWrapperBottleneck ? simulationResults.bottleneckDescription : simulationResults.noBottleneckDescription}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">Contribución por Máquina</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {simulationResults.machineContribution.every(m => m.value === 0) ? (
                                <p className="text-center text-muted-foreground h-[200px] flex items-center justify-center">Activa una máquina para ver la contribución.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={simulationResults.machineContribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                            {simulationResults.machineContribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `${value.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            {editingMachine && (
                <MachineEditDialog
                    open={!!editingMachine}
                    onOpenChange={(isOpen) => !isOpen && setEditingMachine(null)}
                    machine={editingMachine}
                    products={products}
                    onSave={handleSaveMachine}
                />
            )}
        </>
        )}
      </main>
    </div>
  );
}

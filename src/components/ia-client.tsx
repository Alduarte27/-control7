'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, PackageCheck, ArrowRight, AlertTriangle, Upload, Edit, Beaker, Play, Pause, RefreshCw, Clock, Zap, Minus, Plus, Power, PowerOff } from 'lucide-react';
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
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';


const KG_PER_QUINTAL = 50;
const MASA_QQ_AMOUNT = 380;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];
const FUNDAS_PER_SACO = 50;

type MachineState = {
    id: number;
    productId: string;
    speed: number;
    loss: number;
    unitsPerSack: number;
    imageUrl: string | null;
    isSimulatingActive: boolean; 
};

type SiloState = {
  id: string;
  name: string;
  capacityQQ: number;
  currentQQ: number;
  imageUrl: string | null;
};

type ConveyorItem = {
    producedAt: number; // The simulation time it was produced
    units: number;
};

type SimulationState = {
    elapsedTime: number; // in seconds
    machineTotals: { [machineId: number]: number }; // Total units produced by each machine
    conveyorBelt: ConveyorItem[]; // Units currently in transit
    wrapperBuffer: number; // Units that have arrived and are ready for wrapping
    currentBundleProgress: number;
    totalBundles: number;
    isFinished: boolean;
    nextAutoTachosSendTime: number;
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

    const handleFieldChange = (field: keyof Omit<MachineState, 'isSimulatingActive'>, value: any) => {
        const newMachine = { ...editedMachine, [field]: value };
        if (field === 'productId') {
            const product = products.find(p => p.id === value);
            // @ts-ignore
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
                        <Label htmlFor={`units-${machine.id}`}>Unidades por Fardo</Label>
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

function SiloEditDialog({
    silo,
    isTachos,
    open,
    onOpenChange,
    onSave,
}: {
    silo: SiloState;
    isTachos?: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedSilo: SiloState) => void;
}) {
    const [editedSilo, setEditedSilo] = React.useState(silo);

    React.useEffect(() => {
        setEditedSilo(silo);
    }, [silo]);

    const handleFieldChange = (field: keyof SiloState, value: any) => {
        setEditedSilo(prev => ({ ...prev, [field]: value }));
    };

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            handleFieldChange('imageUrl', reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const fileInputId = `silo-modal-image-upload-${silo.id}`;
    
    const handleSaveChanges = () => {
        onSave(editedSilo);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar {silo.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                     <div className="space-y-2">
                        <Label>Previsualización de la Imagen</Label>
                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                            <Image 
                                src={editedSilo.imageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"} 
                                alt={editedSilo.name}
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
                    {!isTachos && (
                        <div className="space-y-1.5">
                            <Label htmlFor={`silo-cap-${silo.id}`}>Capacidad Máx. (QQ)</Label>
                            <Input id={`silo-cap-${silo.id}`} type="number" value={editedSilo.capacityQQ} onChange={(e) => handleFieldChange('capacityQQ', Number(e.target.value))} min="0" />
                        </div>
                    )}
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
    const [editingSilo, setEditingSilo] = React.useState<SiloState | null>(null);
    
    // --- Raw Material State ---
    const [masasToSend, setMasasToSend] = React.useState(1);
    const [totalMasasSent, setTotalMasasSent] = React.useState(0);
    const [isTachosAuto, setIsTachosAuto] = React.useState(false);
    const [autoTachosInterval, setAutoTachosInterval] = React.useState(90); // in minutes
    const [silos, setSilos] = React.useState<SiloState[]>([
        { id: 'familiar', name: 'Silo Familiar', capacityQQ: 380, currentQQ: 0, imageUrl: null },
        { id: 'granel', name: 'Silo a Granel', capacityQQ: 700, currentQQ: 0, imageUrl: null },
    ]);
    const [tachosState, setTachosState] = React.useState<SiloState>({
        id: 'tachos', name: 'Tachos', capacityQQ: 0, currentQQ: 0, imageUrl: null,
    });

    const handleSiloSave = (updatedSilo: SiloState) => {
        if (updatedSilo.id === 'tachos') {
            setTachosState(updatedSilo);
        } else {
            setSilos(prev => prev.map(s => s.id === updatedSilo.id ? updatedSilo : s));
        }
    };

    const sendMasasToSilos = React.useCallback((amount: number) => {
      let qqToDistribute = amount * MASA_QQ_AMOUNT;
      
      setSilos(prevSilos => {
          const newSilos = JSON.parse(JSON.stringify(prevSilos));
          const familiarSilo = newSilos.find((s: SiloState) => s.id === 'familiar')!;
          const granelSilo = newSilos.find((s: SiloState) => s.id === 'granel')!;

          const spaceInFamiliar = familiarSilo.capacityQQ - familiarSilo.currentQQ;
          
          let qqForFamiliar = 0;
          qqForFamiliar = Math.min(qqToDistribute, spaceInFamiliar);
          familiarSilo.currentQQ += qqForFamiliar;
          
          const remainder = qqToDistribute - qqForFamiliar;
          
          if (remainder > 0) {
            const spaceInGranel = granelSilo.capacityQQ - granelSilo.currentQQ;
            let qqForGranel = 0;
            qqForGranel = Math.min(remainder, spaceInGranel);
            granelSilo.currentQQ += qqForGranel;
          }
          
          return newSilos;
      });

      setTotalMasasSent(prev => prev + amount);
    }, []);

    const handleManualSendMasas = () => {
        sendMasasToSilos(masasToSend);
        setMasasToSend(1);
    };
    
    const tachosQQ = 0; // Tachos is now a process, not a storage
    const familiarSilo = silos.find(s => s.id === 'familiar');
    const granelSilo = silos.find(s => s.id === 'granel');
    const totalSiloQQ = (familiarSilo?.currentQQ || 0) + (granelSilo?.currentQQ || 0);
    const familiarSiloQQ = familiarSilo?.currentQQ || 0;

    const [machines, setMachines] = React.useState<MachineState[]>(() => {
        const firstProduct = prefetchedProducts.find(p => p.isActive);
        return [
            { id: 1, productId: firstProduct?.id || 'inactive', speed: 40, loss: 2, unitsPerSack: 12, imageUrl: null, isSimulatingActive: false },
            { id: 2, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null, isSimulatingActive: false },
            { id: 3, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null, isSimulatingActive: false },
            { id: 4, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null, isSimulatingActive: false },
        ];
    });

    const [wrapperCapacity, setWrapperCapacity] = React.useState(110);
    const [unitsPerBundle, setUnitsPerBundle] = React.useState(12);
    const [conveyorDelay, setConveyorDelay] = React.useState(6);
    const [wrapperImageUrl, setWrapperImageUrl] = React.useState<string | null>(null);

    const handleWrapperImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            setWrapperImageUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // --- Simulation State ---
    const [isSimulating, setIsSimulating] = React.useState(false); // Represents if the clock is running
    const initialSimState: SimulationState = {
        elapsedTime: 0,
        machineTotals: { 1: 0, 2: 0, 3: 0, 4: 0 },
        conveyorBelt: [],
        wrapperBuffer: 0,
        currentBundleProgress: 0,
        totalBundles: 0,
        isFinished: false,
        nextAutoTachosSendTime: autoTachosInterval * 60,
    };
    const [simulationState, setSimulationState] = React.useState<SimulationState>(initialSimState);
    const simulationIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const [simulationSpeed, setSimulationSpeed] = React.useState(1);
    
    const machinesRef = React.useRef(machines);
    React.useEffect(() => { machinesRef.current = machines; }, [machines]);

    const silosRef = React.useRef(silos);
    React.useEffect(() => { silosRef.current = silos; }, [silos]);

    const productsRef = React.useRef(products);
    React.useEffect(() => { productsRef.current = products; }, [products]);
    
    const wrapperCapacityRef = React.useRef(wrapperCapacity);
    React.useEffect(() => { wrapperCapacityRef.current = wrapperCapacity; }, [wrapperCapacity]);

    const unitsPerBundleRef = React.useRef(unitsPerBundle);
    React.useEffect(() => { unitsPerBundleRef.current = unitsPerBundle; }, [unitsPerBundle]);
    
    const conveyorDelayRef = React.useRef(conveyorDelay);
    React.useEffect(() => { conveyorDelayRef.current = conveyorDelay; }, [conveyorDelay]);


    const staticSimulationResults = React.useMemo(() => {
        const activeMachines = machines.filter(m => m.isSimulatingActive && m.productId !== 'inactive');
        
        const totalBagsPerMinuteFromPackers = activeMachines.reduce((sum, machine) => {
            const effectiveBagsPerMinute = machine.speed * (1 - machine.loss / 100);
            return sum + effectiveBagsPerMinute;
        }, 0);
        
        const effectiveSystemBagsPerMinute = Math.min(totalBagsPerMinuteFromPackers, wrapperCapacity);
        const isWrapperBottleneck = totalBagsPerMinuteFromPackers > wrapperCapacity;
        
        const bundlesPerMinute = unitsPerBundle > 0 ? effectiveSystemBagsPerMinute / unitsPerBundle : 0;
        
        const bottleneckDescription = `La enfardadora (cap: ${wrapperCapacity.toLocaleString()} f/min) limita a las envasadoras (cap: ${totalBagsPerMinuteFromPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} f/min).`;
        const noBottleneckDescription = `Las envasadoras (cap: ${totalBagsPerMinuteFromPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} f/min) operan a su capacidad.`;

        return {
            isWrapperBottleneck,
            bottleneckDescription,
            noBottleneckDescription,
            totalBagsPerMinuteFromPackers,
            bundlesPerMinute,
        };

    }, [machines, wrapperCapacity, unitsPerBundle]);

    const liveSimulationResults = React.useMemo(() => {
        let totalKgProduced = 0;
        let totalSacksProduced = 0;
        let totalUnitsProduced = 0;

        machinesRef.current.forEach(machine => {
            if (machine.productId !== 'inactive') {
                const product = productsRef.current.find(p => p.id === machine.productId);
                if (product) {
                    const machineUnits = simulationState.machineTotals[machine.id] || 0;
                    totalUnitsProduced += machineUnits;
                    if (machine.unitsPerSack && machine.unitsPerSack > 0) {
                        const sacksFromMachine = machineUnits / machine.unitsPerSack;
                        totalSacksProduced += sacksFromMachine;
                        totalKgProduced += sacksFromMachine * (product.sackWeight || 50);
                    }
                }
            }
        });
        
        const totalKgConsumedPerSecond = machinesRef.current
            .filter(m => m.isSimulatingActive && m.productId !== 'inactive')
            .reduce((sum, m) => {
                const product = productsRef.current.find(p => p.id === m.productId);
                if (!product) return sum;
                const unitsPerMinuteNeto = m.speed * (1 - m.loss / 100);
                const sacksPerMinute = (m.unitsPerSack > 0) ? unitsPerMinuteNeto / m.unitsPerSack : 0;
                const kgPerMinute = sacksPerMinute * (product.sackWeight || 50);
                return sum + (kgPerMinute / 60);
            }, 0);
        
        const familiarSiloKg = (silosRef.current.find(s => s.id === 'familiar')?.currentQQ || 0) * KG_PER_QUINTAL;
        const timeToEmptySeconds = totalKgConsumedPerSecond > 0 ? familiarSiloKg / totalKgConsumedPerSecond : 0;

        return {
            totalKgProduced,
            totalQuintalesProduced: totalKgProduced / KG_PER_QUINTAL,
            timeToEmptyHours: timeToEmptySeconds / 3600,
            unitsInTransit: simulationState.conveyorBelt.reduce((sum, item) => sum + item.units, 0),
        }

    }, [simulationState.machineTotals, simulationState.conveyorBelt]);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const formatElapsedTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    

    const pauseClock = () => {
        setIsSimulating(false);
        if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
        }
    };

    const startClock = () => {
        if (simulationIntervalRef.current) return;
        setIsSimulating(true);
        
        setSimulationState(prev => ({
            ...prev,
            isFinished: false,
            nextAutoTachosSendTime: autoTachosInterval > 0 ? autoTachosInterval * 60 : Infinity,
        }));
        
        const tickRateMs = 50; 

        simulationIntervalRef.current = setInterval(() => {
            const currentMachines = machinesRef.current;
            
            setSimulationState(prev => {
                if (prev.isFinished) {
                    pauseClock();
                    return prev;
                }

                const speedMultiplier = simulationSpeed * simulationSpeed * 60; // Base speed * multiplier
                const elapsedIncrement = (tickRateMs / 1000) * speedMultiplier;
                const newElapsedTime = prev.elapsedTime + elapsedIncrement;

                // --- Automatic Tachos Logic ---
                if (isTachosAuto && newElapsedTime >= prev.nextAutoTachosSendTime) {
                    sendMasasToSilos(1);
                    const newNextSendTime = prev.nextAutoTachosSendTime + (autoTachosInterval * 60);
                    return { ...prev, nextAutoTachosSendTime: newNextSendTime };
                }

                // --- Production Logic ---
                const activeMachinesConfig = currentMachines
                    .filter(m => m.isSimulatingActive && m.productId !== 'inactive')
                    .map(m => {
                        const product = productsRef.current.find(p => p.id === m.productId);
                        const unitsPerMinute = m.speed * (1 - m.loss / 100);
                        const unitsPerSack = m.unitsPerSack || 1;
                        const kgPerUnit = unitsPerSack > 0 ? (product?.sackWeight || 50) / unitsPerSack : 0;
                        return {
                            id: m.id,
                            unitsPerSecond: unitsPerMinute / 60,
                            kgPerSecond: (unitsPerMinute / 60) * kgPerUnit,
                        };
                    });
                
                const totalKgConsumedPerSecond = activeMachinesConfig.reduce((sum, m) => sum + m.kgPerSecond, 0);
                const kgConsumedThisTick = totalKgConsumedPerSecond * elapsedIncrement;
                
                const familiarSiloState = silosRef.current.find(s => s.id === 'familiar');
                const kgAvailableInFamiliarSilo = (familiarSiloState?.currentQQ || 0) * KG_PER_QUINTAL;
                const canProduce = kgAvailableInFamiliarSilo >= kgConsumedThisTick;
                
                if (!canProduce && totalKgConsumedPerSecond > 0) {
                    pauseClock();
                    return {...prev, elapsedTime: newElapsedTime, isFinished: true };
                }

                const newMachineTotals = { ...prev.machineTotals };
                let newWrapperBuffer = prev.wrapperBuffer;
                let newCurrentBundleProgress = prev.currentBundleProgress;
                let newTotalBundles = prev.totalBundles;
                let newConveyorBelt = [...prev.conveyorBelt];

                // 1. Packers produce and add to conveyor belt
                if (canProduce) {
                    if (kgConsumedThisTick > 0) {
                        setSilos(prevSilos => {
                            const newSilos = JSON.parse(JSON.stringify(prevSilos));
                            const familiarSilo = newSilos.find((s: SiloState) => s.id === 'familiar');
                            if (familiarSilo) {
                                familiarSilo.currentQQ -= kgConsumedThisTick / KG_PER_QUINTAL;
                            }
                            return newSilos;
                        });
                    }

                    activeMachinesConfig.forEach(m => {
                        const unitsProducedThisTick = m.unitsPerSecond * elapsedIncrement;
                        newMachineTotals[m.id] += unitsProducedThisTick;
                        newConveyorBelt.push({ producedAt: prev.elapsedTime, units: unitsProducedThisTick });
                    });
                }
                
                // 2. Check conveyor belt for items that have arrived
                const arrivedItems: ConveyorItem[] = [];
                const remainingOnBelt: ConveyorItem[] = [];
                const currentConveyorDelay = conveyorDelayRef.current;

                newConveyorBelt.forEach(item => {
                    if (newElapsedTime >= item.producedAt + currentConveyorDelay) {
                        arrivedItems.push(item);
                    } else {
                        remainingOnBelt.push(item);
                    }
                });
                
                const totalArrivedUnits = arrivedItems.reduce((sum, item) => sum + item.units, 0);
                newWrapperBuffer += totalArrivedUnits;
                newConveyorBelt = remainingOnBelt;


                // 3. Wrapper processes from the buffer
                const currentWrapperCapacity = wrapperCapacityRef.current;
                const wrapperUnitsPerSecond = currentWrapperCapacity / 60;
                const unitsToProcessThisTick = wrapperUnitsPerSecond * elapsedIncrement;
                const unitsToTakeFromBuffer = Math.min(unitsToProcessThisTick, newWrapperBuffer);
                
                newWrapperBuffer -= unitsToTakeFromBuffer;
                newCurrentBundleProgress += unitsToTakeFromBuffer;

                const currentUnitsPerBundle = unitsPerBundleRef.current;
                if (newCurrentBundleProgress >= currentUnitsPerBundle && currentUnitsPerBundle > 0) {
                    const bundlesCreated = Math.floor(newCurrentBundleProgress / currentUnitsPerBundle);
                    newTotalBundles += bundlesCreated;
                    newCurrentBundleProgress %= currentUnitsPerBundle;
                }

                return {
                    ...prev,
                    elapsedTime: newElapsedTime,
                    machineTotals: newMachineTotals,
                    conveyorBelt: newConveyorBelt,
                    wrapperBuffer: newWrapperBuffer,
                    currentBundleProgress: newCurrentBundleProgress,
                    totalBundles: newTotalBundles,
                };
            });
        }, tickRateMs);
    };

    
    const resetSimulation = (resetMaterial = true) => {
        pauseClock();
        setSimulationState(initialSimState);
        if (resetMaterial) {
          setTotalMasasSent(0);
          const originalSilos = [
              { id: 'familiar', name: 'Silo Familiar', capacityQQ: silos.find(s => s.id === 'familiar')?.capacityQQ || 380, currentQQ: 0, imageUrl: silos.find(s => s.id === 'familiar')?.imageUrl || null },
              { id: 'granel', name: 'Silo a Granel', capacityQQ: silos.find(s => s.id === 'granel')?.capacityQQ || 700, currentQQ: 0, imageUrl: silos.find(s => s.id === 'granel')?.imageUrl || null },
          ];
          setSilos(originalSilos);
        }
    };

    const toggleMachineActive = (machineId: number) => {
        setMachines(prev => prev.map(m => {
            if (m.id === machineId) {
                if (m.productId === 'inactive' && !m.isSimulatingActive) return m;
                return { ...m, isSimulatingActive: !m.isSimulatingActive };
            }
            return m;
        }));
    };
    
    React.useEffect(() => {
      return () => pauseClock();
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

    const getSiloFillColor = (percentage: number): string => {
        if (percentage < 20) return 'bg-red-500';
        if (percentage < 60) return 'bg-yellow-500';
        return 'bg-green-500';
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
                                <p>Proceso de donde se genera la materia prima.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <Warehouse className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Silo Familiar</h4>
                                    <p className="text-sm text-muted-foreground">{familiarSiloQQ.toLocaleString(undefined, {maximumFractionDigits: 0})} QQ</p>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Materia prima disponible para la producción.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />
                    
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className={cn("flex flex-col items-center gap-2 text-center p-2 rounded-md", staticSimulationResults.isWrapperBottleneck && 'bg-destructive/10')}>
                                    <Package className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Envasadoras</h4>
                                    <p className={cn("text-sm", staticSimulationResults.isWrapperBottleneck ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                                        {(staticSimulationResults.totalBagsPerMinuteFromPackers).toLocaleString(undefined, {maximumFractionDigits: 0})} fundas/min
                                    </p>
                                </div>
                            </TooltipTrigger>
                             <TooltipContent>
                                <p>Producción total de las envasadoras activas.</p>
                                {staticSimulationResults.isWrapperBottleneck && <p className="text-destructive font-semibold">¡Limitadas por la enfardadora!</p>}
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
                                    <p className={cn("text-sm font-semibold", staticSimulationResults.isWrapperBottleneck ? 'text-destructive' : 'text-green-600')}>
                                        {staticSimulationResults.bundlesPerMinute.toLocaleString(undefined, {maximumFractionDigits: 0})} fardos/min
                                    </p>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Producción efectiva de la línea de empaque final.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                 {staticSimulationResults.isWrapperBottleneck && (
                    <div className="text-center text-destructive text-sm font-semibold mt-2 flex items-center justify-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {staticSimulationResults.bottleneckDescription}
                    </div>
                )}
            </div>
            
            <div className="space-y-8">
                <Card>
                    <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <CardTitle>Controles de Simulación</CardTitle>
                         <div className="flex items-center gap-2">
                            <Button onClick={startClock} disabled={isSimulating} variant="secondary">
                               <Play className="mr-2" /> Iniciar
                           </Button>
                           <Button onClick={pauseClock} disabled={!isSimulating} variant="destructive">
                               <Pause className="mr-2" /> Detener
                           </Button>
                           <Button onClick={() => resetSimulation(true)} variant="outline">
                               <RefreshCw className="mr-2" /> Reiniciar
                           </Button>
                       </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-4">
                           <div className="space-y-1.5">
                               <Label htmlFor="sim-speed">Acelerador de Tiempo</Label>
                               <Slider
                                   id="sim-speed"
                                   min={0.1}
                                   max={5}
                                   step={0.1}
                                   value={[simulationSpeed]}
                                   onValueChange={(value) => setSimulationSpeed(value[0])}
                               />
                               <div className="flex justify-between text-xs text-muted-foreground">
                                   <span>Lento</span>
                                   <span>Normal</span>
                                   <span>Rápido</span>
                               </div>
                           </div>
                       </div>
                       <div className="flex flex-col items-center justify-center bg-muted/30 border rounded-lg p-4">
                           <Clock className="h-6 w-6 text-muted-foreground mb-2" />
                           <p className="text-sm text-muted-foreground">Tiempo Transcurrido</p>
                           <p className="text-4xl font-bold font-mono text-primary">{formatElapsedTime(simulationState.elapsedTime)}</p>
                           {simulationState.isFinished && simulationState.elapsedTime > 0 && (
                               <p className="text-destructive font-semibold mt-2 flex items-center gap-2">
                                   <AlertTriangle className="h-4 w-4" />
                                   ¡Sin Materia Prima en Silo Familiar!
                               </p>
                           )}
                       </div>
                   </CardContent>
                </Card>


                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">1. Materia Prima</CardTitle>
                         <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total en Inventario</p>
                            <p className="text-2xl font-bold text-primary">{totalSiloQQ.toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</p>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Tachos Control Panel */}
                        <div className="p-4 border rounded-lg space-y-3 bg-background flex flex-col justify-between">
                           <div className='relative'>
                               <div className='flex justify-between items-center'>
                                <Label className="font-bold text-primary">{tachosState.name}</Label>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo({ ...tachosState, isTachos: true } as any)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                               </div>
                               <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-3">
                                   <Image src={tachosState.imageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"} alt="Tachos" width={600} height={400} className="object-contain w-full h-full" />
                               </div>
                           </div>
                           <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="auto-mode-switch" className="text-sm font-medium">Modo Automático</Label>
                                    <Switch
                                        id="auto-mode-switch"
                                        checked={isTachosAuto}
                                        onCheckedChange={setIsTachosAuto}
                                        disabled={isSimulating}
                                    />
                                </div>
                                {isTachosAuto && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="auto-interval" className="text-xs">Intervalo de Envío (minutos)</Label>
                                        <Input
                                            id="auto-interval"
                                            type="number"
                                            value={autoTachosInterval}
                                            onChange={(e) => setAutoTachosInterval(Number(e.target.value))}
                                            disabled={isSimulating}
                                            min="1"
                                        />
                                    </div>
                                )}
                                <Separator />
                                <div className={cn("space-y-3", isTachosAuto && "opacity-50")}>
                                    <div className='text-center border bg-muted/30 rounded-lg p-2'>
                                      <p className="text-xs text-muted-foreground">Total Masas Enviadas</p>
                                      <p className="text-lg font-bold text-primary">{totalMasasSent}</p>
                                    </div>
                                    <Label className="text-center block">Masas a Enviar ({MASA_QQ_AMOUNT} QQ c/u)</Label>
                                    <div className="flex items-center justify-center gap-2">
                                        <Button size="icon" variant="outline" onClick={() => setMasasToSend(p => Math.max(1, p - 1))} disabled={isTachosAuto}><Minus className="h-4 w-4" /></Button>
                                        <span className="text-xl font-bold w-12 text-center">{masasToSend}</span>
                                        <Button size="icon" variant="outline" onClick={() => setMasasToSend(p => p + 1)} disabled={isTachosAuto}><Plus className="h-4 w-4" /></Button>
                                    </div>
                                    <Button className="w-full" onClick={handleManualSendMasas} disabled={isTachosAuto || isSimulating}>Enviar a Silos</Button>
                               </div>
                           </div>
                        </div>

                        {/* Silo Cards */}
                        {silos.map((silo) => {
                            const currentKg = silo.currentQQ * KG_PER_QUINTAL;
                            const fillPercentage = silo.capacityQQ > 0 ? (silo.currentQQ / silo.capacityQQ) * 100 : 0;
                            const fillColorClass = getSiloFillColor(fillPercentage);
                            return (
                                <div key={silo.id} className="p-4 border rounded-lg space-y-3 bg-background">
                                     <div className='flex justify-between items-center'>
                                        <Label className="font-bold text-primary">{silo.name}</Label>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo(silo)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                                        <Image src={silo.imageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"} alt={silo.name} width={600} height={400} className="object-contain w-full h-full" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className='text-xs text-muted-foreground'>Capacidad: {silo.capacityQQ.toLocaleString()} QQ</Label>
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        <Label className="text-sm">Nivel: {currentKg.toLocaleString(undefined, {maximumFractionDigits:0})} kg ({fillPercentage.toFixed(1)}%)</Label>
                                        <Progress value={fillPercentage} indicatorClassName={fillColorClass} />
                                    </div>
                                </div>
                            )
                        })}
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
                                const unitsProducedByMachine = simulationState.machineTotals[machine.id] || 0;
                                
                                return (
                                    <div key={machine.id} className={cn("p-3 border rounded-lg space-y-3 bg-background relative transition-all", machine.isSimulatingActive && "ring-2 ring-green-500")}>
                                        <div className="flex justify-between items-start">
                                            <Label className="font-bold text-primary">Máquina {machine.id}</Label>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMachine(machine)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant={machine.isSimulatingActive ? 'destructive' : 'secondary'}
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => toggleMachineActive(machine.id)}
                                                                disabled={machine.productId === 'inactive'}
                                                            >
                                                                {machine.isSimulatingActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{machine.isSimulatingActive ? 'Apagar Máquina' : 'Encender Máquina'}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
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
                                                        <p className="text-muted-foreground">Fardos/Min</p>
                                                        <p className="font-bold text-sm text-green-600">{sacksPerMinuteNeto.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Producción Total (Unidades)</Label>
                                                <p className="text-lg font-bold text-center text-primary">{Math.floor(unitsProducedByMachine).toLocaleString()}</p>
                                                <Progress value={(unitsProducedByMachine % machine.speed) / machine.speed * 100} className="h-1" />
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
                            <div className="space-y-1.5">
                                <Label htmlFor="conveyor-delay">Retraso de Banda (segundos)</Label>
                                <Input id="conveyor-delay" type="number" value={conveyorDelay} onChange={e => setConveyorDelay(Number(e.target.value))}/>
                            </div>
                             <div className="sm:col-span-2 space-y-4 rounded-lg bg-muted/30 p-3 border">
                                 <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground">En Transporte</p>
                                        <p className="font-bold text-lg text-orange-500">{Math.floor(liveSimulationResults.unitsInTransit).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">En Cola</p>
                                        <p className="font-bold text-lg text-blue-600">{Math.floor(simulationState.wrapperBuffer).toLocaleString()}</p>
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
                        <KpiCard 
                            title="Total Fardos Producidos" 
                            value={simulationState.totalBundles} 
                            icon={PackageCheck} 
                            description="Suma total de fardos que ha completado la enfardadora." 
                            fractionDigits={0} 
                        />
                        <KpiCard 
                            title="Total QQ Producidos" 
                            value={liveSimulationResults.totalQuintalesProduced} 
                            icon={Warehouse} 
                            description="Peso total en quintales de todos los sacos producidos." 
                            fractionDigits={1}
                        />
                        <KpiCard 
                            title="Tiempo Restante para Agotar Silo" 
                            value={formatTime(liveSimulationResults.timeToEmptyHours)} 
                            icon={Clock} 
                            description="Tiempo estimado para consumir toda la materia prima restante al ritmo actual." 
                        />
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">Análisis de Cuello de Botella</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-sm p-3 rounded-md flex items-start gap-3", staticSimulationResults.isWrapperBottleneck ? 'bg-destructive/10 text-destructive' : 'bg-green-600/10 text-green-700')}>
                                <AlertTriangle className="h-5 w-5 mt-0.5" />
                                <div>
                                    <h4 className="font-bold mb-1">{staticSimulationResults.isWrapperBottleneck ? "¡Cuello de Botella Detectado!" : "Operación Eficiente"}</h4>
                                    <p>{staticSimulationResults.isWrapperBottleneck ? staticSimulationResults.bottleneckDescription : staticSimulationResults.noBottleneckDescription}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">Contribución por Máquina (Sacos)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Object.values(simulationState.machineTotals).every(m => m === 0) ? (
                                <p className="text-center text-muted-foreground h-[200px] flex items-center justify-center">Activa una máquina para ver la contribución.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie 
                                          data={Object.entries(simulationState.machineTotals)
                                              .map(([machineId, totalUnits]) => {
                                                  const machine = machines.find(m => m.id === parseInt(machineId));
                                                  const product = machine ? products.find(p => p.id === machine.productId) : undefined;
                                                  const sacksProduced = totalUnits / FUNDAS_PER_SACO;
                                                  return {
                                                      name: `Máq. ${machineId} (${product?.productName || 'N/A'})`,
                                                      value: sacksProduced,
                                                  }
                                              })
                                              .filter(d => d.value > 0)
                                          } 
                                          dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label
                                        >
                                            {Object.keys(simulationState.machineTotals).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `${value.toLocaleString(undefined, {maximumFractionDigits: 1})} sacos`} />
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
             {editingSilo && (
                <SiloEditDialog
                    open={!!editingSilo}
                    onOpenChange={(isOpen) => !isOpen && setEditingSilo(null)}
                    silo={editingSilo}
                    isTachos={editingSilo.id === 'tachos'}
                    onSave={handleSiloSave}
                />
            )}
        </>
        )}
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, PackageCheck, ArrowRight, AlertTriangle, Upload, Edit, Beaker, Play, Pause, RefreshCw, Clock, Zap, Power, PowerOff, Droplets, Wind, Hourglass, CircleSlash, Activity, CheckCircle2 } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const KG_PER_QUINTAL = 50;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];
const LOCAL_STORAGE_CONFIG_KEY = 'simulationConfig';
const FIRESTORE_ASSETS_PATH = 'simulation_assets';

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

type ReceiverState = {
    id: string;
    name: string;
    capacityQQ: number; // Represents the number of "masas" it can hold
    currentQQ: number; // The current amount of material in QQ
    imageUrl: string | null;
};

type CentrifugeState = {
    id: string;
    name: string;
    state: 'idle' | 'processing';
    imageUrl: string | null;

    // Live simulation data
    progress: number;
    timeRemaining: number;
};

type TachosSimState = {
    id: 'tachos';
    name: string;
    imageUrl: string | null;
    state: 'idle' | 'cooking' | 'ready';
    cookTimeSeconds: number;
    timeRemaining: number;
    progress: number;
};

type ConveyorItem = {
    producedAt: number; // The simulation time it was produced
    units: number;
};

type WrapperState = {
    id: string;
    name: string;
    capacity: number; // bags per minute
    unitsPerBundle: number;
    conveyorDelay: number; // seconds
    imageUrl: string | null;
    machineIds: number[]; // IDs of the machines connected to this wrapper
    
    // Live simulation data - not persisted
    buffer: number;
    currentBundleProgress: number;
    totalBundles: number;
    conveyorBelt: ConveyorItem[];
};

type SimulationParams = {
    machines: Omit<MachineState, 'isSimulatingActive' | 'imageUrl'>[];
    wrappers: Omit<WrapperState, 'buffer' | 'currentBundleProgress' | 'totalBundles' | 'conveyorBelt' | 'imageUrl'>[];
    silos: Omit<SiloState, 'imageUrl'>[];
    receivers: Omit<ReceiverState, 'imageUrl' | 'currentQQ'>[];
    tachosCookTime: number; 
    tachosGoal: number;
    isTachosAuto: boolean;
    isTachosGoalEnabled: boolean;
    masaQQAmount: number;
    centrifugeCycleTime: number; 
    isCentrifugesAuto: boolean;
};

type ImageUrlConfig = {
    machines: { [id: number]: string };
    wrappers: { [id: string]: string };
    silos: { [id: string]: string };
    receivers: { [id: string]: string };
    centrifuges: { [id: string]: string };
    tachos: string;
};


type SimulationState = {
    elapsedTime: number; // in seconds
    machineTotals: { [machineId: number]: number }; // Total units produced by each machine
    wrappers: { [wrapperId: string]: Omit<WrapperState, 'id' | 'name' | 'capacity' | 'unitsPerBundle' | 'conveyorDelay' | 'imageUrl' | 'machineIds'> };
    isFinished: boolean;
    silos: SiloState[]; 
    receivers: ReceiverState[]; 
    centrifuges: CentrifugeState[];
    tachos: TachosSimState;
    totalMasasSent: number; 
};

function MachineEditDialog({
    machine,
    products,
    open,
    onOpenChange,
    onSave,
    onImageSave,
    isUploading
}: {
    machine: MachineState;
    products: ProductDefinition[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedMachine: Omit<MachineState, 'isSimulatingActive' | 'imageUrl'>) => void;
    onImageSave: (type: 'machine' | 'silo' | 'wrapper' | 'tachos' | 'receiver' | 'centrifuge', id: string | number, file: File) => Promise<void>;
    isUploading: boolean;
}) {
    const [editedMachine, setEditedMachine] = React.useState(machine);

    React.useEffect(() => {
        setEditedMachine(machine);
    }, [machine]);

    const handleFieldChange = (field: keyof Omit<MachineState, 'isSimulatingActive' | 'imageUrl'>, value: any) => {
        const newMachine = { ...editedMachine, [field]: value };
        if (field === 'productId') {
            const product = products.find(p => p.id === value);
            // @ts-ignore
            newMachine.unitsPerSack = product?.unitsPerSack || 1;
        }
        setEditedMachine(newMachine);
    };
    
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await onImageSave('machine', machine.id, file);
    };

    const fileInputId = `modal-image-upload-${machine.id}`;
    
    const handleSaveChanges = () => {
        const { isSimulatingActive, imageUrl, ...configToSave } = editedMachine;
        onSave(configToSave);
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
                           {isUploading ? (
                               <div className="flex flex-col items-center gap-2">
                                   <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">Subiendo...</p>
                               </div>
                           ) : (
                                <Image 
                                    src={editedMachine.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media"} 
                                    alt={`Máquina ${editedMachine.id}`}
                                    width={600}
                                    height={400}
                                    className="object-contain w-full h-full"
                                    unoptimized // Important for external URLs
                                />
                           )}
                        </div>
                        <input
                            type="file"
                            id={fileInputId}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                            disabled={isUploading}
                        />
                        <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById(fileInputId)?.click()} disabled={isUploading}>
                            <Upload className="mr-2 h-3 w-3" />
                            {isUploading ? 'Subiendo...' : 'Cambiar Foto'}
                        </Button>
                    </div>
                    <Separator />
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
    open,
    onOpenChange,
    onSave,
    isTachos,
    tachosConfig,
    onTachosConfigChange,
}: {
    silo: SiloState | TachosSimState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedSilo: Omit<SiloState, 'imageUrl'>) => void;
    isTachos?: boolean;
    tachosConfig?: { isAuto: boolean; cookTime: number; isGoalEnabled: boolean; goal: number; masaQQAmount: number };
    onTachosConfigChange?: (config: { isAuto: boolean; cookTime: number; isGoalEnabled: boolean; goal: number; masaQQAmount: number }) => void;
}) {
    const [editedSilo, setEditedSilo] = React.useState(silo);
    const [localTachosConfig, setLocalTachosConfig] = React.useState(tachosConfig);

    React.useEffect(() => {
        setEditedSilo(silo);
        if (isTachos) {
            setLocalTachosConfig(tachosConfig);
        }
    }, [silo, tachosConfig, isTachos]);

    const handleFieldChange = (field: keyof Omit<SiloState, 'imageUrl'>, value: any) => {
        setEditedSilo(prev => ({ ...prev, [field]: value }));
    };

    const handleTachosConfigFieldChange = (field: keyof typeof localTachosConfig, value: any) => {
        setLocalTachosConfig(prev => (prev ? { ...prev, [field]: value } : undefined));
    };
    
    const handleSaveChanges = () => {
        const { imageUrl, ...configToSave } = editedSilo as any;
        onSave(configToSave);
        if (isTachos && localTachosConfig && onTachosConfigChange) {
            onTachosConfigChange(localTachosConfig);
        }
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar {silo.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                    <div className="space-y-1.5">
                        <Label htmlFor={`silo-name-${silo.id}`}>Nombre</Label>
                        <Input id={`silo-name-${silo.id}`} type="text" value={editedSilo.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                    </div>
                    {silo.id !== 'tachos' && 'capacityQQ' in silo && (
                        <div className="space-y-1.5">
                            <Label htmlFor={`silo-cap-${silo.id}`}>Capacidad Máx. (QQ)</Label>
                            <Input id={`silo-cap-${silo.id}`} type="number" value={(editedSilo as SiloState).capacityQQ} onChange={(e) => handleFieldChange('capacityQQ', Number(e.target.value))} min="0" />
                        </div>
                    )}
                    {isTachos && localTachosConfig && (
                        <>
                            <Separator />
                            <h4 className="font-medium text-sm">Configuración de Tachos</h4>
                             <div className="space-y-1.5">
                                <Label htmlFor="auto-masa-qq">QQ por Masa</Label>
                                <Input
                                    id="auto-masa-qq"
                                    type="number"
                                    value={localTachosConfig.masaQQAmount}
                                    onChange={(e) => handleTachosConfigFieldChange('masaQQAmount', Number(e.target.value))}
                                    min="1"
                                />
                            </div>
                            <Separator />
                            <h4 className="font-medium text-sm">Configuración de Automatización</h4>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="auto-mode-switch" className="text-sm">Modo Automático</Label>
                                <Switch
                                    id="auto-mode-switch"
                                    checked={localTachosConfig.isAuto}
                                    onCheckedChange={(val) => handleTachosConfigFieldChange('isAuto', val)}
                                />
                            </div>
                            <div className={cn("space-y-3 transition-opacity", !localTachosConfig.isAuto && "opacity-50")}>
                                <div className="space-y-1.5">
                                    <Label htmlFor="auto-cooktime" className="text-xs">Tiempo de Cocción (minutos)</Label>
                                    <Input
                                        id="auto-cooktime"
                                        type="number"
                                        value={localTachosConfig.cookTime}
                                        onChange={(e) => handleTachosConfigFieldChange('cookTime', Number(e.target.value))}
                                        disabled={!localTachosConfig.isAuto}
                                        min="1"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="goal-mode-switch" className="text-xs">Establecer Meta de Envío</Label>
                                    <Switch
                                        id="goal-mode-switch"
                                        checked={localTachosConfig.isGoalEnabled}
                                        onCheckedChange={(val) => handleTachosConfigFieldChange('isGoalEnabled', val)}
                                        disabled={!localTachosConfig.isAuto}
                                    />
                                </div>
                                {localTachosConfig.isGoalEnabled && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="auto-goal" className="text-xs">Meta de Masas a Enviar</Label>
                                        <Input
                                            id="auto-goal"
                                            type="number"
                                            value={localTachosConfig.goal}
                                            onChange={(e) => handleTachosConfigFieldChange('goal', Number(e.target.value))}
                                            disabled={!localTachosConfig.isAuto || !localTachosConfig.isGoalEnabled}
                                            min="1"
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleSaveChanges}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ReceiverEditDialog({
    receiver,
    open,
    onOpenChange,
    onSave,
}: {
    receiver: ReceiverState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedSilo: Omit<ReceiverState, 'imageUrl' | 'currentQQ'>) => void;
}) {
    const [editedReceiver, setEditedReceiver] = React.useState(receiver);

    React.useEffect(() => {
        setEditedReceiver(receiver);
    }, [receiver]);

    const handleFieldChange = (field: keyof Omit<ReceiverState, 'imageUrl' | 'currentQQ'>, value: any) => {
        setEditedReceiver(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSaveChanges = () => {
        const { imageUrl, currentQQ, ...configToSave } = editedReceiver as any;
        onSave(configToSave);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar {receiver.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                    <div className="space-y-1.5">
                        <Label htmlFor={`rec-name-${receiver.id}`}>Nombre</Label>
                        <Input id={`rec-name-${receiver.id}`} type="text" value={editedReceiver.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor={`rec-cap-${receiver.id}`}>Capacidad (Masas)</Label>
                        <Input id={`rec-cap-${receiver.id}`} type="number" value={editedReceiver.capacityQQ} onChange={(e) => handleFieldChange('capacityQQ', Number(e.target.value))} min="1" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleSaveChanges}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function CentrifugeEditDialog({
    open,
    onOpenChange,
    onSave,
    cycleTime,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (config: { cycleTime: number }) => void;
    cycleTime: number;
}) {
    const [localCycleTime, setLocalCycleTime] = React.useState(cycleTime);

    React.useEffect(() => {
        setLocalCycleTime(cycleTime);
    }, [cycleTime]);

    const handleSaveChanges = () => {
        onSave({ cycleTime: localCycleTime });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Configuración de Centrífugas</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                    <p className="text-sm text-muted-foreground">
                        Define el tiempo total que tardan las **dos centrífugas trabajando juntas** en procesar una masa completa.
                    </p>
                    <div className="space-y-1.5">
                        <Label htmlFor="cycle-time">Tiempo para Procesar 1 Masa (minutos)</Label>
                        <Input
                            id="cycle-time"
                            type="number"
                            value={localCycleTime}
                            onChange={(e) => setLocalCycleTime(Number(e.target.value))}
                            min="1"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleSaveChanges}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function WrapperEditDialog({
    wrapper,
    allMachines,
    open,
    onOpenChange,
    onSave,
    onImageSave,
    isUploading
}: {
    wrapper: WrapperState;
    allMachines: MachineState[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedWrapper: Omit<WrapperState, 'buffer' | 'currentBundleProgress' | 'totalBundles' | 'conveyorBelt' | 'imageUrl'>) => void;
    onImageSave: (type: 'machine' | 'silo' | 'wrapper' | 'tachos' | 'receiver' | 'centrifuge', id: string | number, file: File) => Promise<void>;
    isUploading: boolean;
}) {
    const [editedWrapper, setEditedWrapper] = React.useState<Omit<WrapperState, 'buffer' | 'currentBundleProgress' | 'totalBundles' | 'conveyorBelt'>>(wrapper);

    React.useEffect(() => {
        const { buffer, currentBundleProgress, totalBundles, conveyorBelt, ...configurableProps } = wrapper;
        setEditedWrapper(configurableProps);
    }, [wrapper]);

    const handleFieldChange = (field: keyof Omit<typeof editedWrapper, 'imageUrl'>, value: any) => {
        setEditedWrapper(prev => ({ ...prev, [field]: value }));
    };

    const handleMachineConnectionChange = (machineId: number, checked: boolean) => {
        setEditedWrapper(prev => {
            const newMachineIds = new Set(prev.machineIds);
            if (checked) {
                newMachineIds.add(machineId);
            } else {
                newMachineIds.delete(machineId);
            }
            return { ...prev, machineIds: Array.from(newMachineIds) };
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await onImageSave('wrapper', wrapper.id, file);
    };

    const fileInputId = `wrapper-modal-image-upload-${wrapper.id}`;

    const handleSaveChanges = () => {
        const { imageUrl, ...configToSave } = editedWrapper;
        onSave(configToSave);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar {wrapper.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                    <div className="space-y-2">
                        <Label>Previsualización de la Imagen</Label>
                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                           {isUploading ? (
                               <div className="flex flex-col items-center gap-2">
                                   <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">Subiendo...</p>
                               </div>
                           ) : (
                                <Image
                                    src={editedWrapper.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/enfardadora.jpeg?alt=media"}
                                    alt={editedWrapper.name}
                                    width={600}
                                    height={400}
                                    className="object-contain w-full h-full"
                                    unoptimized
                                />
                           )}
                        </div>
                        <input
                            type="file"
                            id={fileInputId}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                            disabled={isUploading}
                        />
                        <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById(fileInputId)?.click()} disabled={isUploading}>
                            <Upload className="mr-2 h-3 w-3" />
                            {isUploading ? 'Subiendo...' : 'Cambiar Foto'}
                        </Button>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                        <Label htmlFor={`wrapper-name-${wrapper.id}`}>Nombre</Label>
                        <Input id={`wrapper-name-${wrapper.id}`} type="text" value={editedWrapper.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                    </div>
                     <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor={`wrapper-capacity-${wrapper.id}`} className="text-xs">Capacidad (f/min)</Label>
                            <Input id={`wrapper-capacity-${wrapper.id}`} type="number" value={editedWrapper.capacity} onChange={e => handleFieldChange('capacity', Number(e.target.value))}/>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`wrapper-units-${wrapper.id}`} className="text-xs">Unidades/Fardo</Label>
                            <Input id={`wrapper-units-${wrapper.id}`} type="number" value={editedWrapper.unitsPerBundle} onChange={e => handleFieldChange('unitsPerBundle', Number(e.target.value))}/>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`wrapper-delay-${wrapper.id}`} className="text-xs">Retraso (seg)</Label>
                            <Input id={`wrapper-delay-${wrapper.id}`} type="number" value={editedWrapper.conveyorDelay} onChange={e => handleFieldChange('conveyorDelay', Number(e.target.value))}/>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                        <Label>Envasadoras Conectadas</Label>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {allMachines.map(machine => (
                                <div key={machine.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`machine-conn-${wrapper.id}-${machine.id}`}
                                        checked={editedWrapper.machineIds.includes(machine.id)}
                                        onCheckedChange={(checked) => handleMachineConnectionChange(machine.id, !!checked)}
                                    />
                                    <label
                                        htmlFor={`machine-conn-${wrapper.id}-${machine.id}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Máquina {machine.id}
                                    </label>
                                </div>
                            ))}
                        </div>
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
    const { toast } = useToast();
    const products = React.useMemo(() => prefetchedProducts.filter(p => p.isActive), [prefetchedProducts]);
    
    // --- Unified Configuration State ---
    const [machines, setMachines] = React.useState<MachineState[]>([]);
    const [wrappers, setWrappers] = React.useState<WrapperState[]>([]);
    const [silos, setSilos] = React.useState<SiloState[]>([]);
    const [receivers, setReceivers] = React.useState<ReceiverState[]>([]);
    const [centrifuges, setCentrifuges] = React.useState<CentrifugeState[]>([]);
    const [tachosCookTime, setTachosCookTime] = React.useState(90);
    const [tachosGoal, setTachosGoal] = React.useState(6);
    const [isTachosAuto, setIsTachosAuto] = React.useState(false);
    const [isTachosGoalEnabled, setIsTachosGoalEnabled] = React.useState(false);
    const [masaQQAmount, setMasaQQAmount] = React.useState(380);
    const [tachosImageUrl, setTachosImageUrl] = React.useState<string | null>(null);
    const [centrifugeCycleTime, setCentrifugeCycleTime] = React.useState(90);
    const [isCentrifugesAuto, setIsCentrifugesAuto] = React.useState(true);

    // --- UI State ---
    const [editingMachine, setEditingMachine] = React.useState<MachineState | null>(null);
    const [editingSilo, setEditingSilo] = React.useState<SiloState | TachosSimState | null>(null);
    const [editingReceiver, setEditingReceiver] = React.useState<ReceiverState | null>(null);
    const [editingCentrifuges, setEditingCentrifuges] = React.useState(false);
    const [editingWrapper, setEditingWrapper] = React.useState<WrapperState | null>(null);
    const [isUploading, setIsUploading] = React.useState(false);

    const getDefaultConfig = (): { params: SimulationParams; images: ImageUrlConfig } => ({
        params: {
            machines: [
                { id: 1, productId: 'inactive', speed: 0, loss: 0, unitsPerSack: 1 },
                { id: 2, productId: 'inactive', speed: 0, loss: 0, unitsPerSack: 1 },
                { id: 3, productId: 'inactive', speed: 0, loss: 0, unitsPerSack: 1 },
                { id: 4, productId: 'inactive', speed: 0, loss: 0, unitsPerSack: 1 },
            ],
            wrappers: [
                { id: '1', name: 'Enfardadora 1', capacity: 110, unitsPerBundle: 12, conveyorDelay: 6, machineIds: [1, 2] },
                { id: '2', name: 'Enfardadora 2', capacity: 80, unitsPerBundle: 12, conveyorDelay: 6, machineIds: [3, 4] },
            ],
            silos: [
                { id: 'familiar', name: 'Silo Familiar', capacityQQ: 380, currentQQ: 0 },
                { id: 'granel', name: 'Silo a Granel', capacityQQ: 700, currentQQ: 0 },
            ],
            receivers: [
                { id: 'rec1', name: 'Recibidor 1', capacityQQ: 1 },
                { id: 'rec2', name: 'Recibidor 2', capacityQQ: 1 },
            ],
            tachosCookTime: 90, 
            tachosGoal: 6,
            isTachosAuto: false,
            isTachosGoalEnabled: false,
            masaQQAmount: 380,
            centrifugeCycleTime: 90,
            isCentrifugesAuto: true,
        },
        images: {
            machines: {
                1: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media',
                2: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media',
                3: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media',
                4: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media',
            },
            wrappers: {
                '1': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/enfardadora.jpeg?alt=media',
                '2': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/enfardadora.jpeg?alt=media',
            },
            silos: {
                'familiar': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media',
                'granel': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.%20Gran.jpeg?alt=media',
            },
            receivers: {
                'rec1': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/recibidor.png?alt=media',
                'rec2': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/recibidor.png?alt=media',
            },
            centrifuges: {
                'cent1': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/centrifuga.png?alt=media',
                'cent2': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/centrifuga.png?alt=media',
            },
            tachos: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/Tachos.jpg?alt=media',
        }
    });

    const loadConfig = React.useCallback(async () => {
        const { params: defaultParams } = getDefaultConfig();
        try {
            const localConfigStr = window.localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
            let params: SimulationParams;
            if (localConfigStr) {
                const savedParams = JSON.parse(localConfigStr);
                 params = {
                    ...defaultParams,
                    ...savedParams,
                     machines: defaultParams.machines.map(dm => {
                        const sm = savedParams.machines?.find((m: any) => m.id === dm.id);
                        return { ...dm, ...sm };
                    }),
                    wrappers: defaultParams.wrappers.map(dw => {
                        const sw = savedParams.wrappers?.find((w: any) => w.id === dw.id);
                        return { ...dw, ...sw };
                    }),
                     silos: defaultParams.silos.map(ds => {
                        const ss = savedParams.silos?.find((s: any) => s.id === ds.id);
                        return { ...ds, ...ss };
                    }),
                    receivers: defaultParams.receivers.map(dr => {
                        const sr = savedParams.receivers?.find((r: any) => r.id === dr.id);
                        return { ...dr, ...sr };
                    }),
                };
            } else {
                 params = defaultParams;
            }

            const docRef = doc(db, FIRESTORE_ASSETS_PATH, 'images');
            const docSnap = await getDoc(docRef);
            let imageUrls: ImageUrlConfig = getDefaultConfig().images;
            if (docSnap.exists()) {
                const firestoreImages = docSnap.data() as ImageUrlConfig;
                imageUrls = {
                    machines: { ...getDefaultConfig().images.machines, ...firestoreImages.machines },
                    wrappers: { ...getDefaultConfig().images.wrappers, ...firestoreImages.wrappers },
                    silos: { ...getDefaultConfig().images.silos, ...firestoreImages.silos },
                    receivers: { ...getDefaultConfig().images.receivers, ...firestoreImages.receivers },
                    centrifuges: { ...getDefaultConfig().images.centrifuges, ...firestoreImages.centrifuges },
                    tachos: firestoreImages.tachos || getDefaultConfig().images.tachos,
                };
            }

            setMachines(params.machines.map(m => ({ 
                ...m, 
                imageUrl: imageUrls.machines[m.id] || null, 
                isSimulatingActive: false 
            })));
            setWrappers(params.wrappers.map(w => ({ 
                ...w, 
                imageUrl: imageUrls.wrappers[w.id] || null, 
                buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] 
            })));
            setSilos(params.silos.map(s => ({
                ...s,
                imageUrl: imageUrls.silos[s.id] || null,
            })));
            setReceivers(params.receivers.map(r => ({
                ...r,
                currentQQ: 0,
                imageUrl: imageUrls.receivers[r.id] || null,
            })));
            setCentrifuges([
                { id: 'cent1', name: 'Centrífuga 1', state: 'idle', imageUrl: imageUrls.centrifuges['cent1'], progress: 0, timeRemaining: 0 },
                { id: 'cent2', name: 'Centrífuga 2', state: 'idle', imageUrl: imageUrls.centrifuges['cent2'], progress: 0, timeRemaining: 0 },
            ]);
            setTachosImageUrl(imageUrls.tachos);
            
            setTachosCookTime(params.tachosCookTime);
            setTachosGoal(params.tachosGoal);
            setIsTachosAuto(params.isTachosAuto);
            setIsTachosGoalEnabled(params.isTachosGoalEnabled);
            setMasaQQAmount(params.masaQQAmount || 380);
            setCentrifugeCycleTime(params.centrifugeCycleTime);
            setIsCentrifugesAuto(params.isCentrifugesAuto ?? true);

        } catch (error) {
            console.error("Error loading config:", error);
            const { params, images } = getDefaultConfig();
            setMachines(params.machines.map(m => ({ ...m, imageUrl: images.machines[m.id] || null, isSimulatingActive: false })));
            setWrappers(params.wrappers.map(w => ({ ...w, imageUrl: images.wrappers[w.id] || null, buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] })));
            setSilos(params.silos.map(s => ({ ...s, imageUrl: images.silos[s.id] || null })));
            setReceivers(params.receivers.map(r => ({ ...r, currentQQ: 0, imageUrl: images.receivers[r.id] || null })));
            setCentrifuges([
                { id: 'cent1', name: 'Centrífuga 1', state: 'idle', imageUrl: images.centrifuges['cent1'], progress: 0, timeRemaining: 0 },
                { id: 'cent2', name: 'Centrífuga 2', state: 'idle', imageUrl: images.centrifuges['cent2'], progress: 0, timeRemaining: 0 },
            ]);
            setTachosImageUrl(images.tachos);
        }
    }, []);
    
    React.useEffect(() => {
        setIsClient(true);
        loadConfig();
    }, [loadConfig]);

    const saveParamsToLocalStorage = React.useCallback(() => {
        if (!isClient) return;
        const paramsToSave: SimulationParams = {
            machines: machines.map(({ isSimulatingActive, imageUrl, ...m }) => m),
            wrappers: wrappers.map(({ buffer, currentBundleProgress, totalBundles, conveyorBelt, imageUrl, ...w }) => w),
            silos: silos.map(({imageUrl, ...s}) => s),
            receivers: receivers.map(({imageUrl, currentQQ, ...r}) => r),
            tachosCookTime: tachosCookTime,
            tachosGoal: tachosGoal,
            isTachosAuto: isTachosAuto,
            isTachosGoalEnabled: isTachosGoalEnabled,
            masaQQAmount: masaQQAmount,
            centrifugeCycleTime: centrifugeCycleTime,
            isCentrifugesAuto: isCentrifugesAuto,
        };
        try {
            window.localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(paramsToSave));
        } catch (error) {
            console.error("Error saving params to localStorage", error);
        }
    }, [isClient, machines, wrappers, silos, receivers, tachosCookTime, tachosGoal, isTachosAuto, isTachosGoalEnabled, masaQQAmount, centrifugeCycleTime, isCentrifugesAuto]);

    React.useEffect(() => {
        saveParamsToLocalStorage();
    }, [saveParamsToLocalStorage]);
    
    const handleImageSave = React.useCallback(async (type: 'machine' | 'silo' | 'wrapper' | 'tachos' | 'receiver' | 'centrifuge', id: string | number, file: File) => {
        setIsUploading(true);
        const imagePath = `sim-images/${type}`;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', imagePath);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || `Server error: ${response.statusText}`);
            }

            const { downloadURL } = await response.json();
            
            const docRef = doc(db, FIRESTORE_ASSETS_PATH, 'images');
            
            let fieldToUpdate = '';
            if (type === 'tachos') {
                fieldToUpdate = 'tachos';
            } else {
                fieldToUpdate = `${type}s.${id}`;
            }
            
            await setDoc(docRef, { [fieldToUpdate]: downloadURL }, { merge: true });

            if (type === 'machine') {
                setMachines(prev => prev.map(m => m.id === id ? { ...m, imageUrl: downloadURL } : m));
            } else if (type === 'silo') {
                setSilos(prev => prev.map(s => s.id === id ? { ...s, imageUrl: downloadURL } : s));
            } else if (type === 'wrapper') {
                setWrappers(prev => prev.map(w => w.id === id ? { ...w, imageUrl: downloadURL } : w));
            } else if (type === 'receiver') {
                setReceivers(prev => prev.map(r => r.id === id ? { ...r, imageUrl: downloadURL } : r));
            } else if (type === 'tachos') {
                setTachosImageUrl(downloadURL);
            } else if (type === 'centrifuge') {
                setCentrifuges(prev => prev.map(c => c.id === id ? { ...c, imageUrl: downloadURL } : c));
            }
            toast({ title: "Imagen actualizada", description: "La nueva imagen se ha guardado correctamente."});

        } catch (error: any) {
            console.error("Error during image upload and save:", error);
            toast({ 
                title: "Error al subir imagen", 
                description: `No se pudo guardar la imagen. ${error.message}`, 
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
        }
    }, [toast]);

    const handleMachineSave = (updatedMachine: Omit<MachineState, 'isSimulatingActive' | 'imageUrl'>) => {
        setMachines(prev => prev.map(m => m.id === updatedMachine.id ? { ...m, ...updatedMachine } : m));
    };

    const handleWrapperSave = (updatedWrapper: Omit<WrapperState, 'buffer' | 'currentBundleProgress' | 'totalBundles' | 'conveyorBelt' | 'imageUrl'>) => {
        setWrappers(prev => prev.map(w => w.id === updatedWrapper.id ? { ...w, ...updatedWrapper } : w));
    };

    const handleSiloSave = (updatedSilo: Omit<SiloState, 'imageUrl'>) => {
        setSilos(prev => prev.map(s => s.id === updatedSilo.id ? {...s, ...updatedSilo} : s));
    };

    const handleReceiverSave = (updatedReceiver: Omit<ReceiverState, 'imageUrl'|'currentQQ'>) => {
        setReceivers(prev => prev.map(r => r.id === updatedReceiver.id ? {...r, ...updatedReceiver} : r));
    };
    
    const handleTachosConfigChange = (config: { isAuto: boolean; cookTime: number; isGoalEnabled: boolean; goal: number, masaQQAmount: number; }) => {
        setIsTachosAuto(config.isAuto);
        setTachosCookTime(config.cookTime);
        setIsTachosGoalEnabled(config.isGoalEnabled);
        setTachosGoal(config.goal);
        setMasaQQAmount(config.masaQQAmount);
    };

    const handleCentrifugeConfigSave = (config: { cycleTime: number }) => {
        setCentrifugeCycleTime(config.cycleTime);
        toast({ title: 'Configuración de Centrífugas Guardada' });
    };

    const handleRestoreDefaults = async () => {
        const { params, images } = getDefaultConfig();
        window.localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(params)); 
        
        try {
            await setDoc(doc(db, FIRESTORE_ASSETS_PATH, 'images'), images);
        } catch (error) {
            console.error("Error restoring default images in Firestore", error);
        }
        
        await loadConfig();
        toast({ title: 'Configuración Restaurada', description: 'Todos los parámetros han vuelto a sus valores por defecto.' });
    };
    
    // --- SIMULATION STATE AND LOGIC ---
    const [isSimulating, setIsSimulating] = React.useState(false);
    
    const createInitialSimulationState = React.useCallback((): SimulationState => ({
        elapsedTime: 0,
        machineTotals: { 1: 0, 2: 0, 3: 0, 4: 0 },
        wrappers: {
            '1': { buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] },
            '2': { buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] },
        },
        isFinished: false,
        silos: JSON.parse(JSON.stringify(silos)),
        receivers: JSON.parse(JSON.stringify(receivers.map(r => ({...r, currentQQ: 0})))),
        centrifuges: JSON.parse(JSON.stringify(centrifuges.map(c => ({...c, state: 'idle', progress: 0, timeRemaining: 0})))),
        tachos: {
            id: 'tachos',
            name: 'Tachos',
            imageUrl: tachosImageUrl,
            state: 'idle',
            cookTimeSeconds: tachosCookTime * 60,
            timeRemaining: 0,
            progress: 0,
        },
        totalMasasSent: 0,
    }), [silos, receivers, centrifuges, tachosCookTime, tachosImageUrl]);
    
    const [simulationState, setSimulationState] = React.useState<SimulationState>(createInitialSimulationState());
    
    const sendMasaToReceiver = React.useCallback((): { success: boolean; newReceivers: ReceiverState[], sentTo: string | null } => {
        const newReceivers: ReceiverState[] = JSON.parse(JSON.stringify(simulationState.receivers));
        
        const receiver1 = newReceivers.find(r => r.id === 'rec1');
        if (receiver1 && receiver1.currentQQ < (receiver1.capacityQQ * masaQQAmount)) {
            receiver1.currentQQ += masaQQAmount;
            return { success: true, newReceivers, sentTo: receiver1.id };
        }

        const receiver2 = newReceivers.find(r => r.id === 'rec2');
        if (receiver2 && receiver2.currentQQ < (receiver2.capacityQQ * masaQQAmount)) {
            receiver2.currentQQ += masaQQAmount;
            return { success: true, newReceivers, sentTo: receiver2.id };
        }

        return { success: false, newReceivers: simulationState.receivers, sentTo: null };
    }, [masaQQAmount, simulationState.receivers]);

    const handleManualSendMasa = () => {
        const { success, newReceivers, sentTo } = sendMasaToReceiver();
        if (success) {
            setSimulationState(prev => ({
                ...prev,
                receivers: newReceivers,
                totalMasasSent: prev.totalMasasSent + 1,
            }));
            toast({ title: 'Masa enviada manualmente', description: `Se ha añadido una masa al ${sentTo === 'rec1' ? 'Recibidor 1' : 'Recibidor 2'}.` });
        } else {
            toast({ title: 'Error', description: 'Todos los recibidores están llenos.', variant: 'destructive' });
        }
    };
    
    const startCentrifugeCycle = (centrifugeId: string, isManual = false) => {
        let localSuccess = false;
        setSimulationState(prev => {
             const PURGES_PER_MASA = Math.max(1, Math.round(masaQQAmount / 30));
             const qqPerPurge = masaQQAmount / PURGES_PER_MASA;

             let activeReceiver = prev.receivers.find(r => r.id === 'rec1' && r.currentQQ >= qqPerPurge);
             if (!activeReceiver) {
                 activeReceiver = prev.receivers.find(r => r.id === 'rec2' && r.currentQQ >= qqPerPurge);
             }

            const centrifugeToStart = prev.centrifuges.find(c => c.id === centrifugeId);

            if (!activeReceiver || !centrifugeToStart || centrifugeToStart.state !== 'idle') {
                if (isManual) {
                   // This toast call was causing a render error, so it's removed from here.
                   // The feedback is now handled in the onClick handler.
                }
                return prev;
            }
            
            const newReceivers = JSON.parse(JSON.stringify(prev.receivers));
            const receiverToUpdate = newReceivers.find((r: ReceiverState) => r.id === activeReceiver!.id);
            
            if (receiverToUpdate) {
                receiverToUpdate.currentQQ -= qqPerPurge;

                const totalCycleTimeSeconds = centrifugeCycleTime * 60;
                const individualPurgeCycleTime = totalCycleTimeSeconds / PURGES_PER_MASA;
                
                const newCentrifuges = prev.centrifuges.map(c => 
                    c.id === centrifugeId 
                    ? { ...c, state: 'processing' as const, timeRemaining: individualPurgeCycleTime } 
                    : c
                );
                
                localSuccess = true;

                return {
                    ...prev,
                    receivers: newReceivers,
                    centrifuges: newCentrifuges,
                }
            }
            return prev;
        });

        if (isManual) {
            if (localSuccess) {
                toast({title: 'Ciclo manual iniciado', description: `La ${centrifugeId === 'cent1' ? 'Centrífuga 1' : 'Centrífuga 2'} ha comenzado a procesar.`});
            } else {
                toast({ title: 'No se puede iniciar', description: 'No hay material o la centrífuga está ocupada.', variant: 'destructive'});
            }
        }
    }
    
    React.useEffect(() => {
        setSimulationState(prev => ({
            ...prev,
            silos: JSON.parse(JSON.stringify(silos)),
            receivers: JSON.parse(JSON.stringify(receivers)),
        }));
    }, [silos, receivers]);

    const simulationIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const [simulationSpeed, setSimulationSpeed] = React.useState(1);
    
    const machinesRef = React.useRef(machines);
    React.useEffect(() => { machinesRef.current = machines; }, [machines]);

    const productsRef = React.useRef(products);
    React.useEffect(() => { productsRef.current = products; }, [products]);
    
    const wrappersRef = React.useRef(wrappers);
    React.useEffect(() => { wrappersRef.current = wrappers; }, [wrappers]);

    React.useEffect(() => {
        if (isTachosAuto && isTachosGoalEnabled && simulationState.totalMasasSent >= tachosGoal) {
            setIsTachosAuto(false); 
        }
    }, [simulationState.totalMasasSent, isTachosAuto, isTachosGoalEnabled, tachosGoal]);
    
    const totalWrapperCapacity = wrappers.reduce((sum, w) => sum + w.capacity, 0);
    
    const familiarSilo = simulationState.silos.find(s => s.id === 'familiar');
    const familiarSiloQQ = familiarSilo?.currentQQ || 0;

    const staticSimulationResults = React.useMemo(() => {
        const activeMachines = machines.filter(m => m.isSimulatingActive && m.productId !== 'inactive');
        
        const totalBagsPerMinuteFromPackers = activeMachines.reduce((sum, machine) => {
            const effectiveBagsPerMinute = machine.speed * (1 - machine.loss / 100);
            return sum + effectiveBagsPerMinute;
        }, 0);
        
        const effectiveSystemBagsPerMinute = Math.min(totalBagsPerMinuteFromPackers, totalWrapperCapacity);
        const isWrapperBottleneck = totalBagsPerMinuteFromPackers > totalWrapperCapacity;
        
        const avgUnitsPerBundle = wrappers.length > 0 ? wrappers.reduce((sum, w) => sum + w.unitsPerBundle, 0) / wrappers.length : 1;
        const bundlesPerMinute = avgUnitsPerBundle > 0 ? effectiveSystemBagsPerMinute / avgUnitsPerBundle : 0;
        
        const bottleneckDescription = `Las enfardadoras (cap total: ${totalWrapperCapacity.toLocaleString()} f/min) limitan a las envasadoras (cap: ${totalBagsPerMinuteFromPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} f/min).`;
        const noBottleneckDescription = `Las envasadoras (cap: ${totalBagsPerMinuteFromPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} f/min) operan a su capacidad.`;

        return {
            isWrapperBottleneck,
            bottleneckDescription,
            noBottleneckDescription,
            totalBagsPerMinuteFromPackers,
            bundlesPerMinute,
        };

    }, [machines, wrappers, totalWrapperCapacity]);

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
        
        const familiarSiloState = simulationState.silos.find(s => s.id === 'familiar');
        const familiarSiloKg = (familiarSiloState?.currentQQ || 0) * KG_PER_QUINTAL;
        const timeToEmptySeconds = totalKgConsumedPerSecond > 0 ? familiarSiloKg / totalKgConsumedPerSecond : Infinity;

        return {
            totalKgProduced,
            totalQuintalesProduced: totalKgProduced / KG_PER_QUINTAL,
            totalBundlesProduced: Object.values(simulationState.wrappers).reduce((sum, w) => sum + w.totalBundles, 0),
            timeToEmptyHours: timeToEmptySeconds / 3600,
        }

    }, [simulationState]);

    const formatElapsedTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };
    
    const pauseClock = React.useCallback(() => {
        setIsSimulating(false);
        if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
        }
    }, []);

    const startClock = () => {
        if (simulationIntervalRef.current) return;
        setIsSimulating(true);
        
        setSimulationState(prev => ({
            ...prev,
            isFinished: false,
        }));
        
        const tickRateMs = 50; 
        
        simulationIntervalRef.current = setInterval(() => {
            setSimulationState(prev => {
                if (prev.isFinished) {
                    pauseClock();
                    return prev;
                }
                
                const elapsedIncrement = (tickRateMs / 1000) * simulationSpeed;
                const newElapsedTime = prev.elapsedTime + elapsedIncrement;
                
                let newTachos = { ...prev.tachos, cookTimeSeconds: tachosCookTime * 60 };
                let newReceivers: ReceiverState[] = JSON.parse(JSON.stringify(prev.receivers));
                let newCentrifuges: CentrifugeState[] = JSON.parse(JSON.stringify(prev.centrifuges));
                let newSilos: SiloState[] = JSON.parse(JSON.stringify(prev.silos));
                let newTotalMasasSent = prev.totalMasasSent;

                const goalMet = isTachosGoalEnabled && prev.totalMasasSent >= tachosGoal;
                
                // 1. Tachos Logic
                if (newTachos.state === 'cooking') {
                    newTachos.timeRemaining -= elapsedIncrement;
                    newTachos.progress = 100 * (1 - newTachos.timeRemaining / newTachos.cookTimeSeconds);
                    if (newTachos.timeRemaining <= 0) {
                        newTachos.state = 'ready';
                        newTachos.progress = 100;
                    }
                }
                
                if (isTachosAuto && !goalMet) {
                    if (newTachos.state === 'idle') {
                        newTachos.state = 'cooking';
                        newTachos.timeRemaining = newTachos.cookTimeSeconds;
                    }

                    if (newTachos.state === 'ready') {
                        const { success, newReceivers: updatedReceivers } = sendMasaToReceiver();
                        if (success) {
                            newReceivers = updatedReceivers;
                            newTotalMasasSent += 1;
                            newTachos.state = 'idle'; 
                            newTachos.progress = 0;
                            newTachos.timeRemaining = 0;
                        }
                    }
                } else if (goalMet && isTachosAuto) {
                    setIsTachosAuto(false);
                }


                // 2. Centrifuges Logic
                if (isCentrifugesAuto) {
                     const PURGES_PER_MASA = Math.max(1, Math.round(masaQQAmount / 30));
                     const qqPerPurge = masaQQAmount / PURGES_PER_MASA;
                     let activeReceiver = newReceivers.find((r) => r.id === 'rec1' && r.currentQQ >= qqPerPurge) || newReceivers.find((r) => r.id === 'rec2' && r.currentQQ >= qqPerPurge);
                    
                     const idleCentrifuge = newCentrifuges.find((c) => c.state === 'idle');
                     if (activeReceiver && idleCentrifuge) {
                         const otherCentrifugeId = idleCentrifuge.id === 'cent1' ? 'cent2' : 'cent1';
                         const otherCentrifuge = newCentrifuges.find((c) => c.id === otherCentrifugeId);
                         
                         let shouldStart = false;
                         if (otherCentrifuge?.state === 'idle') {
                             shouldStart = true;
                         } else if (otherCentrifuge?.state === 'processing') {
                            const totalCycleTimeSeconds = centrifugeCycleTime * 60;
                            const individualPurgeCycleTime = totalCycleTimeSeconds / PURGES_PER_MASA;
                            if (otherCentrifuge.timeRemaining <= individualPurgeCycleTime / 2) {
                                shouldStart = true;
                            }
                         }

                         if (shouldStart) {
                            const receiverToUpdate = newReceivers.find((r) => r.id === activeReceiver!.id);
                            if (receiverToUpdate) {
                                receiverToUpdate.currentQQ -= qqPerPurge;
                                const totalCycleTimeSeconds = centrifugeCycleTime * 60;
                                const individualPurgeCycleTime = totalCycleTimeSeconds / PURGES_PER_MASA;
                                newCentrifuges = newCentrifuges.map((c) => 
                                    c.id === idleCentrifuge.id 
                                    ? { ...c, state: 'processing', timeRemaining: individualPurgeCycleTime }
                                    : c
                                );
                            }
                         }
                     }
                }

                // Update progress for all processing centrifuges
                newCentrifuges.forEach((cent, index) => {
                    if (cent.state === 'processing') {
                        cent.timeRemaining -= elapsedIncrement;
                        
                        const PURGES_PER_MASA = Math.max(1, Math.round(masaQQAmount / 30));
                        const totalCycleTimeSeconds = centrifugeCycleTime * 60;
                        const individualPurgeCycleTime = totalCycleTimeSeconds / PURGES_PER_MASA;
                        
                        cent.progress = Math.max(0, 100 * (1 - cent.timeRemaining / individualPurgeCycleTime));
                        
                        const qqPerPurge = masaQQAmount / PURGES_PER_MASA;
                        const qqPerSecond = qqPerPurge / individualPurgeCycleTime;
                        const qqThisTick = qqPerSecond * elapsedIncrement;
                        
                        const familiarSilo = newSilos.find((s) => s.id === 'familiar');
                        const granelSilo = newSilos.find((s) => s.id === 'granel');

                        if (familiarSilo && granelSilo) {
                            const spaceInFamiliar = familiarSilo.capacityQQ - familiarSilo.currentQQ;
                            const qqForFamiliar = Math.min(qqThisTick, spaceInFamiliar);
                            familiarSilo.currentQQ += qqForFamiliar;

                            const remainder = qqThisTick - qqForFamiliar;
                            if (remainder > 0) {
                                granelSilo.currentQQ = Math.min(granelSilo.capacityQQ, granelSilo.currentQQ + remainder);
                            }
                        }

                        if (cent.timeRemaining <= 0) {
                            cent.state = 'idle';
                            cent.progress = 0;
                        }
                        newCentrifuges[index] = cent;
                    }
                });
                
                // 3. Envasadoras & Enfardadoras Logic
                const currentMachines = machinesRef.current;
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
                
                const kgAvailableInFamiliarSilo = (newSilos.find((s) => s.id === 'familiar')?.currentQQ || 0) * KG_PER_QUINTAL;
                const canProduce = kgAvailableInFamiliarSilo >= kgConsumedThisTick;
                
                if (!canProduce && totalKgConsumedPerSecond > 0) {
                    const finalSilos = newSilos.map((s) => s.id === 'familiar' ? { ...s, currentQQ: 0 } : s);
                    pauseClock();
                    return {...prev, silos: finalSilos, elapsedTime: newElapsedTime, isFinished: true, centrifuges: newCentrifuges, receivers: newReceivers, tachos: newTachos };
                }

                const newMachineTotals = { ...prev.machineTotals };
                const unitsProducedByWrapper: { [wrapperId: string]: number } = {};
                wrappersRef.current.forEach(w => unitsProducedByWrapper[w.id] = 0);


                if (canProduce) {
                    if (kgConsumedThisTick > 0) {
                         newSilos = newSilos.map((s) => {
                            if (s.id === 'familiar') {
                                return { ...s, currentQQ: s.currentQQ - (kgConsumedThisTick / KG_PER_QUINTAL) };
                            }
                            return s;
                        });
                    }

                    activeMachinesConfig.forEach(m => {
                        const unitsProducedThisTick = m.unitsPerSecond * elapsedIncrement;
                        newMachineTotals[m.id] += unitsProducedThisTick;
                        const targetWrapper = wrappersRef.current.find(w => w.machineIds.includes(m.id));
                        if (targetWrapper) {
                            unitsProducedByWrapper[targetWrapper.id] += unitsProducedThisTick;
                        }
                    });
                }
                
                const newWrappersState: SimulationState['wrappers'] = JSON.parse(JSON.stringify(prev.wrappers));
                
                for (const wrapperConfig of wrappersRef.current) {
                    const wrapperId = wrapperConfig.id;
                    const unitsForThisWrapper = unitsProducedByWrapper[wrapperId];
                    if (unitsForThisWrapper > 0) {
                        newWrappersState[wrapperId].conveyorBelt.push({ producedAt: prev.elapsedTime, units: unitsForThisWrapper });
                    }
                }

                for (const wrapperConfig of wrappersRef.current) {
                    const wrapperId = wrapperConfig.id;
                    const wrapperState = newWrappersState[wrapperId];
                    
                    const arrivedItems: ConveyorItem[] = [];
                    const remainingOnBelt: ConveyorItem[] = [];
                    wrapperState.conveyorBelt.forEach((item) => {
                        if (newElapsedTime >= item.producedAt + wrapperConfig.conveyorDelay) {
                            arrivedItems.push(item);
                        } else {
                            remainingOnBelt.push(item);
                        }
                    });
                    const totalArrivedUnits = arrivedItems.reduce((sum, item) => sum + item.units, 0);
                    wrapperState.conveyorBelt = remainingOnBelt;
                    wrapperState.buffer += totalArrivedUnits;

                    const wrapperUnitsPerSecond = wrapperConfig.capacity / 60;
                    const unitsToProcessThisTick = wrapperUnitsPerSecond * elapsedIncrement;
                    const unitsToTakeFromBuffer = Math.min(unitsToProcessThisTick, wrapperState.buffer);

                    wrapperState.buffer -= unitsToTakeFromBuffer;
                    wrapperState.currentBundleProgress += unitsToTakeFromBuffer;
                    
                    if (wrapperState.currentBundleProgress >= wrapperConfig.unitsPerBundle && wrapperConfig.unitsPerBundle > 0) {
                        const bundlesCreated = Math.floor(wrapperState.currentBundleProgress / wrapperConfig.unitsPerBundle);
                        wrapperState.totalBundles += bundlesCreated;
                        wrapperState.currentBundleProgress %= wrapperConfig.unitsPerBundle;
                    }
                }

                return {
                    ...prev,
                    elapsedTime: newElapsedTime,
                    machineTotals: newMachineTotals,
                    wrappers: newWrappersState,
                    silos: newSilos,
                    receivers: newReceivers,
                    centrifuges: newCentrifuges,
                    tachos: newTachos,
                    totalMasasSent: newTotalMasasSent,
                };
            });
        }, tickRateMs);
    };

    const resetSimulation = (resetMaterial = true) => {
        pauseClock();
        const initialSimState = createInitialSimulationState();
        if (resetMaterial) {
            setSimulationState(initialSimState);
        } else {
            const currentSilos = JSON.parse(JSON.stringify(simulationState.silos));
            const currentReceivers = JSON.parse(JSON.stringify(simulationState.receivers));
            const currentMasasSent = simulationState.totalMasasSent;
            setSimulationState({
                ...initialSimState,
                silos: currentSilos,
                receivers: currentReceivers,
                totalMasasSent: currentMasasSent,
            });
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
    }, [pauseClock]);
    
    const formatTime = (hours: number) => {
        if (!isFinite(hours) || hours <= 0) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };
    
    const formatTimeSeconds = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m ${seconds}s`;
    };


    const getSiloFillColor = (percentage: number): string => {
        if (percentage < 20) return 'bg-red-500';
        if (percentage < 60) return 'bg-yellow-500';
        return 'bg-green-500';
    };
    
    const simTachos = simulationState.tachos;
    const tachosStateConfig = {
        idle: { text: "Libre", color: "text-primary", icon: CircleSlash },
        cooking: { text: "Cocinando", color: "text-amber-600", icon: Beaker },
        ready: { text: "Lista para Enviar", color: "text-green-600", icon: CheckCircle2 },
    };
    const currentTachosConfig = tachosStateConfig[simTachos.state];

    const areAllCentrifugesIdle = simulationState.centrifuges.every(c => c.state === 'idle');
    const isAnyMaterialAvailable = simulationState.receivers.some(r => r.currentQQ > 0);

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
                <div className="flex justify-around items-center p-4 border rounded-lg bg-muted/30 overflow-x-auto">
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Beaker className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Tachos</h4>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Inicio: Generación de masa.</p></TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Droplets className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Recibidores</h4>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Almacenamiento temporal de masa.</p></TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Hourglass className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Centrífugas</h4>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Purga y lavado del azúcar.</p></TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Warehouse className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Silos</h4>
                            <p className="text-sm text-muted-foreground">{familiarSiloQQ.toLocaleString(undefined, {maximumFractionDigits: 0})} QQ</p>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Almacenamiento de azúcar seca.</p></TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className={cn("flex flex-col items-center gap-2 text-center p-2 rounded-md min-w-[90px]", staticSimulationResults.isWrapperBottleneck && 'bg-destructive/10')}>
                            <Package className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Envasado</h4>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Producción de las envasadoras.</p></TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[90px]">
                            <PackageCheck className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Enfardado</h4>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Empaque final en fardos.</p></TooltipContent> </Tooltip> </TooltipProvider>
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
                         <div className="flex flex-wrap items-center gap-2">
                           <Button onClick={startClock} disabled={isSimulating} variant="secondary">
                               <Play className="mr-2 h-4 w-4" /> Iniciar
                           </Button>
                           <Button onClick={pauseClock} disabled={!isSimulating} variant="destructive">
                               <Pause className="mr-2 h-4 w-4" /> Detener
                           </Button>
                           <Separator orientation="vertical" className="h-6 mx-2" />
                           <Button onClick={() => resetSimulation(true)} variant="outline">
                               <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar Todo
                           </Button>
                       </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-4">
                           <div className="space-y-1.5">
                                <div className='flex justify-between items-center'>
                                  <Label htmlFor="sim-speed">Acelerador de Tiempo (x{simulationSpeed.toLocaleString()})</Label>
                                </div>
                                <Slider
                                   id="sim-speed"
                                   min={1}
                                   max={1000}
                                   step={1}
                                   value={[simulationSpeed]}
                                   onValueChange={(value) => setSimulationSpeed(value[0])}
                                />
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
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">1. Materia Prima</CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Restaurar Configuración</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        ¿Estás seguro? Esto restaurará todos los parámetros de la simulación (en este navegador) y las imágenes (para todos los usuarios) a sus valores por defecto.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleRestoreDefaults}>Sí, Restaurar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Restaurar valores por defecto</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                        {/* Tachos */}
                        <div className="p-4 border rounded-lg space-y-3 bg-background flex flex-col justify-between">
                            <div className='flex justify-between items-start'>
                                <h3 className="font-bold text-lg flex items-center gap-2">{simTachos.name}
                                {isTachosAuto && <Badge variant="secondary">Auto</Badge>}
                                </h3>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo(simTachos)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                             <div className="space-y-1">
                                <div className={cn("flex justify-between items-center text-xs font-medium", currentTachosConfig.color)}>
                                    <span className="flex items-center gap-1.5"><currentTachosConfig.icon className="h-3 w-3" /> {currentTachosConfig.text}</span>
                                    <span>{formatTimeSeconds(simTachos.timeRemaining)}</span>
                                </div>
                                <Progress value={simTachos.progress} indicatorClassName={cn(currentTachosConfig.color.replace("text-", "bg-"))} />
                            </div>
                            <div className="space-y-2">
                                <div className='text-center border bg-muted/30 rounded-lg p-2'>
                                    <p className="text-xs text-muted-foreground">Total Masas Enviadas</p>
                                    <p className="text-lg font-bold text-primary">{simulationState.totalMasasSent}</p>
                                </div>
                                 {!isTachosAuto && (
                                     simTachos.state === 'ready'
                                     ? <Button className="w-full" onClick={handleManualSendMasa} disabled={isSimulating}>Enviar Masa Manual</Button>
                                     : simTachos.state === 'idle' 
                                       ? <Button className="w-full" onClick={() => setSimulationState(prev => ({...prev, tachos: {...prev.tachos, state: 'cooking', timeRemaining: prev.tachos.cookTimeSeconds}}))} disabled={isSimulating}>Cocinar Masa</Button>
                                       : <Button className="w-full" disabled>Cocinando...</Button>
                                )}
                            </div>
                        </div>
                        
                        {/* Receivers */}
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                            {receivers.map((receiver) => {
                                const simReceiver = simulationState.receivers.find(r => r.id === receiver.id) || receiver;
                                const masas = simReceiver.currentQQ / masaQQAmount;
                                const maxMasas = simReceiver.capacityQQ;
                                return (
                                    <div key={receiver.id} className="p-4 border rounded-lg bg-background flex-1 flex flex-col">
                                        <div className='flex justify-between items-start mb-2'>
                                            <h3 className="font-bold text-lg">{receiver.name}</h3>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingReceiver(receiver)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <div className="space-y-2 pt-2 mt-auto">
                                            <Label className="text-sm">Nivel Actual: {masas.toFixed(1)} / {maxMasas} Masas</Label>
                                            <div className="flex gap-1 h-4">
                                                {Array.from({ length: maxMasas }).map((_, i) => (
                                                    <div key={i} className={cn("flex-1 rounded-sm", i < masas ? 'bg-amber-500' : 'bg-muted')}></div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Centrifuges */}
                        <div className="p-4 border rounded-lg bg-background flex-1 flex flex-col">
                            <div className='flex justify-between items-center mb-2'>
                                <h3 className="font-bold text-lg">Centrífugas</h3>
                                <div className="flex items-center gap-2">
                                     <div className="flex items-center space-x-2">
                                        <Label htmlFor="cent-auto-switch" className="text-xs">Auto</Label>
                                        <Switch
                                            id="cent-auto-switch"
                                            checked={isCentrifugesAuto}
                                            onCheckedChange={setIsCentrifugesAuto}
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCentrifuges(true)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {centrifuges.map((centrifuge) => {
                                    const simCentrifuge = simulationState.centrifuges.find(c => c.id === centrifuge.id) || centrifuge;
                                    const stateConfig = {
                                        idle: { text: "Libre", color: "text-primary", icon: CircleSlash },
                                        processing: { text: "Procesando", color: "text-amber-600", icon: Activity },
                                    };
                                    const currentCentrifugeConfig = stateConfig[simCentrifuge.state];
                                    return (
                                        <div key={centrifuge.id} className="mt-4 border p-3 rounded-lg flex flex-col">
                                            <h4 className='text-sm font-semibold mb-2'>{simCentrifuge.name}</h4>
                                            <div className="space-y-1 mt-auto">
                                                <div className={cn("flex justify-between items-center text-xs font-medium", currentCentrifugeConfig.color)}>
                                                    <span className="flex items-center gap-1.5"><currentCentrifugeConfig.icon className="h-3 w-3" /> {currentCentrifugeConfig.text}</span>
                                                    <span>{formatTimeSeconds(simCentrifuge.timeRemaining)}</span>
                                                </div>
                                                <Progress value={simCentrifuge.progress} indicatorClassName={cn(currentCentrifugeConfig.color.replace("text-", "bg-"))} />
                                            </div>
                                            {!isCentrifugesAuto && (
                                                <Button size="sm" variant="secondary" className="w-full mt-2" onClick={() => startCentrifugeCycle(centrifuge.id, true)} disabled={simCentrifuge.state !== 'idle' || !isAnyMaterialAvailable || isSimulating}>
                                                   Iniciar Purga Manual
                                                </Button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            {areAllCentrifugesIdle && !isAnyMaterialAvailable && (
                                <div className="text-center text-amber-600 font-semibold p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm flex items-center justify-center gap-2 mt-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>Sin Material</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">2. Almacenamiento</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {silos.map((silo) => {
                            const simSilo = simulationState.silos.find(s => s.id === silo.id) || silo;
                            const currentKg = simSilo.currentQQ * KG_PER_QUINTAL;
                            const fillPercentage = simSilo.capacityQQ > 0 ? (simSilo.currentQQ / simSilo.capacityQQ) * 100 : 0;
                            const fillColorClass = getSiloFillColor(fillPercentage);
                            const isProductionSilo = simSilo.id === 'familiar';

                            return (
                                <div key={simSilo.id} className="p-4 border rounded-lg space-y-3 bg-background">
                                     <div className='flex justify-between items-start'>
                                        <h3 className="font-bold text-lg">{simSilo.name}</h3>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo(silo)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-2">
                                        <Image src={simSilo.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media"} alt={simSilo.name} width={600} height={400} className="object-contain w-full h-full" unoptimized/>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className='text-xs text-muted-foreground'>Capacidad: {simSilo.capacityQQ.toLocaleString()} QQ</Label>
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        <Label className="text-sm">Nivel: {currentKg.toLocaleString(undefined, {maximumFractionDigits:0})} kg ({fillPercentage.toFixed(1)}%)</Label>
                                        <Progress value={fillPercentage} indicatorClassName={fillColorClass} />
                                    </div>
                                     {isProductionSilo && (
                                         <div className="text-center border bg-muted/30 rounded-lg p-2">
                                              <p className="text-xs text-muted-foreground">Tiempo de Producción Restante</p>
                                              <p className="text-lg font-bold text-primary">{formatTime(liveSimulationResults.timeToEmptyHours)}</p>
                                         </div>
                                     )}
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">3. Envasadoras</CardTitle>
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
                                                src={machine.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media"} 
                                                alt={`Máquina ${machine.id}`}
                                                width={600}
                                                height={400}
                                                className="object-contain w-full h-full"
                                                unoptimized
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
                        <CardTitle className="flex items-center gap-2">4. Enfardadora y Empaque Final</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {wrappers.map((wrapperConfig) => {
                            const wrapperState = simulationState.wrappers[wrapperConfig.id];
                            if (!wrapperState) return null;
                            
                            const unitsInTransit = wrapperState.conveyorBelt.reduce((sum, item) => sum + item.units, 0);

                            return (
                                <div key={wrapperConfig.id} className="p-4 border rounded-lg space-y-3 bg-background">
                                    <div className="flex justify-between items-start">
                                        <Label className="font-bold text-primary">{wrapperConfig.name}</Label>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingWrapper(wrapperConfig)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                                        <Image
                                            src={wrapperConfig.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/enfardadora.jpeg?alt=media"}
                                            alt={wrapperConfig.name}
                                            width={600}
                                            height={400}
                                            className="object-contain w-full h-full"
                                            unoptimized
                                        />
                                    </div>
                                    
                                     <div className="space-y-2 rounded-lg bg-muted/30 p-2 border text-xs">
                                        <h3 className="font-semibold text-center text-muted-foreground">Configuración Clave</h3>
                                        <div className="grid grid-cols-3 gap-1 text-center">
                                            <div className="bg-background p-1 rounded-md border">
                                                <p className="text-muted-foreground">Capacidad</p>
                                                <p className="font-bold text-sm">{wrapperConfig.capacity} <span className="text-xs font-normal">f/min</span></p>
                                            </div>
                                            <div className="bg-background p-1 rounded-md border">
                                                <p className="text-muted-foreground">Unidades/Fardo</p>
                                                <p className="font-bold text-sm">{wrapperConfig.unitsPerBundle}</p>
                                            </div>
                                            <div className="bg-background p-1 rounded-md border">
                                                <p className="text-muted-foreground">Retraso</p>
                                                <p className="font-bold text-sm">{wrapperConfig.conveyorDelay}s</p>
                                            </div>
                                        </div>
                                         <div className="border-t pt-2 mt-2">
                                            <h4 className="font-semibold text-center text-muted-foreground mb-1">Envasadoras Conectadas</h4>
                                            <div className="flex justify-center gap-2 flex-wrap">
                                                {wrapperConfig.machineIds.length > 0 ? wrapperConfig.machineIds.map(id => (
                                                    <Badge key={id} variant="secondary">M{id}</Badge>
                                                )) : <p className="text-muted-foreground">Ninguna</p>}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 rounded-lg bg-muted/30 p-3 border">
                                         <div className="grid grid-cols-2 gap-2 text-center">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Fundas en Transporte</p>
                                                <p className="font-bold text-lg text-orange-500">{Math.floor(unitsInTransit).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">En Cola</p>
                                                <p className="font-bold text-lg text-blue-600">{Math.floor(wrapperState.buffer).toLocaleString()}</p>
                                            </div>
                                        </div>
                                         <div>
                                            <Label className="text-xs">Fardo Actual ({Math.floor(wrapperState.currentBundleProgress)}/{wrapperConfig.unitsPerBundle} fundas)</Label>
                                            <Progress value={(wrapperState.currentBundleProgress / (wrapperConfig.unitsPerBundle || 1)) * 100} />
                                         </div>
                                         <div className='text-center border bg-background rounded-lg p-2'>
                                            <p className="text-xs text-muted-foreground">Total Fardos</p>
                                            <p className="font-bold text-lg text-green-600">{wrapperState.totalBundles.toLocaleString()}</p>
                                         </div>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
                
                <div className="space-y-6">
                    <h3 className="font-semibold text-xl text-center">Resultados Globales de la Línea</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KpiCard 
                            title="Total Fardos Producidos" 
                            value={liveSimulationResults.totalBundlesProduced} 
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
                                                  if (!machine) return { name: `Máq. ${machineId}`, value: 0 };
                                                  const product = products.find(p => p.id === machine.productId);
                                                  const sacksProduced = machine.unitsPerSack > 0 ? totalUnits / machine.unitsPerSack : 0;
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
                    onSave={handleMachineSave}
                    onImageSave={handleImageSave}
                    isUploading={isUploading}
                />
            )}
             {editingSilo && (
                <SiloEditDialog
                    open={!!editingSilo}
                    onOpenChange={(isOpen) => !isOpen && setEditingSilo(null)}
                    silo={editingSilo}
                    onSave={handleSiloSave}
                    isTachos={editingSilo.id === 'tachos'}
                    tachosConfig={{
                        isAuto: isTachosAuto,
                        cookTime: tachosCookTime,
                        isGoalEnabled: isTachosGoalEnabled,
                        goal: tachosGoal,
                        masaQQAmount: masaQQAmount,
                    }}
                    onTachosConfigChange={handleTachosConfigChange}
                />
            )}
            {editingReceiver && (
                <ReceiverEditDialog
                    open={!!editingReceiver}
                    onOpenChange={(isOpen) => !isOpen && setEditingReceiver(null)}
                    receiver={editingReceiver}
                    onSave={handleReceiverSave}
                />
            )}
             {editingCentrifuges && (
                <CentrifugeEditDialog
                    open={editingCentrifuges}
                    onOpenChange={setEditingCentrifuges}
                    onSave={handleCentrifugeConfigSave}
                    cycleTime={centrifugeCycleTime}
                />
            )}
            {editingWrapper && (
                <WrapperEditDialog
                    open={!!editingWrapper}
                    onOpenChange={(isOpen) => !isOpen && setEditingWrapper(null)}
                    wrapper={editingWrapper}
                    allMachines={machines}
                    onSave={handleWrapperSave}
                    onImageSave={handleImageSave}
                    isUploading={isUploading}
                />
            )}
        </>
        )}
      </main>
    </div>
  );
}

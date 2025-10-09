'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, PackageCheck, ArrowRight, AlertTriangle, Upload, Edit, Beaker, Play, Pause, RefreshCw, Clock, Zap, Power, PowerOff, Droplets, Wind, Hourglass } from 'lucide-react';
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
const MASA_QQ_AMOUNT = 380;
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

// NUEVOS TIPOS
type ReceiverState = {
    id: string;
    name: string;
    capacityMasas: number; // Siempre será 1
    currentMasas: number;
    imageUrl: string | null;
};

type CentrifugeState = {
    id: string;
    name: string;
    state: 'idle' | 'purging' | 'sending';
    purgeTimeSeconds: number; // Tiempo de purga en segundos
    sendingTimeSeconds: number; // Tiempo que tarda en enviar a silos
    connectedReceiverId: string;
    imageUrl: string | null;

    // Live simulation data
    progress: number;
    timeRemaining: number;
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
    tachosState: Omit<SiloState, 'imageUrl'>;
    autoTachosInterval: number;
    autoTachosGoal: number;
    isTachosAuto: boolean;
    isTachosGoalEnabled: boolean;
};

type ImageUrlConfig = {
    machines: { [id: number]: string };
    wrappers: { [id: string]: string };
    silos: { [id: string]: string };
    tachos: string;
};


type SimulationState = {
    elapsedTime: number; // in seconds
    machineTotals: { [machineId: number]: number }; // Total units produced by each machine
    wrappers: { [wrapperId: string]: Omit<WrapperState, 'id' | 'name' | 'capacity' | 'unitsPerBundle' | 'conveyorDelay' | 'imageUrl' | 'machineIds'> };
    isFinished: boolean;
    nextAutoTachosSendTime: number;
    silos: SiloState[]; // Add silos to the simulation state
    receivers: ReceiverState[]; // NUEVO
    centrifuges: CentrifugeState[]; // NUEVO
    totalMasasSent: number; // Add masas sent to simulation state
};

function MachineEditDialog({
    machine,
    products,
    open,
    onOpenChange,
    onImageSave,
    isUploading
}: {
    machine: MachineState;
    products: ProductDefinition[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedMachine: Omit<MachineState, 'isSimulatingActive' | 'imageUrl'>) => void;
    onImageSave: (type: 'machine' | 'silo' | 'wrapper' | 'tachos', id: string | number, file: File) => Promise<void>;
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
    onImageSave,
    isTachos,
    tachosConfig,
    onTachosConfigChange,
    isUploading,
}: {
    silo: SiloState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedSilo: Omit<SiloState, 'imageUrl'>) => void;
    onImageSave: (type: 'machine' | 'silo' | 'wrapper' | 'tachos', id: string | number, file: File) => Promise<void>;
    isTachos?: boolean;
    tachosConfig?: { isAuto: boolean; interval: number; isGoalEnabled: boolean; goal: number };
    onTachosConfigChange?: (config: { isAuto: boolean; interval: number; isGoalEnabled: boolean; goal: number }) => void;
    isUploading: boolean;
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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await onImageSave(isTachos ? 'tachos' : 'silo', silo.id, file);
    };

    const fileInputId = `silo-modal-image-upload-${silo.id}`;

    const handleSaveChanges = () => {
        const { imageUrl, ...configToSave } = editedSilo;
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
                                    src={editedSilo.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/Tachos.jpg?alt=media"}
                                    alt={editedSilo.name}
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
                        <Label htmlFor={`silo-name-${silo.id}`}>Nombre</Label>
                        <Input id={`silo-name-${silo.id}`} type="text" value={editedSilo.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                    </div>
                    {!isTachos && (
                        <div className="space-y-1.5">
                            <Label htmlFor={`silo-cap-${silo.id}`}>Capacidad Máx. (QQ)</Label>
                            <Input id={`silo-cap-${silo.id}`} type="number" value={editedSilo.capacityQQ} onChange={(e) => handleFieldChange('capacityQQ', Number(e.target.value))} min="0" />
                        </div>
                    )}
                    {isTachos && localTachosConfig && (
                        <>
                            <Separator />
                            <div className="space-y-4">
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
                                        <Label htmlFor="auto-interval" className="text-xs">Intervalo de Envío (minutos)</Label>
                                        <Input
                                            id="auto-interval"
                                            type="number"
                                            value={localTachosConfig.interval}
                                            onChange={(e) => handleTachosConfigFieldChange('interval', Number(e.target.value))}
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
    onImageSave: (type: 'machine' | 'silo' | 'wrapper' | 'tachos', id: string | number, file: File) => Promise<void>;
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
    const [tachosState, setTachosState] = React.useState<SiloState>({ id: 'tachos', name: 'Tachos', capacityQQ: 0, currentQQ: 0, imageUrl: null });
    const [receivers, setReceivers] = React.useState<ReceiverState[]>([]); // NUEVO
    const [centrifuges, setCentrifuges] = React.useState<CentrifugeState[]>([]); // NUEVO
    
    const [autoTachosInterval, setAutoTachosInterval] = React.useState(10);
    const [autoTachosGoal, setAutoTachosGoal] = React.useState(6);
    const [isTachosAuto, setIsTachosAuto] = React.useState(false);
    const [isTachosGoalEnabled, setIsTachosGoalEnabled] = React.useState(false);
    
    // --- UI State ---
    const [editingMachine, setEditingMachine] = React.useState<MachineState | null>(null);
    const [editingSilo, setEditingSilo] = React.useState<SiloState | null>(null);
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
            tachosState: { id: 'tachos', name: 'Tachos', capacityQQ: 0, currentQQ: 0 },
            autoTachosInterval: 10,
            autoTachosGoal: 6,
            isTachosAuto: false,
            isTachosGoalEnabled: false,
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
                    tachosState: { ...defaultParams.tachosState, ...savedParams.tachosState },
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
            setTachosState({
                ...params.tachosState,
                imageUrl: imageUrls.tachos,
            });
            // --- NUEVA INICIALIZACIÓN ---
            setReceivers([
                { id: 'rec1', name: 'Recibidor 1', capacityMasas: 1, currentMasas: 0, imageUrl: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/recibidor.png?alt=media' },
                { id: 'rec2', name: 'Recibidor 2', capacityMasas: 1, currentMasas: 0, imageUrl: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/recibidor.png?alt=media' },
            ]);
            setCentrifuges([
                { id: 'cent1', name: 'Centrífuga 1', state: 'idle', purgeTimeSeconds: 2 * 3600, sendingTimeSeconds: 3600, connectedReceiverId: 'rec1', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/centrifuga.png?alt=media', progress: 0, timeRemaining: 0 },
                { id: 'cent2', name: 'Centrífuga 2', state: 'idle', purgeTimeSeconds: 2 * 3600, sendingTimeSeconds: 3600, connectedReceiverId: 'rec2', imageUrl: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/centrifuga.png?alt=media', progress: 0, timeRemaining: 0 },
            ]);
            // --- FIN NUEVA INICIALIZACIÓN ---

            setAutoTachosInterval(params.autoTachosInterval);
            setAutoTachosGoal(params.autoTachosGoal);
            setIsTachosAuto(params.isTachosAuto);
            setIsTachosGoalEnabled(params.isTachosGoalEnabled);

        } catch (error) {
            console.error("Error loading config:", error);
            const { params, images } = getDefaultConfig();
            setMachines(params.machines.map(m => ({ ...m, imageUrl: images.machines[m.id] || null, isSimulatingActive: false })));
            setWrappers(params.wrappers.map(w => ({ ...w, imageUrl: images.wrappers[w.id] || null, buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] })));
            setSilos(params.silos.map(s => ({ ...s, imageUrl: images.silos[s.id] || null })));
            setTachosState({ ...params.tachosState, imageUrl: images.tachos });
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
            tachosState: (({imageUrl, ...t}) => t)(tachosState),
            autoTachosInterval: autoTachosInterval,
            autoTachosGoal: autoTachosGoal,
            isTachosAuto: isTachosAuto,
            isTachosGoalEnabled: isTachosGoalEnabled,
        };
        try {
            window.localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(paramsToSave));
        } catch (error) {
            console.error("Error saving params to localStorage", error);
        }
    }, [isClient, machines, wrappers, silos, tachosState, autoTachosInterval, autoTachosGoal, isTachosAuto, isTachosGoalEnabled]);

    React.useEffect(() => {
        saveParamsToLocalStorage();
    }, [saveParamsToLocalStorage]);
    
    const handleImageSave = React.useCallback(async (type: 'machine' | 'silo' | 'wrapper' | 'tachos', id: string | number, file: File) => {
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
                throw new Error(errorData.details || 'Server error');
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
            } else if (type === 'tachos') {
                setTachosState(prev => ({ ...prev, imageUrl: downloadURL }));
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
        if (updatedSilo.id === 'tachos') {
            setTachosState(prev => ({...prev, ...updatedSilo}));
        } else {
            setSilos(prev => prev.map(s => s.id === updatedSilo.id ? {...s, ...updatedSilo} : s));
        }
    };
    
    const handleTachosConfigChange = (config: { isAuto: boolean; interval: number; isGoalEnabled: boolean; goal: number }) => {
        setIsTachosAuto(config.isAuto);
        setAutoTachosInterval(config.interval);
        setIsTachosGoalEnabled(config.isGoalEnabled);
        setAutoTachosGoal(config.goal);
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
    
    const sendMasaToReceiver = React.useCallback((currentReceivers: ReceiverState[]): { success: boolean; newReceivers: ReceiverState[] } => {
        const newReceivers = JSON.parse(JSON.stringify(currentReceivers));
        const availableReceiver = newReceivers.find((r: ReceiverState) => r.currentMasas < r.capacityMasas);

        if (availableReceiver) {
            availableReceiver.currentMasas += 1;
            return { success: true, newReceivers };
        }
        return { success: false, newReceivers: currentReceivers };
    }, []);

    const handleManualSendMasa = () => {
        setSimulationState(prev => {
            const { success, newReceivers } = sendMasaToReceiver(prev.receivers);
            if (success) {
                toast({ title: 'Masa enviada al recibidor' });
                return {
                    ...prev,
                    receivers: newReceivers,
                    totalMasasSent: prev.totalMasasSent + 1,
                };
            } else {
                toast({ title: 'Error', description: 'Todos los recibidores están llenos.', variant: 'destructive' });
                return prev;
            }
        });
    };

    const [isSimulating, setIsSimulating] = React.useState(false);
    
    const createInitialSimulationState = React.useCallback((): SimulationState => ({
        elapsedTime: 0,
        machineTotals: { 1: 0, 2: 0, 3: 0, 4: 0 },
        wrappers: {
            '1': { buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] },
            '2': { buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] },
        },
        isFinished: false,
        nextAutoTachosSendTime: 0,
        silos: JSON.parse(JSON.stringify(silos)),
        receivers: JSON.parse(JSON.stringify(receivers)),
        centrifuges: JSON.parse(JSON.stringify(centrifuges)),
        totalMasasSent: 0,
    }), [silos, receivers, centrifuges]);
    
    const [simulationState, setSimulationState] = React.useState<SimulationState>(createInitialSimulationState());
    
    React.useEffect(() => {
        setSimulationState(prev => ({
            ...prev,
            silos: JSON.parse(JSON.stringify(silos))
        }));
    }, [silos]);

    const simulationIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const [simulationSpeed, setSimulationSpeed] = React.useState(1);
    
    const machinesRef = React.useRef(machines);
    React.useEffect(() => { machinesRef.current = machines; }, [machines]);

    const productsRef = React.useRef(products);
    React.useEffect(() => { productsRef.current = products; }, [products]);
    
    const wrappersRef = React.useRef(wrappers);
    React.useEffect(() => { wrappersRef.current = wrappers; }, [wrappers]);

    const sendMasaToReceiverRef = React.useRef(sendMasaToReceiver);
    React.useEffect(() => { sendMasaToReceiverRef.current = sendMasaToReceiver; }, [sendMasaToReceiver]);

    React.useEffect(() => {
        if (isTachosAuto && isTachosGoalEnabled && simulationState.totalMasasSent >= autoTachosGoal) {
            setIsTachosAuto(false); 
        }
    }, [simulationState.totalMasasSent, isTachosAuto, isTachosGoalEnabled, autoTachosGoal]);
    
    const totalWrapperCapacity = wrappers.reduce((sum, w) => sum + w.capacity, 0);
    
    const familiarSilo = simulationState.silos.find(s => s.id === 'familiar');
    const granelSilo = simulationState.silos.find(s => s.id === 'granel');
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
                
                let nextAutoSendTime = prev.nextAutoTachosSendTime;
                let newReceivers = [...prev.receivers];
                let newCentrifuges = [...prev.centrifuges];
                let newSilos = [...prev.silos];
                let newTotalMasasSent = prev.totalMasasSent;

                const goalMet = isTachosGoalEnabled && prev.totalMasasSent >= autoTachosGoal;
                
                if (isTachosAuto && !goalMet && newElapsedTime >= nextAutoSendTime) {
                    const { success, newReceivers: updatedReceivers } = sendMasaToReceiverRef.current(newReceivers);
                    if (success) {
                        newReceivers = updatedReceivers;
                        newTotalMasasSent = prev.totalMasasSent + 1;
                        nextAutoSendTime = newElapsedTime + (autoTachosInterval * 60);
                    }
                } else if (goalMet && isTachosAuto) {
                    setIsTachosAuto(false);
                }

                // Process Centrifuges
                newCentrifuges = newCentrifuges.map(cent => {
                    let updatedCent = { ...cent };

                    // 1. Start purging if idle and receiver has masa
                    if (updatedCent.state === 'idle') {
                        const connectedReceiver = newReceivers.find(r => r.id === updatedCent.connectedReceiverId);
                        if (connectedReceiver && connectedReceiver.currentMasas > 0) {
                            connectedReceiver.currentMasas -= 1;
                            updatedCent.state = 'purging';
                            updatedCent.timeRemaining = updatedCent.purgeTimeSeconds;
                        }
                    }

                    // 2. Update progress if purging or sending
                    if (updatedCent.state === 'purging' || updatedCent.state === 'sending') {
                        updatedCent.timeRemaining -= elapsedIncrement;
                        const totalTime = updatedCent.state === 'purging' ? updatedCent.purgeTimeSeconds : updatedCent.sendingTimeSeconds;
                        updatedCent.progress = Math.max(0, 100 * (1 - updatedCent.timeRemaining / totalTime));

                        if (updatedCent.timeRemaining <= 0) {
                            if (updatedCent.state === 'purging') {
                                updatedCent.state = 'sending';
                                updatedCent.timeRemaining = updatedCent.sendingTimeSeconds;
                            } else { // sending finished
                                updatedCent.state = 'idle';
                                updatedCent.progress = 0;
                            }
                        }
                    }
                    
                    // 3. If sending, add QQ to silos
                    if (updatedCent.state === 'sending') {
                        const qqPerSecond = MASA_QQ_AMOUNT / updatedCent.sendingTimeSeconds;
                        const qqThisTick = qqPerSecond * elapsedIncrement;
                        
                        const familiarSilo = newSilos.find(s => s.id === 'familiar');
                        const granelSilo = newSilos.find(s => s.id === 'granel');

                        if (familiarSilo && granelSilo) {
                            const spaceInFamiliar = familiarSilo.capacityQQ - familiarSilo.currentQQ;
                            const qqForFamiliar = Math.min(qqThisTick, spaceInFamiliar);
                            familiarSilo.currentQQ += qqForFamiliar;

                            const remainder = qqThisTick - qqForFamiliar;
                            if (remainder > 0) {
                                const spaceInGranel = granelSilo.capacityQQ - granelSilo.currentQQ;
                                const qqForGranel = Math.min(remainder, spaceInGranel);
                                granelSilo.currentQQ += qqForGranel;
                            }
                        }
                    }
                    return updatedCent;
                });

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
                
                const kgAvailableInFamiliarSilo = (newSilos.find(s => s.id === 'familiar')?.currentQQ || 0) * KG_PER_QUINTAL;
                const canProduce = kgAvailableInFamiliarSilo >= kgConsumedThisTick;
                
                if (!canProduce && totalKgConsumedPerSecond > 0) {
                    const finalSilos = newSilos.map(s => s.id === 'familiar' ? { ...s, currentQQ: 0 } : s);
                    pauseClock();
                    return {...prev, silos: finalSilos, elapsedTime: newElapsedTime, isFinished: true, centrifuges: newCentrifuges, receivers: newReceivers };
                }

                const newMachineTotals = { ...prev.machineTotals };
                const unitsProducedByWrapper: { [wrapperId: string]: number } = {};
                wrappersRef.current.forEach(w => unitsProducedByWrapper[w.id] = 0);


                if (canProduce) {
                    if (kgConsumedThisTick > 0) {
                         newSilos = newSilos.map(s => {
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
                    wrapperState.conveyorBelt.forEach((item: ConveyorItem) => {
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
                    nextAutoTachosSendTime: nextAutoSendTime,
                    silos: newSilos,
                    receivers: newReceivers,
                    centrifuges: newCentrifuges,
                    totalMasasSent: newTotalMasasSent,
                };
            });
        }, tickRateMs);
    };

    const resetSimulation = (resetMaterial = true) => {
        pauseClock();
        if (resetMaterial) {
            setSimulationState(createInitialSimulationState());
        } else {
            const currentSilos = JSON.parse(JSON.stringify(simulationState.silos));
            const currentMasasSent = simulationState.totalMasasSent;
            setSimulationState({
                ...createInitialSimulationState(),
                silos: currentSilos,
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
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
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
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                        {/* Tachos */}
                        <div className="p-4 border rounded-lg space-y-3 bg-background flex flex-col justify-between">
                             <div className='flex justify-between items-start'>
                                <h3 className="font-bold text-lg flex items-center gap-2">{tachosState.name}
                                  {isTachosAuto && <Badge variant="secondary">Auto</Badge>}
                                </h3>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo(tachosState)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                           <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-2">
                               <Image src={tachosState.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/Tachos.jpg?alt=media"} alt="Tachos" width={600} height={400} className="object-contain w-full h-full" unoptimized/>
                           </div>
                           <div className="space-y-4">
                                <div className={cn("space-y-3", isTachosAuto && "opacity-50")}>
                                    <div className='text-center border bg-muted/30 rounded-lg p-2'>
                                      <p className="text-xs text-muted-foreground">Total Masas Enviadas</p>
                                      <p className="text-lg font-bold text-primary">{simulationState.totalMasasSent}</p>
                                    </div>
                                    <Button className="w-full" onClick={handleManualSendMasa} disabled={isTachosAuto || simulationState.receivers.every(r => r.currentMasas >= r.capacityMasas)}>Enviar Masa ({MASA_QQ_AMOUNT} QQ)</Button>
                               </div>
                           </div>
                        </div>

                        {/* Recibidores */}
                        {simulationState.receivers.map(receiver => (
                            <div key={receiver.id} className="p-4 border rounded-lg space-y-3 bg-background flex flex-col justify-between">
                                <h3 className="font-bold text-lg">{receiver.name}</h3>
                                <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-2">
                                    <Image src={receiver.imageUrl || ""} alt={receiver.name} width={600} height={400} className="object-contain w-full h-full" unoptimized/>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <Label className="text-sm">Contenido (Masas)</Label>
                                    <div className='text-center border bg-muted/30 rounded-lg p-4'>
                                        <p className="text-3xl font-bold text-primary">{receiver.currentMasas} / {receiver.capacityMasas}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Centrífugas */}
                        {simulationState.centrifuges.map(cent => {
                            const getStateProps = () => {
                                switch (cent.state) {
                                    case 'purging': return { color: 'bg-blue-500', label: 'Purgando', icon: <Hourglass className="h-4 w-4" /> };
                                    case 'sending': return { color: 'bg-green-500', label: 'Enviando a Silos', icon: <Wind className="h-4 w-4" /> };
                                    default: return { color: 'bg-gray-400', label: 'Libre', icon: <PowerOff className="h-4 w-4" /> };
                                }
                            };
                            const { color, label, icon } = getStateProps();
                            return (
                                <div key={cent.id} className="p-4 border rounded-lg space-y-3 bg-background flex flex-col justify-between">
                                    <h3 className="font-bold text-lg">{cent.name}</h3>
                                    <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-2">
                                        <Image src={cent.imageUrl || ""} alt={cent.name} width={600} height={400} className="object-contain w-full h-full" unoptimized/>
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        <div className='flex justify-between items-center text-sm'>
                                            <Label>Estado</Label>
                                            <Badge variant="secondary" className={cn(color, "text-white")}>
                                                {icon}
                                                <span>{label}</span>
                                            </Badge>
                                        </div>
                                        <Progress value={cent.progress} indicatorClassName={color} />
                                        <p className="text-xs text-muted-foreground text-center">
                                            {cent.state !== 'idle' ? `Tiempo restante: ${formatElapsedTime(cent.timeRemaining)}` : 'Esperando masa...'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        {/* Silo Cards */}
                        {simulationState.silos.map((silo) => {
                            const currentKg = silo.currentQQ * KG_PER_QUINTAL;
                            const fillPercentage = silo.capacityQQ > 0 ? (silo.currentQQ / silo.capacityQQ) * 100 : 0;
                            const fillColorClass = getSiloFillColor(fillPercentage);
                            const isProductionSilo = silo.id === 'familiar';

                            return (
                                <div key={silo.id} className="p-4 border rounded-lg space-y-3 bg-background">
                                     <div className='flex justify-between items-start'>
                                        <h3 className="font-bold text-lg">{silo.name}</h3>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo(silo)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-2">
                                        <Image src={silo.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media"} alt={silo.name} width={600} height={400} className="object-contain w-full h-full" unoptimized/>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className='text-xs text-muted-foreground'>Capacidad: {silo.capacityQQ.toLocaleString()} QQ</Label>
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
                        <CardTitle className="flex items-center gap-2">3. Enfardadora y Empaque Final</CardTitle>
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
                    onImageSave={handleImageSave}
                    isTachos={editingSilo.id === 'tachos'}
                    tachosConfig={{
                        isAuto: isTachosAuto,
                        interval: autoTachosInterval,
                        isGoalEnabled: isTachosGoalEnabled,
                        goal: autoTachosGoal
                    }}
                    onTachosConfigChange={handleTachosConfigChange}
                    isUploading={isUploading}
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

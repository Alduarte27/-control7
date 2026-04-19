

'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, PackageCheck, ArrowRight, AlertTriangle, Upload, Edit, Beaker, Play, Pause, RefreshCw, Clock, Zap, Power, PowerOff, Droplets, Wind, Hourglass, CircleSlash, Activity, CheckCircle2, Waves, Snowflake, Archive, Box, Package2, Image as ImageIcon, ImageOff, RotateCcw, ArrowDownToLine, RotateCw, Database, Layers, Palette } from 'lucide-react';
import AppearanceDialog, { AppearanceConfig } from './appearance-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CategoryDefinition, ProductDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
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
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const KG_PER_QUINTAL = 50;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];
const LOCAL_STORAGE_CONFIG_KEY = 'simulationConfig';
const FIRESTORE_ASSETS_PATH = 'simulation_assets';
const LOCAL_STORAGE_SHOW_IMAGES_KEY = 'simulationShowImages';
const LOCAL_STORAGE_APPEARANCE_KEY = 'simulationAppearance';

const safeNum = (val: any, fallback = 0): number => {
    const num = typeof val === 'number' ? val : parseFloat(val);
    return Number.isFinite(num) ? num : fallback;
};

const getUnitLabel = (product: any): string => {
    if (!product || !product.productName) return 'Fardo';
    if (product.primaryPackaging) return product.primaryPackaging === 'fardo' ? 'Fardo' : (product.primaryPackaging === 'saco' ? 'Saco' : 'Saco A Granel');
    if (product.presentationWeight && product.sackWeight && product.presentationWeight === product.sackWeight) return 'Saco A Granel';
    return product.bundleWeight ? 'Fardo' : 'Saco';
};

const getPackagingTypeLabel = (product: any): string => {
    if (!product || !product.productName) return '';
    if (product.primaryPackaging) {
        if (product.primaryPackaging === 'granel') return 'GRANEL -> SACOS';
        return product.primaryPackaging === 'fardo' ? 'FUNDAS -> FARDO' : 'FUNDAS -> SACOS';
    }
    if (product.presentationWeight && product.sackWeight && product.presentationWeight === product.sackWeight) {
        return 'GRANEL -> SACOS';
    }
    return product.bundleWeight ? 'FUNDAS -> FARDO' : 'FUNDAS -> SACOS';
};


type MachineState = {
    id: number;
    productId: string;
    speed: number;
    loss: number;
    isSimulatingActive: boolean; 
    imageUrl: string | null;
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
    capacityQQ: number;
    currentQQ: number; 
    state: 'idle' | 'filling' | 'ready' | 'draining';
    fillProgress: number;
    drainingBy: string[]; // Now an array of centrifuge IDs
    transferRate: number | null;
    imageUrl?: string | null;
};

type CentrifugeState = {
    id: string;
    name: string;
    state: 'idle' | 'loading' | 'washing_centrifuging' | 'purging';
    stageTimeRemaining: number;
    stageProgress: number;
    timeIntoCycle: number;
    currentLoadQQ: number;
};

type TachosSimState = {
    id: 'tachos';
    name: string;
    imageUrl: string | null;
    state: 'idle' | 'cooking' | 'ready' | 'sending';
    cookTimeSeconds: number;
    transferTimeSeconds: number; 
    timeRemaining: number;
    progress: number;
    targetReceiverId: string | null; 
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
    silos: Omit<SiloState, 'imageUrl' | 'currentQQ'>[];
    receivers: Omit<ReceiverState, 'imageUrl' | 'currentQQ' | 'state' | 'fillProgress' | 'drainingBy' | 'transferRate'>[];
    tachosCookTime: number; 
    tachosTransferTime: number;
    tachosGoal: number;
    isTachosAuto: boolean;
    isTachosGoalEnabled: boolean;
    masaQQAmount: number;
    centrifugeBatchSizeQQ: number;
    centrifugeLoadTime: number;
    centrifugeWashTime: number;
    centrifugePurgeTime: number;
    centrifugeStartInterval: number; 
    isCentrifugesAuto: boolean;
    bufferTankCapacityQQ: number;
    bufferTransferTimeMinutes: number;
    targetShiftHours: number;
    isShiftGoalEnabled: boolean;
    isAutoStartEnabled: boolean;
    isReserveSiloEnabled: boolean;
};

type ImageUrlConfig = {
    machines: { [id: number]: string };
    wrappers: { [id: string]: string };
    silos: { [id: string]: string };
    receivers: { [id: string]: string };
    centrifuges: { [id: string]: string };
    tachos: string;
};


type PalletGroup = {
    productName: string;
    sacks: number;
    fullPallets: number;
    currentPalletSacks: number;
    sacksPerPallet: number;
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
    qqInCentrifuges: number;
    totalQQProduced: number;
    totalQQPacked: number;
    timeToProcessReceivers: number;
    initialQQInReceivers: number;
    bufferTankQQ: number;
    isBufferDraining: boolean; // Flag to ensure complete emptying cycle
    silosFullAlarm: boolean; // Flag to stop centrifuges when silos are 100% full
    accumulatedOperationSeconds: number; // Time only when machines are active
    machineActiveTimes: { [machineId: number]: number }; // Total operating time for each machine
    palletGroups: { [productName: string]: PalletGroup };
    machineUnwrappedProgress: { [machineId: number]: number }; // Progress of machines without wrappers towards a "virtual bundle"
};

const CustomPieTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="rounded-lg border bg-background p-3 shadow-sm text-sm min-w-[250px]">
                <p className="font-bold mb-2 text-primary">{data.name}</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <div className="font-semibold text-muted-foreground">Producto:</div>
                    <div className="text-right font-medium truncate" title={data.productName}>{data.productName}</div>
                    
                    <div className="font-semibold text-muted-foreground">Fardos:</div>
                    <div className="text-right font-medium">{(data.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>

                    <div className="font-semibold text-muted-foreground">Fundas:</div>
                    <div className="text-right font-medium">{(data.units ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    
                    <div className="font-semibold text-muted-foreground">Consumo QQ:</div>
                    <div className="text-right font-medium">{(data.qqConsumed ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                </div>
            </div>
        );
    }
    return null;
};


function MachineEditDialog({
    machine,
    products,
    open,
    onOpenChange,
    onSave,
    onImageSave,
    isUploading,
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
                    <DialogTitle>Editar Maquina {machine.id}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                     <div className="space-y-2">
                        <Label>Previsualizacion de la Imagen</Label>
                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                           {isUploading ? (
                               <div className="flex flex-col items-center gap-2">
                                   <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">Subiendo...</p>
                               </div>
                           ) : (
                                <Image 
                                    src={editedMachine.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media"} 
                                    alt={`Maquina ${editedMachine.id}`}
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
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.productName} ({getPackagingTypeLabel(p)})</SelectItem>)}
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
    onImageSave,
    isUploading
}: {
    silo: SiloState | TachosSimState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedSilo: Omit<SiloState, 'imageUrl' | 'currentQQ'>) => void;
    isTachos?: boolean;
    tachosConfig?: { isAuto: boolean; cookTime: number; transferTime: number; isGoalEnabled: boolean; goal: number; masaQQAmount: number };
    onTachosConfigChange?: (config: { isAuto: boolean; cookTime: number; transferTime: number; isGoalEnabled: boolean; goal: number; masaQQAmount: number }) => void;
    onImageSave: (type: 'machine' | 'silo' | 'wrapper' | 'tachos' | 'receiver' | 'centrifuge', id: string | number, file: File) => Promise<void>;
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

    const handleFieldChange = (field: keyof Omit<SiloState, 'imageUrl' | 'currentQQ'>, value: any) => {
        setEditedSilo(prev => ({ ...prev, [field]: value }));
    };

    const handleTachosConfigFieldChange = (field: 'isAuto' | 'cookTime' | 'transferTime' | 'isGoalEnabled' | 'goal' | 'masaQQAmount', value: any) => {
        setLocalTachosConfig(prev => (prev ? { ...prev, [field]: value } : undefined));
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await onImageSave(isTachos ? 'tachos' : 'silo', silo.id, file);
    };

    const fileInputId = `silo-image-upload-${silo.id}`;
    
    const handleSaveChanges = () => {
        const { imageUrl, currentQQ, ...configToSave } = editedSilo as any;
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
                        <Label>Previsualizacion de la Imagen</Label>
                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                           {isUploading ? (
                               <div className="flex flex-col items-center gap-2">
                                   <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">Subiendo...</p>
                               </div>
                           ) : (
                                <Image
                                    src={silo.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media"}
                                    alt={editedSilo.name}
                                    width={600}
                                    height={400}
                                    className="object-contain w-full h-full"
                                    unoptimized
                                />
                           )}
                        </div>
                        <input type="file" id={fileInputId} className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isUploading}/>
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
                    {silo.id !== 'tachos' && 'capacityQQ' in silo && (
                        <div className="space-y-1.5">
                            <Label htmlFor={`silo-cap-${silo.id}`}>Capacidad Max. (QQ)</Label>
                            <Input id={`silo-cap-${silo.id}`} type="number" value={(editedSilo as SiloState).capacityQQ} onChange={(e) => handleFieldChange('capacityQQ', Number(e.target.value))} min="0" />
                        </div>
                    )}
                    {isTachos && localTachosConfig && (
                        <>
                            <Separator />
                            <h4 className="font-medium text-sm">Configuracion de Tachos</h4>
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
                            <h4 className="font-medium text-sm">Configuracion de Automatizacion</h4>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="auto-mode-switch" className="text-sm">Modo Automatico</Label>
                                <Switch
                                    id="auto-mode-switch"
                                    checked={localTachosConfig.isAuto}
                                    onCheckedChange={(val) => handleTachosConfigFieldChange('isAuto', val)}
                                />
                            </div>
                            <div className={cn("space-y-3 transition-opacity", !localTachosConfig.isAuto && "opacity-50")}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="auto-cooktime" className="text-xs">Tiempo de Coccion (min)</Label>
                                        <Input
                                            id="auto-cooktime"
                                            type="number"
                                            value={localTachosConfig.cookTime}
                                            onChange={(e) => handleTachosConfigFieldChange('cookTime', Number(e.target.value))}
                                            disabled={!localTachosConfig.isAuto}
                                            min="1"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="auto-transfertime" className="text-xs">Tiempo de Transferencia (min)</Label>
                                        <Input
                                            id="auto-transfertime"
                                            type="number"
                                            value={localTachosConfig.transferTime}
                                            onChange={(e) => handleTachosConfigFieldChange('transferTime', Number(e.target.value))}
                                            disabled={!localTachosConfig.isAuto}
                                            min="1"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="goal-mode-switch" className="text-xs">Establecer Meta de Envio</Label>
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
    isUploading
}: {
    receiver: ReceiverState;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedSilo: Omit<ReceiverState, 'imageUrl' | 'currentQQ' | 'state' | 'fillProgress' | 'drainingBy'>) => void;
    isUploading: boolean;
}) {
    const [editedReceiver, setEditedReceiver] = React.useState(receiver);

    React.useEffect(() => {
        setEditedReceiver(receiver);
    }, [receiver]);

    const handleFieldChange = (field: keyof Omit<ReceiverState, 'imageUrl' | 'currentQQ' | 'state' | 'fillProgress' | 'drainingBy'>, value: any) => {
        setEditedReceiver(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSaveChanges = () => {
        const { currentQQ, state, fillProgress, drainingBy, ...configToSave } = editedReceiver;
        onSave(configToSave as any); // Type assertion to satisfy Omit
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
                        <Label htmlFor={`rec-cap-${receiver.id}`}>Capacidad Max. (QQ)</Label>
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
    config,
    isUploading
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (config: { isAuto: boolean; batchSizeQQ: number, loadTime: number, washTime: number, purgeTime: number, startInterval: number, bufferTankCapacityQQ: number, bufferTransferTimeMinutes: number }) => void;
    config: { isAuto: boolean; batchSizeQQ: number, loadTime: number, washTime: number, purgeTime: number, startInterval: number, bufferTankCapacityQQ: number, bufferTransferTimeMinutes: number };
    isUploading: boolean;
}) {
    const [localConfig, setLocalConfig] = React.useState(config);

    React.useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleSave = () => {
        onSave(localConfig);
        onOpenChange(false);
    };
    
    const handleValueChange = (field: keyof typeof config, value: string | boolean) => {
        if (typeof value === 'boolean') {
             setLocalConfig(prev => ({ ...prev, [field]: value }));
        } else {
            const numValue = Number(value);
            if (!isNaN(numValue) && numValue >= 0) {
                setLocalConfig(prev => ({ ...prev, [field]: numValue }));
            }
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Configuracion de Centrifugas</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                     <p className="text-sm text-muted-foreground">
                        Define la cantidad de masa a procesar, los tiempos del ciclo y el modo de Operacion.
                    </p>
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <Label htmlFor="cent-auto-switch" className="text-sm font-medium">Modo Automatico</Label>
                        <Switch
                           id="cent-auto-switch"
                           checked={localConfig.isAuto}
                           onCheckedChange={(val) => handleValueChange('isAuto', val)}
                        />
                    </div>
                    <div className={cn("space-y-4", !localConfig.isAuto && "opacity-50 pointer-events-none")}>
                        <div className="space-y-1.5">
                            <Label htmlFor="batch-size">Cantidad de Carga por Ciclo (QQ)</Label>
                             <Input
                                id="batch-size"
                                type="number"
                                value={localConfig.batchSizeQQ}
                                onChange={(e) => handleValueChange('batchSizeQQ', e.target.value)}
                                min="1"
                            />
                            <p className="text-xs text-muted-foreground">La cantidad de masa que cada centrifuga tomara del recibidor en cada ciclo de carga.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="load-time">Tiempo de Carga (seg)</Label>
                                <Input
                                    id="load-time"
                                    type="number"
                                    value={localConfig.loadTime}
                                    onChange={(e) => handleValueChange('loadTime', e.target.value)}
                                    min="0"
                                />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="wash-time">Tiempo de Lavado (seg)</Label>
                                <Input
                                    id="wash-time"
                                    type="number"
                                    value={localConfig.washTime}
                                    onChange={(e) => handleValueChange('washTime', e.target.value)}
                                    min="0"
                                />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="purge-time">Tiempo de Purga (seg)</Label>
                                <Input
                                    id="purge-time"
                                    type="number"
                                    value={localConfig.purgeTime}
                                    onChange={(e) => handleValueChange('purgeTime', e.target.value)}
                                    min="0"
                                />
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="start-interval">Intervalo de Inicio (seg)</Label>
                                <Input
                                    id="start-interval"
                                    type="number"
                                    value={localConfig.startInterval}
                                    onChange={(e) => handleValueChange('startInterval', e.target.value)}
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="buffer-tank-capacity">Capacidad Pulmon (QQ)</Label>
                                <Input
                                    id="buffer-tank-capacity"
                                    type="number"
                                    value={localConfig.bufferTankCapacityQQ}
                                    onChange={(e) => handleValueChange('bufferTankCapacityQQ', e.target.value)}
                                    min="1"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="buffer-transfer-time">Tiempo Vaciado (min)</Label>
                                <Input
                                    id="buffer-transfer-time"
                                    type="number"
                                    value={localConfig.bufferTransferTimeMinutes}
                                    onChange={(e) => handleValueChange('bufferTransferTimeMinutes', e.target.value)}
                                    min="1"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Define la capacidad del tanque pulmon y el tiempo que tarda el recibidor en vaciarse por completo.</p>
                         <p className="text-xs text-muted-foreground pt-2">
                            El **Intervalo de Inicio** es el tiempo de espera entre el inicio de la primera y la segunda centrifuga para asegurar el trabajo alternado.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleSave}>Guardar Cambios</Button>
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
                        <Label>Previsualizacion de la Imagen</Label>
                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                           {isUploading ? (
                               <div className="flex flex-col items-center gap-2">
                                   <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                                   <p className="text-sm text-muted-foreground">Subiendo...</p>
                               </div>
                           ) : (
                                <Image
                                    src={wrapper.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/enfardadora.jpeg?alt=media"}
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
                                        Maquina {machine.id}
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
  prefetchedCategories,
}: { 
  prefetchedProducts: ProductDefinition[],
  prefetchedCategories: CategoryDefinition[]
}) {
    const [isClient, setIsClient] = React.useState(false);
    const { toast } = useToast();

    const familiarCategoryId = React.useMemo(() => {
        return prefetchedCategories.find(c => c.name.toLowerCase() === 'familiar')?.id;
    }, [prefetchedCategories]);

    const products = React.useMemo(() => {
        const activeProducts = prefetchedProducts.filter(p => p.isActive);
        if (familiarCategoryId) {
            return activeProducts.filter(p => p.categoryId === familiarCategoryId);
        }
        return activeProducts; // Fallback to all active products if category not found
    }, [prefetchedProducts, familiarCategoryId]);
    
    // --- Unified Configuration State ---
    const [machines, setMachines] = React.useState<MachineState[]>([]);
    const [wrappers, setWrappers] = React.useState<WrapperState[]>([]);
    const [silos, setSilos] = React.useState<SiloState[]>([]);
    const [receivers, setReceivers] = React.useState<ReceiverState[]>([]);
    const [centrifuges, setCentrifuges] = React.useState<CentrifugeState[]>([]);
    const [tachosCookTime, setTachosCookTime] = React.useState(90);
    const [tachosTransferTime, setTachosTransferTime] = React.useState(10);
    const [tachosGoal, setTachosGoal] = React.useState(6);
    const [isTachosAuto, setIsTachosAuto] = React.useState(false);
    const [isTachosGoalEnabled, setIsTachosGoalEnabled] = React.useState(false);
    const [masaQQAmount, setMasaQQAmount] = React.useState(380);
    const [tachosImageUrl, setTachosImageUrl] = React.useState<string | null>(null);
    const [centrifugeBatchSizeQQ, setCentrifugeBatchSizeQQ] = React.useState(25);
    const [centrifugeLoadTime, setCentrifugeLoadTime] = React.useState(60);
    const [centrifugeWashTime, setCentrifugeWashTime] = React.useState(120);
    const [centrifugePurgeTime, setCentrifugePurgeTime] = React.useState(60);
    const [centrifugeStartInterval, setCentrifugeStartInterval] = React.useState(120);
    const [isCentrifugesAuto, setIsCentrifugesAuto] = React.useState(true);
    
    // Appearance State
    const [appearanceConfig, setAppearanceConfig] = React.useState<AppearanceConfig>({
        theme: 'light',
        accentColor: '221 83% 53%',
        radius: 0.5
    });
    const [isAppearanceDialogOpen, setIsAppearanceDialogOpen] = React.useState(false);
    const [bufferTankCapacityQQ, setBufferTankCapacityQQ] = React.useState(380);
    const [bufferTransferTimeMinutes, setBufferTransferTimeMinutes] = React.useState(5);
    const [targetShiftHours, setTargetShiftHours] = React.useState(8);
    const [isShiftGoalEnabled, setIsShiftGoalEnabled] = React.useState(false);
    const [isAutoStartEnabled, setIsAutoStartEnabled] = React.useState(false);
    const [isReserveSiloEnabled, setIsReserveSiloEnabled] = React.useState(false);

    // --- UI State ---
    const [editingMachine, setEditingMachine] = React.useState<MachineState | null>(null);
    const [editingSilo, setEditingSilo] = React.useState<SiloState | TachosSimState | null>(null);
    const [editingReceiver, setEditingReceiver] = React.useState<ReceiverState | null>(null);
    const [editingCentrifuges, setEditingCentrifuges] = React.useState(false);
    const [editingWrapper, setEditingWrapper] = React.useState<WrapperState | null>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [showImages, setShowImages] = React.useState(true);

     // --- SIMULATION STATE AND LOGIC ---
    const [isSimulating, setIsSimulating] = React.useState(false);
    const simulationIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
    const [simulationSpeed, setSimulationSpeed] = React.useState(1);
    
    const machinesRef = React.useRef(machines);
    React.useEffect(() => { machinesRef.current = machines; }, [machines]);

    const simulationSpeedRef = React.useRef(simulationSpeed);
    React.useEffect(() => { simulationSpeedRef.current = simulationSpeed; }, [simulationSpeed]);

    const targetShiftHoursRef = React.useRef(targetShiftHours);
    React.useEffect(() => { targetShiftHoursRef.current = targetShiftHours; }, [targetShiftHours]);

    const isShiftGoalEnabledRef = React.useRef(isShiftGoalEnabled);
    React.useEffect(() => { isShiftGoalEnabledRef.current = isShiftGoalEnabled; }, [isShiftGoalEnabled]);

    const isAutoStartEnabledRef = React.useRef(isAutoStartEnabled);
    React.useEffect(() => { isAutoStartEnabledRef.current = isAutoStartEnabled; }, [isAutoStartEnabled]);

    const isReserveSiloEnabledRef = React.useRef(isReserveSiloEnabled);
    React.useEffect(() => { isReserveSiloEnabledRef.current = isReserveSiloEnabled; }, [isReserveSiloEnabled]);

    const productsRef = React.useRef(products);
    React.useEffect(() => { productsRef.current = products; }, [products]);
    
    const wrappersRef = React.useRef(wrappers);
    React.useEffect(() => { wrappersRef.current = wrappers; }, [wrappers]);

    const createInitialSimulationState = React.useCallback((): SimulationState => {
        const initialQQInReceivers = receivers.reduce((sum, r) => sum + r.currentQQ, 0);
        return {
            elapsedTime: 0,
            machineTotals: { 1: 0, 2: 0, 3: 0, 4: 0 },
            wrappers: {
                '1': { buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] },
                '2': { buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] },
            },
            isFinished: false,
            silos: silos.map(s => ({...s, currentQQ: 0})),
            receivers: receivers.map(r => ({...r, currentQQ: 0, state: 'idle', fillProgress: 0, drainingBy: []})),
            centrifuges: centrifuges.map(c => ({...c, state: 'idle', stageTimeRemaining: 0, stageProgress: 0, timeIntoCycle: 0, currentLoadQQ: 0 })),
            tachos: {
                id: 'tachos',
                name: 'Tachos',
                imageUrl: tachosImageUrl,
                state: 'idle',
                cookTimeSeconds: tachosCookTime * 60,
                transferTimeSeconds: tachosTransferTime * 60,
                timeRemaining: 0,
                progress: 0,
                targetReceiverId: null,
            },
            totalMasasSent: 0,
            qqInCentrifuges: 0,
            totalQQProduced: 0,
            totalQQPacked: 0,
            timeToProcessReceivers: 0,
            initialQQInReceivers: initialQQInReceivers,
            bufferTankQQ: 0,
            isBufferDraining: false,
            silosFullAlarm: false,
            accumulatedOperationSeconds: 0,
            machineActiveTimes: { 1: 0, 2: 0, 3: 0, 4: 0 },
            palletGroups: {},
            machineUnwrappedProgress: { 1: 0, 2: 0, 3: 0, 4: 0 },
        };
    }, [silos, receivers, centrifuges, tachosCookTime, tachosTransferTime, tachosImageUrl]);
    
    const [simulationState, setSimulationState] = React.useState<SimulationState>(createInitialSimulationState);
    
    const handleManualSendMasa = () => {
        let sent = false;
        let toastShown = false;
        
        setSimulationState(prev => {
            if (prev.tachos.state !== 'idle') {
                if (!toastShown) {
                    // toast is now called outside of setState
                    toastShown = true;
                }
                return prev;
            }
        
            const availableReceiver = prev.receivers.find(r => r.state === 'idle');
            if (!availableReceiver) {
                if (!toastShown) {
                     // toast is now called outside of setState
                    toastShown = true;
                }
                return prev;
            }

            const newReceivers: ReceiverState[] = prev.receivers.map(r => 
                r.id === availableReceiver.id ? { ...r, state: 'filling' as const } : r
            );

            sent = true;
            return {
                ...prev,
                receivers: newReceivers,
                tachos: {
                    ...prev.tachos,
                    state: 'sending' as const,
                    targetReceiverId: availableReceiver.id,
                    timeRemaining: prev.tachos.transferTimeSeconds,
                    progress: 0,
                },
                totalMasasSent: prev.totalMasasSent + 1,
            };
        });

        if (sent) {
            const availableReceiver = simulationState.receivers.find(r => r.state === 'idle');
            toast({ title: 'Masa Enviada Manualmente', description: `La masa ha comenzado a transferirse al ${availableReceiver?.name}.` });
        } else {
            if(simulationState.tachos.state !== 'idle') {
                toast({ title: 'Tachos no esta libre', description: 'El tacho esta actualmente ocupado.', variant: 'destructive'});
            } else {
                toast({ title: 'Sin Recibidores Libres', description: 'Todos los recibidores estan ocupados.', variant: 'destructive' });
            }
        }
    };


    React.useEffect(() => {
        setSimulationState(createInitialSimulationState());
    }, [createInitialSimulationState]);

    const formatElapsedTime = (totalSeconds: number) => {
        if (!isFinite(totalSeconds) || totalSeconds < 0) return '00:00:00';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        
        const paddedHours = String(hours).padStart(2, '0');
        const paddedMinutes = String(minutes).padStart(2, '0');
        const paddedSeconds = String(seconds).padStart(2, '0');

        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    };
    
    const formatSeconds = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatTime = (hours: number) => {
        if (!isFinite(hours) || hours <= 0) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}`;
    };
    
    const getDefaultConfig = (): { params: SimulationParams; images: ImageUrlConfig } => ({
        params: {
            machines: [
                { id: 1, productId: 'inactive', speed: 0, loss: 0 },
                { id: 2, productId: 'inactive', speed: 0, loss: 0 },
                { id: 3, productId: 'inactive', speed: 0, loss: 0 },
                { id: 4, productId: 'inactive', speed: 0, loss: 0 },
            ],
            wrappers: [
                { id: '1', name: 'Enfardadora 1', capacity: 110, unitsPerBundle: 12, conveyorDelay: 6, machineIds: [1, 2] },
                { id: '2', name: 'Enfardadora 2', capacity: 80, unitsPerBundle: 12, conveyorDelay: 6, machineIds: [3, 4] },
            ],
            silos: [
                { id: 'familiar', name: 'Silo Familiar', capacityQQ: 380 },
                { id: 'reserva', name: 'Silo de Reserva (M4)', capacityQQ: 150 },
                { id: 'granel', name: 'Silo a Granel', capacityQQ: 700 },
            ],
            receivers: [
                { id: 'rec1', name: 'Recibidor 1', capacityQQ: 400 },
                { id: 'rec2', name: 'Recibidor 2', capacityQQ: 400 },
            ],
            tachosCookTime: 90, 
            tachosTransferTime: 10,
            tachosGoal: 6,
            isTachosAuto: false,
            isTachosGoalEnabled: false,
            masaQQAmount: 380,
            centrifugeBatchSizeQQ: 25,
            centrifugeLoadTime: 60,
            centrifugeWashTime: 120,
            centrifugePurgeTime: 60,
            centrifugeStartInterval: 120,
            isCentrifugesAuto: true,
            bufferTankCapacityQQ: 380,
            bufferTransferTimeMinutes: 5,
            targetShiftHours: 8,
            isShiftGoalEnabled: false,
            isAutoStartEnabled: false,
            isReserveSiloEnabled: false,
        },
        images: {
            machines: {
                1: "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media",
                2: "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media",
                3: "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media",
                4: "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media",
            },
            wrappers: {
                '1': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/enfardadora.jpeg?alt=media',
                '2': 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/enfardadora.jpeg?alt=media',
            },
            silos: {
                'familiar': "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media",
                'granel': "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media",
                'reserva': "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media",
            },
            receivers: {},
            centrifuges: {},
            tachos: 'https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/Tachos.jpg?alt=media',
        }
    });

    const loadConfig = React.useCallback(async () => {
        const { params: defaultParams } = getDefaultConfig();
        try {
            const showImagesPref = window.localStorage.getItem(LOCAL_STORAGE_SHOW_IMAGES_KEY);
            setShowImages(showImagesPref === null || showImagesPref === 'true');

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
                currentQQ: 0, // Start empty
                imageUrl: imageUrls.silos[s.id] || null,
            })));
            setReceivers(params.receivers.map(r => ({
                ...r,
                currentQQ: 0,
                state: 'idle',
                fillProgress: 0,
                drainingBy: [],
                transferRate: null,
            })));
            setCentrifuges([
                { id: 'cent1', name: 'Centrifuga 1', state: 'idle', stageTimeRemaining: 0, stageProgress: 0, timeIntoCycle: 0, currentLoadQQ: 0 },
                { id: 'cent2', name: 'Centrifuga 2', state: 'idle', stageTimeRemaining: 0, stageProgress: 0, timeIntoCycle: 0, currentLoadQQ: 0 },
            ]);
            setTachosImageUrl(imageUrls.tachos);
            
            setTachosCookTime(params.tachosCookTime);
            setTachosTransferTime(params.tachosTransferTime || 10);
            setTachosGoal(params.tachosGoal);
            setIsTachosAuto(params.isTachosAuto);
            setIsTachosGoalEnabled(params.isTachosGoalEnabled);
            setMasaQQAmount(params.masaQQAmount || 380);
            setCentrifugeBatchSizeQQ(params.centrifugeBatchSizeQQ || 25);
            setCentrifugeLoadTime(params.centrifugeLoadTime || 60);
            setCentrifugeWashTime(params.centrifugeWashTime || 120);
            setCentrifugePurgeTime(params.centrifugePurgeTime || 60);
            setCentrifugeStartInterval(params.centrifugeStartInterval ?? 120);
            setIsCentrifugesAuto(params.isCentrifugesAuto ?? true);
            setBufferTankCapacityQQ(params.bufferTankCapacityQQ || 380);
            setBufferTransferTimeMinutes(params.bufferTransferTimeMinutes || 5);
            setTargetShiftHours(params.targetShiftHours ?? 8);
            setIsShiftGoalEnabled(params.isShiftGoalEnabled ?? false);
            setIsAutoStartEnabled(params.isAutoStartEnabled ?? false);
            setIsReserveSiloEnabled(params.isReserveSiloEnabled ?? false);

        } catch (error) {
            console.error("Error loading config:", error);
            const { params, images } = getDefaultConfig();
            setMachines(params.machines.map(m => ({ ...m, imageUrl: images.machines[m.id] || null, isSimulatingActive: false })));
            setWrappers(params.wrappers.map(w => ({ ...w, imageUrl: images.wrappers[w.id] || null, buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] })));
            setSilos(params.silos.map(s => ({ ...s, imageUrl: images.silos[s.id] || null, currentQQ: 0 })));
            setReceivers(params.receivers.map(r => ({ ...r, currentQQ: 0, state: 'idle', fillProgress: 0, drainingBy: [], transferRate: null })));
            setCentrifuges([
                { id: 'cent1', name: 'Centrifuga 1', state: 'idle', stageTimeRemaining: 0, stageProgress: 0, timeIntoCycle: 0, currentLoadQQ: 0 },
                { id: 'cent2', name: 'Centrifuga 2', state: 'idle', stageTimeRemaining: 0, stageProgress: 0, timeIntoCycle: 0, currentLoadQQ: 0 },
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
            silos: silos.map(({imageUrl, currentQQ, ...s}) => s),
            receivers: receivers.map(({currentQQ, state, fillProgress, drainingBy, transferRate, ...r}) => r),
            tachosCookTime: tachosCookTime,
            tachosTransferTime: tachosTransferTime,
            tachosGoal: tachosGoal,
            isTachosAuto: isTachosAuto,
            isTachosGoalEnabled: isTachosGoalEnabled,
            masaQQAmount: masaQQAmount,
            centrifugeBatchSizeQQ: centrifugeBatchSizeQQ,
            centrifugeLoadTime: centrifugeLoadTime,
            centrifugeWashTime: centrifugeWashTime,
            centrifugePurgeTime: centrifugePurgeTime,
            centrifugeStartInterval: centrifugeStartInterval,
            isCentrifugesAuto: isCentrifugesAuto,
            bufferTankCapacityQQ: bufferTankCapacityQQ,
            bufferTransferTimeMinutes: bufferTransferTimeMinutes,
            targetShiftHours: targetShiftHours,
            isShiftGoalEnabled: isShiftGoalEnabled,
            isAutoStartEnabled: isAutoStartEnabled,
            isReserveSiloEnabled: isReserveSiloEnabled,
        };
        try {
            window.localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(paramsToSave));
        } catch (error) {
            console.error("Error saving params to localStorage", error);
        }
    }, [isClient, machines, wrappers, silos, receivers, tachosCookTime, tachosTransferTime, tachosGoal, isTachosAuto, isTachosGoalEnabled, masaQQAmount, centrifugeBatchSizeQQ, centrifugeLoadTime, centrifugeWashTime, centrifugePurgeTime, centrifugeStartInterval, isCentrifugesAuto, bufferTankCapacityQQ, bufferTransferTimeMinutes, targetShiftHours, isShiftGoalEnabled, isAutoStartEnabled, isReserveSiloEnabled]);

    React.useEffect(() => {
        saveParamsToLocalStorage();
    }, [saveParamsToLocalStorage]);

     const handleShowImagesChange = () => {
        const newShowImages = !showImages;
        setShowImages(newShowImages);
        if (isClient) {
            window.localStorage.setItem(LOCAL_STORAGE_SHOW_IMAGES_KEY, String(newShowImages));
        }
    };
    
    const handleImageSave = React.useCallback(async (type: 'machine' | 'silo' | 'wrapper' | 'tachos' | 'receiver' | 'centrifuge', id: string | number, file: File) => {
        setIsUploading(true);
        try {
            // Upload directly from client using Firebase Storage SDK (no server credentials needed)
            const imagePath = `sim-images/${type}/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, imagePath);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            
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
                setTachosImageUrl(downloadURL);
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
        
        // Load appearance
        const savedAppearance = localStorage.getItem(LOCAL_STORAGE_APPEARANCE_KEY);
        if (savedAppearance) {
            try {
                setAppearanceConfig(JSON.parse(savedAppearance));
            } catch (e) {
                console.error("Error loading appearance", e);
            }
        }
    }, [toast]);

    // Apply Appearance
    React.useEffect(() => {
        // Save to localStorage
        localStorage.setItem(LOCAL_STORAGE_APPEARANCE_KEY, JSON.stringify(appearanceConfig));

        // Apply Dark Mode
        const root = window.document.documentElement;
        const isDark = appearanceConfig.theme === 'dark' || 
                      (appearanceConfig.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (isDark) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Apply Accent Color & Radius
        root.style.setProperty('--primary', appearanceConfig.accentColor);
        root.style.setProperty('--ring', appearanceConfig.accentColor);
        root.style.setProperty('--radius', `${appearanceConfig.radius}rem`);
    }, [appearanceConfig]);

    const handleMachineSave = (updatedMachine: Omit<MachineState, 'isSimulatingActive' | 'imageUrl'>) => {
        setMachines(prev => prev.map(m => m.id === updatedMachine.id ? { ...m, ...updatedMachine } : m));
    };

    const handleWrapperSave = (updatedWrapper: Omit<WrapperState, 'buffer' | 'currentBundleProgress' | 'totalBundles' | 'conveyorBelt' | 'imageUrl'>) => {
        setWrappers(prev => prev.map(w => w.id === updatedWrapper.id ? { ...w, ...updatedWrapper } : w));
    };

    const handleSiloSave = (updatedSilo: Omit<SiloState, 'imageUrl' | 'currentQQ'>) => {
        setSilos(prev => prev.map(s => s.id === updatedSilo.id ? {...s, ...updatedSilo} : s));
    };

    const handleReceiverSave = (updatedReceiver: Omit<ReceiverState, 'imageUrl'|'currentQQ' | 'state' | 'fillProgress' | 'drainingBy'>) => {
        setReceivers(prev => prev.map(r => r.id === updatedReceiver.id ? {...r, ...updatedReceiver} : r));
    };
    
    const handleTachosConfigChange = (config: { isAuto: boolean; cookTime: number; transferTime: number; isGoalEnabled: boolean; goal: number; masaQQAmount: number; }) => {
        setIsTachosAuto(config.isAuto);
        setTachosCookTime(config.cookTime);
        setTachosTransferTime(config.transferTime);
        setIsTachosGoalEnabled(config.isGoalEnabled);
        setTachosGoal(config.goal);
        setMasaQQAmount(config.masaQQAmount);
    };

    const handleCentrifugeConfigSave = (config: { 
        isAuto: boolean; 
        batchSizeQQ: number; 
        loadTime: number; 
        washTime: number; 
        purgeTime: number; 
        startInterval: number; 
        bufferTankCapacityQQ: number;
        bufferTransferTimeMinutes: number;
    }) => {
        setIsCentrifugesAuto(config.isAuto);
        setCentrifugeBatchSizeQQ(config.batchSizeQQ);
        setCentrifugeLoadTime(config.loadTime);
        setCentrifugeWashTime(config.washTime);
        setCentrifugePurgeTime(config.purgeTime);
        setCentrifugeStartInterval(config.startInterval);
        setBufferTankCapacityQQ(config.bufferTankCapacityQQ);
        setBufferTransferTimeMinutes(config.bufferTransferTimeMinutes);
        toast({ title: 'Configuracion de Centrifugas Guardada' });
    };

    // Inicio manual de una centrifuga especifica (solo en modo manual)
    const handleManualStartCentrifuge = (centrifugeId: string) => {
        if (!isSimulating) return;
        setSimulationState(prev => {
            const nextState = JSON.parse(JSON.stringify(prev)) as SimulationState;
            const cent = nextState.centrifuges.find(c => c.id === centrifugeId);
            
            if (nextState.silosFullAlarm) {
                toast({ 
                    title: "AcciÃƒÂ³n Bloqueada", 
                    description: "No se puede iniciar la centrifuga: Los silos estan llenos.",
                    variant: "destructive"
                });
                return prev;
            }

            if (cent && cent.state === 'idle' && nextState.bufferTankQQ > 0.1) {
                cent.state = 'loading';
                cent.stageTimeRemaining = centrifugeLoadTime;
                cent.timeIntoCycle = 0;
                cent.currentLoadQQ = 0;
            }
            return nextState;
        });
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
        toast({ title: 'Configuracion Restaurada', description: 'Todos los parametros de la simulacion han vuelto a sus valores por defecto.' });
    };
    
    const pauseClock = React.useCallback(() => {
        setIsSimulating(false);
        if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
        }
    }, []);

    React.useEffect(() => {
      return () => pauseClock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pauseClock]);

    const startClock = () => {
        if (simulationIntervalRef.current) return;
        setIsSimulating(true);
        
        setSimulationState(prev => ({
            ...prev,
            isFinished: false,
            initialQQInReceivers: prev.receivers.reduce((sum, r) => sum + r.currentQQ, 0),
        }));
        
        const tickRateMs = 50; 
        
        simulationIntervalRef.current = setInterval(() => {
            setSimulationState(prev => {
                if (prev.isFinished) {
                    pauseClock();
                    return prev;
                }
                
                let nextState: SimulationState = JSON.parse(JSON.stringify(prev));
                const elapsedIncrement = (tickRateMs / 1000) * simulationSpeedRef.current;
                nextState.elapsedTime += elapsedIncrement;
                
                // Track accumulated operation time (only when machines are active and producing)
                // 'canProduce' is calculated further down, so we'll move the shift logic after line 1700
                
                // Update config-dependent times
                nextState.tachos.cookTimeSeconds = tachosCookTime * 60;
                nextState.tachos.transferTimeSeconds = tachosTransferTime * 60;

                const goalMet = isTachosGoalEnabled && nextState.totalMasasSent >= tachosGoal;
                
                // 1. Tachos Logic
                if (nextState.tachos.state === 'cooking') {
                    nextState.tachos.timeRemaining = Math.max(0, nextState.tachos.timeRemaining - elapsedIncrement);
                    nextState.tachos.progress = Math.min(100, 100 * (1 - nextState.tachos.timeRemaining / nextState.tachos.cookTimeSeconds));
                    if (nextState.tachos.timeRemaining <= 0) {
                        nextState.tachos.state = 'ready';
                        nextState.tachos.progress = 100;
                    }
                } else if (nextState.tachos.state === 'sending') {
                    nextState.tachos.timeRemaining = Math.max(0, nextState.tachos.timeRemaining - elapsedIncrement);
                    const progress = Math.min(100, 100 * (1 - nextState.tachos.timeRemaining / nextState.tachos.transferTimeSeconds));
                    nextState.tachos.progress = progress;

                    const receiver = nextState.receivers.find((r: ReceiverState) => r.id === nextState.tachos.targetReceiverId);
                    if (receiver) {
                        const qqPerSecond = masaQQAmount / nextState.tachos.transferTimeSeconds;
                        receiver.currentQQ = Math.min(receiver.capacityQQ, receiver.currentQQ + qqPerSecond * elapsedIncrement);
                        receiver.fillProgress = progress;
                    }

                    if (nextState.tachos.timeRemaining <= 0) {
                        if (receiver) {
                            receiver.state = 'ready';
                            receiver.fillProgress = 100;
                            // transferRate = null: el recibidor espera su turno.
                            // El tanque pulmon debe estar vacio antes de que empiece a drenar.
                            receiver.transferRate = null;
                        }
                        nextState.tachos.state = 'idle';
                        nextState.tachos.progress = 0;
                        nextState.tachos.targetReceiverId = null;
                    }
                }

                if (isTachosAuto && !goalMet) {
                    if (nextState.tachos.state === 'idle') {
                        nextState.tachos.state = 'cooking';
                        nextState.tachos.timeRemaining = nextState.tachos.cookTimeSeconds;
                        nextState.tachos.progress = 0;
                    } else if (nextState.tachos.state === 'ready') {
                        const availableReceiver = nextState.receivers.find((r: ReceiverState) => r.state === 'idle');
                        if (availableReceiver) {
                            nextState.tachos.state = 'sending'; 
                            nextState.tachos.targetReceiverId = availableReceiver.id;
                            nextState.tachos.timeRemaining = nextState.tachos.transferTimeSeconds;
                            nextState.tachos.progress = 0;
                            availableReceiver.state = 'filling';
                            nextState.totalMasasSent += 1;
                        }
                    }
                } else if (goalMet && isTachosAuto) {
                    setIsTachosAuto(false);
                }

                // 1.5 Buffer Tank Logic (Receiver -> Buffer Tank)
                //
                // REGLA PRINCIPAL:
                // - El tanque pulmon solo acepta masa cuando esta COMPLETAMENTE VACÃƒÂO.
                // - Un recibidor que YA esta drenando (transferRate != null) continua
                //   hasta vaciarse, sin importar el nivel del tanque.
                // - Cuando no hay drenado activo, el siguiente recibidor espera a que
                //   el tanque este en 0 para empezar.

                // 1. Continuar drenado activo
                const activeDraining = nextState.receivers.find(
                    r => r.state === 'ready' && r.transferRate !== null && r.currentQQ > 0.01
                );

                if (activeDraining) {
                    // Sigue transfiriendo hasta vaciarse (pausa si tank llega a 100%)
                    const spaceInTank = bufferTankCapacityQQ - nextState.bufferTankQQ;
                    if (spaceInTank > 0.01) {
                        const rate = activeDraining.transferRate!;
                        const amountToTransfer = Math.min(activeDraining.currentQQ, rate * elapsedIncrement, spaceInTank);
                        if (amountToTransfer > 0) {
                            activeDraining.currentQQ -= amountToTransfer;
                            nextState.bufferTankQQ = Math.min(bufferTankCapacityQQ, nextState.bufferTankQQ + amountToTransfer);
                        }
                    }
                    // Recibidor vaciado → liberar (idle) para que pueda recibir nueva masa del tacho
                    if (activeDraining.currentQQ <= 0.01) {
                        activeDraining.currentQQ = 0;
                        activeDraining.transferRate = null;
                        activeDraining.state = 'idle';
                    }
                } else {
                    // 2. No hay drenado activo -> iniciar SOLO si el tanque esta VACÃƒÂO
                    const tankIsEmpty = nextState.bufferTankQQ <= 0.01;
                    if (tankIsEmpty) {
                        const nextReceiver = nextState.receivers.find(
                            r => r.state === 'ready' && r.currentQQ > 0.01
                        );
                        if (nextReceiver) {
                            // Calcular tasa ahora (primer tick del drenado)
                            nextReceiver.transferRate = nextReceiver.currentQQ / (bufferTransferTimeMinutes * 60);
                            const rate = nextReceiver.transferRate;
                            const amountToTransfer = Math.min(nextReceiver.currentQQ, rate * elapsedIncrement, bufferTankCapacityQQ);
                            if (amountToTransfer > 0) {
                                nextReceiver.currentQQ -= amountToTransfer;
                                nextState.bufferTankQQ = Math.min(bufferTankCapacityQQ, nextState.bufferTankQQ + amountToTransfer);
                            }
                        }
                    }
                    // Tank aun tiene masa -> recibidores esperan en 'ready' sin drenar
                }

                // 2. Centrifuges Logic
                let qqPurgedThisTick = 0;

                nextState.centrifuges.forEach((cent) => {
                    // Update cycle time if not idle
                    if (cent.state !== 'idle') {
                        cent.timeIntoCycle += elapsedIncrement;
                    }

                    if (cent.stageTimeRemaining > 0) {
                        cent.stageTimeRemaining = Math.max(0, cent.stageTimeRemaining - elapsedIncrement);
                    }

                    switch (cent.state) {
                        case 'loading': {
                            const stageDuration = centrifugeLoadTime;
                            const consumption = (centrifugeBatchSizeQQ / stageDuration) * elapsedIncrement;
                            
                            const amountToDrain = Math.min(consumption, nextState.bufferTankQQ);
                            nextState.bufferTankQQ -= amountToDrain;
                            cent.currentLoadQQ += amountToDrain;
                            
                            cent.stageProgress = Math.min(100, 100 * (stageDuration - cent.stageTimeRemaining) / stageDuration);

                            if (cent.stageTimeRemaining <= 0) {
                                cent.state = 'washing_centrifuging';
                                cent.stageTimeRemaining = centrifugeWashTime; 
                            }
                            break;
                        }
                        case 'washing_centrifuging': {
                            const stageDuration = centrifugeWashTime;
                            cent.stageProgress = stageDuration > 0 ? Math.min(100, 100 * (stageDuration - cent.stageTimeRemaining) / stageDuration) : 100;

                            if (cent.stageTimeRemaining <= 0) {
                                cent.state = 'purging';
                                cent.stageTimeRemaining = centrifugePurgeTime;
                            }
                            break;
                        }
                        case 'purging': {
                            const stageDuration = centrifugePurgeTime;
                             if (stageDuration > 0) {
                                const qqPerSecond = cent.currentLoadQQ / stageDuration;
                                qqPurgedThisTick += qqPerSecond * elapsedIncrement;
                                cent.stageProgress = Math.min(100, 100 * (stageDuration - cent.stageTimeRemaining) / stageDuration);
                            }

                            if (cent.stageTimeRemaining <= 0) {
                                cent.state = 'idle';
                                cent.timeIntoCycle = 0;
                                cent.currentLoadQQ = 0;
                            }
                            break;
                        }
                    }
                });

                if (isCentrifugesAuto) {
                    // 1. Control de Alarma de Silos
                    const familiarSilo = nextState.silos.find(s => s.id === 'familiar');
                    const granelSilo = nextState.silos.find(s => s.id === 'granel');
                    const allSilosFull = (familiarSilo?.currentQQ ?? 0) >= (familiarSilo?.capacityQQ ?? 0) - 0.1 && 
                                        (granelSilo?.currentQQ ?? 0) >= (granelSilo?.capacityQQ ?? 0) - 0.1;
                    
                    if (allSilosFull) {
                        nextState.silosFullAlarm = true;
                    } else {
                        // Reseteo con histeresis (por debajo del 95% en alguno de los silos)
                        const familiarLevel = familiarSilo ? (familiarSilo.currentQQ / familiarSilo.capacityQQ) : 1;
                        const granelLevel = granelSilo ? (granelSilo.currentQQ / granelSilo.capacityQQ) : 1;
                        if (familiarLevel < 0.95 || granelLevel < 0.95) {
                            nextState.silosFullAlarm = false;
                        }
                    }

                    // Update isBufferDraining state based on levels
                    if (nextState.bufferTankQQ >= (bufferTankCapacityQQ * 0.5)) {
                        nextState.isBufferDraining = true;
                    } else if (nextState.bufferTankQQ <= 0.1) {
                        nextState.isBufferDraining = false;
                    }

                    // MODO AUTOMÃƒÂTICO: Las centrifugas inician cuando se activa el modo de drenado
                    // (al llegar al 50%) y continÃƒÂºan operando hasta que el tanque se vacÃƒÂ­e.
                    // BLOQUEO: Solo inician si la alarma de silos NO esta activa.
                    if (nextState.isBufferDraining && !nextState.silosFullAlarm) {

                        const idleCentrifuges = nextState.centrifuges.filter(c => c.state === 'idle');
                        const runningCentrifuges = nextState.centrifuges.filter(c => c.state !== 'idle');

                        for (const idleCent of idleCentrifuges) {
                            if (nextState.bufferTankQQ > 0.1) {
                                let canStart = false;
                                if (runningCentrifuges.length === 0) {
                                    canStart = true;
                                } else {
                                    const otherCentrifuge = runningCentrifuges.find(c => c.id !== idleCent.id);
                                    if (!otherCentrifuge || (otherCentrifuge.timeIntoCycle >= centrifugeStartInterval)) {
                                        canStart = true;
                                    }
                                }

                                if (canStart) {
                                    idleCent.state = 'loading';
                                    idleCent.stageTimeRemaining = centrifugeLoadTime;
                                    idleCent.timeIntoCycle = 0;
                                    idleCent.currentLoadQQ = 0;
                                    runningCentrifuges.push(idleCent);
                                }
                            }
                        }
                    }
                }
                // MODO MANUAL: el usuario inicia cada centrifuga con el boton en la UI.



                nextState.qqInCentrifuges = qqPurgedThisTick > 0 ? (qqPurgedThisTick / elapsedIncrement) * 3600 : prev.qqInCentrifuges;

                nextState.receivers.forEach(r => {
                    if (r.currentQQ <= 0.1 && r.state === 'ready' && r.drainingBy.length === 0) {
                        r.state = 'idle';
                    }
                });

                if (qqPurgedThisTick > 0) {
                    nextState.totalQQProduced += qqPurgedThisTick;
                    const familiarSilo = nextState.silos.find(s => s.id === 'familiar');
                    const reserveSilo = nextState.silos.find(s => s.id === 'reserva');
                    
                    let remainingQQ = qqPurgedThisTick;

                    // Simultaneous distribution to Familiar and Reserva
                    if (familiarSilo || reserveSilo) {
                        const targetSilos = [];
                        if (familiarSilo && familiarSilo.currentQQ < familiarSilo.capacityQQ) targetSilos.push(familiarSilo);
                        if (reserveSilo && reserveSilo.currentQQ < reserveSilo.capacityQQ) targetSilos.push(reserveSilo);

                        if (targetSilos.length > 0) {
                            const qqPerSilo = remainingQQ / targetSilos.length;
                            targetSilos.forEach(silo => {
                                const canTake = Math.min(qqPerSilo, silo.capacityQQ - silo.currentQQ);
                                silo.currentQQ += canTake;
                                remainingQQ -= canTake;
                            });
                            
                            // If one was full and the other not, try to give the rest to the one with space
                            if (remainingQQ > 0) {
                                const sillWithSpace = targetSilos.find(s => s.currentQQ < s.capacityQQ);
                                if (sillWithSpace) {
                                    const takeMore = Math.min(remainingQQ, sillWithSpace.capacityQQ - sillWithSpace.currentQQ);
                                    sillWithSpace.currentQQ += takeMore;
                                    remainingQQ -= takeMore;
                                }
                            }
                        }
                    }

                    const overflow = remainingQQ;
                    if (overflow > 0) {
                        const granelSilo = nextState.silos.find(s => s.id === 'granel');
                        if (granelSilo) {
                            granelSilo.currentQQ = Math.min(granelSilo.capacityQQ, granelSilo.currentQQ + overflow);
                        }
                    }
                }
                
                const totalQQinReceiversNow = nextState.receivers.reduce((sum, r) => sum + r.currentQQ, 0) + nextState.bufferTankQQ;
                const singleCycleTime = centrifugeLoadTime + centrifugeWashTime + centrifugePurgeTime;
                const effectiveTimePerBatch = centrifugeStartInterval > 0 ? centrifugeStartInterval : singleCycleTime;
                const centrifugeThroughputQQperHour = effectiveTimePerBatch > 0 ? (centrifugeBatchSizeQQ * 3600) / effectiveTimePerBatch : 0;
                
                nextState.timeToProcessReceivers = centrifugeThroughputQQperHour > 0 ? (totalQQinReceiversNow / centrifugeThroughputQQperHour) : 0;


                // 3. Envasadoras & Enfardadoras Logic
                const familiarSilo = nextState.silos.find((s: SiloState) => s.id === 'familiar');
                const reserveSilo = nextState.silos.find((s: SiloState) => s.id === 'reserva');

                // Determine which machines consume from which silo
                const activeMachines = machinesRef.current.filter(m => m.isSimulatingActive && m.productId !== 'inactive');
                
                let totalKgConsumedPerSecond = 0;
                let canProduceAllRequired = true;

                // Temporary objects to store consumption to apply after verification
                const consumptionBySilo: Record<string, number> = { familiar: 0, reserva: 0 };
                const machineCanProduce: Record<number, boolean> = {};

                activeMachines.forEach(machine => {
                    const product = productsRef.current.find(p => p.id === machine.productId);
                    if (!product || !product.presentationWeight) return;
                    
                    const bagsPerMinute = machine.speed * (1 - machine.loss / 100);
                    const kgPerSecond = (bagsPerMinute * product.presentationWeight) / 60;
                    const kgThisTick = kgPerSecond * elapsedIncrement;

                    // Decision: which silo to use?
                    const useReserve = machine.id === 4 && isReserveSiloEnabledRef.current;
                    const targetSilo = useReserve ? reserveSilo : familiarSilo;
                    
                    if (targetSilo && targetSilo.currentQQ * KG_PER_QUINTAL >= kgThisTick) {
                        machineCanProduce[machine.id] = true;
                        consumptionBySilo[targetSilo.id] += kgThisTick;
                        totalKgConsumedPerSecond += kgPerSecond;
                    } else {
                        machineCanProduce[machine.id] = false;
                        if (targetSilo) targetSilo.currentQQ = 0; // Empty it if it was almost empty
                    }
                });

                // Apply verified consumption
                if (familiarSilo) {
                    const qqFromFamiliar = consumptionBySilo.familiar / KG_PER_QUINTAL;
                    familiarSilo.currentQQ -= qqFromFamiliar;
                    nextState.totalQQPacked += qqFromFamiliar;
                }
                if (reserveSilo) {
                    const qqFromReserve = consumptionBySilo.reserva / KG_PER_QUINTAL;
                    reserveSilo.currentQQ -= qqFromReserve;
                    nextState.totalQQPacked += qqFromReserve;
                }

                // Overall production status for timing logic
                const canProduce = Object.values(machineCanProduce).some(v => v === true);

                // 4. Shift Duration Logic
                const isOperating = totalKgConsumedPerSecond > 0 && canProduce;
                if (isOperating) {
                    nextState.accumulatedOperationSeconds += elapsedIncrement;
                }

                if (isShiftGoalEnabledRef.current && nextState.accumulatedOperationSeconds >= (targetShiftHoursRef.current * 3600)) {
                    nextState.isFinished = true;
                }

                // 5. Auto-Start Logic (30% Silo Level)
                const familiarSiloForStart = nextState.silos.find(s => s.id === 'familiar');
                const familiarLevelPercent = familiarSiloForStart ? (familiarSiloForStart.currentQQ / familiarSiloForStart.capacityQQ) * 100 : 0;
                
                if (isAutoStartEnabledRef.current && familiarLevelPercent >= 30) {
                    const machinesToStart = machinesRef.current.filter(m => m.productId !== 'inactive' && !m.isSimulatingActive);
                    if (machinesToStart.length > 0) {
                        // We use setMachines to update the UI state. 
                        // The machinesRef will be updated automatically via the useEffect on machines.
                        setMachines(prevMachines => prevMachines.map(m => {
                            if (m.productId !== 'inactive' && !m.isSimulatingActive) {
                                return { ...m, isSimulatingActive: true };
                            }
                            return m;
                        }));
                    }
                }

                machinesRef.current
                    .filter(m => m.isSimulatingActive && m.productId !== 'inactive' && machineCanProduce[m.id])
                    .forEach(machine => {
                        const product = productsRef.current.find(p => p.id === machine.productId);
                        if (!product) return;
                        
                        const bagsPerMinute = machine.speed * (1 - machine.loss / 100);
                        const unitsPerSecond = bagsPerMinute / 60;
                        const unitsProducedThisTick = unitsPerSecond * elapsedIncrement;

                        nextState.machineTotals[machine.id] += unitsProducedThisTick;
                        nextState.machineActiveTimes[machine.id] = (nextState.machineActiveTimes[machine.id] || 0) + elapsedIncrement;
                        
                        const targetWrapper = wrappersRef.current.find(w => w.machineIds.includes(machine.id));
                        if (targetWrapper) {
                            nextState.wrappers[targetWrapper.id].conveyorBelt.push({ producedAt: prev.elapsedTime, units: unitsProducedThisTick });
                        } else {
                            // --- Machine WITHOUT Wrapper (Experimental Manual/Direct Estiba) ---
                            // We accumulate until we reach the bundle equivalent size
                            let bundleSize = 12; // Fallback default
                            if (product.presentationWeight && product.presentationWeight > 0) {
                                if (product.primaryPackaging === 'fardo' && product.bundleWeight) {
                                    bundleSize = Math.round(product.bundleWeight / product.presentationWeight);
                                } else if (product.primaryPackaging === 'saco' || product.primaryPackaging === 'granel' || !product.bundleWeight) {
                                      bundleSize = Math.round((product.sackWeight || 50) / product.presentationWeight);
                                } else {
                                    bundleSize = Math.round(product.bundleWeight / product.presentationWeight);
                                }
                            }
                            
                            nextState.machineUnwrappedProgress[machine.id] = (nextState.machineUnwrappedProgress[machine.id] || 0) + unitsProducedThisTick;
                            
                            if (nextState.machineUnwrappedProgress[machine.id] >= bundleSize) {
                                const virtualBundlesFinished = Math.floor(nextState.machineUnwrappedProgress[machine.id] / bundleSize);
                                nextState.machineUnwrappedProgress[machine.id] %= bundleSize;
                                
                                // Direct entry to Estiba
                                const pName = product.productName;
                                if (!nextState.palletGroups[pName]) {
                                    const getPalletCapacity = (name: string): number => {
                                        if (product.unitsPerPallet && product.unitsPerPallet > 0) return product.unitsPerPallet;
                                        
                                        const lower = name.toLowerCase();
                                        if (lower.includes('1 kg -blanca (50 kg) don antonio')) return 165;
                                        if (lower.includes('1 kg -blanca (12 kg)')) return 165;
                                        if (lower.includes('12 kg') || lower.includes('12kg')) return 165;
                                        if (lower.includes('25 kg') || lower.includes('500 g')) return 72;
                                        return 35;
                                    };

                                    nextState.palletGroups[pName] = {
                                        productName: pName,
                                        sacks: 0,
                                        fullPallets: 0,
                                        currentPalletSacks: 0,
                                        sacksPerPallet: getPalletCapacity(pName)
                                    };
                                }
                                
                                const pGroup = nextState.palletGroups[pName];
                                pGroup.sacks += virtualBundlesFinished;
                                pGroup.currentPalletSacks += virtualBundlesFinished;

                                if (pGroup.currentPalletSacks >= pGroup.sacksPerPallet) {
                                    const palletsFinished = Math.floor(pGroup.currentPalletSacks / pGroup.sacksPerPallet);
                                    pGroup.fullPallets += palletsFinished;
                                    pGroup.currentPalletSacks %= pGroup.sacksPerPallet;
                                }
                            }
                        }
                    });


                for (const wrapperConfig of wrappersRef.current) {
                    const wrapperId = wrapperConfig.id;
                    const wrapperState = nextState.wrappers[wrapperId];
                    
                    const arrivedItems: ConveyorItem[] = [];
                    const remainingOnBelt: ConveyorItem[] = [];
                    wrapperState.conveyorBelt.forEach((item) => {
                        if (nextState.elapsedTime >= item.producedAt + wrapperConfig.conveyorDelay) {
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
                    
                    const activeMachineOnWrapper = machinesRef.current.find(m => 
                        wrapperConfig.machineIds.includes(m.id) && m.isSimulatingActive && m.productId !== 'inactive'
                    );
                    
                    let unitsRequired = wrapperConfig.unitsPerBundle || 12;
                    if (activeMachineOnWrapper) {
                        const product = productsRef.current.find(p => p.id === activeMachineOnWrapper.productId);
                        if (product) {
                            if (product.presentationWeight && product.presentationWeight > 0) {
                                if (product.primaryPackaging === 'fardo' && product.bundleWeight) {
                                    unitsRequired = Math.round(product.bundleWeight / product.presentationWeight);
                                } else if (product.primaryPackaging === 'saco' || product.primaryPackaging === 'granel' || !product.bundleWeight) {
                                    unitsRequired = Math.round((product.sackWeight || 50) / product.presentationWeight);
                                } else {
                                    unitsRequired = Math.round(product.bundleWeight / product.presentationWeight);
                                }
                            }
                        }
                    }

                    if (wrapperState.currentBundleProgress >= unitsRequired && unitsRequired > 0) {
                        const bundlesCreated = Math.floor(wrapperState.currentBundleProgress / unitsRequired);
                        wrapperState.totalBundles += bundlesCreated;
                        wrapperState.currentBundleProgress %= unitsRequired;

                        // --- Zona de Estiba Logic for Wrapped Production ---
                        if (activeMachineOnWrapper) {
                            const product = productsRef.current.find(p => p.id === activeMachineOnWrapper.productId);
                            if (product) {
                                const pName = product.productName;
                                if (!nextState.palletGroups[pName]) {
                                    const getPalletCapacity = (name: string): number => {
                                        if (product.unitsPerPallet && product.unitsPerPallet > 0) return product.unitsPerPallet;

                                        const lower = name.toLowerCase();
                                        if (lower.includes('1 kg -blanca (50 kg) don antonio')) return 165;
                                        if (lower.includes('1 kg -blanca (12 kg)')) return 165;
                                        if (lower.includes('12 kg') || lower.includes('12kg')) return 165;
                                        if (lower.includes('25 kg') || lower.includes('500 g')) return 72;
                                        return 35;
                                    };

                                    nextState.palletGroups[pName] = {
                                        productName: pName,
                                        sacks: 0,
                                        fullPallets: 0,
                                        currentPalletSacks: 0,
                                        sacksPerPallet: getPalletCapacity(pName)
                                    };
                                }
                                
                                const pGroup = nextState.palletGroups[pName];
                                pGroup.sacks += bundlesCreated;
                                pGroup.currentPalletSacks += bundlesCreated;

                                if (pGroup.currentPalletSacks >= pGroup.sacksPerPallet) {
                                    const palletsFinished = Math.floor(pGroup.currentPalletSacks / pGroup.sacksPerPallet);
                                    pGroup.fullPallets += palletsFinished;
                                    pGroup.currentPalletSacks %= pGroup.sacksPerPallet;
                                }
                            }
                        }
                    }
                    wrapperState.currentBundleProgress = safeNum(wrapperState.currentBundleProgress);
                    wrapperState.totalBundles = safeNum(wrapperState.totalBundles);
                    wrapperState.buffer = safeNum(wrapperState.buffer);
                }

                // Final state sanitization to prevent NaN propagation
                nextState.totalQQProduced = safeNum(nextState.totalQQProduced);
                nextState.totalQQPacked = safeNum(nextState.totalQQPacked);
                nextState.bufferTankQQ = safeNum(nextState.bufferTankQQ);
                nextState.timeToProcessReceivers = safeNum(nextState.timeToProcessReceivers);
                nextState.elapsedTime = safeNum(nextState.elapsedTime);

                return nextState;
            });
        }, tickRateMs);
    };

    const resetSimulation = () => {
        pauseClock();
        setSimulationState(createInitialSimulationState());
        setIsTachosAuto(false);
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
    
    const getSiloFillColor = (percentage: number): string => {
        if (percentage < 20) return 'bg-red-500';
        if (percentage < 60) return 'bg-yellow-500';
        return 'bg-green-500';
    };
    
    const staticSimulationResults = React.useMemo(() => {
        const activeMachines = machines.filter(m => m.isSimulatingActive && m.productId !== 'inactive');
        
        const totalBagsPerMinuteFromPackers = activeMachines.reduce((sum, machine) => {
            const effectiveBagsPerMinute = machine.speed * (1 - machine.loss / 100);
            return sum + effectiveBagsPerMinute;
        }, 0);
        
        const relevantWrappers = wrappers.filter(w => machines.some(m => m.isSimulatingActive && w.machineIds.includes(m.id)));
        const totalWrapperCapacity = relevantWrappers.reduce((sum, w) => sum + w.capacity, 0);

        const isWrapperBottleneck = totalBagsPerMinuteFromPackers > totalWrapperCapacity;
        
        const bundlesPerMinute = relevantWrappers.reduce((sum, wrapper) => {
            const connectedMachines = machines.filter(m => m.isSimulatingActive && wrapper.machineIds.includes(m.id));
            const bagsPerMinuteForThisWrapper = connectedMachines.reduce((machineSum, machine) => machineSum + (machine.speed * (1 - machine.loss/100)), 0);
            
            const wrapperEffectiveBagsPerMinute = Math.min(bagsPerMinuteForThisWrapper, wrapper.capacity);
            return sum + (wrapperEffectiveBagsPerMinute / (wrapper.unitsPerBundle || 1));
        }, 0);
        
        return {
            isWrapperBottleneck,
            totalBagsPerMinuteFromPackers: safeNum(totalBagsPerMinuteFromPackers),
            totalWrapperCapacity: safeNum(totalWrapperCapacity),
            bundlesPerMinute: safeNum(bundlesPerMinute),
        };

    }, [machines, wrappers]);

    const liveSimulationResults = React.useMemo(() => {
        const totalUnitsProduced = Object.values(simulationState.machineTotals).reduce((sum, total) => sum + total, 0);
        const anyMachineActive = machines.some(m => m.isSimulatingActive);

        // 1. Tachos Rate
        const qqRateFromTachos = (masaQQAmount * 3600) / (tachosCookTime * 60 + tachosTransferTime * 60);
        
        // 2. Centrifuge Rate
        const effectiveTimePerBatch = centrifugeStartInterval > 0 ? centrifugeStartInterval : (centrifugeLoadTime + centrifugeWashTime + centrifugePurgeTime);
        const qqRateFromCentrifuges = effectiveTimePerBatch > 0 ? (centrifugeBatchSizeQQ * 3600) / effectiveTimePerBatch * 2 : 0;
        
        // 3. Packer Rate
        const qqRateToPackers = (staticSimulationResults.totalBagsPerMinuteFromPackers * 60 / 1000) * KG_PER_QUINTAL;
        
        // 4. Wrapper Rate
        // Ratio of Bags/Min to QQ/h from packers: (qqRateToPackers / totalBagsPerMinuteFromPackers)
        const qqPerBagMinute = staticSimulationResults.totalBagsPerMinuteFromPackers > 0 
            ? qqRateToPackers / staticSimulationResults.totalBagsPerMinuteFromPackers 
            : (60 / 1000) * KG_PER_QUINTAL;
        const qqRateFromWrappers = staticSimulationResults.totalWrapperCapacity * qqPerBagMinute;

        const familiarSilo = simulationState.silos.find(s => s.id === 'familiar');
        const familiarSiloLevel = (familiarSilo?.currentQQ || 0) / (familiarSilo?.capacityQQ || 1) * 100;
        const familiarSiloKg = (familiarSilo?.currentQQ || 0) * KG_PER_QUINTAL;
        const totalKgConsumedPerSecond = (qqRateToPackers / 3600) * KG_PER_QUINTAL;
        const timeToEmptySeconds = totalKgConsumedPerSecond > 0 ? familiarSiloKg / totalKgConsumedPerSecond : Infinity;
        
        const bottleneckStages: { name: string; status: 'optimal' | 'warning' | 'critical'; message: string; advice: string }[] = [];

        if (!anyMachineActive) {
            bottleneckStages.push({
                name: "Sistema",
                status: 'warning',
                message: "Linea Detenida",
                advice: "Active las envasadoras para iniciar el analisis de flujo."
            });
        } else {
            // Tachos vs Centrifuges
            if (qqRateFromTachos < qqRateFromCentrifuges * 0.9) {
                bottleneckStages.push({
                    name: "Cristalizacion",
                    status: 'critical',
                    message: "Tacho es el cuello de botella",
                    advice: "Aumente el tamano de masa o reduzca tiempos de coccion."
                });
            } else {
                bottleneckStages.push({
                    name: "Cristalizacion",
                    status: 'optimal',
                    message: "Suministro de masa fluido",
                    advice: "Balance optimo."
                });
            }

            // Centrifugas vs Packers
            if (qqRateFromCentrifuges < qqRateToPackers * 0.95) {
                bottleneckStages.push({
                    name: "Purga",
                    status: 'critical',
                    message: "Baja capacidad de centrifugado",
                    advice: "El silo se vaciara. Aumente la velocidad de centrifugado."
                });
            } else if (qqRateFromCentrifuges < qqRateToPackers * 1.1) {
                bottleneckStages.push({
                    name: "Purga",
                    status: 'warning',
                    message: "Capacidad ajustada",
                    advice: "Casi al lÃƒÂ­mite de la demanda de empaque."
                });
            } else {
                bottleneckStages.push({
                    name: "Purga",
                    status: 'optimal',
                    message: "Centrifugadoras eficientes",
                    advice: "Produccion superior a la demanda."
                });
            }

            // Silos status
            if (simulationState.silosFullAlarm) {
                bottleneckStages.push({
                    name: "Almacenamiento",
                    status: 'critical',
                    message: "Silos Llenos",
                    advice: "Produccion detenida. Aumente el ritmo de empaque."
                });
            } else if (familiarSiloLevel < 10) {
                bottleneckStages.push({
                    name: "Almacenamiento",
                    status: 'critical',
                    message: "Nivel CrÃƒÂ­tico de AzÃƒÂºcar",
                    advice: "Surtido insuficiente desde centrifugas."
                });
            } else if (familiarSiloLevel < 25) {
                bottleneckStages.push({
                    name: "Almacenamiento",
                    status: 'warning',
                    message: "Nivel Bajo",
                    advice: "Vigilancia necesaria."
                });
            } else {
                bottleneckStages.push({
                    name: "Almacenamiento",
                    status: 'optimal',
                    message: "Stock estable",
                    advice: "Niveles adecuados."
                });
            }

            // Packers vs Wrappers
            if (staticSimulationResults.isWrapperBottleneck) {
                bottleneckStages.push({
                    name: "Empaque",
                    status: 'critical',
                    message: "Enfardadora saturada",
                    advice: "Reduzca velocidad de envasadoras o anada enfardadoras."
                });
            } else if (staticSimulationResults.totalBagsPerMinuteFromPackers > staticSimulationResults.totalWrapperCapacity * 0.8) {
                bottleneckStages.push({
                    name: "Empaque",
                    status: 'warning',
                    message: "Alta carga en enfardado",
                    advice: "Poco margen de maniobra."
                });
            } else {
                bottleneckStages.push({
                    name: "Empaque",
                    status: 'optimal',
                    message: "Flujo de salida balanceado",
                    advice: "Carga de trabajo estable."
                });
            }
        }

        const totalQQinReceivers = simulationState.receivers.reduce((sum, r) => sum + r.currentQQ, 0);
        const processedQQ = simulationState.initialQQInReceivers > 0 ? simulationState.initialQQInReceivers - totalQQinReceivers : 0;
        const processingProgress = simulationState.initialQQInReceivers > 0 ? (processedQQ / simulationState.initialQQInReceivers) * 100 : 0;

        let mainBottleneck: 'tachos' | 'centrifuges' | 'receivers' | 'silos' | 'machines' | 'wrapper' | 'none' = 'none';
        if (staticSimulationResults.isWrapperBottleneck) mainBottleneck = 'wrapper';
        else if (simulationState.silosFullAlarm) mainBottleneck = 'silos';
        else if (qqRateFromCentrifuges < qqRateToPackers * 0.95) mainBottleneck = 'centrifuges';
        else if (qqRateFromTachos < qqRateFromCentrifuges * 0.9) mainBottleneck = 'tachos';

        return {
            totalBundlesProduced: safeNum(Object.values(simulationState.wrappers).reduce((sum, w) => sum + w.totalBundles, 0)),
            timeToEmptyHours: safeNum(timeToEmptySeconds / 3600, Infinity),
            totalUnitsProduced: safeNum(totalUnitsProduced),
            bottleneckStages,
            bottleneck: mainBottleneck,
            qqRateFromCentrifuges: safeNum(isSimulating && anyMachineActive ? qqRateFromCentrifuges : 0),
            qqRateToPackers: safeNum(isSimulating && anyMachineActive ? qqRateToPackers : 0),
            processingProgress: safeNum(processingProgress),
            totalPallets: Object.values(simulationState.palletGroups).reduce((sum, group) => sum + group.fullPallets, 0),
            globalEfficiency: simulationState.elapsedTime > 0 ? (simulationState.accumulatedOperationSeconds / simulationState.elapsedTime) * 100 : 0,
            totalInProcessQQ: (simulationState.receivers.reduce((sum, r) => sum + r.currentQQ, 0) + 
                               simulationState.bufferTankQQ + 
                               simulationState.silos.reduce((sum, s) => sum + s.currentQQ, 0))
        }

    }, [simulationState, machines, staticSimulationResults, centrifugeLoadTime, centrifugeWashTime, centrifugePurgeTime, centrifugeBatchSizeQQ, centrifugeStartInterval, isSimulating, masaQQAmount, tachosCookTime, tachosTransferTime]);
    
    const simTachos = simulationState.tachos;
    const tachosStateConfig = {
        idle: { text: "Libre", color: "text-primary", icon: CircleSlash },
        cooking: { text: "Cocinando", color: "text-amber-600", icon: Beaker },
        ready: { text: "Lista para Enviar", color: "text-green-600", icon: CheckCircle2 },
        sending: { text: "Enviando...", color: "text-blue-600", icon: ArrowRight },
    };
    const currentTachosConfig = tachosStateConfig[simTachos.state];

    const tachosStateForDialog = { ...simulationState.tachos };
    
    const totalQQInReceivers = simulationState.receivers.reduce((sum, r) => sum + r.currentQQ, 0);


  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Panel de Operaciones</h1>
        </div>
        <Link href="/"><Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver a la Planificacion</Button></Link>
      </header>
      
      <main className="p-4 md:p-8 space-y-8">
        {simulationState.silosFullAlarm && (
            <Alert variant="destructive" className="border-2 animate-pulse">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-bold">ALERTA: CAPACIDAD DE SILOS AGOTADA</AlertTitle>
                <AlertDescription>
                    La produccion se ha detenido automaticamente porque todos los silos estan al 100%. 
                    La Linea se reanudara cuando el nivel de los silos baje del 95%.
                </AlertDescription>
            </Alert>
        )}

        {!isClient ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-muted-foreground">Cargando panel de operaciones...</p>
          </div>
        ) : (
        <>
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-center mb-4">Flujo del Proceso de Produccion</h3>
                <div className="flex justify-around items-center p-4 border rounded-lg bg-muted/30 overflow-x-auto">
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Beaker className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Tachos</h4>
                            <p className="text-sm text-muted-foreground">{simulationState.totalMasasSent} Masas</p>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Inicio: GeneraciÃƒÂ³n de masa.</p></TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Droplets className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Recibidores</h4>
                             <p className="text-sm text-muted-foreground">{(totalQQInReceivers ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</p>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Almacenamiento temporal de masa.</p></TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Activity className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold text-xs md:text-sm">Tanque Pulmon</h4>
                             <p className="text-xs text-muted-foreground">{(simulationState.bufferTankQQ ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</p>
                        </div>
                    </TooltipTrigger> <TooltipContent><p>Pulmon de almacenamiento intermedio.</p></TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider> <Tooltip> <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Hourglass className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold text-xs md:text-sm">Centrifugas</h4>
                             <p className="text-xs text-muted-foreground">{(simulationState.totalQQProduced ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</p>
                        </div>
                    </TooltipTrigger>  <TooltipContent> <p>Total de azucar purgada y lavada.</p> </TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider>  <Tooltip>  <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[80px]">
                            <Warehouse className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Silos</h4>
                            <p className="text-sm text-muted-foreground">{(simulationState.silos.find(s => s.id === 'familiar')?.currentQQ ?? 0).toLocaleString(undefined, {maximumFractionDigits: 0})} QQ</p>
                        </div>
                    </TooltipTrigger>  <TooltipContent> <p>Almacenamiento de azucar seca.</p> </TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider>  <Tooltip>  <TooltipTrigger>
                        <div className={cn("flex flex-col items-center gap-2 text-center p-2 rounded-md min-w-[90px]", liveSimulationResults.bottleneck === 'wrapper' && 'bg-destructive/10')}>
                            <Package className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Envasado</h4>
                            <p className="text-sm text-muted-foreground">{Math.floor(liveSimulationResults.totalUnitsProduced ?? 0).toLocaleString()} Fundas</p>
                        </div>
                    </TooltipTrigger>  <TooltipContent> <p>Produccion de las envasadoras.</p> </TooltipContent> </Tooltip> </TooltipProvider>
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0 mx-2 md:mx-4" />
                    <TooltipProvider>  <Tooltip>  <TooltipTrigger>
                        <div className="flex flex-col items-center gap-2 text-center min-w-[90px]">
                            <PackageCheck className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">Enfardado</h4>
                             <p className="text-sm text-muted-foreground">{(staticSimulationResults.bundlesPerMinute ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} Fardos/Min</p>
                        </div>
                    </TooltipTrigger>  <TooltipContent> <p>Capacidad teÃƒÂ³rica de empaque final en fardos por minuto.</p> </TooltipContent> </Tooltip> </TooltipProvider>
                </div>
            </div>
            
            <div className="space-y-8">
                <Card>
                    <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CardTitle>Controles de Simulacion</CardTitle>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setIsAppearanceDialogOpen(true)}>
                                            <Palette className="h-5 w-5 text-primary" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Personalizar Apariencia</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={handleShowImagesChange}>
                                            {showImages ? <ImageOff className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{showImages ? 'Ocultar ImÃƒÂ¡genes' : 'Mostrar ImÃƒÂ¡genes'}</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <RotateCcw className="h-5 w-5 text-muted-foreground" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Restaurar Configuracion por Defecto</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        ¿Estas seguro? Esto restaurara todos los parametros de la simulacion (en este navegador) y las imagenes (para todos los usuarios) a sus valores originales.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleRestoreDefaults}>Si, Restaurar</AlertDialogAction>
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
                        <div className="flex flex-wrap items-center gap-2">
                           <Button onClick={startClock} disabled={isSimulating} variant="secondary">
                                <Play className="mr-2 h-4 w-4" /> Iniciar
                           </Button>
                           <Button onClick={pauseClock} disabled={!isSimulating} variant="destructive">
                                <Pause className="mr-2 h-4 w-4" /> Detener
                           </Button>
                           <Separator orientation="vertical" className="h-6 mx-2" />
                           <Button onClick={resetSimulation} variant="outline">
                                <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar Todo
                           </Button>
                       </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                                 <div className="space-y-1.5">
                                      <div className='flex justify-between items-center'>
                                        <Label htmlFor="sim-speed">Acelerador de Tiempo (x{(simulationSpeed ?? 1).toLocaleString()})</Label>
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
                                 <div className="space-y-1.5">
                                     <div className="flex justify-between items-center">
                                         <Label className="text-xs">Duracion del Turno (Horas de Operacion)</Label>
                                         <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{targetShiftHours}h</span>
                                     </div>
                                     <Slider 
                                         min={0.5} 
                                         max={24} 
                                         step={0.5} 
                                         value={[targetShiftHours]} 
                                         onValueChange={(v) => setTargetShiftHours(v[0])} 
                                     />
                                 </div>
                             </div>

                            <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-semibold">Turno Automatico</Label>
                                        <div className="text-[10px] text-muted-foreground line-clamp-1">Detener por horas</div>
                                    </div>
                                    <Switch checked={isShiftGoalEnabled} onCheckedChange={setIsShiftGoalEnabled} />
                                </div>
                                <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                                     <div className="space-y-0.5">
                                         <div className="flex items-center gap-2">
                                             <Label className="text-xs font-semibold">Auto-Arranque (30%)</Label>
                                             <TooltipProvider> <Tooltip> <TooltipTrigger asChild><Activity className="h-3 w-3 text-muted-foreground cursor-help"/></TooltipTrigger> <TooltipContent><p className="w-60 text-xs text-center border-none shadow-none bg-transparent">Las maquinas se encenderan solas cuando el silo familiar tenga suficiente reserva (30%) para asegurar produccion continua.</p></TooltipContent> </Tooltip> </TooltipProvider>
                                         </div>
                                         <div className="text-[10px] text-muted-foreground line-clamp-1">Nivel optimo de inicio</div>
                                     </div>
                                     <Switch checked={isAutoStartEnabled} onCheckedChange={setIsAutoStartEnabled} />
                                 </div>
                                <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                                     <div className="space-y-0.5">
                                         <div className="flex items-center gap-2">
                                             <Label className="text-xs font-semibold">Reserva (M4)</Label>
                                             <TooltipProvider> <Tooltip> <TooltipTrigger asChild><Database className="h-3 w-3 text-muted-foreground cursor-help"/></TooltipTrigger> <TooltipContent><p className="w-60 text-xs text-center border-none shadow-none bg-transparent text-xs">Activa el consumo desde el Silo de Reserva de 150 QQ para la Maquina 4.</p></TooltipContent> </Tooltip> </TooltipProvider>
                                         </div>
                                         <div className="text-[10px] text-muted-foreground line-clamp-1">Alimentacion dedicada M4</div>
                                     </div>
                                     <Switch checked={isReserveSiloEnabled} onCheckedChange={setIsReserveSiloEnabled} />
                                 </div>
                            </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                           <div className="flex flex-col items-center justify-center bg-muted/30 border rounded-lg p-4 transition-all hover:bg-muted/50">
                               <Clock className="h-5 w-5 text-muted-foreground mb-1" />
                               <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold italic">Tiempo Cronologico</p>
                               <p className="text-2xl font-bold font-mono text-foreground">{formatElapsedTime(simulationState.elapsedTime)}</p>
                           </div>
                           <div className="flex flex-col items-center justify-center bg-muted/40 border border-primary/20 rounded-lg p-4 relative overflow-hidden transition-all hover:bg-muted/60">
                               <Activity className={cn("h-5 w-5 mb-1", isSimulating && machines.some(m => m.isSimulatingActive) && (simulationState.silos.find(s => s.id === 'familiar')?.currentQQ || 0) > 0 ? "text-primary animate-pulse" : "text-muted-foreground")} />
                               <p className="text-[10px] uppercase tracking-wider text-primary font-bold italic">Tiempo de Operacion</p>
                               <p className="text-2xl font-bold font-mono text-primary">{formatElapsedTime(simulationState.accumulatedOperationSeconds)}</p>
                               {isShiftGoalEnabled && (
                                   <div className="w-full mt-2 h-1.5 bg-muted rounded-full overflow-hidden border border-primary/10">
                                       <div 
                                           className="h-full bg-primary transition-all duration-300" 
                                           style={{ width: `${Math.min(100, (simulationState.accumulatedOperationSeconds / (targetShiftHours * 3600)) * 100)}%` }}
                                       />
                                   </div>
                               )}
                               {isShiftGoalEnabled && simulationState.accumulatedOperationSeconds >= (targetShiftHours * 3600) && (
                                   <div className="absolute inset-0 bg-primary/10 flex items-center justify-center backdrop-blur-[1px]">
                                       <Badge className="bg-primary text-primary-foreground font-bold py-1">TURNO COMPLETADO</Badge>
                                   </div>
                               )}
                               {isSimulating && machines.some(m => m.isSimulatingActive) && (simulationState.silos.find(s => s.id === 'familiar')?.currentQQ || 0) <= 0.1 && (
                                   <div className="absolute bottom-0 left-0 right-0 bg-destructive/80 text-destructive-foreground text-[10px] py-0.5 text-center font-bold animate-pulse">
                                       ESPERANDO MATERIA PRIMA
                                   </div>
                               )}
                           </div>
                       </div>
                   </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">1. Materia Prima</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                         {/* Tachos */}
                         <div className="p-4 border rounded-lg space-y-3 bg-background flex flex-col h-full">
                             <div className='flex justify-between items-start'>
                                 <h3 className="font-bold text-lg flex items-center gap-2">
                                     <Factory className="h-5 w-5 text-primary" />
                                     {simTachos.name}
                                     {isTachosAuto && <Badge variant="secondary">Auto</Badge>}
                                 </h3>
                                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo(tachosStateForDialog)}>
                                      <Edit className="h-4 w-4" />
                                 </Button>
                             </div>
                            {showImages && (
                                 <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-2">
                                      <Image src={simTachos.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/Tachos.jpg?alt=media"} alt={simTachos.name} width={600} height={400} className="object-contain w-full h-full" unoptimized/>
                                 </div>
                            )}
                             <div className="mt-auto space-y-3 flex-grow flex flex-col justify-end">
                                 <div className="space-y-1">
                                      <div className={cn("flex justify-between items-center text-xs font-medium", currentTachosConfig.color)}>
                                          <span className="flex items-center gap-1.5"><currentTachosConfig.icon className="h-3 w-3" /> {currentTachosConfig.text}</span>
                                          <span>{formatElapsedTime(simTachos.timeRemaining)}</span>
                                     </div>
                                     <Progress value={simTachos.progress} indicatorClassName={cn(
                                         simTachos.state === 'cooking' ? 'bg-amber-500' : 
                                         simTachos.state === 'ready' ? 'bg-green-500' : 
                                         simTachos.state === 'sending' ? 'bg-blue-500' : 
                                         'bg-primary'
                                     )} />
                                 </div>
                                  <div className='text-center border bg-muted/30 rounded-lg p-2'>
                                      <p className="text-xs text-muted-foreground">Total Masas Enviadas</p>
                                      <p className="text-lg font-bold text-primary">{simulationState.totalMasasSent}</p>
                                 </div>
                                  {!isTachosAuto && (
                                      <Button className="w-full" onClick={handleManualSendMasa} disabled={isSimulating && simTachos.state !== 'idle'}>Enviar Masa</Button>
                                  )}
                             </div>
                         </div>
                        
                         {/* Receivers */}
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                            {receivers.map((receiver) => {
                                const simReceiver = simulationState.receivers.find(r => r.id === receiver.id) || receiver;
                                const consumptionPercentage = simReceiver.capacityQQ > 0 ? (simReceiver.currentQQ / simReceiver.capacityQQ) * 100 : 0;
                                return (
                                     <div key={receiver.id} className="p-4 border rounded-lg bg-background flex-1 flex flex-col h-full">
                                         <div className='flex justify-between items-start mb-2'>
                                             <h3 className="font-bold text-lg flex items-center gap-2">
                                                 <ArrowDownToLine className="h-5 w-5 text-primary" />
                                                 {receiver.name}
                                             </h3>
                                             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingReceiver(receiver)}>
                                                  <Edit className="h-4 w-4" />
                                             </Button>
                                         </div>
                                          <div className="space-y-3 pt-2 mt-auto flex-grow flex flex-col justify-end">
                                              <div className="space-y-1">
                                                  <Label className="text-xs text-muted-foreground">Llenado</Label>
                                                  <Progress value={simReceiver.state === 'filling' ? simReceiver.fillProgress : (simReceiver.state === 'ready' || simReceiver.state === 'draining') ? 100 : 0} indicatorClassName="bg-green-500" />
                                             </div>
                                              <div className="space-y-1">
                                                   <div className="flex justify-between items-baseline">
                                                      <Label className="text-xs text-muted-foreground">Consumo</Label>
                                                  </div>
                                                  <Progress value={consumptionPercentage} indicatorClassName="bg-amber-500" />
                                             </div>
                                              <div className="text-center">
                                                  <p className="text-sm">Nivel: {(simReceiver.currentQQ ?? 0).toFixed(0)} / {(simReceiver.capacityQQ ?? 0).toLocaleString()} QQ</p>
                                             </div>
                                         </div>
                                     </div>
                                )
                            })}
                         </div>

                         {/* Centrifuges and Buffer Tank Column */}
                         <div className="flex flex-col gap-4 h-full">
                              {/* Buffer Tank Card */}
                              <div className="p-4 border rounded-lg bg-background">
                                   <div className="flex justify-between items-start mb-2">
                                        <div className="space-y-1">
                                             <h3 className="font-bold text-lg flex items-center gap-2">
                                                  <Waves className="h-5 w-5 text-blue-500" />
                                                   Tanque Pulmon
                                             </h3>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCentrifuges(true)}>
                                             <Edit className="h-4 w-4" />
                                        </Button>
                                   </div>
                                   <div className="space-y-3">
                                        <div className="space-y-1">
                                             <div className="flex justify-between text-xs mb-1">
                                                  <Label className="text-muted-foreground font-medium">Nivel de Masa</Label>
                                                  <span className="font-bold text-blue-600">{safeNum(simulationState.bufferTankQQ).toFixed(1)} QQ</span>
                                             </div>
                                             <Progress 
                                                  value={safeNum((simulationState.bufferTankQQ / (bufferTankCapacityQQ || 1)) * 100)} 
                                                  indicatorClassName="bg-blue-600" 
                                             />
                                             <div className="flex justify-between text-[10px] text-muted-foreground mt-1 text-center font-medium">
                                                  <span>Capacidad Max: {safeNum(bufferTankCapacityQQ ?? 380).toLocaleString()} QQ</span>
                                             </div>
                                        </div>
                                   </div>
                              </div>

                              {/* Centrifuges */}
                               <div className="p-4 border rounded-lg bg-background flex-grow flex flex-col h-full">
                                   <div className="flex justify-between items-start mb-2">
                                       <div className="space-y-1">
                                           <h3 className="font-bold text-lg flex items-center gap-2">
                                                <RotateCw className="h-5 w-5 text-primary" />
                                                Centrifugas
                                               <Badge variant={isCentrifugesAuto ? "default" : "secondary"} className="text-[10px] py-0">
                                                   {isCentrifugesAuto ? '⚡ Auto' : 'Ã°Å¸â€“Â Manual'}
                                               </Badge>
                                           </h3>
                                           {isCentrifugesAuto && (
                                               <p className="text-[10px] text-muted-foreground">
                                                   Inicia al ≥ 50% del tanque pulmon
                                               </p>
                                           )}
                                       </div>
                                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCentrifuges(true)}>
                                            <Edit className="h-4 w-4" />
                                       </Button>
                                   </div>
                                   <div className="space-y-2 mb-3">
                                      <div className="flex justify-between items-center text-xs">
                                        <Label className="text-muted-foreground">Tiempo para Procesar</Label>
                                        <span className="font-bold text-primary">{formatElapsedTime(simulationState.timeToProcessReceivers * 3600)}</span>
                                      </div>
                                      <Progress value={liveSimulationResults.processingProgress} />
                                  </div>
                                   <div className="grid grid-cols-2 gap-4 flex-grow">
                                      {centrifuges.map((centrifuge) => {
                                          const simCentrifuge = simulationState.centrifuges.find(c => c.id === centrifuge.id) || centrifuge;
                                          const stateConfig = {
                                              idle: { text: "Libre", color: "text-primary", icon: CircleSlash },
                                              loading: { text: "Cargando", color: "text-blue-600", icon: Droplets },
                                              washing_centrifuging: { text: "Lavando/Girar", color: "text-purple-600", icon: Waves },
                                              purging: { text: "Purgando", color: "text-amber-600", icon: Snowflake },
                                          };
                                          const currentCentrifugeConfig = stateConfig[simCentrifuge.state];
                                          const canManualStart = !isCentrifugesAuto && simCentrifuge.state === 'idle' && (simulationState.bufferTankQQ ?? 0) > 0.1 && isSimulating;
                                          return (
                                               <div key={centrifuge.id} className="border p-3 rounded-lg flex flex-col justify-between gap-2">
                                                   <div>
                                                       <h4 className='text-sm font-semibold mb-2'>{simCentrifuge.name}</h4>
                                                   </div>
                                                   <div className="space-y-1">
                                                       <div className={cn("flex justify-between items-center text-xs font-medium", currentCentrifugeConfig.color)}>
                                                           <span className="flex items-center gap-1.5"><currentCentrifugeConfig.icon className="h-3 w-3" /> {currentCentrifugeConfig.text}</span>
                                                           <span>{formatElapsedTime(simCentrifuge.stageTimeRemaining)}</span>
                                                       </div>
                                                        <Progress value={simCentrifuge.stageProgress} indicatorClassName={cn(
                                                           simCentrifuge.state === 'loading' ? 'bg-blue-500' :
                                                           simCentrifuge.state === 'washing_centrifuging' ? 'bg-purple-500' :
                                                           simCentrifuge.state === 'purging' ? 'bg-amber-500' :
                                                           'bg-primary'
                                                       )} />
                                                   </div>
                                                   {!isCentrifugesAuto && (
                                                       <Button
                                                           size="sm"
                                                           className="w-full h-7 text-xs"
                                                           onClick={() => handleManualStartCentrifuge(centrifuge.id)}
                                                           disabled={!canManualStart}
                                                       >
                                                           <Play className="h-3 w-3 mr-1" />
                                                           {simCentrifuge.state === 'idle' ? 'Iniciar' : 'En Proceso'}
                                                       </Button>
                                                   )}
                                               </div>
                                          )
                                      })}
                                   </div>
                               </div>
                          </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">2. Almacenamiento</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {silos.map((silo) => {
                            const simSilo = simulationState.silos.find(s => s.id === silo.id) || silo;
                            const fillPercentage = simSilo.capacityQQ > 0 ? (simSilo.currentQQ / simSilo.capacityQQ) * 100 : 0;
                            const fillColorClass = getSiloFillColor(fillPercentage);
                            const isProductionSilo = simSilo.id === 'familiar';

                            return (
                                 <div key={simSilo.id} className="p-4 border rounded-lg space-y-3 bg-background">
                                      <div className='flex justify-between items-start'>
                                         <h3 className="font-bold text-lg flex items-center gap-2">
                                              <Database className="h-5 w-5 text-primary" />
                                              {simSilo.name}
                                          </h3>
                                         <div className="flex items-center gap-1.5">
                                              {simulationState.silosFullAlarm && fillPercentage >= 99 && (
                                                  <Badge variant="destructive" className="text-[10px] animate-pulse">CAPACIDAD CRÃƒÂTICA</Badge>
                                              )}
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo(silo)}>
                                                   <Edit className="h-4 w-4" />
                                              </Button>
                                         </div>
                                     </div>
                                    {showImages && (
                                         <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-2">
                                             <Image src={simSilo.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media"} alt={simSilo.name} width={600} height={400} className="object-contain w-full h-full" unoptimized/>
                                         </div>
                                    )}
                                     <div className="space-y-1.5">
                                         <Label className='text-xs text-muted-foreground'>Capacidad: {(simSilo.capacityQQ ?? 0).toLocaleString()} QQ</Label>
                                    </div>
                                     <div className="space-y-2 pt-2">
                                         <Label className="text-sm">Nivel: {(simSilo.currentQQ ?? 0).toLocaleString(undefined, {maximumFractionDigits:1})} QQ ({(fillPercentage ?? 0).toFixed(1)}%)</Label>
                                         <Progress value={fillPercentage} indicatorClassName={fillColorClass} />
                                     </div>
                                      {isProductionSilo && (
                                          <div className="text-center border bg-muted/30 rounded-lg p-2">
                                               <p className="text-xs text-muted-foreground">Tiempo de Produccion Restante</p>
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
                                const wrapper = wrappersRef.current.find(w => w.machineIds.includes(machine.id));
                                
                                let dynamicUPB = wrapper?.unitsPerBundle || 12;
                                if (product) {
                                    const pNameLower = product.productName.toLowerCase();
                                    if (pNameLower.includes('1 kg -blanca (50 kg) don antonio')) {
                                        dynamicUPB = 12;
                                    } else if (product.presentationWeight && product.presentationWeight > 0) {
                                        dynamicUPB = Math.round((product.sackWeight || (pNameLower.includes('50 kg') ? 50 : 12)) / product.presentationWeight);
                                    }
                                }
                                const fardosPerMinuteNeto = wrapper && dynamicUPB > 0 ? unitsPerMinuteNeto / dynamicUPB : 0;
                                const unitsProducedByMachine = simulationState.machineTotals[machine.id] || 0;
                                
                                return (
                                     <div key={machine.id} className={cn("p-3 border rounded-lg space-y-3 bg-background relative transition-all", machine.isSimulatingActive && "ring-2 ring-green-500")}>
                                         <div className="flex justify-between items-start">
                                             <Label className="font-bold text-primary flex items-center gap-2">
                                                  <Box className="h-4 w-4" /> Maquina {machine.id}
                                              </Label>
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
                                                              <p>{machine.isSimulatingActive ? 'Apagar Maquina' : 'Encender Maquina'}</p>
                                                         </TooltipContent>
                                                      </Tooltip>
                                                  </TooltipProvider>
                                             </div>
                                         </div>
                                         
                                         {showImages && (
                                             <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                                                 <Image 
                                                     src={machine.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media"} 
                                                     alt={`Maquina ${machine.id}`}
                                                     width={600}
                                                     height={400}
                                                     className="object-contain w-full h-full"
                                                     unoptimized
                                                 />
                                             </div>
                                         )}

                                         <div className="space-y-1">
                                             <p className="text-xs text-muted-foreground">Producto</p>
                                             <p className="font-semibold truncate" title={product?.productName || 'Inactiva'}>
                                                 {product?.productName || 'Inactiva'}
                                             </p>
                                             {product && (
                                                 <Badge variant="outline" className="text-[10px] mt-0.5 bg-muted/50 font-bold border-primary/20 text-primary">
                                                     {getPackagingTypeLabel(product)}
                                                 </Badge>
                                             )}
                                         </div>

                                         {machine.productId !== 'inactive' && (
                                           <>
                                             <div className="space-y-2 rounded-lg bg-muted/30 p-2 border text-xs">
                                                 <h3 className="font-semibold text-center text-muted-foreground">Configuracion Clave</h3>
                                                 <div className="grid grid-cols-2 gap-1 text-center">
                                                     <div className="bg-background p-1 rounded-md border">
                                                         <p className="text-muted-foreground">Velocidad</p>
                                                         <p className="font-bold text-sm">{machine.speed} <span className="text-xs font-normal">f/min</span></p>
                                                     </div>
                                                     <div className="bg-background p-1 rounded-md border">
                                                         <p className="text-muted-foreground">Merma</p>
                                                         <p className="font-bold text-sm">{machine.loss}%</p>
                                                     </div>
                                                 </div>
                                             </div>
                                             <div className="space-y-2 rounded-lg bg-muted/30 p-2 border text-xs">
                                                 <h3 className="font-semibold text-center text-muted-foreground">Rendimiento (Neto)</h3>
                                                 <div className="grid grid-cols-2 gap-2 text-center">
                                                     <div className="bg-background p-1 rounded-md border">
                                                         <p className="text-muted-foreground">Fundas/Min</p>
                                                         <p className="font-bold text-sm">{(unitsPerMinuteNeto ?? 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                                     </div>
                                                     <div className="bg-background p-1 rounded-md border">
                                                         <p className="text-muted-foreground">{getUnitLabel(product)}s/Min</p>
                                                         <p className="font-bold text-sm text-green-600">{(fardosPerMinuteNeto ?? 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                                     </div>
                                                 </div>
                                             </div>

                                             <div className="space-y-2 rounded-lg bg-primary/10 p-2 border border-primary/20 text-xs text-center mb-3">
                                                 <h3 className="font-semibold text-primary flex items-center justify-center gap-1.5">
                                                     <Clock className="h-3 w-3" /> Reloj de Operacion
                                                 </h3>
                                                 <p className="text-lg font-mono font-bold text-primary tracking-wider">
                                                     {formatSeconds(simulationState.machineActiveTimes[machine.id] || 0)}
                                                 </p>
                                             </div>

                                             <div className="space-y-1">
                                                 <Label className="text-xs">Produccion Total (Fundas)</Label>
                                                 <p className="text-lg font-bold text-center text-primary">{Math.floor(unitsProducedByMachine ?? 0).toLocaleString()}</p>
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
                                         <Label className="font-bold text-primary flex items-center gap-2">
                                              <Package2 className="h-4 w-4" /> {wrapperConfig.name}
                                          </Label>
                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingWrapper(wrapperConfig)}>
                                              <Edit className="h-4 w-4" />
                                         </Button>
                                     </div>

                                     {showImages && (
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
                                     )}
                                     
                                      <div className="space-y-2 rounded-lg bg-muted/30 p-2 border text-xs">
                                         <h3 className="font-semibold text-center text-muted-foreground">Configuracion Clave</h3>
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
                                                 <p className="font-bold text-lg text-orange-500">{Math.floor(unitsInTransit ?? 0).toLocaleString()}</p>
                                             </div>
                                             <div>
                                                 <p className="text-xs text-muted-foreground">En Cola</p>
                                                 <p className="font-bold text-lg text-blue-600">{Math.floor(wrapperState.buffer ?? 0).toLocaleString()}</p>
                                             </div>
                                        </div>
                                          <div>
                                             {(() => {
                                                 const activeMachine = machines.find(m => wrapperConfig.machineIds.includes(m.id) && m.isSimulatingActive && m.productId !== 'inactive');
                                                 const prod = activeMachine ? products.find(p => String(p.id) === String(activeMachine.productId)) : null;
                                                 let dynamicUPB = wrapperConfig.unitsPerBundle || 12;
                                                 if (prod) {
                                                     if (prod.presentationWeight && prod.presentationWeight > 0) {
                                                         if (prod.primaryPackaging === 'fardo' && prod.bundleWeight) {
                                                             dynamicUPB = Math.round(prod.bundleWeight / prod.presentationWeight);
                                                         } else if (prod.primaryPackaging === 'saco' || prod.primaryPackaging === 'granel' || !prod.bundleWeight) {
                                                             dynamicUPB = Math.round((prod.sackWeight || 50) / prod.presentationWeight);
                                                         } else {
                                                             dynamicUPB = Math.round(prod.bundleWeight / prod.presentationWeight);
                                                         }
                                                     }
                                                 }
                                                 return (
                                                     <>
                                                         <Label className="text-xs">{getUnitLabel(prod)} Actual ({Math.floor(wrapperState.currentBundleProgress ?? 0)}/{dynamicUPB} fundas)</Label>
                                                         <Progress value={(wrapperState.currentBundleProgress / (dynamicUPB || 1)) * 100} />
                                                     </>
                                                 );
                                             })()}
                                         </div>
                                         <div className='text-center border bg-background rounded-lg p-2'>
                                             {(() => {
                                                 const activeMachine = machines.find(m => wrapperConfig.machineIds.includes(m.id) && m.isSimulatingActive && m.productId !== 'inactive');
                                                 const prod = activeMachine ? products.find(p => String(p.id) === String(activeMachine.productId)) : null;
                                                 return <p className="text-xs text-muted-foreground">Total {getUnitLabel(prod)}s</p>;
                                             })()}
                                             <p className="font-bold text-lg text-green-600">{(wrapperState.totalBundles ?? 0).toLocaleString()}</p>
                                         </div>
                                    </div>
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>

                <Card className="shadow-lg border-2 border-primary/10">
                    <CardHeader className="bg-primary/5 pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                             <Layers className="h-5 w-5 text-primary" />
                             5. Zona de Estiba
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {Object.keys(simulationState.palletGroups).length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
                                <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                <p className="font-medium">Esperando producciÃƒÂ³n para iniciar estiba...</p>
                                <p className="text-xs">Los pallets aparecerÃƒÂ¡n aquÃƒÂ­ una vez que las envasadoras o enfardadoras completen unidades.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {Object.values(simulationState.palletGroups).map((group) => {
                                    const isFardo = group.productName.toLowerCase().includes('don antonio') || group.productName.toLowerCase().includes('12 kg');
                                    const unitLabel = isFardo ? 'Paquetes' : 'Sacos';
                                    const singularLabel = isFardo ? 'Paquete' : 'Saco';

                                    return (
                                        <div key={group.productName} className="p-4 border-2 rounded-xl space-y-4 bg-background shadow-sm hover:shadow-md transition-all hover:border-primary/20 group">
                                            <div className="space-y-1">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Presentacion</p>
                                                    <Badge variant="outline" className="text-[9px] font-bold">{group.sacksPerPallet} / Pallet</Badge>
                                                </div>
                                                <p className="font-black text-sm text-primary leading-tight h-10 line-clamp-2" title={group.productName}>
                                                    {group.productName}
                                                </p>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 text-center border-y py-4 bg-muted/30 rounded-lg group-hover:bg-primary/5 transition-colors">
                                                <div className="border-r border-muted-foreground/10">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Pallets</p>
                                                    <p className="text-3xl font-black text-primary tabular-nums">{group.fullPallets}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total {unitLabel}</p>
                                                    <p className="text-3xl font-black text-green-600 tabular-nums">{group.sacks}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[11px] font-black">
                                                    <span className="text-muted-foreground">PROGRESO PALLET</span>
                                                    <span className="font-mono text-primary bg-primary/10 px-1.5 rounded">{group.currentPalletSacks} / {group.sacksPerPallet}</span>
                                                </div>
                                                <Progress value={(group.currentPalletSacks / group.sacksPerPallet) * 100} indicatorClassName="bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" className="h-2.5 bg-muted/50" />
                                            </div>

                                            <div className="pt-3 flex flex-col items-center gap-2 border-t border-dashed">
                                                <div className="grid grid-cols-7 gap-1.5">
                                                    {[...Array(21)].map((_, i) => {
                                                        const isFilled = i < (group.currentPalletSacks / group.sacksPerPallet * 21);
                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={cn(
                                                                    "h-2 w-3.5 rounded-[1px] transition-all duration-300",
                                                                    isFilled ? "bg-primary scale-110 shadow-sm" : "bg-muted opacity-40"
                                                                )} 
                                                            />
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[10px] text-muted-foreground font-medium italic">Estibado de {unitLabel.toLowerCase()}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                 <div className="space-y-6">
                    <h3 className="font-semibold text-xl text-center">Resultados Globales de la Linea</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KpiCard 
                            title="Tiempo para Agotar Silo" 
                            value={formatTime(liveSimulationResults.timeToEmptyHours)} 
                            icon={Hourglass} 
                            description="Tiempo estimado para que se agote el azucar en el Silo Familiar al ritmo de consumo actual." 
                        />
                        <KpiCard
                            title="Flujo de Produccion (QQ/hora)"
                            value={(liveSimulationResults.qqRateFromCentrifuges ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            subValue={`vs ${(liveSimulationResults.qqRateToPackers ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} de Empaque`}
                            icon={Activity}
                            description="Compara la produccion de azucar de las centrifugas con la demanda de las envasadoras."
                        />
                        <KpiCard 
                            title="Total Fundas Producidas" 
                            value={liveSimulationResults.totalUnitsProduced} 
                            icon={Package2} 
                            description="Suma total de fundas individuales que han producido todas las envasadoras." 
                            fractionDigits={0} 
                        />
                        <KpiCard 
                            title="Total QQ Empacados"
                            value={simulationState.totalQQPacked}
                            icon={Box}
                            description="Total de quintales que han sido consumidos por las envasadoras desde el silo."
                            fractionDigits={1}
                        />
                        <KpiCard
                            title="Total Fardos Producidos"
                            value={liveSimulationResults.totalBundlesProduced}
                            icon={Archive}
                            description="Suma total de fardos que han sido completados por las enfardadoras."
                            fractionDigits={0}
                        />
                        <KpiCard 
                            title="Total Pallets Estibados" 
                            value={liveSimulationResults.totalPallets} 
                            icon={Layers} 
                            description="Cantidad total de pallets completos en la zona de estiba." 
                            fractionDigits={0} 
                        />
                        <KpiCard 
                            title="Eficiencia de Linea (OEE)" 
                            value={liveSimulationResults.globalEfficiency} 
                            icon={Zap} 
                            description="Porcentaje de tiempo que las maquinas estuvieron produciendo vs. tiempo total transcurrido." 
                            suffix="%"
                            fractionDigits={1} 
                        />
                        <KpiCard 
                            title="Total Azucar en Sistema" 
                            value={liveSimulationResults.totalInProcessQQ} 
                            icon={Database} 
                            description="Suma de toda la materia prima presente actualmente en tacho, recibidores y silos." 
                            suffix=" QQ"
                            fractionDigits={1} 
                        />
                    </div>
                    <Card className="border-2 shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/50 border-b">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Activity className="h-5 w-5 text-primary" />
                                Diagnostico Multietapa: Analisis de Cuello de Botella
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {liveSimulationResults.bottleneckStages.map((stage, idx) => {
                                    const statusColors = {
                                        optimal: "bg-green-600/10 text-green-700 border-green-200 shadow-green-100",
                                        warning: "bg-amber-500/10 text-amber-700 border-amber-200 shadow-amber-100",
                                        critical: "bg-destructive/10 text-destructive border-destructive/20 shadow-red-100"
                                    };
                                    
                                    const statusIcons = {
                                        optimal: CheckCircle2,
                                        warning: AlertTriangle,
                                        critical: AlertTriangle 
                                    };
                                    
                                    const Icon = statusIcons[stage.status];
                                    
                                    return (
                                        <div key={idx} className={cn(
                                            "p-4 rounded-xl border-2 transition-all hover:scale-[1.02] flex flex-col gap-3 h-full shadow-sm",
                                            statusColors[stage.status]
                                        )}>
                                            <div className="flex justify-between items-center border-b pb-2 border-current/10">
                                                <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">ETAPA: {stage.name}</span>
                                                <Icon className={cn("h-5 w-5", stage.status === 'critical' && "animate-pulse")} />
                                            </div>
                                            
                                            <div className="flex-grow">
                                                <h4 className="font-bold text-sm leading-tight mb-1">{stage.message}</h4>
                                                <p className="text-[11px] font-medium leading-relaxed opacity-90">{stage.advice}</p>
                                            </div>

                                            <div className="mt-auto pt-2">
                                                <Badge className={cn(
                                                    "w-full justify-center text-[10px] font-bold py-0.5",
                                                    stage.status === 'optimal' ? "bg-green-600" :
                                                    stage.status === 'warning' ? "bg-amber-600" : "bg-destructive"
                                                )}>
                                                    {stage.status === 'optimal' ? 'FLUJO LIBRE' : 
                                                     stage.status === 'warning' ? 'ADVERTENCIA' : 'CUELLO DE BOTELLA'}
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            <div className="mt-6 p-3 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground italic flex items-start gap-2">
                                <Activity className="h-4 w-4 mt-0.5 shrink-0 opacity-50" />
                                <p>El analisis se basa en el balance de masas en tiempo real entre la capacidad de los equipos seleccionados y la demanda de empaque establecida.</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">Contribucion por Maquina (Fardos)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {Object.values(simulationState.machineTotals).every(m => m === 0) ? (
                                 <p className="text-center text-muted-foreground h-[200px] flex items-center justify-center">Activa una maquina para ver la contribucion.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                     <PieChart>
                                         <Pie 
                                          data={Object.entries(simulationState.machineTotals)
                                              .map(([machineId, totalUnits]) => {
                                                  const machine = machines.find(m => m.id === parseInt(machineId));
                                                  if (!machine) return null;
                                                  const product = products.find(p => p.id === machine.productId);
                                                  if (!product) return null;
                                                  
                                                  const wrapper = wrappers.find(w => w.machineIds.includes(machine.id));
                                                  const unitsPerBundle = wrapper?.unitsPerBundle || 1;
                                                  const totalBundles = totalUnits / unitsPerBundle;
                                                  const totalKg = totalUnits * (product.presentationWeight || 1);
                                                  
                                                  return {
                                                      name: `Maquina ${machineId}`,
                                                      productName: product.productName,
                                                      value: totalBundles,  // Value for pie chart size
                                                      units: totalUnits,
                                                      qqConsumed: totalKg / KG_PER_QUINTAL,
                                                  }
                                              })
                                              .filter((d): d is NonNullable<typeof d> => d !== null && d.value > 0)
                                          } 
                                          dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label
                                        >
                                             {Object.keys(simulationState.machineTotals).map((entry, index) => (
                                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                             ))}
                                        </Pie>
                                         <RechartsTooltip content={<CustomPieTooltip />} />
                                     </PieChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        
        <AppearanceDialog 
            open={isAppearanceDialogOpen}
            onOpenChange={setIsAppearanceDialogOpen}
            config={appearanceConfig}
            onConfigChange={setAppearanceConfig}
        />

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
                        transferTime: tachosTransferTime,
                        isGoalEnabled: isTachosGoalEnabled,
                        goal: tachosGoal,
                        masaQQAmount: masaQQAmount,
                    }}
                    onTachosConfigChange={handleTachosConfigChange}
                    onImageSave={handleImageSave}
                    isUploading={isUploading}
                />
            )}
            {editingReceiver && (
                 <ReceiverEditDialog
                    open={!!editingReceiver}
                    onOpenChange={(isOpen) => !isOpen && setEditingReceiver(null)}
                    receiver={editingReceiver}
                    onSave={handleReceiverSave}
                    isUploading={isUploading}
                />
            )}
             {editingCentrifuges && (
                 <CentrifugeEditDialog
                    open={editingCentrifuges}
                    onOpenChange={setEditingCentrifuges}
                    onSave={handleCentrifugeConfigSave}
                    config={{
                        isAuto: isCentrifugesAuto,
                        batchSizeQQ: centrifugeBatchSizeQQ,
                        loadTime: centrifugeLoadTime,
                        washTime: centrifugeWashTime,
                        purgeTime: centrifugePurgeTime,
                        startInterval: centrifugeStartInterval,
                        bufferTankCapacityQQ: bufferTankCapacityQQ,
                        bufferTransferTimeMinutes: bufferTransferTimeMinutes,
                    }}
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

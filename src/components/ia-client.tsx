'use client';

import React from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, PackageCheck, LayoutDashboard, ArrowRight, AlertTriangle, Upload, Edit, Beaker, Play, Pause, RefreshCw, Clock, Zap, Power, PowerOff, Droplets, Wind, Hourglass, CircleSlash, Activity, CheckCircle2, Waves, Snowflake, Archive, Box, Boxes, Weight, Package2, Image as ImageIcon, ImageOff, RotateCcw, ArrowDownToLine, RotateCw, Database, Layers, CalendarDays, Settings2, Sunrise, Sunset, Utensils, Coffee, Moon, Sun, FileText, Calculator, Target, TrendingUp, PanelLeftClose, PanelLeftOpen, CalendarRange, Calendar as CalendarIcon, ArrowLeftRight, Save, History, BarChart as BarChartIcon, MousePointer2, Trash2, ChevronDown, ChevronUp, MoreVertical, Eye, Pencil, FileDown, Users, ShieldCheck, Bot } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CategoryDefinition, ProductDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { useSearchParams, useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import KpiCard from '@/components/kpi-card';
import { Separator } from '@/components/ui/separator';
import { Pie, Cell, ResponsiveContainer, PieChart, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, LabelList, ComposedChart } from 'recharts';
import { cn } from '@/lib/utils';
import Header from '@/components/header';
import { runSmartPlannerEngine } from '@/lib/smart-planner-engine';
import { AutonomousAgentView } from '@/components/autonomous-agent-view';
import { FloatingCopilot } from '@/components/floating-copilot';

import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Slider } from './ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const KG_PER_QUINTAL = 50;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];
const LOCAL_STORAGE_CONFIG_KEY = 'simulationConfig';
const FIRESTORE_ASSETS_PATH = 'simulation_assets';
const LOCAL_STORAGE_SHOW_IMAGES_KEY = 'simulationShowImages';

const formatDateDisplay = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
};

const getEcuadorHolidays = (year: number) => {
    // Fixed holidays (MM-DD)
    const fixed = [
        '01-01', // Año Nuevo
        '05-01', // Día del Trabajo
        '05-24', // Batalla de Pichincha
        '08-10', // Primer Grito de Independencia
        '10-09', // Independencia de Guayaquil
        '11-02', // Día de los Difuntos
        '11-03', // Independencia de Cuenca
        '12-25', // Navidad
    ];

    // Helper to calculate Easter (moveable holidays)
    const f = Math.floor;
    const G = year % 19;
    const C = f(year / 100);
    const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
    const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
    const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
    const L = I - J;
    const month = 3 + f((L + 40) / 44);
    const day = L + 28 - 31 * f(month / 4);
    const easter = new Date(year, month - 1, day);

    // Movable holidays based on Easter
    const addDays = (date: Date, days: number) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    };

    const holidays = new Set(fixed.map(f => `${year}-${f}`));
    holidays.add(addDays(easter, -48)); // Lunes Carnaval
    holidays.add(addDays(easter, -47)); // Martes Carnaval
    holidays.add(addDays(easter, -2));  // Viernes Santo

    return holidays;
};

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
    keepActiveDuringBreaks: boolean;
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
    machines: Omit<MachineState, 'imageUrl'>[];
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
    shiftType: 'day' | 'night';
    dayLunchBreak: { start: string; end: string; enabled: boolean };
    nightDinnerBreak: { start: string; end: string; enabled: boolean };
    nightBreakfastBreak: { start: string; end: string; enabled: boolean };
    isGranelActive: boolean;
    granelSpeed: number;
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
    virtualTimeSeconds: number; // calculated clock time
    isBreakActive: boolean; // true if currently in a break
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
    siloHistory: any[]; // Track silo levels over time
    totalGranelQQ: number;
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
                            <Input id={`speed-${machine.id}`} type="number" value={editedMachine.speed} onChange={e => handleFieldChange('speed', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`loss-${machine.id}`}>Merma (%)</Label>
                            <Input id={`loss-${machine.id}`} type="number" value={editedMachine.loss} onChange={e => handleFieldChange('loss', Number(e.target.value))} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id={`keep-active-${machine.id}`}
                            checked={editedMachine.keepActiveDuringBreaks}
                            onCheckedChange={(checked) => handleFieldChange('keepActiveDuringBreaks', checked)}
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label
                                htmlFor={`keep-active-${machine.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Mantener activa durante descansos
                            </Label>
                            <p className="text-[10px] text-muted-foreground">
                                Si se activa, esta mÃ¡quina no se detendrÃ¡ durante el almuerzo o merienda.
                            </p>
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
    isUploading,
    isReserveEnabled,
    onReserveToggle
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
    isReserveEnabled?: boolean;
    onReserveToggle?: (val: boolean) => void;
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
                        <input type="file" id={fileInputId} className="hidden" accept="image/*" onChange={handleFileSelect} disabled={isUploading} />
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
                    {silo.id === 'reserva' && (
                        <>
                            <Separator />
                            <div className="flex items-center justify-between py-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="reserve-silo-toggle" className="text-sm font-medium">Alimentacion dedicada M4</Label>
                                    <p className="text-[10px] text-muted-foreground">
                                        Si se desactiva, no ingresarÃ¡ azÃºcar a este silo durante la simulaciÃ³n.
                                    </p>
                                </div>
                                <Switch
                                    id="reserve-silo-toggle"
                                    checked={isReserveEnabled}
                                    onCheckedChange={onReserveToggle}
                                />
                            </div>
                        </>
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
                            <Input id={`wrapper-capacity-${wrapper.id}`} type="number" value={editedWrapper.capacity} onChange={e => handleFieldChange('capacity', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`wrapper-units-${wrapper.id}`} className="text-xs">Unidades/Fardo</Label>
                            <Input id={`wrapper-units-${wrapper.id}`} type="number" value={editedWrapper.unitsPerBundle} onChange={e => handleFieldChange('unitsPerBundle', Number(e.target.value))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`wrapper-delay-${wrapper.id}`} className="text-xs">Retraso (seg)</Label>
                            <Input id={`wrapper-delay-${wrapper.id}`} type="number" value={editedWrapper.conveyorDelay} onChange={e => handleFieldChange('conveyorDelay', Number(e.target.value))} />
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
function ProductionProjectionView({
    onClose,
    machines,
    products,
}: {
    onClose: () => void;
    machines: MachineState[];
    products: ProductDefinition[];
}) {
    const { toast } = useToast();
    const router = useRouter();
    const currentYear = new Date().getFullYear();
    const [season, setSeason] = React.useState<'zafra' | 'no-zafra'>('zafra');
    const [viewMode, setViewMode] = React.useState<'semana' | 'dia' | 'mes'>('dia');
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [zafraStartDate, setZafraStartDate] = React.useState<string>(`${currentYear}-08-01`);
    const [zafraEndDate, setZafraEndDate] = React.useState<string>(`${currentYear}-12-15`);
    const [projectionMode, setProjectionMode] = React.useState<'auto' | 'manual'>('auto');
    const [isCopilotOpen, setIsCopilotOpen] = React.useState(false);
    const [isAgentViewOpen, setIsAgentViewOpen] = React.useState(false);

    const [rendimiento, setRendimiento] = React.useState<number>(0.8);
    const [horasTurnoDia, setHorasTurnoDia] = React.useState<number>(10.5);
    const [horasTurnoNoche, setHorasTurnoNoche] = React.useState<number>(10.5);
    const [dailySupply, setDailySupply] = React.useState<number>(3500);
    const [isGranelActive, setIsGranelActive] = React.useState<boolean>(false);
    const [granelSpeed, setGranelSpeed] = React.useState<number>(100);
    const [laborType, setLaborType] = React.useState<'contractor' | 'staff'>('contractor');
    const [fixedDayRate, setFixedDayRate] = React.useState<number>(29);
    const [fixedNightRate, setFixedNightRate] = React.useState<number>(35);
    const [activeSnapshotId, setActiveSnapshotId] = React.useState<string | null>(null);
    const [activeSnapshotName, setActiveSnapshotName] = React.useState<string | null>(null);
    const [activeSnapshotDate, setActiveSnapshotDate] = React.useState<any | null>(null);
    const [isReadOnly, setIsReadOnly] = React.useState(false);

    const [customMachineDays, setCustomMachineDays] = React.useState<Record<string, number>>({});
    const [customActiveDays, setCustomActiveDays] = React.useState<Record<string, boolean>>({});

    const [aiScenarios, setAiScenarios] = React.useState<any[] | null>(null);
    const [overrides, setOverrides] = React.useState<Record<string, { productId?: string, speed?: number, inactive?: boolean }>>({});
    const [syncContinuity, setSyncContinuity] = React.useState(true);

    const [editingOverride, setEditingOverride] = React.useState<{
        key: string;
        machineId: number;
        title: string;
        shift: 'dia' | 'noche';
        currentProductId: string;
        currentSpeed: number;
        inactive?: boolean;
        isRange?: boolean;
        startDate?: string;
        endDate?: string;
        inactiveDays?: Record<string, boolean>;
        isToggleMode?: boolean;
        applyToBothShifts?: boolean;
        syncWithNight?: boolean;
    } | null>(null);

    const [isSaveSnapshotOpen, setIsSaveSnapshotOpen] = React.useState(false);
    const [snapshotName, setSnapshotName] = React.useState('');
    const [isSavingSnapshot, setIsSavingSnapshot] = React.useState(false);
    const [isRenameOpen, setIsRenameOpen] = React.useState(false);
    const [renameId, setRenameId] = React.useState('');
    const [renameName, setRenameName] = React.useState('');
    const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
    const [isSummaryView, setIsSummaryView] = React.useState(false);
    const [isPDFModalOpen, setIsPDFModalOpen] = React.useState(false);
    const [snapshots, setSnapshots] = React.useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

    const fetchHistory = React.useCallback(async () => {
        setIsLoadingHistory(true);
        try {
            const q = query(collection(db, 'projectionSnapshots'), orderBy('name', 'asc'), limit(50));
            const querySnapshot = await getDocs(q);
            const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSnapshots(docs);
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    React.useEffect(() => {
        if (isHistoryOpen) {
            fetchHistory();
        }
    }, [isHistoryOpen, fetchHistory]);

    // Ocultar scrollbar del navegador solo para esta vista
    React.useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    const loadSnapshot = (snapshot: any, readOnly: boolean = true) => {
        const { config } = snapshot;
        if (config.season) setSeason(config.season);
        if (config.zafraStartDate !== undefined) setZafraStartDate(config.zafraStartDate);
        if (config.zafraEndDate !== undefined) setZafraEndDate(config.zafraEndDate);
        if (config.zafraStartMonth !== undefined && config.zafraStartDate === undefined) {
            setZafraStartDate(`${currentYear}-${(config.zafraStartMonth + 1).toString().padStart(2, '0')}-01`);
        }
        if (config.zafraEndMonth !== undefined && config.zafraEndDate === undefined) {
            setZafraEndDate(`${currentYear}-${(config.zafraEndMonth + 1).toString().padStart(2, '0')}-28`);
        }
        if (config.rendimiento !== undefined) setRendimiento(config.rendimiento);
        if (config.horasTurnoDia !== undefined) setHorasTurnoDia(config.horasTurnoDia);
        if (config.horasTurnoNoche !== undefined) setHorasTurnoNoche(config.horasTurnoNoche);
        if (config.dailySupply !== undefined) setDailySupply(config.dailySupply);
        if (config.isGranelActive !== undefined) setIsGranelActive(config.isGranelActive);
        if (config.laborType !== undefined) setLaborType(config.laborType);
        if (config.fixedDayRate !== undefined) setFixedDayRate(config.fixedDayRate);
        if (config.fixedNightRate !== undefined) setFixedNightRate(config.fixedNightRate);
        if (config.customMachineDays) setCustomMachineDays(config.customMachineDays);
        if (config.customActiveDays) setCustomActiveDays(config.customActiveDays);
        if (config.overrides) setOverrides(config.overrides);
        if (config.syncContinuity !== undefined) setSyncContinuity(config.syncContinuity);
        if (config.machineConfig) setMachineConfig(config.machineConfig);
        if (config.projectionMode) setProjectionMode(config.projectionMode);
        if (config.plannedGoals) setPlannedGoals(config.plannedGoals);
        if (config.plannedSpeeds) setPlannedSpeeds(config.plannedSpeeds);

        setActiveSnapshotId(snapshot.id);
        setActiveSnapshotName(snapshot.name);
        setActiveSnapshotDate(snapshot.updatedAt || snapshot.createdAt);
        setIsReadOnly(readOnly);

        toast({
            title: readOnly ? "Escenario cargado (Lectura)" : "Escenario cargado",
            description: `Se cargó el escenario "${snapshot.name}"`,
            duration: 3000
        });
        setIsHistoryOpen(false);
    };

    const handleSaveSnapshot = async (customName?: string) => {
        const isUpdate = !!activeSnapshotId && !customName;
        const nameToUse = (customName || (isUpdate ? (activeSnapshotName || '') : snapshotName)).trim().toUpperCase();

        if (!nameToUse) {
            toast({ title: "Nombre requerido", description: "Por favor asigna un nombre al escenario", variant: "destructive" });
            return;
        }

        setIsSavingSnapshot(true);
        try {
            const snapshotData = {
                name: nameToUse,
                updatedAt: serverTimestamp(),
                config: {
                    season,
                    zafraStartDate,
                    zafraEndDate,
                    rendimiento,
                    horasTurnoDia,
                    horasTurnoNoche,
                    customMachineDays,
                    customActiveDays,
                    overrides,
                    syncContinuity,
                    machineConfig,
                    projectionMode,
                    plannedGoals,
                    dailySupply,
                    isGranelActive,
                    laborType,
                    fixedDayRate,
                    fixedNightRate
                },
                summary: {
                    totalQQ: totalFamiliarQQ + totalGranelQQ
                }
            };

            if (isUpdate) {
                await updateDoc(doc(db, 'projectionSnapshots', activeSnapshotId), snapshotData);
                toast({ title: "Escenario actualizado", description: `El escenario "${activeSnapshotName}" se actualizó correctamente.` });
            } else {
                const docRef = await addDoc(collection(db, 'projectionSnapshots'), { ...snapshotData, createdAt: serverTimestamp() });
                setActiveSnapshotId(docRef.id);
                setActiveSnapshotName(nameToUse);
                setActiveSnapshotDate(new Date());
                toast({ title: "Escenario guardado", description: `El escenario "${nameToUse}" se guardó correctamente.` });
            }

            setIsSaveSnapshotOpen(false);
            setSnapshotName('');
            fetchHistory();
        } catch (error) {
            console.error("Error saving snapshot:", error);
            toast({ title: "Error al guardar", description: "No se pudo guardar el escenario.", variant: "destructive" });
        } finally {
            setIsSavingSnapshot(false);
        }
    };

    const handleDeleteSnapshot = async (e: React.MouseEvent, snapshotId: string) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de que deseas eliminar este escenario?')) return;

        try {
            await deleteDoc(doc(db, 'projectionSnapshots', snapshotId));
            toast({ title: "Escenario eliminado", description: "El escenario se eliminó correctamente." });
            fetchHistory();
        } catch (error) {
            console.error("Error deleting snapshot:", error);
            toast({ title: "Error al eliminar", description: "No se pudo eliminar el escenario.", variant: "destructive" });
        }
    };

    const handleGeneratePDF = async (requestedMode: 'dia' | 'semana' | 'visual') => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Título y Encabezado
        doc.setFontSize(22);
        doc.setTextColor(0, 51, 153);
        doc.text('CONTROL 7 - REPORTE DE PROYECCIÓN', 10, 15);

        doc.setFontSize(9);
        doc.setTextColor(100);
        const now = new Date();
        doc.text(`Generado el: ${format(now, 'dd/MM/yyyy HH:mm')}`, 10, 22);
        if (activeSnapshotName) {
            doc.text(`Escenario Actual: ${activeSnapshotName}`, 130, 22);
        }

        // Sección de Resumen
        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text('Resumen de Operación', 10, 32);

        const summaryData = [
            ['Producción Proyectada', `${(totalFamiliarQQ + totalGranelQQ).toLocaleString(undefined, { maximumFractionDigits: 2 })} QQ`],
            ['Producción Planificada', `${totalPlannedQQ.toLocaleString(undefined, { maximumFractionDigits: 2 })} QQ`],
            ['Porcentaje de Cumplimiento', `${fulfillmentPct.toFixed(1)}%`],
            ['Costo Total Mano de Obra', `$ ${laborStats.totalCosto.toLocaleString(undefined, { maximumFractionDigits: 2 })}`]
        ];

        autoTable(doc, {
            startY: 35,
            head: [['Indicador de Rendimiento', 'Valor Proyectado']],
            body: summaryData,
            theme: 'striped',
            headStyles: { fillColor: [0, 82, 155], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9 },
            margin: { left: 10 },
            tableWidth: 120
        });

        // Parámetros de Simulación
        doc.text('Parámetros de Simulación', 145, 32);
        const configData = [
            ['Temporada', season === 'zafra' ? 'Zafra' : 'No Zafra'],
            ['Rendimiento Global', `${(rendimiento * 100).toFixed(1)}%`],
            ['Horas Turno Día', `${horasTurnoDia}h`],
            ['Horas Turno Noche', `${horasTurnoNoche}h`]
        ];

        autoTable(doc, {
            startY: 35,
            head: [['Parámetro Configurado', 'Valor']],
            body: configData,
            theme: 'grid',
            headStyles: { fillColor: [80, 80, 80], fontSize: 9 },
            bodyStyles: { fontSize: 9 },
            margin: { left: 145 },
            tableWidth: 120
        });

        // Tabla Detallada o Gráficos
        const lastY = (doc as any).lastAutoTable.finalY || 100;

        if (requestedMode === 'visual') {
            const sections = [
                { id: 'pdf-cards-container', title: 'Resumen Ejecutivo de Operación' },
                { id: 'pdf-resumen-container', title: 'Resumen Detallado por Presentación' },
                { id: 'reporte-consolidado-grafico-pdf', title: 'Análisis Visual de Balances de Producción' },
                { id: 'labor-weekly-chart-pdf', title: 'Proyección de Mano de Obra' }
            ];

            // Mayor retraso para asegurar renderizado completo de gráficos y fuentes
            await new Promise(resolve => setTimeout(resolve, 1500));

            for (let i = 0; i < sections.length; i++) {
                const section = sections[i];
                const element = document.getElementById(section.id);

                if (element) {
                    // Si no es la primera sección, añadir página nueva
                    if (i > 0) {
                        doc.addPage();
                        // Encabezado de página
                        doc.setFontSize(18);
                        doc.setTextColor(0, 51, 153);
                        doc.text('CONTROL 7 - REPORTE VISUAL', 10, 15);

                        doc.setFontSize(8);
                        doc.setTextColor(150);
                        doc.text(`Generado: ${format(now, 'dd/MM/yyyy')} | Página ${i + 1}`, doc.internal.pageSize.width - 60, 15);

                        doc.setDrawColor(0, 51, 153);
                        doc.setLineWidth(0.5);
                        doc.line(10, 18, doc.internal.pageSize.width - 10, 18);
                    }

                    const canvas = await html2canvas(element as HTMLElement, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        windowWidth: 1400,
                        onclone: (clonedDoc) => {
                            const clonedEl = clonedDoc.getElementById(section.id);
                            if (clonedEl) {
                                clonedEl.style.height = 'auto';
                                clonedEl.style.overflow = 'visible';
                            }
                        }
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);

                    const marginX = 10;
                    const startY = (i === 0) ? (lastY + 22) : 30;
                    const pdfWidth = doc.internal.pageSize.getWidth() - (marginX * 2);
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    const maxAvailableHeight = doc.internal.pageSize.getHeight() - startY - 15;
                    let finalPdfWidth = pdfWidth;
                    let finalPdfHeight = pdfHeight;

                    // Solo escalar si realmente no cabe en la hoja
                    if (finalPdfHeight > maxAvailableHeight) {
                        const scale = maxAvailableHeight / finalPdfHeight;
                        finalPdfHeight = maxAvailableHeight;
                        finalPdfWidth = finalPdfWidth * scale;
                    }

                    doc.setFontSize(14);
                    doc.setTextColor(0);
                    doc.setFont('helvetica', 'bold');
                    doc.text(section.title, marginX, startY - 8);
                    doc.addImage(imgData, 'PNG', marginX + (pdfWidth - finalPdfWidth) / 2, startY, finalPdfWidth, finalPdfHeight);

                    // Pie de página
                    doc.setDrawColor(200);
                    doc.setLineWidth(0.1);
                    doc.line(10, doc.internal.pageSize.height - 15, doc.internal.pageSize.width - 10, doc.internal.pageSize.height - 15);
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(150);
                    doc.text('Control 7 - Sistema de Gestión de Producción', 14, doc.internal.pageSize.height - 10);
                    doc.text(`Página ${i + 1}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
                }
            }

            doc.save(`Control7_Reporte_Visual_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);

            toast({
                title: "Reporte Visual Generado",
                description: "Se han exportado 2 páginas con los gráficos de producción y mano de obra.",
            });
            return;
        }

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text('Detalle de Proyección por Máquina', 14, lastY + 15);

        const activeMachinesList = machines.filter(m => machineConfig[m.id]?.active);
        const headRows: any[] = [];

        // Primera fila de cabecera: Máquinas
        const machineHeaderRow = [
            { content: 'Tiempo', colSpan: requestedMode === 'dia' ? 3 : 2, styles: { halign: 'center', fillColor: [44, 62, 80] } }
        ];
        activeMachinesList.forEach(m => {
            machineHeaderRow.push({ content: `Máquina #${m.id}`, colSpan: 2, styles: { halign: 'center', fillColor: [44, 62, 80] } } as any);
        });
        machineHeaderRow.push({ content: 'Totales de Producción', colSpan: 3, styles: { halign: 'center', fillColor: [44, 62, 80] } } as any);
        headRows.push(machineHeaderRow);

        // Segunda fila de cabecera: Turnos
        const shiftHeaderRow: any[] = [
            { content: 'Mes', styles: { fillColor: [52, 73, 94] } },
            { content: requestedMode === 'dia' ? 'S' : 'W', styles: { fillColor: [52, 73, 94] } }
        ];
        if (requestedMode === 'dia') shiftHeaderRow.push({ content: 'Fecha', styles: { fillColor: [52, 73, 94] } });

        activeMachinesList.forEach(() => {
            shiftHeaderRow.push({ content: 'Día', styles: { halign: 'center', fillColor: [52, 73, 94] } });
            shiftHeaderRow.push({ content: 'Noche', styles: { halign: 'center', fillColor: [52, 73, 94] } });
        });
        shiftHeaderRow.push({ content: 'Familiar QQ', styles: { halign: 'center', fillColor: [52, 73, 94] } });
        shiftHeaderRow.push({ content: 'Granel QQ', styles: { halign: 'center', fillColor: [52, 73, 94] } });
        shiftHeaderRow.push({ content: 'TOTAL PRODUCIDO', styles: { halign: 'center', fillColor: [109, 40, 217] } });
        headRows.push(shiftHeaderRow);

        const bodyRows: any[] = [];

        groupedWeeks.forEach(group => {
            group.weeks.forEach(week => {
                if (requestedMode === 'semana') {
                    const row: any[] = [group.monthName.substring(0, 3), `W${week.weekNum}`];
                    let weekTotalQQ = 0;
                    let weekMaxDays = 0;

                    activeMachinesList.forEach(m => {
                        const conf = machineConfig[m.id];
                        const machineAutoDays = week.days.reduce((total, d) => {
                            const dateStr = d.toISOString().split('T')[0];
                            if (customActiveDays[dateStr] === false) return total;
                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];
                            const isInactiveD = oD?.inactive || (!oD);
                            const isInactiveN = oN?.inactive || (!oN);
                            return total + ((!isInactiveD || !isInactiveN) ? 1 : 0);
                        }, 0);

                        const machineDays = customMachineDays[`${m.id}-${week.weekNum}`] !== undefined
                            ? customMachineDays[`${m.id}-${week.weekNum}`]
                            : machineAutoDays;

                        weekMaxDays = Math.max(weekMaxDays, machineDays);
                        const scalingFactor = machineAutoDays > 0 ? machineDays / machineAutoDays : 0;

                        let weekDiaQQ = 0;
                        let weekNocQQ = 0;

                        week.days.forEach(day => {
                            const dateStr = day.toISOString().split('T')[0];
                            if (customActiveDays[dateStr] === false) return;
                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];
                            const pD = products.find(p => p.id === (oD?.productId || conf.productId)) || products[0];
                            const pN = products.find(p => p.id === (oN?.productId || conf.productId)) || products[0];
                            const sD = oD?.speed || conf.speed || 38;
                            const sN = oN?.speed || conf.speed || 38;

                            if (!oD?.inactive && (!!oD)) {
                                weekDiaQQ += ((sD * 60) * rendimiento * horasTurnoDia * (pD.presentationWeight || 50)) / 50;
                            }
                            if (!oN?.inactive && (!!oN)) {
                                weekNocQQ += ((sN * 60) * rendimiento * horasTurnoNoche * (pN.presentationWeight || 50)) / 50;
                            }
                        });

                        row.push(`${(weekDiaQQ * scalingFactor).toFixed(1)}`);
                        row.push(`${(weekNocQQ * scalingFactor).toFixed(1)}`);
                        weekTotalQQ += (weekDiaQQ + weekNocQQ) * scalingFactor;
                    });

                    row.push(`${weekTotalQQ.toFixed(1)}`);
                    row.push(`${((dailySupply * weekMaxDays) - weekTotalQQ).toFixed(1)}`);
                    row.push(`${(dailySupply * weekMaxDays).toFixed(1)}`);
                    bodyRows.push(row);
                } else {
                    week.days.forEach(day => {
                        const dateStr = day.toISOString().split('T')[0];
                        const isActive = customActiveDays[dateStr] !== false;
                        const row: any[] = [group.monthName.substring(0, 3), `S${week.weekNum}`, format(day, 'dd/MM')];

                        let dayTotalQQ = 0;

                        activeMachinesList.forEach(m => {
                            if (!isActive) {
                                row.push('-');
                                row.push('-');
                                return;
                            }
                            const conf = machineConfig[m.id];
                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];
                            const pD = products.find(p => p.id === (oD?.productId || conf.productId)) || products[0];
                            const pN = products.find(p => p.id === (oN?.productId || conf.productId)) || products[0];
                            const sD = oD?.speed || conf.speed || 38;
                            const sN = oN?.speed || conf.speed || 38;

                            const qqDia = (!oD?.inactive && (!!oD)) ? ((sD * 60) * rendimiento * horasTurnoDia * (pD.presentationWeight || 50)) / 50 : 0;
                            const qqNoc = (!oN?.inactive && (!!oN)) ? ((sN * 60) * rendimiento * horasTurnoNoche * (pN.presentationWeight || 50)) / 50 : 0;

                            row.push(qqDia > 0 ? qqDia.toFixed(1) : '0');
                            row.push(qqNoc > 0 ? qqNoc.toFixed(1) : '0');
                            dayTotalQQ += (qqDia + qqNoc);
                        });

                        row.push(isActive ? dayTotalQQ.toFixed(1) : '0');
                        row.push(isActive ? (dailySupply - dayTotalQQ).toFixed(1) : '0');
                        row.push(isActive ? dailySupply.toFixed(1) : '0');
                        bodyRows.push(row);
                    });
                }
            });
        });

        autoTable(doc, {
            startY: lastY + 20,
            head: headRows,
            body: bodyRows,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold' },
                1: { halign: 'center' }
            },
            headStyles: { fontSize: 8, fontStyle: 'bold' },
            didDrawPage: (data) => {
                // Pie de página
                doc.setFontSize(8);
                doc.setTextColor(150);
                const str = `Página ${data.pageNumber}`;
                doc.text(str, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
                doc.text('Control 7 - Sistema de Gestión de Producción', 14, doc.internal.pageSize.height - 10);
            }
        });

        doc.save(`Reporte_Proyeccion_${activeSnapshotName || 'Industrial'}_${format(now, 'yyyyMMdd')}.pdf`);

        toast({
            title: "Reporte generado",
            description: "El PDF se ha descargado correctamente.",
        });
    };

    const handleRenameSnapshot = (e: React.MouseEvent, snapshotId: string, currentName: string) => {
        e.stopPropagation();
        setRenameId(snapshotId);
        setRenameName(currentName.toUpperCase());
        setIsRenameOpen(true);
    };

    const confirmRename = async () => {
        if (!renameName.trim() || !renameId) return;
        const nameToUse = renameName.trim().toUpperCase();

        try {
            await updateDoc(doc(db, 'projectionSnapshots', renameId), { name: nameToUse });
            toast({ title: "Escenario renombrado", description: "El nombre se actualizó correctamente." });
            fetchHistory();
            setIsRenameOpen(false);
        } catch (error) {
            console.error("Error renaming snapshot:", error);
            toast({ title: "Error al renombrar", description: "No se pudo actualizar el nombre.", variant: "destructive" });
        }
    };



    const [machineConfig, setMachineConfig] = React.useState<Record<number, { active: boolean, productId: string, speed: number }>>({});
    const [plannedGoals, setPlannedGoals] = React.useState<Record<string, number>>({});
    const [plannedSpeeds, setPlannedSpeeds] = React.useState<Record<string, number>>({});
    const [isViewConfigModalOpen, setIsViewConfigModalOpen] = React.useState(false);
    const [isGoalsModalOpen, setIsGoalsModalOpen] = React.useState(false);
    const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({
        temporada: true,
        proyeccion: true,
        parametros: true,
        envasadoras: true,
        manoDeObra: true,
        combinaciones: true
    });
    const [safeCombinations, setSafeCombinations] = React.useState<any[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('safeCombinations');
            if (saved) return JSON.parse(saved);
        }
        return [
            { id: 's1', m1: '500 g Fardo DA', m2: '500 g Fardo DA', m3: '5 kg Saco SJ', m4: 'Apagada', label: 'Pesado + Mini' },
            { id: 's2', m1: '1 kg Fardo DA', m2: '1 kg Fardo DA', m3: 'Apagada', m4: 'Apagada', label: 'Doble 1kg Fardo' },
            { id: 's3', m1: '1 kg Saco DA', m2: '1 kg Saco DA', m3: '1 kg Saco DA', m4: 'Apagada', label: 'Triple 1kg Saco' },
            { id: 's4', m1: '1 kg Fardo DA', m2: '500 g Fardo DA', m3: '2 kg Saco SJ', m4: 'Apagada', label: 'Mediano' },
            { id: 's5', m1: '1 kg Fardo DA', m2: 'Apagada', m3: '2 kg Saco SJ', m4: 'Apagada', label: 'Doble 2kg' },
            { id: 's9', m1: '1 kg Fardo DA', m2: '500 g Fardo DA', m3: '5 kg Saco SJ', m4: 'Apagada', label: 'Seguro' }
        ];
    });
    const [prohibitedCombinations, setProhibitedCombinations] = React.useState<any[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('prohibitedCombinations');
            if (saved) return JSON.parse(saved);
        }
        return [
            { id: 'p1', m1: '1 kg Fardo DA', m2: '1 kg Fardo SJ', m3: '5 kg Saco SJ', m4: '(Cualquiera)', label: 'Exceso de Flujo' },
            { id: 'p2', m1: '1 kg Fardo DA', m2: '2 kg Saco SJ', m3: '5 kg Saco SJ', m4: '(Cualquiera)', label: 'Exceso de Flujo' },
            { id: 'p3', m1: '2 kg Saco SJ', m2: '2 kg Saco SJ', m3: '5 kg Saco SJ', m4: '(Cualquiera)', label: 'Fatal Suministro' },
            { id: 'p4', m1: '(Cualquiera)', m2: '(Cualquiera)', m3: '500 g Fardo DA', m4: '(Cualquiera)', label: 'M3 no procesa 500g' },
            { id: 'p5', m1: '5 kg Saco SJ', m2: '(Cualquiera)', m3: '(Cualquiera)', m4: '(Cualquiera)', label: 'Solo M3 hace 5kg' },
            { id: 'p6', m1: '2 kg Saco SJ', m2: '2 kg Saco SJ', m3: '2 kg Saco SJ', m4: '(Cualquiera)', label: 'Exceso de Flujo' },
            { id: 'p7', m1: '1 kg Fardo DA', m2: '1 kg Fardo SJ', m3: '(Cualquiera)', m4: '(Cualquiera)', label: 'Mezcla Marcas Fardo' }
        ];
    });
    const [isComboModalOpen, setIsComboModalOpen] = React.useState(false);
    const [activeScenarioName, setActiveScenarioName] = React.useState<string | null>(null);

    const classifyProduct = (name: string): string => {
        if (!name || name === 'Apagada') return 'Apagada';
        if (name === '(Cualquiera)') return '(Cualquiera)';
        const nl = name.toLowerCase();

        const is1kg = nl.includes('1 kg');
        const is2kg = nl.includes('2 kg');
        const is5kg = nl.includes('5 kg');
        const is500g = nl.includes('500 g');
        const isFardo = nl.includes('12 kg');
        const isSaco = nl.includes('50 kg') || nl.includes('25 kg');
        const isDA = nl.includes('don antonio');
        const isSJ = nl.includes('san juan');

        if (is1kg && isFardo && isDA) return '1 kg Fardo DA';
        if (is1kg && isFardo && isSJ) return '1 kg Fardo SJ';
        if (is1kg && isSaco && isDA) return '1 kg Saco DA';
        if (is1kg && isSaco && isSJ) return '1 kg Saco SJ';
        if (is2kg && isSJ) return '2 kg Saco SJ';
        if (is5kg && isSJ) return '5 kg Saco SJ';
        if (is500g && isFardo) return '500 g Fardo DA';
        if (is500g && nl.includes('25 kg')) return '500 g Saco SJ'; // Basado en la captura

        return name; // Fallback
    };

    // Función para generar etiquetas automáticas basadas en la combinación
    const generateAutoLabel = (m1: string, m2: string, m3: string, m4: string, isProhibited: boolean) => {
        const valM1 = classifyProduct(m1);
        const valM2 = classifyProduct(m2);
        const valM3 = classifyProduct(m3);
        const valM4 = classifyProduct(m4);

        const parts = [valM1, valM2, valM3, valM4].filter(x => x !== 'Apagada' && x !== '(Cualquiera)');
        if (parts.length === 0) return 'Estado Libre / Apagado';

        // Detección de mezcla de marcas en fardos
        const isFardoDA = (s: string) => s.includes('Fardo DA');
        const isFardoSJ = (s: string) => s.includes('Fardo SJ');
        const hasDA = [valM1, valM2, valM3].some(isFardoDA);
        const hasSJ = [valM1, valM2, valM3].some(isFardoSJ);

        if (hasDA && hasSJ) {
            return isProhibited ? "VETO: Mezcla de marcas en fardos" : "Mezcla de Marcas";
        }

        // Detección de pesos para reglas de flujo (simplificada con las nuevas etiquetas)
        const is1kg = (s: string) => s.includes('1 kg');
        const is5kg = (s: string) => s.includes('5 kg');

        const count1 = [valM1, valM2, valM3, valM4].filter(is1kg).length;
        const count5 = [valM1, valM2, valM3, valM4].filter(is5kg).length;

        if (count1 >= 2 && count5 >= 1) {
            return isProhibited ? "VETO 1-1-5: Exceso de flujo crítico" : "Flujo Máximo Autorizado";
        }

        return parts.join(' + ');
    };

    React.useEffect(() => {
        localStorage.setItem('safeCombinations', JSON.stringify(safeCombinations));
        localStorage.setItem('prohibitedCombinations', JSON.stringify(prohibitedCombinations));
    }, [safeCombinations, prohibitedCombinations]);
    const [lastUsedSpeed, setLastUsedSpeed] = React.useState<number | null>(null);
    const [granelDisplayMode, setGranelDisplayMode] = React.useState<'split' | 'combined'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('granelDisplayMode') as 'split' | 'combined') || 'combined';
        }
        return 'combined';
    });
    const [machinesDisplayMode, setMachinesDisplayMode] = React.useState<'combined' | 'individual'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('machinesDisplayMode') as 'combined' | 'individual') || 'individual';
        }
        return 'individual';
    });
    React.useEffect(() => {
        localStorage.setItem('granelDisplayMode', granelDisplayMode);
    }, [granelDisplayMode]);
    React.useEffect(() => {
        localStorage.setItem('machinesDisplayMode', machinesDisplayMode);
    }, [machinesDisplayMode]);



    // AUTO-HIDE SIDEBAR 2 SECONDS AFTER LAST INTERACTION WITH IT
    React.useEffect(() => {
        if (!isSidebarOpen || isComboModalOpen || isGoalsModalOpen || isViewConfigModalOpen) return;

        let timeoutId: any;

        const handleInteraction = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                setIsSidebarOpen(false);
            }, 2000);
        };

        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) {
            sidebar.addEventListener('mousedown', handleInteraction);
            sidebar.addEventListener('keydown', handleInteraction);
            sidebar.addEventListener('touchstart', handleInteraction);
            sidebar.addEventListener('mousemove', handleInteraction);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (sidebar) {
                sidebar.removeEventListener('mousedown', handleInteraction);
                sidebar.removeEventListener('keydown', handleInteraction);
                sidebar.removeEventListener('touchstart', handleInteraction);
                sidebar.removeEventListener('mousemove', handleInteraction);
            }
        };
    }, [isSidebarOpen, isComboModalOpen, isGoalsModalOpen, isViewConfigModalOpen]);

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    const [isDataLoaded, setIsDataLoaded] = React.useState(false);

    // PERSISTENCE LOAD
    React.useEffect(() => {
        const saved = localStorage.getItem('production_projection_data');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.season) setSeason(data.season);
                if (data.viewMode) setViewMode(data.viewMode);
                if (data.zafraStartDate !== undefined) setZafraStartDate(data.zafraStartDate);
                if (data.zafraEndDate !== undefined) setZafraEndDate(data.zafraEndDate);
                if (data.zafraStartMonth !== undefined && data.zafraStartDate === undefined) {
                    setZafraStartDate(`${currentYear}-${(data.zafraStartMonth + 1).toString().padStart(2, '0')}-01`);
                }
                if (data.zafraEndMonth !== undefined && data.zafraEndDate === undefined) {
                    setZafraEndDate(`${currentYear}-${(data.zafraEndMonth + 1).toString().padStart(2, '0')}-28`);
                }
                if (data.rendimiento !== undefined) setRendimiento(data.rendimiento);
                if (data.horasTurnoDia !== undefined) setHorasTurnoDia(data.horasTurnoDia);
                if (data.horasTurnoNoche !== undefined) setHorasTurnoNoche(data.horasTurnoNoche);
                if (data.customMachineDays) setCustomMachineDays(data.customMachineDays);
                if (data.customActiveDays) setCustomActiveDays(data.customActiveDays);
                if (data.overrides) setOverrides(data.overrides);
                if (data.syncContinuity !== undefined) setSyncContinuity(data.syncContinuity);
                if (data.machineConfig) setMachineConfig(data.machineConfig);
                if (data.projectionMode) setProjectionMode(data.projectionMode);
                if (data.plannedGoals) setPlannedGoals(data.plannedGoals);
                if (data.plannedSpeeds) setPlannedSpeeds(data.plannedSpeeds);
                if (data.dailySupply !== undefined) setDailySupply(data.dailySupply);
                if (data.isGranelActive !== undefined) setIsGranelActive(data.isGranelActive);
                if (data.lastUsedSpeed !== undefined) setLastUsedSpeed(data.lastUsedSpeed);
                if (data.granelDisplayMode !== undefined) setGranelDisplayMode(data.granelDisplayMode);
                else if (data.tableDisplayMode !== undefined) setGranelDisplayMode(data.tableDisplayMode);
                if (data.laborType !== undefined) setLaborType(data.laborType);
                if (data.fixedDayRate !== undefined) setFixedDayRate(data.fixedDayRate);
                if (data.fixedNightRate !== undefined) setFixedNightRate(data.fixedNightRate);
            } catch (e) {
                console.error("Error loading projection data", e);
            }
        }
        setIsDataLoaded(true);
    }, []);

    // PERSISTENCE SAVE
    React.useEffect(() => {
        if (!isDataLoaded) return;
        const data = {
            season,
            viewMode,
            zafraStartDate,
            zafraEndDate,
            rendimiento,
            horasTurnoDia,
            horasTurnoNoche,
            customMachineDays,
            customActiveDays,
            overrides,
            syncContinuity,
            machineConfig,
            projectionMode,
            plannedGoals,
            dailySupply,
            isGranelActive,
            lastUsedSpeed,
            granelDisplayMode,
            laborType,
            fixedDayRate,
            fixedNightRate,
            plannedSpeeds
        };
        localStorage.setItem('production_projection_data', JSON.stringify(data));
    }, [isDataLoaded, season, viewMode, zafraStartDate, zafraEndDate, rendimiento, horasTurnoDia, horasTurnoNoche, customMachineDays, customActiveDays, overrides, syncContinuity, machineConfig, projectionMode, plannedGoals, plannedSpeeds, dailySupply, isGranelActive, lastUsedSpeed, granelDisplayMode, laborType, fixedDayRate, fixedNightRate]);

    React.useEffect(() => {
        if (isDataLoaded && Object.keys(machineConfig).length === 0 && machines.length > 0) {
            const initial: Record<number, { active: boolean, productId: string, speed: number }> = {};
            machines.forEach(m => {
                initial[m.id] = {
                    active: m.isSimulatingActive && m.productId !== 'inactive',
                    productId: m.productId !== 'inactive' ? m.productId : (products[0]?.id || ''),
                    speed: (m.speed === 0 || m.speed === 30) ? 38 : m.speed
                };
            });
            setMachineConfig(initial);
        }
    }, [isDataLoaded, machines, products, machineConfig]);

    const isDateInZafra = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        if (zafraStartDate <= zafraEndDate) {
            return dateStr >= zafraStartDate && dateStr <= zafraEndDate;
        } else {
            // Case where zafra crosses year boundary (e.g. Nov to Jan)
            return dateStr >= zafraStartDate || dateStr <= zafraEndDate;
        }
    };

    const generateWeeksGroupedByMonth = () => {
        const grouped: { monthIndex: number; monthName: string; weeks: { weekNum: number; start: Date; end: Date; days: Date[] }[] }[] = [];
        let d = new Date(currentYear, 0, 1);
        while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
        let weekNum = 1;
        while (d.getFullYear() === currentYear || (d.getFullYear() === currentYear + 1 && d.getMonth() === 0 && d.getDate() < 4)) {
            const start = new Date(d);
            const end = new Date(d);
            end.setDate(end.getDate() + 6);
            const daysInWeek: Date[] = [];
            for (let i = 0; i < 7; i++) {
                const dayDate = new Date(start);
                dayDate.setDate(dayDate.getDate() + i);

                const isZafraDay = isDateInZafra(dayDate);
                const shouldInclude = (season === 'zafra' && isZafraDay) || (season === 'no-zafra' && !isZafraDay);

                if (shouldInclude) {
                    daysInWeek.push(dayDate);
                }
            }

            if (daysInWeek.length > 0) {
                const midWeek = daysInWeek[Math.floor(daysInWeek.length / 2)];
                const mIndex = midWeek.getMonth();
                let monthGroup = grouped.find(g => g.monthIndex === mIndex);
                if (!monthGroup) {
                    monthGroup = { monthIndex: mIndex, monthName: monthNames[mIndex], weeks: [] };
                    grouped.push(monthGroup);
                }
                monthGroup.weeks.push({ weekNum, start, end, days: daysInWeek });
            }
            d.setDate(d.getDate() + 7);
            weekNum++;
        }
        grouped.sort((a, b) => {
            return a.monthIndex - b.monthIndex;
        });
        return grouped;
    };

    const groupedWeeks = generateWeeksGroupedByMonth();
    const totalWeeksInProjection = groupedWeeks.reduce((acc, group) => acc + group.weeks.length, 0);
    const allWeeks = groupedWeeks.flatMap(g => g.weeks);

    const productionStats = React.useMemo(() => {
        const byProduct: Record<string, {
            qq: number,
            qqDay: number,
            qqNight: number,
            units: number,
            speedSum: number,
            count: number,
            dates: Set<string>,
            supervisors: number,
            operators: number,
            envasadores: number,
            supervisorsDay: number,
            supervisorsNight: number,
            operatorsDay: number,
            operatorsNight: number,
            envasadoresDay: number,
            envasadoresNight: number
        }> = {};
        const byMachine: Record<number, {
            qq: number,
            units: number,
            count: number,
            dates: Set<string>,
            products: Record<string, { qq: number, units: number, shifts: number, dates: Set<string>, weeks: Set<number> }>
        }> = {};
        const byWeek: Record<number, {
            qq: number,
            familiarQQ: number,
            granelQQ: number,
            granelDiaQQ: number,
            granelNocQQ: number,
            totalQQ: number,
            balanceQQ: number,
            productionDays: number,
            granelDays: number,
            days: Record<string, {
                familiarQQ: number,
                granelQQ: number,
                granelDiaQQ: number,
                granelNocQQ: number,
                totalQQ: number,
                balanceQQ: number
            }>
        }> = {};
        const dayShiftProducts: Record<string, { dia: Set<string>, noche: Set<string> }> = {};
        const activeMachines = machines.filter(m => machineConfig[m.id]?.active);

        groupedWeeks.forEach(group => {
            group.weeks.forEach(week => {
                if (!byWeek[week.weekNum]) byWeek[week.weekNum] = { qq: 0, familiarQQ: 0, granelQQ: 0, granelDiaQQ: 0, granelNocQQ: 0, totalQQ: 0, balanceQQ: 0, productionDays: 0, granelDays: 0, days: {} };

                if (viewMode === 'mes') {
                    let weekFamiliarQQ = 0;
                    const weekCalendarDays = week.days.reduce((t, d) => {
                        const dateStr = d.toISOString().split('T')[0];
                        return t + (customActiveDays[dateStr] === false ? 0 : 1);
                    }, 0);
                    let weekMaxDays = 0;

                    activeMachines.forEach(m => {
                        const conf = machineConfig[m.id];
                        if (!conf) return;

                        const machineAutoDays = week.days.reduce((t, d) => {
                            const dateStr = d.toISOString().split('T')[0];
                            if (customActiveDays[dateStr] === false) return t;
                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];
                            const isInactiveD = oD?.inactive || (!oD);
                            const isInactiveN = oN?.inactive || (!oN);
                            return t + ((!isInactiveD || !isInactiveN) ? 1 : 0);
                        }, 0);

                        const machineDays = customMachineDays[`${m.id}-${week.weekNum}`] !== undefined
                            ? customMachineDays[`${m.id}-${week.weekNum}`]
                            : machineAutoDays;

                        const scalingFactor = machineAutoDays > 0 ? machineDays / machineAutoDays : (machineAutoDays === 0 && machineDays > 0 ? 1 : 0);
                        weekMaxDays = Math.max(weekMaxDays, machineDays);

                        const granelMachineDays = customMachineDays[`99-${week.weekNum}`] !== undefined
                            ? customMachineDays[`99-${week.weekNum}`]
                            : 0;
                        weekMaxDays = Math.max(weekMaxDays, granelMachineDays);

                        week.days.forEach(day => {
                            const dateStr = day.toISOString().split('T')[0];
                            if (customActiveDays[dateStr] === false) return;
                            if (!dayShiftProducts[dateStr]) dayShiftProducts[dateStr] = { dia: new Set(), noche: new Set() };
                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];

                            const pIdD = oD?.productId || conf.productId;
                            const pIdN = oN?.productId || conf.productId;
                            const pD = products.find(p => p.id === pIdD) || products[0];
                            const pN = products.find(p => p.id === pIdN) || products[0];
                            const sD = oD?.speed || conf.speed || 38;
                            const sN = oN?.speed || conf.speed || 38;

                            if (!byMachine[m.id]) byMachine[m.id] = { qq: 0, units: 0, count: 0, dates: new Set(), products: {} };

                            const isManualAndNoOverrideD = !oD;
                            if (!oD?.inactive && pD && !isManualAndNoOverrideD) {
                                dayShiftProducts[dateStr].dia.add(pIdD);
                                const qq = ((sD * 60) * rendimiento * horasTurnoDia * (pD.presentationWeight || 50)) / 50 * scalingFactor;
                                const isFardo = pD.primaryPackaging === 'fardo' || !!pD.bundleWeight;
                                const units = isFardo ? (qq * 50) / (pD.bundleWeight || 12) : (qq * 50) / (pD.sackWeight || pD.presentationWeight || 50);

                                if (!byProduct[pIdD]) byProduct[pIdD] = { qq: 0, qqDay: 0, qqNight: 0, units: 0, speedSum: 0, count: 0, dates: new Set(), supervisors: 0, operators: 0, envasadores: 0, supervisorsDay: 0, supervisorsNight: 0, operatorsDay: 0, operatorsNight: 0, envasadoresDay: 0, envasadoresNight: 0 };
                                byProduct[pIdD].qq += qq;
                                byProduct[pIdD].qqDay += qq;
                                byProduct[pIdD].units += units;
                                byProduct[pIdD].speedSum += sD;
                                byProduct[pIdD].count += 1;
                                byProduct[pIdD].dates.add(dateStr);

                                // Labor tracking
                                const isProductAuto = (prod: any) => {
                                    if (!prod) return false;
                                    const name = prod.productName;
                                    return name === "1 kg -Blanca (12 kg) San Juan" || name === "1 kg -Blanca (12 kg) Don Antonio";
                                };

                                byProduct[pIdD].supervisors += 1;
                                byProduct[pIdD].operators += 1;
                                byProduct[pIdD].supervisorsDay += 1;
                                byProduct[pIdD].operatorsDay += 1;
                                if (!isProductAuto(pD)) {
                                    byProduct[pIdD].envasadores += 1;
                                    byProduct[pIdD].envasadoresDay += 1;
                                }

                                byMachine[m.id].qq += qq;
                                byMachine[m.id].units += units;
                                byMachine[m.id].count += 1;
                                byMachine[m.id].dates.add(dateStr);

                                if (!byMachine[m.id].products[pIdD]) byMachine[m.id].products[pIdD] = { qq: 0, units: 0, shifts: 0, dates: new Set(), weeks: new Set() };
                                byMachine[m.id].products[pIdD].qq += qq;
                                byMachine[m.id].products[pIdD].units += units;
                                byMachine[m.id].products[pIdD].shifts += 1;
                                byMachine[m.id].products[pIdD].dates.add(dateStr);
                                byMachine[m.id].products[pIdD].weeks.add(week.weekNum);
                                weekFamiliarQQ += qq;
                            }
                            const isManualAndNoOverrideN = !oN;
                            if (!oN?.inactive && pN && !isManualAndNoOverrideN) {
                                const qq = ((sN * 60) * rendimiento * horasTurnoNoche * (pN.presentationWeight || 50)) / 50 * scalingFactor;
                                const isFardo = pN.primaryPackaging === 'fardo' || !!pN.bundleWeight;
                                const units = isFardo ? (qq * 50) / (pN.bundleWeight || 12) : (qq * 50) / (pN.sackWeight || pN.presentationWeight || 50);

                                if (!byProduct[pIdN]) byProduct[pIdN] = { qq: 0, qqDay: 0, qqNight: 0, units: 0, speedSum: 0, count: 0, dates: new Set(), supervisors: 0, operators: 0, envasadores: 0, supervisorsDay: 0, supervisorsNight: 0, operatorsDay: 0, operatorsNight: 0, envasadoresDay: 0, envasadoresNight: 0 };
                                byProduct[pIdN].qq += qq;
                                byProduct[pIdN].qqNight += qq;
                                byProduct[pIdN].units += units;
                                byProduct[pIdN].speedSum += sN;
                                byProduct[pIdN].count += 1;
                                byProduct[pIdN].dates.add(dateStr);

                                // Labor tracking
                                const isProductAutoN = (prod: any) => {
                                    if (!prod) return false;
                                    const name = prod.productName;
                                    return name === "1 kg -Blanca (12 kg) San Juan" || name === "1 kg -Blanca (12 kg) Don Antonio";
                                };

                                byProduct[pIdN].supervisors += 1;
                                byProduct[pIdN].operators += 1;
                                byProduct[pIdN].supervisorsNight += 1;
                                byProduct[pIdN].operatorsNight += 1;
                                if (!isProductAutoN(pN)) {
                                    byProduct[pIdN].envasadores += 1;
                                    byProduct[pIdN].envasadoresNight += 1;
                                }

                                byMachine[m.id].qq += qq;
                                byMachine[m.id].units += units;
                                byMachine[m.id].count += 1;
                                byMachine[m.id].dates.add(dateStr);

                                if (!byMachine[m.id].products[pIdN]) byMachine[m.id].products[pIdN] = { qq: 0, units: 0, shifts: 0, dates: new Set(), weeks: new Set() };
                                byMachine[m.id].products[pIdN].qq += qq;
                                byMachine[m.id].products[pIdN].units += units;
                                byMachine[m.id].products[pIdN].shifts += 1;
                                byMachine[m.id].products[pIdN].dates.add(dateStr);
                                byMachine[m.id].products[pIdN].weeks.add(week.weekNum);
                                weekFamiliarQQ += qq;
                            }
                        });
                    });

                    let granelDiaWeight = 0;
                    let granelNocWeight = 0;
                    week.days.forEach(d => {
                        const dateStr = d.toISOString().split('T')[0];
                        if (customActiveDays[dateStr] === false) return;
                        const oD = overrides[`99-${dateStr}-dia`];
                        const oN = overrides[`99-${dateStr}-noche`];
                        if (!(oD?.inactive || (!oD))) granelDiaWeight += 0.5;
                        if (!(oN?.inactive || (!oN))) granelNocWeight += 0.5;
                    });

                    const granelAutoDays = granelDiaWeight + granelNocWeight;
                    const granelMachineDays = customMachineDays[`99-${week.weekNum}`] !== undefined
                        ? customMachineDays[`99-${week.weekNum}`]
                        : granelAutoDays;

                    const weekGranelQQ = granelMachineDays > 0 ? Math.max(0, (dailySupply * granelMachineDays) - (weekFamiliarQQ * (granelMachineDays / Math.max(1, weekMaxDays)))) : 0;

                    // Distribuir proporcionalmente entre Dia y Noche
                    const granelDiaQQ = granelAutoDays > 0 ? (weekGranelQQ * (granelDiaWeight / granelAutoDays)) : (granelMachineDays > 0 ? weekGranelQQ / 2 : 0);
                    const granelNocQQ = granelAutoDays > 0 ? (weekGranelQQ * (granelNocWeight / granelAutoDays)) : (granelMachineDays > 0 ? weekGranelQQ / 2 : 0);

                    const weekBalanceQQ = Math.max(0, (dailySupply * weekCalendarDays) - weekFamiliarQQ - weekGranelQQ);

                    byWeek[week.weekNum].familiarQQ = weekFamiliarQQ;
                    byWeek[week.weekNum].granelQQ = weekGranelQQ;
                    byWeek[week.weekNum].granelDiaQQ = granelDiaQQ;
                    byWeek[week.weekNum].granelNocQQ = granelNocQQ;
                    byWeek[week.weekNum].balanceQQ = weekBalanceQQ;
                    byWeek[week.weekNum].qq = weekFamiliarQQ + weekGranelQQ;
                    byWeek[week.weekNum].productionDays = weekCalendarDays;
                    byWeek[week.weekNum].granelDays = granelMachineDays;

                } else {
                    let weekFamiliarQQ = 0;
                    let weekGranelQQ = 0;
                    let weekGranelDiaQQ = 0;
                    let weekGranelNocQQ = 0;
                    let weekBalanceQQ = 0;
                    let weekMaxDays = 0;

                    // Pre-calcular machineAutoDays para cada máquina en esta semana
                    const machineAutoDaysMap: Record<string, number> = {};

                    // Incluimos Granel (99) en el pre-cálculo
                    const allTargetMachines = [...activeMachines, { id: 99 }];

                    allTargetMachines.forEach(m => {
                        machineAutoDaysMap[m.id] = week.days.reduce((total, d) => {
                            const dateStr = d.toISOString().split('T')[0];
                            if (customActiveDays[dateStr] === false) return total;

                            const isGranel = m.id === 99;
                            let isInactiveD, isInactiveN;

                            if (isGranel) {
                                if (!isGranelActive) return total;
                                const oD = overrides[`99-${dateStr}-dia`];
                                const oN = overrides[`99-${dateStr}-noche`];
                                isInactiveD = oD?.inactive || (!oD);
                                isInactiveN = oN?.inactive || (!oN);
                            } else {
                                const oD = overrides[`${m.id}-${dateStr}-dia`];
                                const oN = overrides[`${m.id}-${dateStr}-noche`];
                                isInactiveD = oD?.inactive || (!oD);
                                isInactiveN = oN?.inactive || (!oN);
                            }

                            let dayWeight = 0;
                            if (!isInactiveD) dayWeight += 0.5;
                            if (!isInactiveN) dayWeight += 0.5;
                            return total + dayWeight;
                        }, 0);
                    });

                    // Factor de escala semanal para Granel (ID 99)
                    const gAutoDays = machineAutoDaysMap[99] || 0;
                    const gCustomDays = customMachineDays[`99-${week.weekNum}`];
                    const gActualDays = gCustomDays !== undefined ? gCustomDays : gAutoDays;
                    const gScalingFactor = gAutoDays > 0 ? gActualDays / gAutoDays : (gAutoDays === 0 && gActualDays > 0 ? 1 : 0);

                    week.days.forEach(day => {
                        const dateStr = day.toISOString().split('T')[0];
                        if (customActiveDays[dateStr] === false) return;

                        if (!dayShiftProducts[dateStr]) dayShiftProducts[dateStr] = { dia: new Set(), noche: new Set() };

                        let dayFamiliarQQ = 0;
                        let dayActiveD = false;
                        let dayActiveN = false;

                        activeMachines.forEach(m => {
                            const conf = machineConfig[m.id];
                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];
                            const pIdD = oD?.productId || conf?.productId;
                            const pIdN = oN?.productId || conf?.productId;
                            const sD = oD?.speed || conf?.speed || 38;
                            const sN = oN?.speed || conf?.speed || 38;
                            const pD = products.find(p => p.id === pIdD);
                            const pN = products.find(p => p.id === pIdN);

                            // Factor de escala semanal para esta máquina
                            const autoDays = machineAutoDaysMap[m.id] || 0;
                            const customDays = customMachineDays[`${m.id}-${week.weekNum}`];
                            const actualDays = customDays !== undefined ? customDays : autoDays;
                            const scalingFactor = autoDays > 0 ? actualDays / autoDays : (autoDays === 0 && actualDays > 0 ? 1 : 0);

                            if (!byMachine[m.id]) byMachine[m.id] = { qq: 0, units: 0, count: 0, dates: new Set(), products: {} };

                            const isManualAndNoOverrideD = !oD;
                            if (pD && !oD?.inactive && !isManualAndNoOverrideD) {
                                const baseQQ = ((sD * 60) * rendimiento * horasTurnoDia * (pD.presentationWeight || 50)) / 50;
                                const qq = baseQQ * scalingFactor;
                                const isFardo = pD.primaryPackaging === 'fardo' || !!pD.bundleWeight;
                                const units = isFardo ? (qq * 50) / (pD.bundleWeight || 12) : (qq * 50) / (pD.sackWeight || pD.presentationWeight || 50);

                                if (!byProduct[pIdD]) byProduct[pIdD] = { qq: 0, qqDay: 0, qqNight: 0, units: 0, speedSum: 0, count: 0, dates: new Set(), supervisors: 0, operators: 0, envasadores: 0, supervisorsDay: 0, supervisorsNight: 0, operatorsDay: 0, operatorsNight: 0, envasadoresDay: 0, envasadoresNight: 0 };
                                byProduct[pIdD].qq += qq;
                                byProduct[pIdD].qqDay += qq;
                                byProduct[pIdD].units += units;
                                byProduct[pIdD].speedSum += sD;
                                byProduct[pIdD].count += 1;
                                byProduct[pIdD].dates.add(dateStr);

                                // Labor tracking
                                const isProductAutoD = (prod: any) => {
                                    if (!prod) return false;
                                    const name = prod.productName;
                                    return name === "1 kg -Blanca (12 kg) San Juan" || name === "1 kg -Blanca (12 kg) Don Antonio";
                                };

                                byProduct[pIdD].supervisors += 1;
                                byProduct[pIdD].operators += 1;
                                byProduct[pIdD].supervisorsDay += 1;
                                byProduct[pIdD].operatorsDay += 1;
                                if (!isProductAutoD(pD)) {
                                    byProduct[pIdD].envasadores += 1;
                                    byProduct[pIdD].envasadoresDay += 1;
                                }

                                byMachine[m.id].qq += qq;
                                byMachine[m.id].units += units;
                                byMachine[m.id].count += 1;
                                byMachine[m.id].dates.add(dateStr);

                                if (!byMachine[m.id].products[pIdD]) byMachine[m.id].products[pIdD] = { qq: 0, units: 0, shifts: 0, dates: new Set(), weeks: new Set() };
                                byMachine[m.id].products[pIdD].qq += qq;
                                byMachine[m.id].products[pIdD].units += units;
                                byMachine[m.id].products[pIdD].shifts += 1;
                                byMachine[m.id].products[pIdD].dates.add(dateStr);
                                byMachine[m.id].products[pIdD].weeks.add(week.weekNum);
                                dayFamiliarQQ += qq;
                                dayActiveD = true;
                            }
                            const isManualAndNoOverrideN = !oN;
                            if (pN && !oN?.inactive && !isManualAndNoOverrideN) {
                                dayShiftProducts[dateStr].noche.add(pIdN);
                                const baseQQ = ((sN * 60) * rendimiento * horasTurnoNoche * (pN.presentationWeight || 50)) / 50;
                                const qq = baseQQ * scalingFactor;
                                const isFardo = pN.primaryPackaging === 'fardo' || !!pN.bundleWeight;
                                const units = isFardo ? (qq * 50) / (pN.bundleWeight || 12) : (qq * 50) / (pN.sackWeight || pN.presentationWeight || 50);

                                if (!byProduct[pIdN]) byProduct[pIdN] = { qq: 0, qqDay: 0, qqNight: 0, units: 0, speedSum: 0, count: 0, dates: new Set(), supervisors: 0, operators: 0, envasadores: 0, supervisorsDay: 0, supervisorsNight: 0, operatorsDay: 0, operatorsNight: 0, envasadoresDay: 0, envasadoresNight: 0 };
                                byProduct[pIdN].qq += qq;
                                byProduct[pIdN].qqNight += qq;
                                byProduct[pIdN].units += units;
                                byProduct[pIdN].speedSum += sN;
                                byProduct[pIdN].count += 1;
                                byProduct[pIdN].dates.add(dateStr);

                                // Labor tracking
                                const isProductAutoN2 = (prod: any) => {
                                    if (!prod) return false;
                                    const name = prod.productName;
                                    return name === "1 kg -Blanca (12 kg) San Juan" || name === "1 kg -Blanca (12 kg) Don Antonio";
                                };

                                byProduct[pIdN].supervisors += 1;
                                byProduct[pIdN].operators += 1;
                                byProduct[pIdN].supervisorsNight += 1;
                                byProduct[pIdN].operatorsNight += 1;
                                if (!isProductAutoN2(pN)) {
                                    byProduct[pIdN].envasadores += 1;
                                    byProduct[pIdN].envasadoresNight += 1;
                                }

                                byMachine[m.id].qq += qq;
                                byMachine[m.id].units += units;
                                byMachine[m.id].count += 1;
                                byMachine[m.id].dates.add(dateStr);

                                if (!byMachine[m.id].products[pIdN]) byMachine[m.id].products[pIdN] = { qq: 0, units: 0, shifts: 0, dates: new Set(), weeks: new Set() };
                                byMachine[m.id].products[pIdN].qq += qq;
                                byMachine[m.id].products[pIdN].units += units;
                                byMachine[m.id].products[pIdN].shifts += 1;
                                byMachine[m.id].products[pIdN].dates.add(dateStr);
                                byMachine[m.id].products[pIdN].weeks.add(week.weekNum);
                                dayFamiliarQQ += qq;
                                dayActiveN = true;
                            }
                        });

                        const isGActive = (s: 'dia' | 'noche') => {
                            if (!isGranelActive) return false;
                            const ov = overrides[`99-${dateStr}-${s}`];
                            if (ov?.inactive) return false;
                            if (!ov) return false;
                            return true;
                        };

                        const granelDiaActive = isGActive('dia');
                        const granelNocActive = isGActive('noche');

                        // Distribute remaining supply to active Granel shifts
                        const dailyRemainder = Math.max(0, dailySupply - dayFamiliarQQ);
                        const activeGranelShifts = (granelDiaActive ? 1 : 0) + (granelNocActive ? 1 : 0);
                        const baseGranelDiaQQ = granelDiaActive ? (dailyRemainder / (activeGranelShifts || 1)) : 0;
                        const baseGranelNocQQ = granelNocActive ? (dailyRemainder / (activeGranelShifts || 1)) : 0;

                        const dayGranelDiaQQ = baseGranelDiaQQ * gScalingFactor;
                        const dayGranelNocQQ = baseGranelNocQQ * gScalingFactor;
                        const dayGranelQQ = dayGranelDiaQQ + dayGranelNocQQ;

                        const dayBalanceQQ = Math.max(0, dailyRemainder - dayGranelQQ);
                        const dayTotalQQ = dayFamiliarQQ + dayGranelQQ;
                        weekFamiliarQQ += dayFamiliarQQ;
                        weekGranelQQ += dayGranelQQ;
                        weekGranelDiaQQ += dayGranelDiaQQ;
                        weekGranelNocQQ += dayGranelNocQQ;
                        weekBalanceQQ += dayBalanceQQ;

                        weekMaxDays += 1;

                        byWeek[week.weekNum].days[dateStr] = {
                            familiarQQ: dayFamiliarQQ,
                            granelQQ: dayGranelQQ,
                            granelDiaQQ: dayGranelDiaQQ,
                            granelNocQQ: dayGranelNocQQ,
                            totalQQ: dayTotalQQ,
                            balanceQQ: dayBalanceQQ
                        };
                    });

                    byWeek[week.weekNum].familiarQQ = weekFamiliarQQ;
                    byWeek[week.weekNum].granelQQ = weekGranelQQ;
                    byWeek[week.weekNum].granelDiaQQ = weekGranelDiaQQ;
                    byWeek[week.weekNum].granelNocQQ = weekGranelNocQQ;
                    byWeek[week.weekNum].balanceQQ = weekBalanceQQ;
                    byWeek[week.weekNum].qq = weekFamiliarQQ + weekGranelQQ;
                    byWeek[week.weekNum].productionDays = weekMaxDays;
                    byWeek[week.weekNum].granelDays = gActualDays;
                }
            });
        });

        const totalProductionDaysList = new Set<string>();
        const totalProductionShiftsDiaList = new Set<string>();
        const totalProductionShiftsNocList = new Set<string>();

        Object.values(byWeek).forEach(w => {
            Object.entries(w.days).forEach(([dateStr, dayData]) => {
                if (dayData.totalQQ > 0) {
                    totalProductionDaysList.add(dateStr);
                }
                // We need to know if it was Dia or Noche. 
                // dayShiftProducts already has this for familiar.
                // For granel, we can check week-level granelDiaQQ/NocQQ or better, re-check overrides here.
            });
        });

        // Refined shift counting
        Object.keys(dayShiftProducts).forEach(dateStr => {
            if (dayShiftProducts[dateStr].dia.size > 0) totalProductionShiftsDiaList.add(dateStr);
            if (dayShiftProducts[dateStr].noche.size > 0) totalProductionShiftsNocList.add(dateStr);

            // Add Granel shifts
            const oD = overrides[`99-${dateStr}-dia`];
            const oN = overrides[`99-${dateStr}-noche`];
            const gD = isGranelActive && !oD?.inactive && (!!oD);
            const gN = isGranelActive && !oN?.inactive && (!!oN);

            if (gD) {
                totalProductionShiftsDiaList.add(dateStr);
                totalProductionDaysList.add(dateStr);
            }
            if (gN) {
                totalProductionShiftsNocList.add(dateStr);
                totalProductionDaysList.add(dateStr);
            }
        });

        return {
            byProduct,
            byMachine,
            byWeek,
            totalProductionDays: totalProductionDaysList.size,
            totalProductionShiftsDia: totalProductionShiftsDiaList.size,
            totalProductionShiftsNoc: totalProductionShiftsNocList.size,
            dayShiftProducts
        };
    }, [machines, machineConfig, isGranelActive, dailySupply, groupedWeeks, viewMode, customActiveDays, overrides, customMachineDays, products, rendimiento, horasTurnoDia, horasTurnoNoche, projectionMode]);

    const totalFamiliarQQ = React.useMemo(() => {
        return Object.values(productionStats.byWeek).reduce((sum, w) => sum + (w.familiarQQ || 0), 0);
    }, [productionStats]);

    const totalGranelQQ = React.useMemo(() => {
        return Object.values(productionStats.byWeek).reduce((sum, w) => sum + (w.granelQQ || 0), 0);
    }, [productionStats]);

    const totalGranelDiaQQ = React.useMemo(() => {
        return Object.values(productionStats.byWeek).reduce((sum, w) => sum + (w.granelDiaQQ || 0), 0);
    }, [productionStats]);

    const totalGranelNocQQ = React.useMemo(() => {
        return Object.values(productionStats.byWeek).reduce((sum, w) => sum + (w.granelNocQQ || 0), 0);
    }, [productionStats]);

    const totalPlannedQQ = React.useMemo(() => {
        return Object.values(plannedGoals).reduce((acc, g) => acc + (g || 0), 0);
    }, [plannedGoals]);

    const fulfillmentPct = totalPlannedQQ > 0 ? (totalFamiliarQQ / totalPlannedQQ) * 100 : 0;

    const { totalSacos, totalFardos, totalSacosQQ, totalFardosQQ, sacosDays, fardosDays, familiarDays, granelDays } = React.useMemo(() => {
        let sacos = 0;
        let fardos = 0;
        let sacosQQ = 0;
        let fardosQQ = 0;
        const sacoDates = new Set<string>();
        const fardoDates = new Set<string>();
        const familiarDates = new Set<string>();

        Object.entries(productionStats.byProduct).forEach(([pId, stats]) => {
            const product = products.find(p => p.id === pId);
            if (!product) return;
            const isFardo = product.primaryPackaging === 'fardo' || !!product.bundleWeight;
            if (isFardo) {
                fardos += stats.units;
                fardosQQ += stats.qq;
                stats.dates.forEach(d => fardoDates.add(d));
            } else {
                sacos += stats.units;
                sacosQQ += stats.qq;
                stats.dates.forEach(d => sacoDates.add(d));
            }
            stats.dates.forEach(d => familiarDates.add(d));
        });

        const totalGranelDays = Object.values(productionStats.byWeek).reduce((sum, w) => sum + (w.granelDays || 0), 0);

        return {
            totalSacos: sacos,
            totalFardos: fardos,
            totalSacosQQ: sacosQQ,
            totalFardosQQ: fardosQQ,
            sacosDays: sacoDates.size,
            fardosDays: fardoDates.size,
            familiarDays: familiarDates.size,
            granelDays: totalGranelDays
        };
    }, [productionStats, products]);

    const laborStats = React.useMemo(() => {
        let totalEnvasadoresTurnos = 0;
        let maxPersonasTurno = 0;
        let globalMaxDia = 0;
        let globalMaxNoche = 0;
        let globalTotalDia = 0;
        let globalTotalNoche = 0;
        let globalTotalSupDia = 0;
        let globalTotalSupNoc = 0;
        let globalTotalOpDia = 0;
        let globalTotalOpNoc = 0;
        let globalTotalEnvDia = 0;
        let globalTotalEnvNoc = 0;
        let globalTotalGraDia = 0;
        let globalTotalGraNoc = 0;
        let diasConOperacion = 0;

        let familiarBreakdown = { sup: 0, supDia: 0, supNoc: 0, op: 0, opDia: 0, opNoc: 0, env: 0, envDia: 0, envNoc: 0, gra: 0, graDia: 0, graNoc: 0 };
        let granelBreakdown = { sup: 0, supDia: 0, supNoc: 0, op: 0, opDia: 0, opNoc: 0, env: 0, envDia: 0, envNoc: 0, gra: 0, graDia: 0, graNoc: 0 };
        let sacoBreakdown = { sup: 0, supDia: 0, supNoc: 0, op: 0, opDia: 0, opNoc: 0, env: 0, envDia: 0, envNoc: 0, gra: 0, graDia: 0, graNoc: 0 };
        let fardoBreakdown = { sup: 0, supDia: 0, supNoc: 0, op: 0, opDia: 0, opNoc: 0, env: 0, envDia: 0, envNoc: 0, gra: 0, graDia: 0, graNoc: 0 };

        const activeMachines = machines.filter(m => machineConfig[m.id]?.active);

        const isFardo = (pId: string) => {
            const p = products.find(prod => prod.id === pId);
            if (!p) return false;
            return p.primaryPackaging === 'fardo' || !!p.bundleWeight;
        };

        const dailyDetail: Record<string, { dia: any, noche: any, costo: number }> = {};
        const weeklyDetail: Record<number, {
            totalCosto: number,
            maxPersonal: number,
            totalEnvasadores: number,
            maxDia: number,
            maxNoche: number,
            totalPersTurnos: number,
            totalPersDia: number,
            totalPersNoche: number,
            totalEnvasadoresDia: number,
            totalEnvasadoresNoche: number,
            // Nuevos campos para desglose (Máximos por semana)
            maxSupDia: number, maxSupNoc: number,
            maxOpDia: number, maxOpNoc: number,
            maxEnvDia: number, maxEnvNoc: number,
            maxGraDia: number, maxGraNoc: number,
            // Totales acumulados por semana
            totalSupDia: number, totalSupNoc: number,
            totalOpDia: number, totalOpNoc: number,
            totalEnvDia: number, totalEnvNoc: number,
            totalGraDia: number, totalGraNoc: number,
            totalCostoDia: number, totalCostoNoc: number
        }> = {};

        let totalActiveDaysCount = 0;
        let totalWeeksOperated = 0;

        groupedWeeks.forEach(group => {
            group.weeks.forEach(week => {
                const weekNum = week.weekNum;
                week.days.forEach(day => {
                    const dateStr = day.toISOString().split('T')[0];
                    if (customActiveDays[dateStr] === false) return;

                    let machinesDia = 0;
                    let machinesNoc = 0;
                    let autoDia = 0;
                    let autoNoc = 0;
                    let granelDia = false;
                    let granelNoc = false;

                    machines.forEach(m => {
                        const conf = machineConfig[m.id];
                        if (!conf?.active) return;
                        const oD = overrides[`${m.id}-${dateStr}-dia`];
                        const oN = overrides[`${m.id}-${dateStr}-noche`];

                        const isAuto = (pId: string | undefined) => {
                            if (!pId) return false;
                            const p = products.find(prod => prod.id === pId);
                            if (!p) return false;
                            return p.productName.toLowerCase().includes("12 kg");
                        };

                        if (!oD?.inactive && (!!oD)) {
                            const pIdD = oD?.productId || conf.productId;
                            if (isAuto(pIdD)) autoDia++;
                            else machinesDia++;
                        }
                        if (!oN?.inactive && (!!oN)) {
                            const pIdN = oN?.productId || conf.productId;
                            if (isAuto(pIdN)) autoNoc++;
                            else machinesNoc++;
                        }
                    });

                    if (isGranelActive) {
                        const isGActive = (s: 'dia' | 'noche') => {
                            const ov = overrides[`99-${dateStr}-${s}`];
                            if (ov?.inactive) return false;
                            if (!ov) return false;
                            return true;
                        };
                        granelDia = isGActive('dia');
                        granelNoc = isGActive('noche');
                    }

                    let mSacoDia = 0, mFardoDia = 0;
                    let mSacoNoc = 0, mFardoNoc = 0;

                    activeMachines.forEach(m => {
                        const oD = overrides[`${m.id}-${dateStr}-dia`];
                        const oN = overrides[`${m.id}-${dateStr}-noche`];
                        const pIdD = oD?.productId || machineConfig[m.id]?.productId;
                        const pIdN = oN?.productId || machineConfig[m.id]?.productId;
                        if (pIdD && !oD?.inactive && !(!oD)) {
                            if (isFardo(pIdD)) mFardoDia++; else mSacoDia++;
                        }
                        if (pIdN && !oN?.inactive && !(!oN)) {
                            if (isFardo(pIdN)) mFardoNoc++; else mSacoNoc++;
                        }
                    });

                    const getEnvBreakdown = (mSaco: number, mFardo: number) => {
                        let sEnv = mSaco;
                        let fEnv = mFardo;
                        if (mSaco > 0 && mFardo > 0) { sEnv += 0.5; fEnv += 0.5; }
                        else if (mSaco > 0) { sEnv += 1; }
                        else if (mFardo > 0) { fEnv += 1; }
                        return { sEnv, fEnv };
                    };

                    const { sEnv: envSacoDia, fEnv: envFardoDia } = getEnvBreakdown(mSacoDia, mFardoDia);
                    const { sEnv: envSacoNoc, fEnv: envFardoNoc } = getEnvBreakdown(mSacoNoc, mFardoNoc);

                    const calcPersonal = (mCount: number, aCount: number, hasGranel: boolean) => {
                        const totalMachines = mCount + aCount;
                        if (totalMachines === 0 && !hasGranel) return { total: 0, supervisor: 0, operador: 0, envasadores: 0, granelero: 0 };

                        const supervisor = 1;
                        const operador = totalMachines > 0 ? 1 : 0;
                        // Regla: 1 envasador por máquina manual + 1 cosedor para el grupo
                        const envasadores = mCount > 0 ? mCount + 1 : 0;
                        const granelero = hasGranel ? 1 : 0;

                        const total = supervisor + operador + envasadores + granelero;
                        return { total, supervisor, operador, envasadores, granelero };
                    };

                    const pDia = calcPersonal(machinesDia, autoDia, granelDia);
                    const pNoc = calcPersonal(machinesNoc, autoNoc, granelNoc);

                    totalEnvasadoresTurnos += (machinesDia + machinesNoc);
                    maxPersonasTurno = Math.max(maxPersonasTurno, pDia.total, pNoc.total);
                    globalMaxDia = Math.max(globalMaxDia, pDia.total);
                    globalMaxNoche = Math.max(globalMaxNoche, pNoc.total);

                    globalTotalDia += pDia.total;
                    globalTotalNoche += pNoc.total;

                    // Acumular totales globales por rol
                    globalTotalSupDia += pDia.supervisor;
                    globalTotalSupNoc += pNoc.supervisor;
                    globalTotalOpDia += pDia.operador;
                    globalTotalOpNoc += pNoc.operador;
                    globalTotalEnvDia += pDia.envasadores;
                    globalTotalEnvNoc += pNoc.envasadores;
                    globalTotalGraDia += pDia.granelero;
                    globalTotalGraNoc += pNoc.granelero;

                    // Breakdown attribution
                    const attr = (p: any, hasS: boolean, hasF: boolean, sE: number, fE: number, hasG: boolean, isDia: boolean) => {
                        if (hasS) {
                            sacoBreakdown.sup += p.supervisor;
                            sacoBreakdown.op += p.operador;
                            sacoBreakdown.env += sE;
                            if (isDia) {
                                sacoBreakdown.supDia += p.supervisor;
                                sacoBreakdown.opDia += p.operador;
                                sacoBreakdown.envDia += sE;
                            } else {
                                sacoBreakdown.supNoc += p.supervisor;
                                sacoBreakdown.opNoc += p.operador;
                                sacoBreakdown.envNoc += sE;
                            }
                        }
                        if (hasF) {
                            fardoBreakdown.sup += p.supervisor;
                            fardoBreakdown.op += p.operador;
                            fardoBreakdown.env += fE;
                            if (isDia) {
                                fardoBreakdown.supDia += p.supervisor;
                                fardoBreakdown.opDia += p.operador;
                                fardoBreakdown.envDia += fE;
                            } else {
                                fardoBreakdown.supNoc += p.supervisor;
                                fardoBreakdown.opNoc += p.operador;
                                fardoBreakdown.envNoc += fE;
                            }
                        }
                        if (hasS || hasF) {
                            familiarBreakdown.sup += p.supervisor;
                            familiarBreakdown.op += p.operador;
                            familiarBreakdown.env += p.envasadores;
                            if (isDia) {
                                familiarBreakdown.supDia += p.supervisor;
                                familiarBreakdown.opDia += p.operador;
                                familiarBreakdown.envDia += p.envasadores;
                            } else {
                                familiarBreakdown.supNoc += p.supervisor;
                                familiarBreakdown.opNoc += p.operador;
                                familiarBreakdown.envNoc += p.envasadores;
                            }
                        }
                        if (hasG) {
                            granelBreakdown.sup += p.supervisor;
                            granelBreakdown.gra += p.granelero;
                            if (isDia) {
                                granelBreakdown.supDia += p.supervisor;
                                granelBreakdown.graDia += p.granelero;
                            } else {
                                granelBreakdown.supNoc += p.supervisor;
                                granelBreakdown.graNoc += p.granelero;
                            }
                        }
                    };
                    attr(pDia, mSacoDia > 0, mFardoDia > 0, envSacoDia, envFardoDia, granelDia, true);
                    attr(pNoc, mSacoNoc > 0, mFardoNoc > 0, envSacoNoc, envFardoNoc, granelNoc, false);

                    if (pDia.total > 0 || pNoc.total > 0) diasConOperacion++;

                    const costDia = pDia.envasadores * fixedDayRate;
                    const costNoc = pNoc.envasadores * fixedNightRate;
                    const dailyCost = costDia + costNoc;

                    dailyDetail[dateStr] = { dia: pDia, noche: pNoc, costo: dailyCost };

                    if (!weeklyDetail[weekNum]) {
                        weeklyDetail[weekNum] = {
                            totalCosto: 0,
                            maxPersonal: 0,
                            totalEnvasadores: 0,
                            maxDia: 0,
                            maxNoche: 0,
                            totalPersTurnos: 0,
                            totalPersDia: 0,
                            totalPersNoche: 0,
                            totalEnvasadoresDia: 0,
                            totalEnvasadoresNoche: 0,
                            maxSupDia: 0, maxSupNoc: 0,
                            maxOpDia: 0, maxOpNoc: 0,
                            maxEnvDia: 0, maxEnvNoc: 0,
                            maxGraDia: 0, maxGraNoc: 0,
                            totalSupDia: 0, totalSupNoc: 0,
                            totalOpDia: 0, totalOpNoc: 0,
                            totalEnvDia: 0, totalEnvNoc: 0,
                            totalGraDia: 0, totalGraNoc: 0,
                            totalCostoDia: 0, totalCostoNoc: 0
                        };
                        totalWeeksOperated++;
                    }
                    weeklyDetail[weekNum].totalCosto += dailyCost;
                    weeklyDetail[weekNum].totalCostoDia += costDia;
                    weeklyDetail[weekNum].totalCostoNoc += costNoc;
                    weeklyDetail[weekNum].maxPersonal = Math.max(weeklyDetail[weekNum].maxPersonal, pDia.total, pNoc.total);
                    weeklyDetail[weekNum].maxDia = Math.max(weeklyDetail[weekNum].maxDia, pDia.total);
                    weeklyDetail[weekNum].maxNoche = Math.max(weeklyDetail[weekNum].maxNoche, pNoc.total);
                    weeklyDetail[weekNum].totalPersDia += pDia.total;
                    weeklyDetail[weekNum].totalPersNoche += pNoc.total;
                    weeklyDetail[weekNum].totalPersTurnos = weeklyDetail[weekNum].totalPersDia + weeklyDetail[weekNum].totalPersNoche;
                    weeklyDetail[weekNum].totalEnvasadoresDia += pDia.envasadores;
                    weeklyDetail[weekNum].totalEnvasadoresNoche += pNoc.envasadores;

                    // Actualizar máximos de roles por semana
                    weeklyDetail[weekNum].maxSupDia = Math.max(weeklyDetail[weekNum].maxSupDia, pDia.supervisor);
                    weeklyDetail[weekNum].maxSupNoc = Math.max(weeklyDetail[weekNum].maxSupNoc, pNoc.supervisor);
                    weeklyDetail[weekNum].maxOpDia = Math.max(weeklyDetail[weekNum].maxOpDia, pDia.operador);
                    weeklyDetail[weekNum].maxOpNoc = Math.max(weeklyDetail[weekNum].maxOpNoc, pNoc.operador);
                    weeklyDetail[weekNum].maxEnvDia = Math.max(weeklyDetail[weekNum].maxEnvDia, pDia.envasadores);
                    weeklyDetail[weekNum].maxEnvNoc = Math.max(weeklyDetail[weekNum].maxEnvNoc, pNoc.envasadores);
                    weeklyDetail[weekNum].maxGraDia = Math.max(weeklyDetail[weekNum].maxGraDia, pDia.granelero);
                    weeklyDetail[weekNum].maxGraNoc = Math.max(weeklyDetail[weekNum].maxGraNoc, pNoc.granelero);

                    // Acumular totales de roles por semana
                    weeklyDetail[weekNum].totalSupDia += pDia.supervisor;
                    weeklyDetail[weekNum].totalSupNoc += pNoc.supervisor;
                    weeklyDetail[weekNum].totalOpDia += pDia.operador;
                    weeklyDetail[weekNum].totalOpNoc += pNoc.operador;
                    weeklyDetail[weekNum].totalEnvDia += pDia.envasadores;
                    weeklyDetail[weekNum].totalEnvNoc += pNoc.envasadores;
                    weeklyDetail[weekNum].totalGraDia += pDia.granelero;
                    weeklyDetail[weekNum].totalGraNoc += pNoc.granelero;

                    if (dailyCost > 0 || pDia.total > 0 || pNoc.total > 0) {
                        totalActiveDaysCount++;
                    }
                });
            });
        });

        const totalCosto = Object.values(weeklyDetail).reduce((sum, w) => sum + w.totalCosto, 0);
        const totalCostoDia = Object.values(weeklyDetail).reduce((sum, w) => sum + w.totalCostoDia, 0);
        const totalCostoNoc = Object.values(weeklyDetail).reduce((sum, w) => sum + w.totalCostoNoc, 0);
        const totalShiftsDia = Object.values(dailyDetail).filter(d => d.dia.total > 0).length;
        const totalShiftsNoc = Object.values(dailyDetail).filter(d => d.noche.total > 0).length;
        const totalPersTurnosGlobal = Object.values(weeklyDetail).reduce((sum, w) => sum + w.totalPersTurnos, 0);
        const avgDaysPerWeek = totalWeeksOperated > 0 ? totalActiveDaysCount / totalWeeksOperated : 0;

        const totalQQ = totalFamiliarQQ + totalGranelQQ;
        const costoPorQQ = totalQQ > 0 ? totalCosto / totalQQ : 0;

        return {
            totalCosto,
            totalCostoDia,
            totalCostoNoc,
            totalShiftsDia,
            totalShiftsNoc,
            costoPorQQ,
            maxPersonasTurno,
            globalMaxDia,
            globalMaxNoche,
            globalTotalDia,
            globalTotalNoche,
            globalTotalSupDia,
            globalTotalSupNoc,
            globalTotalOpDia,
            globalTotalOpNoc,
            globalTotalEnvDia,
            globalTotalEnvNoc,
            globalTotalSup: globalTotalSupDia + globalTotalSupNoc,
            globalTotalOp: globalTotalOpDia + globalTotalOpNoc,
            globalTotalEnv: globalTotalEnvDia + globalTotalEnvNoc,
            globalTotalGra: globalTotalGraDia + globalTotalGraNoc,
            globalTotalGraDia,
            globalTotalGraNoc,
            totalSup: globalTotalSupDia + globalTotalSupNoc,
            totalOp: globalTotalOpDia + globalTotalOpNoc,
            totalEnv: globalTotalEnvDia + globalTotalEnvNoc,
            totalGra: globalTotalGraDia + globalTotalGraNoc,
            familiarBreakdown,
            granelBreakdown,
            sacoBreakdown,
            fardoBreakdown,
            totalEnvasadoresTurnos,
            totalPersTurnosGlobal,
            dailyDetail,
            weeklyDetail,
            calculatedDaysPerWeek: avgDaysPerWeek
        };
    }, [productionStats, machines, machineConfig, overrides, projectionMode, isGranelActive, laborType, fixedDayRate, fixedNightRate, totalFamiliarQQ, totalGranelQQ, customActiveDays, groupedWeeks, products]);


    const handleCustomMachineDaysChange = (machineId: number, weekNum: number, value: string) => {
        const num = parseFloat(value);
        const key = `${machineId}-${weekNum}`;
        if (!isNaN(num) && num >= 0 && num <= 7) {
            setCustomMachineDays(prev => ({ ...prev, [key]: num }));
        } else if (value === '') {
            setCustomMachineDays(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const toggleDayActive = (dateStr: string) => {
        setCustomActiveDays(prev => ({ ...prev, [dateStr]: prev[dateStr] === false }));
    };

    const handleOverride = (key: string, updates: { productId?: string, speed?: number }) => {
        setOverrides(prev => ({
            ...prev,
            [key]: { ...prev[key], ...updates }
        }));
    };


    const applyEditOverride = () => {
        if (!editingOverride) return;
        const newOverrides = { ...overrides };
        if (editingOverride.startDate && editingOverride.endDate) {
            const start = new Date(editingOverride.startDate + "T12:00:00");
            const end = new Date(editingOverride.endDate + "T12:00:00");
            let curr = new Date(start);

            while (curr <= end) {
                const dateStr = curr.toISOString().split('T')[0];
                const baseKey = `${editingOverride.machineId}-${dateStr}`;

                const isInactiveDay = editingOverride.inactiveDays?.[dateStr] === true;

                if (editingOverride.shift === 'dia') {
                    newOverrides[`${baseKey}-dia`] = {
                        productId: editingOverride.currentProductId,
                        speed: editingOverride.currentSpeed,
                        inactive: editingOverride.inactive || isInactiveDay
                    };
                    if (editingOverride.applyToBothShifts) {
                        newOverrides[`${baseKey}-noche`] = {
                            productId: editingOverride.currentProductId,
                            speed: editingOverride.currentSpeed,
                            inactive: editingOverride.inactive || isInactiveDay
                        };
                    }
                } else {
                    newOverrides[`${baseKey}-noche`] = {
                        productId: editingOverride.currentProductId,
                        speed: editingOverride.currentSpeed,
                        inactive: editingOverride.inactive || isInactiveDay
                    };
                    if (editingOverride.applyToBothShifts) {
                        // Sincronizamos con el turno de día del MISMO día, 
                        // EXCEPTO el primer día del rango (porque ya pasó)
                        if (curr.getTime() > start.getTime()) {
                            newOverrides[`${editingOverride.machineId}-${dateStr}-dia`] = {
                                productId: editingOverride.currentProductId,
                                speed: editingOverride.currentSpeed,
                                inactive: editingOverride.inactive || isInactiveDay
                            };
                        }
                    }
                }
                curr.setDate(curr.getDate() + 1);
            }
        } else {
            // Fallback for weekly keys or missing dates
            newOverrides[editingOverride.key] = {
                productId: editingOverride.currentProductId,
                speed: editingOverride.currentSpeed,
                inactive: editingOverride.inactive
            };
        }

        setOverrides(newOverrides);
        setLastUsedSpeed(editingOverride.currentSpeed);
        setEditingOverride(null);
    };

    const changeProduct = (id: number, productId: string) => {
        setMachineConfig(prev => ({ ...prev, [id]: { ...prev[id], productId } }));
    };

    const toggleMachine = (id: number) => {
        const isActive = machineConfig[id]?.active;
        setMachineConfig(prev => ({ ...prev, [id]: { ...prev[id], active: !isActive } }));

        // Si se apaga la máquina, limpiar todos sus overrides para evitar "fantasmas" en cálculos
        if (isActive) {
            const newOverrides = { ...overrides };
            Object.keys(newOverrides).forEach(key => {
                if (key.startsWith(`${id}-`)) {
                    delete newOverrides[key];
                }
            });
            setOverrides(newOverrides);
        }
    };

    const renderTable = () => {
        const activeMachines = machines.filter(m => machineConfig[m.id]?.active);

        // Pre-calculate holidays for the visible range
        const tableYears = Array.from(new Set(groupedWeeks.flatMap(g => g.weeks.flatMap(w => w.days.map(d => d.getFullYear())))));
        const allHolidays = tableYears.reduce((acc, year) => {
            getEcuadorHolidays(year).forEach(h => acc.add(h));
            return acc;
        }, new Set<string>());

        const machineHeaders = activeMachines.map(m => {
            const hasDays = viewMode === 'semana';
            let colSpan = hasDays ? 3 : 2;
            if (machinesDisplayMode === 'combined') {
                colSpan = hasDays ? 2 : 1;
            }
            return (
                <th key={m.id} colSpan={colSpan} className="px-1 py-1 border-l text-center bg-card">
                    <div className="flex items-center justify-center gap-1">
                        <div className="relative w-8 h-6 bg-white rounded border overflow-hidden shrink-0">
                            <Image src={m.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media"} alt={`M${m.id}`} fill className="object-contain" unoptimized />
                        </div>
                        <span className="font-bold text-primary text-[10px] leading-tight truncate">Maquina #{m.id}</span>
                    </div>
                </th>
            );
        });

        if (isGranelActive) {
            const hasDays = viewMode === 'semana'; // Granel solo tiene días en vista semanal por ahora
            const granelColSpan = (granelDisplayMode === 'combined' ? 1 : 2) + (hasDays ? 1 : 0);
            machineHeaders.push(
                <th key="granel-machine" colSpan={granelColSpan} className="px-1 py-1 border-l text-center bg-card">
                    <div className="flex items-center justify-center gap-1">
                        <Database className="h-4 w-4 text-primary" />
                        <span className="font-bold text-primary text-[10px] leading-tight truncate">Granel 50KG</span>
                    </div>
                </th>
            );
        }

        // Nueva columna de Mano de Obra
        machineHeaders.push(
            <th key="labor-machine" colSpan={2} className="px-1 py-1 border-l border-r text-center bg-blue-50/50">
                <div className="flex items-center justify-center gap-1 text-blue-700">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-bold text-[10px] leading-tight uppercase tracking-tighter">Mano de Obra</span>
                </div>
            </th>
        );

        const shiftHeaders = activeMachines.flatMap(m => {
            if (machinesDisplayMode === 'combined' && viewMode !== 'semana') {
                return [<th key={m.id + 'c'} className="px-1 py-1 border-l text-center bg-card text-[8px] font-bold text-muted-foreground w-20 h-4">General</th>];
            }

            const headers = [
                <th key={m.id + 'd'} className="px-1 py-1 border-l text-center bg-card text-[8px] font-bold text-muted-foreground w-[85px] h-4">Dia</th>,
                <th key={m.id + 'n'} className="px-1 py-1 border-l text-center bg-card text-[8px] font-bold text-muted-foreground w-[85px] h-4">Noche</th>
            ];
            if (viewMode === 'semana') {
                headers.unshift(<th key={m.id + 's'} className="px-0 py-1 border-l text-center bg-card text-[8px] font-bold text-muted-foreground w-8 h-4">Días</th>);
            }
            return headers;
        });

        if (isGranelActive) {
            if (viewMode === 'semana') {
                shiftHeaders.push(<th key="granel-shift-s" className="px-0 py-1 border-l text-center bg-card text-[8px] font-bold text-muted-foreground w-8 h-4">Días</th>);
            }
            if (granelDisplayMode === 'combined') {
                shiftHeaders.push(
                    <th key="granel-shift-comb" className="px-1 py-1 border-l text-center bg-card text-[8px] font-bold text-muted-foreground w-20 h-4">General</th>
                );
            } else {
                shiftHeaders.push(
                    <th key="granel-shift-d" className="px-1 py-1 border-l text-center bg-card text-[8px] font-bold text-muted-foreground w-[85px] h-4">Dia</th>,
                    <th key="granel-shift-n" className="px-1 py-1 border-l text-center bg-card text-[8px] font-bold text-muted-foreground w-[85px] h-4">Noche</th>
                );
            }
        }

        // Sub-headers para Mano de Obra
        shiftHeaders.push(
            <th key="labor-shift-d" className="px-1 py-1 border-l text-center bg-blue-50/30 text-[8px] font-bold text-blue-600 w-20 h-4">Dia</th>,
            <th key="labor-shift-n" className="px-1 py-1 border-l border-r text-center bg-blue-50/30 text-[8px] font-bold text-blue-600 w-20 h-4">Noche</th>
        );

        const rows: JSX.Element[] = [];
        let grandTotalMachines: Record<number, { dia: number, noche: number, days: number }> = {};
        let grandTotalDays = 0;
        let grandTotalSemanal = 0;

        activeMachines.forEach(m => grandTotalMachines[m.id] = { dia: 0, noche: 0, days: 0 });

        const renderCellInfo = (prod: ProductDefinition, qq: number, speed: number, isInactive?: boolean) => {
            if (isInactive || qq <= 0) {
                return (
                    <div className="flex flex-col items-center justify-center opacity-40">
                        <PowerOff className="h-4 w-4 text-muted-foreground mb-1" />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Sin Turno</span>
                    </div>
                );
            }
            const isFardo = prod.primaryPackaging === 'fardo' || !!prod.bundleWeight;
            const units = isFardo ? Math.round((qq * 50) / (prod.bundleWeight || 12)) : Math.round(qq);
            const unitLabel = isFardo ? 'Fardo' : 'Sacos';
            return (
                <div className="flex flex-col items-center">
                    <div className="text-[7px] w-full font-bold leading-tight mb-1 text-center" style={{ color: prod.color }} title={prod.productName}>
                        {(() => {
                            const name = prod.productName;
                            const splitIdx = name.lastIndexOf(') ');
                            if (splitIdx !== -1) {
                                return (
                                    <div className="flex flex-col gap-0">
                                        <div className="truncate">{name.substring(0, splitIdx + 1)}</div>
                                        <div className="font-black text-[7.5px] mt-0.5 leading-none uppercase">{name.substring(splitIdx + 2)}</div>
                                    </div>
                                );
                            }
                            return <div className="truncate">{name}</div>;
                        })()}
                    </div>
                    <div className="font-bold text-primary text-[10px] leading-tight">{units.toLocaleString()} {unitLabel}</div>
                    <div className="text-[8px] font-medium text-primary/70 leading-none">{qq.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-[7px] text-muted-foreground leading-none mt-1">{speed} Vel</div>
                </div>
            );
        };

        // Reset totals before calculation
        grandTotalDays = 0;
        grandTotalSemanal = 0;
        activeMachines.forEach(m => {
            if (!grandTotalMachines[m.id]) grandTotalMachines[m.id] = { dia: 0, noche: 0, days: 0 };
            grandTotalMachines[m.id].dia = 0;
            grandTotalMachines[m.id].noche = 0;
            grandTotalMachines[m.id].days = 0;
        });

        groupedWeeks.forEach((group) => {
            let monthTotalDays = 0;

            // First pass to calculate monthTotalDays correctly for rowSpan cell
            group.weeks.forEach((week) => {
                if (viewMode === 'semana') {
                    let weekMaxDays = 0;
                    activeMachines.forEach(m => {
                        const machineAutoDays = week.days.reduce((total, d) => {
                            const dateStr = d.toISOString().split('T')[0];
                            if (customActiveDays[dateStr] === false) return total;
                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];
                            const isInactiveD = oD?.inactive || (!oD);
                            const isInactiveN = oN?.inactive || (!oN);
                            let dayWeight = 0;
                            if (!isInactiveD) dayWeight += 0.5;
                            if (!isInactiveN) dayWeight += 0.5;
                            return total + dayWeight;
                        }, 0);
                        const machineDays = customMachineDays[`${m.id}-${week.weekNum}`] !== undefined
                            ? customMachineDays[`${m.id}-${week.weekNum}`]
                            : machineAutoDays;
                        weekMaxDays = Math.max(weekMaxDays, machineDays);
                        grandTotalMachines[m.id].days += machineDays;
                    });
                    monthTotalDays += weekMaxDays;
                } else {
                    week.days.forEach(day => {
                        const dateStr = day.toISOString().split('T')[0];
                        if (customActiveDays[dateStr] !== false) {
                            const hasProduction = activeMachines.some(m => {
                                const oD = overrides[`${m.id}-${dateStr}-dia`];
                                const oN = overrides[`${m.id}-${dateStr}-noche`];
                                return (!oD?.inactive && (!!oD)) ||
                                    (!oN?.inactive && (!!oN));
                            });
                            if (hasProduction) monthTotalDays += 1;
                        }
                    });
                }
            });

            group.weeks.forEach((week, wIndex) => {
                if (viewMode === 'semana') {
                    let weekFamiliarQQ = 0;
                    let weekMaxDays = 0;

                    const machineCells = activeMachines.flatMap(m => {
                        const conf = machineConfig[m.id];
                        if (!conf) return [];

                        const machineAutoDays = week.days.reduce((total, d) => {
                            const dateStr = d.toISOString().split('T')[0];
                            if (customActiveDays[dateStr] === false) return total;
                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];
                            const isInactiveD = oD?.inactive || (!oD);
                            const isInactiveN = oN?.inactive || (!oN);
                            let dayWeight = 0;
                            if (!isInactiveD) dayWeight += 0.5;
                            if (!isInactiveN) dayWeight += 0.5;
                            return total + dayWeight;
                        }, 0);

                        const machineDays = customMachineDays[`${m.id}-${week.weekNum}`] !== undefined
                            ? customMachineDays[`${m.id}-${week.weekNum}`]
                            : machineAutoDays;

                        weekMaxDays = Math.max(weekMaxDays, machineDays);
                        const scalingFactor = machineAutoDays > 0 ? machineDays / machineAutoDays : (machineAutoDays === 0 && machineDays > 0 ? 1 : 0);

                        let weekDiaQQ = 0;
                        let weekNocQQ = 0;
                        let lastProdDia = products.find(p => p.id === conf.productId);
                        let lastProdNoc = products.find(p => p.id === conf.productId);
                        let lastSpeedDia = lastUsedSpeed || conf.speed;
                        let lastSpeedNoc = lastUsedSpeed || conf.speed;
                        let hasAnyOverride = false;
                        let allInactive = true;

                        let weekProductsDia: Record<string, { prod: ProductDefinition, qq: number, speedSum: number, count: number }> = {};
                        let weekProductsNoc: Record<string, { prod: ProductDefinition, qq: number, speedSum: number, count: number }> = {};

                        week.days.forEach((day) => {
                            const dateStr = day.toISOString().split('T')[0];
                            if (customActiveDays[dateStr] === false) return;

                            const oD = overrides[`${m.id}-${dateStr}-dia`];
                            const oN = overrides[`${m.id}-${dateStr}-noche`];
                            if (oD || oN) hasAnyOverride = true;

                            const pD = products.find(p => p.id === (oD?.productId || conf.productId)) || products[0];
                            const pN = products.find(p => p.id === (oN?.productId || conf.productId)) || products[0];
                            const sD = oD?.speed || conf.speed || 38;
                            const sN = oN?.speed || conf.speed || 38;

                            const isManualAndNoOverrideD = !oD;
                            const isManualAndNoOverrideN = !oN;

                            if (!oD?.inactive && !isManualAndNoOverrideD) {
                                const qq = ((sD * 60) * rendimiento * horasTurnoDia * (pD.presentationWeight || 50)) / 50;
                                weekDiaQQ += qq;
                                if (!weekProductsDia[pD.id]) weekProductsDia[pD.id] = { prod: pD, qq: 0, speedSum: 0, count: 0 };
                                weekProductsDia[pD.id].qq += qq;
                                weekProductsDia[pD.id].speedSum += sD;
                                weekProductsDia[pD.id].count++;
                                allInactive = false;
                            }
                            if (!oN?.inactive && !isManualAndNoOverrideN) {
                                const qq = ((sN * 60) * rendimiento * horasTurnoNoche * (pN.presentationWeight || 50)) / 50;
                                weekNocQQ += qq;
                                if (!weekProductsNoc[pN.id]) weekProductsNoc[pN.id] = { prod: pN, qq: 0, speedSum: 0, count: 0 };
                                weekProductsNoc[pN.id].qq += qq;
                                weekProductsNoc[pN.id].speedSum += sN;
                                weekProductsNoc[pN.id].count++;
                                allInactive = false;
                            }
                            lastProdDia = pD; lastProdNoc = pN; lastSpeedDia = sD; lastSpeedNoc = sN;
                        });

                        const scaledDiaQQ = weekDiaQQ * scalingFactor;
                        const scaledNocQQ = weekNocQQ * scalingFactor;
                        grandTotalMachines[m.id].dia += scaledDiaQQ;
                        grandTotalMachines[m.id].noche += scaledNocQQ;
                        weekFamiliarQQ += (scaledDiaQQ + scaledNocQQ);

                        const isManualAndNoOverrideDia = !hasAnyOverride;

                        const renderWeeklyCell = (productsMap: Record<string, { prod: ProductDefinition, qq: number, speedSum: number, count: number }>, lastProd: ProductDefinition | undefined, lastSpeed: number, scaledTotalQQ: number, isInactive: boolean, shiftKey: string) => {
                            const productList = Object.values(productsMap);
                            const hasMultiple = productList.length > 1;

                            // Si hay varios, buscamos el que tenga más QQ para mostrarlo como principal
                            const mainEntry = hasMultiple
                                ? productList.reduce((prev, current) => (prev.qq > current.qq) ? prev : current)
                                : productList[0];

                            const content = mainEntry ? (
                                <div className="relative group">
                                    {renderCellInfo(mainEntry.prod, scaledTotalQQ, Math.round(mainEntry.speedSum / mainEntry.count), isInactive)}
                                    {hasMultiple && (
                                        <div className="absolute -top-1 -right-1 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                lastProd && renderCellInfo(lastProd, scaledTotalQQ, lastSpeed, isInactive)
                            );

                            if (!hasMultiple) return content;

                            return (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            {content}
                                        </TooltipTrigger>
                                        <TooltipContent className="p-3 min-w-[200px]" side="right">
                                            <div className="space-y-3">
                                                <div className="text-[10px] font-bold border-b pb-1 mb-2">Desglose de Producción</div>
                                                {productList.map((wp, idx) => (
                                                    <div key={wp.prod.id}>
                                                        {idx > 0 && <div className="border-t border-primary/5 my-1.5" />}
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wp.prod.color }} />
                                                            <span className="text-[10px] font-bold">{wp.prod.productName}</span>
                                                        </div>
                                                        {renderCellInfo(wp.prod, wp.qq * scalingFactor, Math.round(wp.speedSum / wp.count), false)}
                                                    </div>
                                                ))}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        };

                        const diaCell = (allInactive || isManualAndNoOverrideDia) && hasAnyOverride ? (
                            <td key={m.id + 'd'} className="px-1 py-1 border-l text-center bg-amber-500/5 cursor-pointer"
                                onClick={() => setEditingOverride({ key: `${m.id}-W${week.weekNum}-dia`, machineId: m.id, title: `Semana ${week.weekNum}`, shift: 'dia', currentProductId: lastProdDia?.id || products[0]?.id || '', currentSpeed: lastSpeedDia, inactive: true, isRange: true, startDate: week.start.toISOString().split('T')[0], endDate: week.end.toISOString().split('T')[0] })}>
                                {lastProdDia && renderCellInfo(lastProdDia, 0, 0, true)}
                            </td>
                        ) : (
                            <td key={m.id + 'd'} className={cn("px-1 py-2 border-l text-center transition-colors cursor-pointer hover:bg-primary/5 relative", (hasAnyOverride || isManualAndNoOverrideDia) && "bg-amber-500/5")}
                                style={{ borderLeftColor: lastProdDia?.color ? `${lastProdDia.color}80` : undefined, borderLeftWidth: lastProdDia?.color ? "2px" : undefined }}
                                onClick={() => setEditingOverride({ key: `${m.id}-W${week.weekNum}-dia`, machineId: m.id, title: `Semana ${week.weekNum}`, shift: 'dia', currentProductId: lastProdDia?.id || products[0]?.id || '', currentSpeed: lastSpeedDia, isRange: true, startDate: week.start.toISOString().split('T')[0], endDate: week.end.toISOString().split('T')[0] })}>
                                {renderWeeklyCell(weekProductsDia, lastProdDia, lastSpeedDia, scaledDiaQQ, isManualAndNoOverrideDia, 'dia')}
                            </td>
                        );

                        const nocCell = (allInactive || isManualAndNoOverrideDia) && hasAnyOverride ? (
                            <td key={m.id + 'n'} className="px-1 py-1 border-l text-center bg-amber-500/5 cursor-pointer"
                                onClick={() => setEditingOverride({ key: `${m.id}-W${week.weekNum}-noche`, machineId: m.id, title: `Semana ${week.weekNum}`, shift: 'noche', currentProductId: lastProdNoc?.id || products[0]?.id || '', currentSpeed: lastSpeedNoc, inactive: true, isRange: true, startDate: week.start.toISOString().split('T')[0], endDate: week.end.toISOString().split('T')[0] })}>
                                {lastProdNoc && renderCellInfo(lastProdNoc, 0, 0, true)}
                            </td>
                        ) : (
                            <td key={m.id + 'n'} className={cn("px-1 py-2 border-l text-center transition-colors cursor-pointer hover:bg-primary/5 relative", (hasAnyOverride || isManualAndNoOverrideDia) && "bg-amber-500/5")}
                                style={{ borderLeftColor: lastProdNoc?.color ? `${lastProdNoc.color}80` : undefined, borderLeftWidth: lastProdNoc?.color ? "2px" : undefined }}
                                onClick={() => setEditingOverride({ key: `${m.id}-W${week.weekNum}-noche`, machineId: m.id, title: `Semana ${week.weekNum}`, shift: 'noche', currentProductId: lastProdNoc?.id || products[0]?.id || '', currentSpeed: lastSpeedNoc, isRange: true, startDate: week.start.toISOString().split('T')[0], endDate: week.end.toISOString().split('T')[0] })}>
                                {renderWeeklyCell(weekProductsNoc, lastProdNoc, lastSpeedNoc, scaledNocQQ, isManualAndNoOverrideDia, 'noche')}
                            </td>
                        );

                        const machineDaysCell = (
                            <td key={m.id + 's'} className="px-0 py-1 text-center border-l bg-muted/5 w-8">
                                <div className="relative mx-auto w-6">
                                    <Input
                                        type="number"
                                        value={isNaN(machineDays) ? '' : machineDays}
                                        onChange={(e) => handleCustomMachineDaysChange(m.id, week.weekNum, e.target.value)}
                                        className="w-full h-7 text-[10px] text-center font-bold bg-background border-primary/30 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        step="0.1" min="0" max="7"
                                    />
                                </div>
                            </td>
                        );

                        if (machinesDisplayMode === 'combined') {
                            const combinedCell = (
                                <td key={m.id + 'c'} className="px-1 py-2 border-l text-center bg-card">
                                    <div className="flex flex-col items-center">
                                        <div className="font-bold text-primary text-[9px]">{(scaledDiaQQ + scaledNocQQ).toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                                        <div className="text-[7px] text-muted-foreground">QQ Total</div>
                                    </div>
                                </td>
                            );
                            return [machineDaysCell, combinedCell];
                        }

                        return [
                            machineDaysCell,
                            diaCell,
                            nocCell
                        ];
                    });

                    grandTotalDays += weekMaxDays;
                    grandTotalSemanal += weekFamiliarQQ;
                    rows.push(
                        <tr key={week.weekNum} className="border-b hover:bg-muted/30">
                            {wIndex === 0 && (
                                <td rowSpan={group.weeks.length} className="px-2 py-1 bg-muted/10 border-r align-middle text-center">
                                    <div className="text-xs font-bold text-foreground">{group.monthName.substring(0, 3)}</div>
                                </td>
                            )}
                            <td className="px-2 py-1 text-xs text-center border-r">{week.weekNum}</td>
                            {machineCells}
                            {(() => {
                                const weekStats = productionStats.byWeek[week.weekNum] || { granelQQ: 0 };
                                const weekGranelQQ = weekStats.granelQQ || 0;

                                // Calcular días automáticos para Granel (ID 99)
                                let granelDiaWeight = 0;
                                let granelNocWeight = 0;
                                week.days.forEach(d => {
                                    const dateStr = d.toISOString().split('T')[0];
                                    if (customActiveDays[dateStr] === false) return;
                                    const oD = overrides[`99-${dateStr}-dia`];
                                    const oN = overrides[`99-${dateStr}-noche`];
                                    if (!(oD?.inactive || (!oD))) granelDiaWeight += 0.5;
                                    if (!(oN?.inactive || (!oN))) granelNocWeight += 0.5;
                                });

                                const granelAutoDays = granelDiaWeight + granelNocWeight;
                                const granelDays = weekStats.granelDays || 0;

                                return (
                                    <>
                                        {isGranelActive && (
                                            <>
                                                <td className="px-0 py-1 text-center border-l bg-emerald-500/5 w-8">
                                                    <div className="relative mx-auto w-6">
                                                        <Input
                                                            type="number"
                                                            value={granelDays}
                                                            onChange={(e) => handleCustomMachineDaysChange(99, week.weekNum, e.target.value)}
                                                            className="w-full h-7 text-[10px] text-center font-bold bg-background border-emerald-500/30 px-0.5 text-emerald-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            step="0.1" min="0" max="7"
                                                        />
                                                    </div>
                                                </td>
                                                {granelDisplayMode === 'combined' ? (
                                                    granelDays > 0 ? (
                                                        <td className="px-1 py-1 text-center border-l bg-emerald-500/5">
                                                            <div className="flex flex-col items-center">
                                                                <div className="font-bold text-emerald-700 text-[10px] leading-tight">{weekGranelQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                            </div>
                                                        </td>
                                                    ) : (
                                                        <td className="px-1 py-1 text-center border-l bg-emerald-500/5 opacity-40">
                                                            <div className="flex flex-col items-center justify-center">
                                                                <PowerOff className="h-4 w-4 text-muted-foreground mb-1 mt-1" />
                                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Sin Turno</span>
                                                            </div>
                                                        </td>
                                                    )
                                                ) : (
                                                    <>
                                                        {/* Dia */}
                                                        {granelDiaWeight > 0 ? (
                                                            <td className="px-1 py-1 text-center border-l bg-emerald-500/5 w-[90px]">
                                                                <div className="flex flex-col items-center">
                                                                    <div className="font-bold text-emerald-700 text-[10px] leading-tight">{(weekStats.granelDiaQQ || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                                </div>
                                                            </td>
                                                        ) : (
                                                            <td className="px-1 py-1 text-center border-l bg-emerald-500/5 opacity-40 w-[90px]">
                                                                <div className="flex flex-col items-center justify-center">
                                                                    <PowerOff className="h-4 w-4 text-muted-foreground mb-1 mt-1" />
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Sin Turno</span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        {/* Noche */}
                                                        {granelNocWeight > 0 ? (
                                                            <td className="px-1 py-1 text-center border-l bg-emerald-500/5 w-[90px]">
                                                                <div className="flex flex-col items-center">
                                                                    <div className="font-bold text-emerald-700 text-[10px] leading-tight">{(weekStats.granelNocQQ || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                                </div>
                                                            </td>
                                                        ) : (
                                                            <td className="px-1 py-1 text-center border-l bg-emerald-500/5 opacity-40 w-[90px]">
                                                                <div className="flex flex-col items-center justify-center">
                                                                    <PowerOff className="h-4 w-4 text-muted-foreground mb-1 mt-1" />
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Sin Turno</span>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                            {/* Celdas de Mano de Obra (Semanal) */}
                            <TooltipProvider>
                                <td className="px-1 py-1 border-l text-center bg-blue-50/30">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex flex-col items-center cursor-help">
                                                <div className="flex gap-1 mb-0.5">
                                                    {laborStats.weeklyDetail[week.weekNum]?.totalSupDia > 0 && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded-sm font-bold whitespace-nowrap">Sup-{laborStats.weeklyDetail[week.weekNum].totalSupDia}</span>}
                                                    {laborStats.weeklyDetail[week.weekNum]?.totalOpDia > 0 && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded-sm font-bold whitespace-nowrap">Op-{laborStats.weeklyDetail[week.weekNum].totalOpDia}</span>}
                                                </div>
                                                <div className="flex gap-1">
                                                    {laborStats.weeklyDetail[week.weekNum]?.totalEnvDia > 0 && <span className="text-[8px] bg-sky-100 text-sky-700 px-1 rounded-sm font-bold whitespace-nowrap">Env-{laborStats.weeklyDetail[week.weekNum].totalEnvDia}</span>}
                                                    {laborStats.weeklyDetail[week.weekNum]?.totalGraDia > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded-sm font-bold whitespace-nowrap">Gr-{laborStats.weeklyDetail[week.weekNum].totalGraDia}</span>}
                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="p-3">
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-black border-b pb-1 mb-1 uppercase text-blue-700">Desglose Día (Sem {week.weekNum})</div>
                                                <div className="flex justify-between gap-4 text-[10px]"><span>Supervisor:</span> <span className="font-bold">{laborStats.weeklyDetail[week.weekNum]?.totalSupDia || 0}</span></div>
                                                <div className="flex justify-between gap-4 text-[10px]"><span>Operador:</span> <span className="font-bold">{laborStats.weeklyDetail[week.weekNum]?.totalOpDia || 0}</span></div>
                                                <div className="flex justify-between gap-4 text-[10px]"><span>Envasadores (+Cosedor):</span> <span className="font-bold">{laborStats.weeklyDetail[week.weekNum]?.totalEnvDia || 0}</span></div>
                                                <div className="flex justify-between gap-4 text-[10px]"><span>Granelero:</span> <span className="font-bold">{laborStats.weeklyDetail[week.weekNum]?.totalGraDia || 0}</span></div>
                                                <div className="border-t pt-1 mt-1 flex justify-between gap-4 text-[10px] font-black"><span>TOTAL:</span> <span>{laborStats.weeklyDetail[week.weekNum]?.totalPersDia || 0} Pers.</span></div>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </td>
                                <td className="px-1 py-1 border-l border-r text-center bg-blue-50/30">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex flex-col items-center cursor-help">
                                                <div className="flex gap-1 mb-0.5">
                                                    {laborStats.weeklyDetail[week.weekNum]?.totalSupNoc > 0 && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded-sm font-bold whitespace-nowrap">Sup-{laborStats.weeklyDetail[week.weekNum].totalSupNoc}</span>}
                                                    {laborStats.weeklyDetail[week.weekNum]?.totalOpNoc > 0 && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded-sm font-bold whitespace-nowrap">Op-{laborStats.weeklyDetail[week.weekNum].totalOpNoc}</span>}
                                                </div>
                                                <div className="flex gap-1">
                                                    {laborStats.weeklyDetail[week.weekNum]?.totalEnvNoc > 0 && <span className="text-[8px] bg-sky-100 text-sky-700 px-1 rounded-sm font-bold whitespace-nowrap">Env-{laborStats.weeklyDetail[week.weekNum].totalEnvNoc}</span>}
                                                    {laborStats.weeklyDetail[week.weekNum]?.totalGraNoc > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded-sm font-bold whitespace-nowrap">Gr-{laborStats.weeklyDetail[week.weekNum].totalGraNoc}</span>}
                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="p-3">
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-black border-b pb-1 mb-1 uppercase text-indigo-700">Desglose Noche (Sem {week.weekNum})</div>
                                                <div className="flex justify-between gap-4 text-[10px]"><span>Supervisor:</span> <span className="font-bold">{laborStats.weeklyDetail[week.weekNum]?.totalSupNoc || 0}</span></div>
                                                <div className="flex justify-between gap-4 text-[10px]"><span>Operador:</span> <span className="font-bold">{laborStats.weeklyDetail[week.weekNum]?.totalOpNoc || 0}</span></div>
                                                <div className="flex justify-between gap-4 text-[10px]"><span>Envasadores (+Cosedor):</span> <span className="font-bold">{laborStats.weeklyDetail[week.weekNum]?.totalEnvNoc || 0}</span></div>
                                                <div className="flex justify-between gap-4 text-[10px]"><span>Granelero:</span> <span className="font-bold">{laborStats.weeklyDetail[week.weekNum]?.totalGraNoc || 0}</span></div>
                                                <div className="border-t pt-1 mt-1 flex justify-between gap-4 text-[10px] font-black"><span>TOTAL:</span> <span>{laborStats.weeklyDetail[week.weekNum]?.totalPersNoche || 0} Pers.</span></div>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </td>
                            </TooltipProvider>
                            <td className="px-2 py-1 border-l text-center bg-primary/5 font-bold text-primary text-[10px]">
                                {weekFamiliarQQ > 0 ? weekFamiliarQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                            </td>
                            {isGranelActive && (() => {
                                const weekGranelQQTotal = (productionStats.byWeek[week.weekNum]?.granelQQ) || 0;
                                return (
                                    <>
                                        <td className="px-2 py-1 border-l text-center bg-primary/5 font-bold text-primary text-[10px]">
                                            {weekGranelQQTotal > 0 ? weekGranelQQTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </td>
                                        <td className="px-2 py-1 border-l text-center bg-violet-500/10 font-black text-violet-700 text-[10px]">
                                            {(weekFamiliarQQ + weekGranelQQTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </>
                                );
                            })()}
                        </tr>
                    );
                } else {
                    week.days.forEach((day, dIndex) => {
                        const dateStr = day.toISOString().split('T')[0];
                        const dayStats = productionStats.byWeek[week.weekNum].days[dateStr] || { familiarQQ: 0, granelQQ: 0, balanceQQ: 0 };
                        const isActive = customActiveDays[dateStr] !== false;
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const isHoliday = allHolidays.has(dateStr);

                        let dayFamiliarQQ = 0;
                        let hasAnyProduction = false;

                        if (isActive) {
                            let dayWeight = 0;
                            activeMachines.forEach(m => {
                                const oD = overrides[`${m.id}-${dateStr}-dia`];
                                const oN = overrides[`${m.id}-${dateStr}-noche`];
                                const isInactiveD = oD?.inactive || (!oD);
                                const isInactiveN = oN?.inactive || (!oN);
                                if (!isInactiveD) dayWeight = Math.max(dayWeight, 0.5);
                                if (!isInactiveN) dayWeight = Math.max(dayWeight, 1.0);
                            });
                            grandTotalDays += dayWeight;
                        }
                        const machineCells = activeMachines.flatMap(m => {
                            const conf = machineConfig[m.id];
                            const keyDia = `${m.id}-${dateStr}-dia`;
                            const keyNoc = `${m.id}-${dateStr}-noche`;
                            const overrideDia = overrides[keyDia];
                            const overrideNoc = overrides[keyNoc];
                            const pIdDia = overrideDia?.productId || conf?.productId;
                            const sDia = overrideDia?.speed || lastUsedSpeed || conf?.speed || 38;
                            const prodDia = products.find(p => p.id === pIdDia);
                            const pIdNoc = overrideNoc?.productId || conf?.productId;
                            const sNoc = overrideNoc?.speed || lastUsedSpeed || conf?.speed || 38;
                            const prodNoc = products.find(p => p.id === pIdNoc);

                            if (!prodDia || !prodNoc || !conf || !isActive) {
                                if (machinesDisplayMode === 'combined') {
                                    return [<td key={m.id + 'c'} className="px-1 py-1 border-l text-center text-muted-foreground opacity-30">-</td>];
                                }
                                return [
                                    <td key={m.id + 'd'} className="px-1 py-1 border-l text-center text-muted-foreground opacity-30">-</td>,
                                    <td key={m.id + 'n'} className="px-1 py-1 border-l text-center text-muted-foreground opacity-30">-</td>
                                ];
                            }

                            const isManualAndNoOverrideD = !overrideDia;
                            const isManualAndNoOverrideN = !overrideNoc;

                            const qqDia = (overrideDia?.inactive || isManualAndNoOverrideD) ? 0 : ((sDia * 60) * rendimiento * horasTurnoDia * (prodDia.presentationWeight || 50)) / 50;
                            const qqNoche = (overrideNoc?.inactive || isManualAndNoOverrideN) ? 0 : ((sNoc * 60) * rendimiento * horasTurnoNoche * (prodNoc.presentationWeight || 50)) / 50;

                            grandTotalMachines[m.id].dia += qqDia;
                            grandTotalMachines[m.id].noche += qqNoche;
                            dayFamiliarQQ += (qqDia + qqNoche);

                            const machineDays = customMachineDays[m.id] || 0;
                            const diaCell = (
                                <td key={m.id + 'd'} className={cn("px-1 py-2 border-l text-center relative", !isReadOnly && "cursor-pointer hover:bg-primary/5", (overrideDia || isManualAndNoOverrideD) && "bg-amber-500/5", isHoliday && "bg-indigo-50/30", !isHoliday && isWeekend && "bg-amber-50/30")} style={{ borderLeftColor: prodDia.color ? `${prodDia.color}80` : undefined, borderLeftWidth: prodDia.color ? "2px" : undefined }} onClick={() => !isReadOnly && setEditingOverride({ key: keyDia, machineId: m.id, title: dateStr, shift: 'dia', currentProductId: pIdDia, currentSpeed: sDia, inactive: !!overrideDia?.inactive, startDate: dateStr, endDate: dateStr })}>
                                    {renderCellInfo(prodDia, qqDia, sDia, !!overrideDia?.inactive || isManualAndNoOverrideD)}
                                </td>
                            );
                            const nocCell = (
                                <td key={m.id + 'n'} className={cn("px-1 py-2 border-l text-center relative", !isReadOnly && "cursor-pointer hover:bg-primary/5", (overrideNoc || isManualAndNoOverrideN) && "bg-amber-500/5", isHoliday && "bg-indigo-50/30", !isHoliday && isWeekend && "bg-amber-50/30")} style={{ borderLeftColor: prodNoc.color ? `${prodNoc.color}80` : undefined, borderLeftWidth: prodNoc.color ? "2px" : undefined }} onClick={() => !isReadOnly && setEditingOverride({ key: keyNoc, machineId: m.id, title: dateStr, shift: 'noche', currentProductId: pIdNoc, currentSpeed: sNoc, inactive: !!overrideNoc?.inactive, startDate: dateStr, endDate: dateStr })}>
                                    {renderCellInfo(prodNoc, qqNoche, sNoc, !!overrideNoc?.inactive || isManualAndNoOverrideN)}
                                </td>
                            );

                            if (machinesDisplayMode === 'combined') {
                                return [
                                    <td key={m.id + 'c'} className={cn("px-1 py-2 border-l text-center relative", !isReadOnly && "cursor-pointer hover:bg-primary/5")}>
                                        <div className="flex flex-col items-center">
                                            <div className="font-bold text-primary text-[9px]">{(qqDia + qqNoche).toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                                            <div className="text-[7px] text-muted-foreground">General</div>
                                        </div>
                                    </td>
                                ];
                            }

                            return [diaCell, nocCell];
                        });
                        grandTotalSemanal += dayFamiliarQQ;
                        rows.push(
                            <tr key={dateStr} className={cn("border-b hover:bg-muted/30", !isActive && "bg-muted/10 opacity-60")}>
                                {wIndex === 0 && dIndex === 0 && (
                                    <td rowSpan={group.weeks.reduce((acc, w) => acc + w.days.length, 0)} className="px-2 py-1 bg-muted/10 border-r align-middle text-center">
                                        <div className="text-xs font-bold text-foreground">{group.monthName.substring(0, 3)}</div>
                                    </td>
                                )}
                                {dIndex === 0 && (
                                    <td rowSpan={week.days.length} className="px-2 py-1 text-[10px] text-center border-r bg-muted/5 font-medium">S{week.weekNum}</td>
                                )}
                                <td className={cn(
                                    "px-1 py-1 text-center border-r transition-colors",
                                    isHoliday ? "bg-indigo-50" : (isWeekend ? "bg-amber-50" : "")
                                )}>
                                    <div className="flex flex-col items-center gap-0.5 py-0.5">
                                        <span className={cn(
                                            "text-[10px] font-bold leading-none",
                                            isHoliday ? "text-indigo-700" : (isWeekend ? "text-amber-700" : "text-foreground")
                                        )}>
                                            {dayNames[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                                        </span>
                                        <span className={cn(
                                            "text-[8px] leading-none",
                                            isHoliday ? "text-indigo-600/70" : (isWeekend ? "text-amber-600/70" : "text-muted-foreground")
                                        )}>
                                            {day.getDate()}/{day.getMonth() + 1}/{day.getFullYear()}
                                        </span>
                                    </div>
                                </td>
                                {machineCells}
                                {isGranelActive && (
                                    <>
                                        {granelDisplayMode === 'combined' ? (
                                            (() => {
                                                const isGActive = (s: 'dia' | 'noche') => {
                                                    if (!isActive) return false;
                                                    const ov = overrides[`99-${dateStr}-${s}`];
                                                    if (ov?.inactive) return false;
                                                    if (!ov) return false;
                                                    return true;
                                                };
                                                const isDiaActive = isGActive('dia');
                                                const isNocheActive = isGActive('noche');
                                                const isInactive = !isDiaActive && !isNocheActive;
                                                const dailyRemainder = Math.max(0, dailySupply - dayFamiliarQQ);

                                                return (
                                                    <td
                                                        key={`99-${dateStr}-comb`}
                                                        className={cn(
                                                            "px-1 py-2 border-l text-center transition-all cursor-pointer hover:bg-emerald-500/10",
                                                            isInactive ? "bg-muted/20 grayscale" : "bg-emerald-500/5",
                                                            !isInactive && isHoliday && "bg-indigo-50/30",
                                                            !isInactive && !isHoliday && isWeekend && "bg-amber-50/30"
                                                        )}
                                                        onClick={() => {
                                                            if (isReadOnly) return;
                                                            setEditingOverride({
                                                                key: `99-${dateStr}-dia`,
                                                                machineId: 99,
                                                                title: dateStr,
                                                                shift: 'dia',
                                                                currentProductId: 'granel',
                                                                currentSpeed: 0,
                                                                inactive: isInactive,
                                                                applyToBothShifts: true,
                                                                startDate: dateStr,
                                                                endDate: dateStr
                                                            });
                                                        }}
                                                    >
                                                        <div className="flex flex-col items-center justify-center">
                                                            {isInactive ? (
                                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                                    <PowerOff className="h-4 w-4 text-muted-foreground mb-1" />
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Sin Turno</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="font-bold text-emerald-700 text-[10px] leading-tight">
                                                                        {dailyRemainder > 0.01 ? dailyRemainder.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })()
                                        ) : (
                                            ['dia', 'noche'].map(shift => {
                                                const key = `99-${dateStr}-${shift}`;
                                                const isGActive = (s: string) => {
                                                    if (!isActive) return false;
                                                    const ov = overrides[`99-${dateStr}-${s}`];
                                                    if (ov?.inactive) return false;
                                                    if (!ov) return false;
                                                    return true;
                                                };
                                                const isInactive = !isGActive(shift);
                                                const isDiaActive = isGActive('dia');
                                                const isNocheActive = isGActive('noche');
                                                const activeCount = (isDiaActive ? 1 : 0) + (isNocheActive ? 1 : 0);
                                                const dailyRemainder = Math.max(0, dailySupply - dayFamiliarQQ);
                                                const shiftValue = activeCount > 0 ? dailyRemainder / activeCount : 0;

                                                return (
                                                    <td
                                                        key={key}
                                                        className={cn(
                                                            "px-1 py-2 border-l text-center transition-all cursor-pointer hover:bg-emerald-500/10",
                                                            isInactive ? "bg-muted/20 grayscale" : "bg-emerald-500/5",
                                                            !isInactive && isHoliday && "bg-indigo-50/30",
                                                            !isInactive && !isHoliday && isWeekend && "bg-amber-50/30"
                                                        )}
                                                        onClick={() => {
                                                            if (isReadOnly) return;
                                                            setEditingOverride({
                                                                key: key,
                                                                machineId: 99,
                                                                title: dateStr,
                                                                shift: shift as 'dia' | 'noche',
                                                                currentProductId: 'granel',
                                                                currentSpeed: 0,
                                                                inactive: isInactive,
                                                                startDate: dateStr,
                                                                endDate: dateStr
                                                            });
                                                        }}
                                                    >
                                                        <div className="flex flex-col items-center justify-center">
                                                            {isInactive ? (
                                                                <div className="flex flex-col items-center justify-center opacity-40">
                                                                    <PowerOff className="h-4 w-4 text-muted-foreground mb-1" />
                                                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Sin Turno</span>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="font-bold text-emerald-700 text-[10px] leading-tight">
                                                                        {shiftValue > 0.01 ? shiftValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })
                                        )}
                                    </>
                                )}
                                {/* Celdas de Mano de Obra (Diaria) */}
                                <TooltipProvider>
                                    <td className="px-1 py-1 border-l text-center bg-blue-50/30">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex flex-col items-center cursor-help">
                                                    <div className="flex gap-1 mb-0.5">
                                                        {(laborStats.dailyDetail[dateStr]?.dia.supervisor || 0) > 0 && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded-sm font-bold whitespace-nowrap">Sup-{laborStats.dailyDetail[dateStr].dia.supervisor}</span>}
                                                        {(laborStats.dailyDetail[dateStr]?.dia.operador || 0) > 0 && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded-sm font-bold whitespace-nowrap">Op-{laborStats.dailyDetail[dateStr].dia.operador}</span>}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {(laborStats.dailyDetail[dateStr]?.dia.envasadores || 0) > 0 && <span className="text-[8px] bg-sky-100 text-sky-700 px-1 rounded-sm font-bold whitespace-nowrap">Env-{laborStats.dailyDetail[dateStr].dia.envasadores}</span>}
                                                        {(laborStats.dailyDetail[dateStr]?.dia.granelero || 0) > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded-sm font-bold whitespace-nowrap">Gr-{laborStats.dailyDetail[dateStr].dia.granelero}</span>}
                                                    </div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="p-3">
                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] font-black border-b pb-1 mb-1 uppercase text-blue-700">Desglose Día ({dateStr})</div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Supervisor:</span> <span className="font-bold">{laborStats.dailyDetail[dateStr]?.dia.supervisor || 0}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Operador:</span> <span className="font-bold">{laborStats.dailyDetail[dateStr]?.dia.operador || 0}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Envasadores (+Cosedor):</span> <span className="font-bold">{laborStats.dailyDetail[dateStr]?.dia.envasadores || 0}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Granelero:</span> <span className="font-bold">{laborStats.dailyDetail[dateStr]?.dia.granelero || 0}</span></div>
                                                    <div className="border-t pt-1 mt-1 flex justify-between gap-4 text-[10px] font-black"><span>TOTAL:</span> <span>{laborStats.dailyDetail[dateStr]?.dia.total || 0} Pers.</span></div>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>
                                    <td className="px-1 py-1 border-l border-r text-center bg-blue-50/30">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex flex-col items-center cursor-help">
                                                    <div className="flex gap-1 mb-0.5">
                                                        {(laborStats.dailyDetail[dateStr]?.noche.supervisor || 0) > 0 && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded-sm font-bold whitespace-nowrap">Sup-{laborStats.dailyDetail[dateStr].noche.supervisor}</span>}
                                                        {(laborStats.dailyDetail[dateStr]?.noche.operador || 0) > 0 && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded-sm font-bold whitespace-nowrap">Op-{laborStats.dailyDetail[dateStr].noche.operador}</span>}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {(laborStats.dailyDetail[dateStr]?.noche.envasadores || 0) > 0 && <span className="text-[8px] bg-sky-100 text-sky-700 px-1 rounded-sm font-bold whitespace-nowrap">Env-{laborStats.dailyDetail[dateStr].noche.envasadores}</span>}
                                                        {(laborStats.dailyDetail[dateStr]?.noche.granelero || 0) > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded-sm font-bold whitespace-nowrap">Gr-{laborStats.dailyDetail[dateStr].noche.granelero}</span>}
                                                    </div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="p-3">
                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] font-black border-b pb-1 mb-1 uppercase text-indigo-700">Desglose Noche ({dateStr})</div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Supervisor:</span> <span className="font-bold">{laborStats.dailyDetail[dateStr]?.noche.supervisor || 0}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Operador:</span> <span className="font-bold">{laborStats.dailyDetail[dateStr]?.noche.operador || 0}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Envasadores (+Cosedor):</span> <span className="font-bold">{laborStats.dailyDetail[dateStr]?.noche.envasadores || 0}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Granelero:</span> <span className="font-bold">{laborStats.dailyDetail[dateStr]?.noche.granelero || 0}</span></div>
                                                    <div className="border-t pt-1 mt-1 flex justify-between gap-4 text-[10px] font-black"><span>TOTAL:</span> <span>{laborStats.dailyDetail[dateStr]?.noche.total || 0} Pers.</span></div>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>
                                </TooltipProvider>

                                <td className="px-2 py-1 border-l text-center bg-primary/5 font-bold text-primary text-[10px]">
                                    {dayFamiliarQQ > 0 ? dayFamiliarQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                </td>
                                {isGranelActive && (
                                    <>
                                        <td className="px-2 py-1 border-l text-center bg-primary/5 font-bold text-primary text-[10px]">
                                            {dayStats.granelQQ > 0.01 ? dayStats.granelQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </td>
                                        <td className="px-2 py-1 border-l text-center bg-violet-500/10 font-black text-violet-700 text-[10px]">
                                            {dayStats.totalQQ > 0.01 ? dayStats.totalQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                                        </td>
                                    </>
                                )}

                            </tr>
                        );
                    });
                }
            });
        });

        const totalsCells = activeMachines.flatMap(m => {
            const totals = grandTotalMachines[m.id];
            const hasDays = viewMode === 'semana';
            const cells = [
                <td key={m.id + 'd'} className="px-1 py-1 border-l text-center bg-card border-t border-b">
                    <div className="font-bold text-primary text-[9px]">{totals.dia > 0.01 ? totals.dia.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</div>
                    <div className="text-[7px] text-muted-foreground uppercase leading-tight">Dia</div>
                </td>,
                <td key={m.id + 'n'} className="px-1 py-1 border-l text-center bg-card border-t border-b">
                    <div className="font-bold text-primary text-[9px]">{totals.noche > 0.01 ? totals.noche.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</div>
                    <div className="text-[7px] text-muted-foreground uppercase leading-tight">Noc</div>
                </td>
            ];
            if (hasDays) {
                cells.unshift(
                    <td key={m.id + 's'} className="px-0 py-1 border-l text-center bg-muted/5 border-t border-b w-8">
                        <div className="font-bold text-muted-foreground text-[9px]">{totals.days > 0.01 ? totals.days.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-"}</div>
                        <div className="text-[7px] text-muted-foreground uppercase leading-tight">Días</div>
                    </td>
                );
            }
            return cells;
        });

        return (
            <div className="rounded-lg border shadow-sm bg-card w-full h-full flex flex-col overflow-hidden">
                <div className="w-full flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                    <table className="min-w-full text-sm text-left table-fixed border-collapse">
                        <colgroup>
                            <col className="w-8" />
                            <col className="w-10" />
                            {viewMode === 'dia' && <col className="w-20" />}
                            {activeMachines.map(m => (
                                <React.Fragment key={m.id}>
                                    {viewMode === 'semana' && <col className="w-8" />}
                                    {machinesDisplayMode === 'combined' && viewMode !== 'semana' ? (
                                        <col className="w-20" />
                                    ) : (
                                        <>
                                            <col className="min-w-[85px]" />
                                            <col className="min-w-[85px]" />
                                        </>
                                    )}
                                </React.Fragment>
                            ))}
                            {isGranelActive && (
                                <React.Fragment key="granel-cols">
                                    {viewMode === 'semana' && <col className="w-8" />}
                                    {granelDisplayMode === 'combined' ? (
                                        <col className="w-[85px]" />
                                    ) : (
                                        <>
                                            <col className="min-w-[85px]" />
                                            <col className="min-w-[85px]" />
                                        </>
                                    )}
                                </React.Fragment>
                            )}
                            <col className="w-20" />
                            <col className="w-20" />
                            <col className="w-[85px]" />
                            {isGranelActive && (
                                <>
                                    <col className="w-[85px]" />
                                    <col className="w-[85px]" />
                                </>
                            )}
                        </colgroup>
                        <thead className="text-[10px] uppercase bg-muted text-muted-foreground sticky top-0 z-10 shadow-sm leading-none">
                            <tr>
                                <th className="px-2 py-2 border-r bg-muted w-8 text-center" rowSpan={2}>Mes</th>
                                <th className="px-2 py-2 border-r bg-muted w-10 text-center" rowSpan={2}>Sem</th>
                                {viewMode === 'dia' && (
                                    <th className="px-2 py-2 border-r bg-muted w-20 text-center" rowSpan={2}>Dia</th>
                                )}
                                {machineHeaders}
                                <th rowSpan={2} className="px-1 py-1 border-l text-center text-[9px] font-black uppercase leading-tight bg-primary/10 text-primary/80">
                                    <div>Familiar</div>
                                    <div className="text-[7px] font-bold opacity-70">QQ</div>
                                </th>
                                {isGranelActive && (
                                    <>
                                        <th rowSpan={2} className="px-1 py-1 border-l text-center text-[9px] font-black uppercase leading-tight bg-primary/10 text-primary/80">
                                            <div>Granel</div>
                                            <div className="text-[7px] font-bold opacity-70">QQ</div>
                                        </th>
                                        <th rowSpan={2} className="px-1 py-1 border-l text-center text-[9px] font-black uppercase leading-tight bg-violet-500/10 text-violet-700">
                                            <div>Total Producido</div>
                                            <div className="text-[7px] font-bold opacity-70">QQ</div>
                                        </th>
                                    </>
                                )}
                            </tr>
                            <tr>{shiftHeaders}</tr>
                        </thead>
                        <tbody>
                            {rows.length > 0 ? rows : (
                                <tr><td colSpan={20} className="px-4 py-8 text-center text-muted-foreground text-xs">No hay datos.</td></tr>
                            )}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] bg-card border-t-2">
                            <tr className="font-bold">
                                <td colSpan={viewMode === 'dia' ? 2 : 1} className="px-2 py-1 text-right bg-card text-[8px] uppercase font-bold border-t border-b">Total:</td>
                                <td className="px-1 py-1 text-center bg-muted/30 border-r text-[9px] font-bold text-foreground border-t border-b">
                                    {grandTotalDays > 0 ? grandTotalDays.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-"} <span className="text-[7px] text-muted-foreground font-normal">Días</span>
                                </td>
                                {totalsCells}
                                {isGranelActive && (
                                    <>
                                        {viewMode === 'semana' && (
                                            <td className="px-0 py-1 border-l text-center bg-muted/5 border-t border-b w-8">
                                                <div className="font-bold text-muted-foreground text-[9px]">
                                                    {(() => {
                                                        // Sumar todos los días de Granel (Custom o Auto)
                                                        let totalG = 0;
                                                        groupedWeeks.forEach(g => {
                                                            g.weeks.forEach(w => {
                                                                const autoG = w.days.reduce((total, d) => {
                                                                    const dateStr = d.toISOString().split('T')[0];
                                                                    if (customActiveDays[dateStr] === false) return total;
                                                                    const oD = overrides[`99-${dateStr}-dia`];
                                                                    const oN = overrides[`99-${dateStr}-noche`];
                                                                    const isInactiveD = oD?.inactive || (!oD);
                                                                    const isInactiveN = oN?.inactive || (!oN);
                                                                    let weight = 0;
                                                                    if (!isInactiveD) weight += 0.5;
                                                                    if (!isInactiveN) weight += 0.5;
                                                                    return total + weight;
                                                                }, 0);
                                                                const actualG = customMachineDays[`99-${w.weekNum}`] !== undefined ? customMachineDays[`99-${w.weekNum}`] : autoG;
                                                                totalG += actualG;
                                                            });
                                                        });
                                                        return totalG > 0 ? totalG.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "-";
                                                    })()}
                                                </div>
                                                <div className="text-[7px] text-muted-foreground uppercase leading-tight">Días</div>
                                            </td>
                                        )}
                                        {granelDisplayMode === 'combined' ? (
                                            <td className="px-2 py-1 border-l text-center bg-emerald-50/30 text-emerald-700 text-[10px] font-bold border-t border-b">{totalGranelQQ > 0.01 ? totalGranelQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                                        ) : (
                                            <>
                                                <td className="px-2 py-1 border-l text-center bg-emerald-50/30 text-emerald-700 text-[9px] font-bold border-t border-b">{totalGranelDiaQQ > 0.01 ? totalGranelDiaQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                                                <td className="px-2 py-1 border-l text-center bg-emerald-50/30 text-emerald-700 text-[9px] font-bold border-t border-b">{totalGranelNocQQ > 0.01 ? totalGranelNocQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                                            </>
                                        )}
                                    </>
                                )}
                                {/* Mano de Obra Totales */}
                                <TooltipProvider>
                                    <td className="px-1 py-1 border-l text-center bg-blue-50/30 border-t border-b">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="cursor-help">
                                                    <div className="font-bold text-blue-700 text-[11px]">{laborStats.globalTotalDia > 0 ? laborStats.globalTotalDia : "-"}</div>
                                                    <div className="text-[7px] text-blue-600/70 uppercase leading-tight font-medium">Pers./Turnos</div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="p-3">
                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] font-black border-b pb-1 mb-1 uppercase text-blue-700">Desglose Total Día</div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Supervisor:</span> <span className="font-bold">{laborStats.globalTotalSupDia}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Operador:</span> <span className="font-bold">{laborStats.globalTotalOpDia}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Envasadores (+Cosedor):</span> <span className="font-bold">{laborStats.globalTotalEnvDia}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Granelero:</span> <span className="font-bold">{laborStats.globalTotalGraDia}</span></div>
                                                    <div className="border-t pt-1 mt-1 flex justify-between gap-4 text-[10px] font-black"><span>TOTAL:</span> <span>{laborStats.globalTotalDia} Pers.</span></div>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>
                                    <td className="px-1 py-1 border-l border-r text-center bg-blue-50/30 border-t border-b">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="cursor-help">
                                                    <div className="font-bold text-blue-700 text-[11px]">{laborStats.globalTotalNoche > 0 ? laborStats.globalTotalNoche : "-"}</div>
                                                    <div className="text-[7px] text-blue-600/70 uppercase leading-tight font-medium">Pers./Turnos</div>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="p-3">
                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] font-black border-b pb-1 mb-1 uppercase text-indigo-700">Desglose Total Noche</div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Supervisor:</span> <span className="font-bold">{laborStats.globalTotalSupNoc}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Operador:</span> <span className="font-bold">{laborStats.globalTotalOpNoc}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Envasadores (+Cosedor):</span> <span className="font-bold">{laborStats.globalTotalEnvNoc}</span></div>
                                                    <div className="flex justify-between gap-4 text-[10px]"><span>Granelero:</span> <span className="font-bold">{laborStats.globalTotalGraNoc}</span></div>
                                                    <div className="border-t pt-1 mt-1 flex justify-between gap-4 text-[10px] font-black"><span>TOTAL:</span> <span>{laborStats.globalTotalNoche} Pers.</span></div>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </td>
                                </TooltipProvider>

                                <td className="px-2 py-1 border-l text-center bg-primary/10 text-primary text-[10px] font-black border-t border-b">{totalFamiliarQQ > 0.01 ? totalFamiliarQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                                {isGranelActive && (
                                    <>
                                        <td className="px-2 py-1 border-l text-center bg-primary/10 text-primary text-[10px] font-black border-t border-b">{totalGranelQQ > 0.01 ? totalGranelQQ.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                                        <td className="px-2 py-1 border-l text-center bg-violet-500/15 text-violet-800 text-[10px] font-black border-t border-b">{(totalFamiliarQQ + totalGranelQQ) > 0.01 ? (totalFamiliarQQ + totalGranelQQ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                                    </>
                                )}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-screen max-h-screen bg-background text-foreground overflow-hidden w-full">
            <Header title="Proyección de Producción" icon={Target}>
                <div className="flex items-center gap-2">
                    {!isSummaryView && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="h-9 w-9"
                            title={isSidebarOpen ? 'Ocultar Panel' : 'Mostrar Panel'}
                        >
                            {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                        </Button>
                    )}
                    {isSummaryView && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSummaryView(false)}
                            className="h-9 w-9 text-primary hover:bg-primary/10"
                            title="Volver a Proyección"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    )}
                    <Separator orientation="vertical" className={cn("h-6 mx-1", isSummaryView && "hidden")} />
                    {!isSummaryView && projectionMode === 'auto' && (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md border-0 ml-2"
                            onClick={() => setIsAgentViewOpen(true)}
                        >
                            <Bot className="h-4 w-4 mr-2" />
                            Agente IA
                        </Button>
                    )}
                    {!isSummaryView && (
                        <div className="flex bg-muted p-1 rounded-md h-9">
                            <Button
                                variant={viewMode === 'semana' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 px-3"
                                onClick={() => setViewMode('semana')}
                                title="Vista Semanal"
                            >
                                <CalendarRange className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'dia' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 px-3"
                                onClick={() => setViewMode('dia')}
                                title="Vista Diaria"
                            >
                                <CalendarDays className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    {!isSummaryView && (
                        <div className="flex items-center gap-1 ml-2">
                            <div
                                className={cn(
                                    "flex items-center gap-2 px-3 min-h-[2rem] py-1 rounded-xl border shadow-sm transition-all duration-300 cursor-help",
                                    isReadOnly
                                        ? "bg-blue-50 border-blue-200 text-blue-700"
                                        : "bg-primary/5 border-primary/20 text-primary"
                                )}
                                title={activeSnapshotName || (isReadOnly ? "Modo Lectura" : "Modo Edición")}
                            >
                                <div className={cn(
                                    "w-2 h-2 rounded-full shrink-0",
                                    isReadOnly ? "bg-blue-600" : "bg-primary animate-pulse"
                                )} />
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-start shrink-0">
                                        <span className="text-[7px] font-black uppercase opacity-50 leading-none">Modo</span>
                                        <span className="text-[9px] font-black uppercase tracking-tight leading-none">
                                            {isReadOnly ? "Lectura" : "Edición"}
                                        </span>
                                    </div>
                                    {(activeSnapshotName || activeScenarioName) && (
                                        <>
                                            <div className="w-[1px] h-4 bg-current/20 shrink-0" />
                                            <span className="text-[10px] font-bold opacity-90 leading-tight max-w-[180px] break-words line-clamp-2 whitespace-pre-wrap">
                                                {activeSnapshotName || `🤖 ${activeScenarioName}`}
                                            </span>
                                        </>
                                    )}
                                </div>
                                {activeSnapshotId && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 ml-1 hover:bg-current/10 text-current"
                                        onClick={() => {
                                            setActiveSnapshotId(null);
                                            setActiveSnapshotName(null);
                                            setActiveSnapshotDate(null);
                                            setIsReadOnly(false);
                                            toast({
                                                title: "Nuevo Escenario",
                                                description: "Se ha limpiado la referencia del escenario actual.",
                                                duration: 3000
                                            });
                                        }}
                                        title="Nuevo / Limpiar Escenario"
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    setIsSummaryView(true);
                                    setIsSidebarOpen(false);
                                }}
                                className="h-8 w-8 ml-1 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10"
                                title="Reporte Detallado"
                            >
                                <BarChartIcon className="h-4 w-4" />
                            </Button>
                            {!isReadOnly && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={activeSnapshotId ? () => handleSaveSnapshot() : () => setIsSaveSnapshotOpen(true)}
                                    className={cn(
                                        "h-8 w-8 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10",
                                        isSavingSnapshot && "animate-pulse"
                                    )}
                                    title={activeSnapshotId ? "Actualizar Escenario" : "Guardar Nuevo Escenario"}
                                    disabled={isSavingSnapshot}
                                >
                                    {isSavingSnapshot ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </Button>
                            )}
                        </div>
                    )}
                    {!isSummaryView && (
                        <Button variant="outline" size="icon" onClick={() => setIsHistoryOpen(true)} className="h-8 w-8 ml-1 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10" title="Ver Historial">
                            <History className="h-4 w-4" />
                        </Button>
                    )}
                    {!isSummaryView && (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setIsPDFModalOpen(true)}
                            className="h-8 w-8 ml-1 text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                            title="Descargar Reporte PDF"
                        >
                            <FileDown className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </Header>

            <main className="flex-1 min-h-0 p-3 overflow-hidden flex flex-col bg-muted/20">
                <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
                    {isSidebarOpen && (
                        <div id="main-sidebar" className="w-full lg:w-64 space-y-3 overflow-y-auto pr-1 no-scrollbar shrink-0 animate-in slide-in-from-left duration-200">


                            <Card className="border rounded-lg shadow-sm overflow-hidden">
                                <div
                                    className="bg-muted/50 px-3 py-1.5 border-b font-medium text-xs flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => toggleSection('temporada')}
                                >
                                    <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Temporada</div>
                                    {collapsedSections.temporada ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                                </div>
                                {!collapsedSections.temporada && (
                                    <div className="p-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex bg-muted p-0.5 rounded">
                                            <Button disabled={isReadOnly} variant={season === 'zafra' ? 'default' : 'ghost'} size="sm" className="flex-1 h-6 text-[10px]" onClick={() => setSeason('zafra')}>Zafra</Button>
                                            <Button disabled={isReadOnly} variant={season === 'no-zafra' ? 'default' : 'ghost'} size="sm" className="flex-1 h-6 text-[10px]" onClick={() => setSeason('no-zafra')}>No Zafra</Button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Inicio de Zafra</Label>
                                                <Input
                                                    disabled={isReadOnly}
                                                    type="date"
                                                    value={zafraStartDate}
                                                    onChange={(e) => setZafraStartDate(e.target.value)}
                                                    className="h-8 text-[11px] bg-muted/30 border-primary/20"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Término de Zafra</Label>
                                                <Input
                                                    disabled={isReadOnly}
                                                    type="date"
                                                    value={zafraEndDate}
                                                    onChange={(e) => setZafraEndDate(e.target.value)}
                                                    className="h-8 text-[11px] bg-muted/30 border-primary/20"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                            <Card className="border rounded-lg shadow-sm overflow-hidden">
                                <div
                                    className="bg-muted/50 px-3 py-1.5 border-b font-medium text-xs flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => toggleSection('proyeccion')}
                                >
                                    <div className="flex items-center gap-1.5"><MousePointer2 className="h-3.5 w-3.5" /> Modo de Proyección</div>
                                    {collapsedSections.proyeccion ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                                </div>
                                {!collapsedSections.proyeccion && (
                                    <div className="p-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex bg-muted p-0.5 rounded">
                                            <Button disabled={isReadOnly} variant={projectionMode === 'auto' ? 'default' : 'ghost'} size="sm" className="flex-1 h-6 text-[10px]" onClick={() => setProjectionMode('auto')}>IA</Button>
                                            <Button disabled={isReadOnly} variant={projectionMode === 'manual' ? 'default' : 'ghost'} size="sm" className="flex-1 h-6 text-[10px]" onClick={() => setProjectionMode('manual')}>Manual</Button>
                                        </div>
                                        <p className="text-[9px] text-muted-foreground px-1 text-center">
                                            {projectionMode === 'auto' ? 'La IA de Planta Copilot y el Smart Engine planifican tu zafra de forma óptima.' : 'Tú planificas y editas manualmente cada día en la tabla.'}
                                        </p>
                                        <Button
                                            disabled={isReadOnly}
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-7 text-[10px] text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 mb-1"
                                            onClick={() => setIsGoalsModalOpen(true)}
                                        >
                                            <Target className="h-3 w-3 mr-1" /> Definir Metas
                                        </Button>
                                        <Button
                                            disabled={isReadOnly}
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-7 text-[10px] text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/5"
                                            onClick={() => {
                                                if (confirm('¿Seguro que quieres vaciar por completo la tabla de proyección?')) {
                                                    const cleanOverrides: Record<string, { inactive: boolean }> = {};
                                                    groupedWeeks.forEach(group => {
                                                        group.weeks.forEach(week => {
                                                            week.days.forEach(day => {
                                                                const dateStr = day.toISOString().split('T')[0];
                                                                machines.forEach(m => {
                                                                    cleanOverrides[`${m.id}-${dateStr}-dia`] = { inactive: true };
                                                                    cleanOverrides[`${m.id}-${dateStr}-noche`] = { inactive: true };
                                                                });
                                                                cleanOverrides[`99-${dateStr}-dia`] = { inactive: true };
                                                                cleanOverrides[`99-${dateStr}-noche`] = { inactive: true };
                                                            });
                                                        });
                                                    });
                                                    setOverrides(cleanOverrides);
                                                    toast({ title: 'Tabla Vacía', description: 'Se han desactivado todas las máquinas para iniciar una planificación limpia en el modo actual.' });
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1" /> Vaciar Tabla
                                        </Button>
                                    </div>
                                )}
                            </Card>
                            <Card className="border rounded-lg shadow-sm overflow-hidden">
                                <div
                                    className="bg-muted/50 px-3 py-1.5 border-b font-medium text-xs flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => toggleSection('parametros')}
                                >
                                    <div className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Parámetro</div>
                                    {collapsedSections.parametros ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                                </div>
                                {!collapsedSections.parametros && (
                                    <div className="p-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="flex items-center justify-between gap-2">
                                            <Label className="text-[10px] font-medium w-20">Eficiencia</Label>
                                            <Input disabled={isReadOnly} type="number" value={rendimiento} onChange={(e) => setRendimiento(Number(e.target.value))} className="h-6 text-[10px] w-14 px-1 text-center" step="0.05" min="0.1" />
                                            <span className="text-[9px] font-mono bg-muted px-1 py-0.5 rounded">{(rendimiento * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <Label className="text-[10px] font-medium w-20">Hr Turno Dias</Label>
                                            <Input disabled={isReadOnly} type="number" value={horasTurnoDia} onChange={(e) => setHorasTurnoDia(Number(e.target.value))} className="h-6 text-[10px] w-14 px-1 text-center" step="0.5" />
                                            <span className="text-[9px] text-muted-foreground w-6 text-right">h</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <Label className="text-[10px] font-medium w-20">Hr Turno Noc</Label>
                                            <Input disabled={isReadOnly} type="number" value={horasTurnoNoche} onChange={(e) => setHorasTurnoNoche(Number(e.target.value))} className="h-6 text-[10px] w-14 px-1 text-center" step="0.5" />
                                            <span className="text-[9px] text-muted-foreground w-6 text-right">h</span>
                                        </div>
                                    </div>
                                )}
                            </Card>


                            <Card className="border rounded-lg shadow-sm overflow-hidden">
                                <div
                                    className="bg-muted/50 px-3 py-1.5 border-b font-medium text-xs flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => toggleSection('envasadoras')}
                                >
                                    <div className="flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" /> Envasadoras</div>
                                    <div className="flex items-center gap-2">
                                        {collapsedSections.envasadoras ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                                    </div>
                                </div>
                                {!collapsedSections.envasadoras && (
                                    <div className="p-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                        {machines.map(machine => {
                                            const conf = machineConfig[machine.id];
                                            if (!conf) return null;
                                            return (
                                                <div key={machine.id} className={cn("p-2 border rounded text-xs", conf.active ? "bg-primary/5 border-primary/30" : "bg-muted/30 opacity-60")}>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-1.5 font-bold text-primary">
                                                            <Switch disabled={isReadOnly} checked={conf.active} onCheckedChange={() => toggleMachine(machine.id)} className="scale-[0.6] origin-left" />
                                                            Maquina #{machine.id}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className={cn("p-2 border rounded text-xs", isGranelActive ? "bg-emerald-500/5 border-emerald-500/30" : "bg-muted/30 opacity-60")}>
                                            <div className="flex items-center gap-1.5 font-bold text-emerald-600">
                                                <Switch disabled={isReadOnly} checked={isGranelActive} onCheckedChange={() => setIsGranelActive(!isGranelActive)} className="scale-[0.6] origin-left" />
                                                Máquina Granel
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-emerald-600/70 hover:text-emerald-600 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsViewConfigModalOpen(true);
                                                }}
                                            >
                                                <Settings2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Card>

                            <Card className="border rounded-lg shadow-sm overflow-hidden">
                                <div
                                    className="bg-muted/50 px-3 py-1.5 border-b font-medium text-xs flex items-center justify-between cursor-pointer hover:bg-muted transition-colors"
                                    onClick={() => toggleSection('manoDeObra')}
                                >
                                    <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Mano de Obra</div>
                                    {collapsedSections.manoDeObra ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
                                </div>
                                {!collapsedSections.manoDeObra && (
                                    <div className="p-2 space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-medium">Tipo de Personal</Label>
                                            <Select
                                                disabled={isReadOnly}
                                                value={laborType}
                                                onValueChange={(val: any) => setLaborType(val)}
                                            >
                                                <SelectTrigger className="h-7 text-[10px] px-1.5 border-primary/20">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="contractor" className="text-[10px]">Contratista (Fijo)</SelectItem>
                                                    <SelectItem value="staff" className="text-[10px]">Zafra (Sueldo + Ben)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {laborType === 'contractor' && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[9px] font-medium">Tarifa Día</Label>
                                                        <span className="text-[8px] font-mono text-primary">$</span>
                                                    </div>
                                                    <Input
                                                        disabled={isReadOnly}
                                                        type="number"
                                                        value={fixedDayRate}
                                                        onChange={(e) => setFixedDayRate(Number(e.target.value))}
                                                        className="h-7 text-[10px] text-center font-bold"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-[9px] font-medium">Tarifa Noche</Label>
                                                        <span className="text-[8px] font-mono text-primary">$</span>
                                                    </div>
                                                    <Input
                                                        disabled={isReadOnly}
                                                        type="number"
                                                        value={fixedNightRate}
                                                        onChange={(e) => setFixedNightRate(Number(e.target.value))}
                                                        className="h-7 text-[10px] text-center font-bold"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-medium">Días Laborales/Sem</Label>
                                                <span className="text-[9px] font-mono bg-muted px-1 rounded">Auto</span>
                                            </div>
                                            <div className="h-7 border rounded bg-muted/20 flex items-center justify-center text-[10px] font-bold">
                                                {laborStats.calculatedDaysPerWeek.toFixed(1)} Días
                                            </div>
                                            <p className="text-[8px] text-muted-foreground leading-tight">Calculado según programación de máquinas.</p>
                                        </div>

                                        <div className="pt-1 border-t mt-1">
                                            <div className="bg-muted/30 rounded p-1.5 space-y-1">
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-muted-foreground">Supervisor:</span>
                                                    <span className="font-bold">1 / turno</span>
                                                </div>
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-muted-foreground">Operador:</span>
                                                    <span className="font-bold">1 / turno</span>
                                                </div>
                                                <div className="flex justify-between text-[9px]">
                                                    <span className="text-muted-foreground">Cosedor:</span>
                                                    <span className="font-bold">1 / turno</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>

                            <Card className="border rounded-lg shadow-sm overflow-hidden border-emerald-500/30">
                                <div
                                    className="bg-emerald-500/5 px-3 py-1.5 border-b font-medium text-xs flex items-center justify-between cursor-pointer hover:bg-emerald-500/10 transition-colors"
                                    onClick={() => toggleSection('combinaciones')}
                                >
                                    <div className="flex items-center gap-1.5 text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Combinaciones</div>
                                    {collapsedSections.combinaciones ? <ChevronDown className="h-3 w-3 text-emerald-700" /> : <ChevronUp className="h-3 w-3 text-emerald-700" />}
                                </div>
                                {!collapsedSections.combinaciones && (
                                    <div className="p-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase px-1">Seguras (Autorizadas)</p>
                                            <div className="space-y-1">
                                                {safeCombinations.slice(0, 5).map((c) => (
                                                    <div key={c.id} className="flex items-center gap-1 bg-emerald-500/5 border border-emerald-500/10 rounded p-1 text-[8px] font-medium text-emerald-800">
                                                        <span className="bg-emerald-500 text-white px-1 rounded-[2px]">{c.m1}</span>
                                                        <span>+</span>
                                                        <span className="bg-emerald-500 text-white px-1 rounded-[2px]">{c.m2}</span>
                                                        <span>+</span>
                                                        <span className="bg-emerald-500 text-white px-1 rounded-[2px]">{c.m3}</span>
                                                        <span className="ml-auto opacity-60 italic">{c.label}</span>
                                                    </div>
                                                ))}
                                                {safeCombinations.length > 5 && (
                                                    <p className="text-[8px] text-center text-muted-foreground italic">+{safeCombinations.length - 5} combinaciones más...</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="pt-1 border-t space-y-1">
                                            <p className="text-[9px] font-bold text-destructive uppercase px-1">Prohibidas (Peligro)</p>
                                            <div className="space-y-1">
                                                {prohibitedCombinations.slice(0, 2).map((c) => (
                                                    <div key={c.id} className="bg-destructive/5 border border-destructive/10 rounded p-1 text-[8px] font-bold text-destructive flex items-center gap-1">
                                                        <div className="w-1 h-1 rounded-full bg-destructive shrink-0" />
                                                        {c.m1} + {c.m2} + {c.m3} ({c.label})
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-6 text-[9px] mt-1 border-emerald-500/20 text-emerald-700 hover:bg-emerald-500/5"
                                            onClick={() => setIsComboModalOpen(true)}
                                        >
                                            <Pencil className="h-2.5 w-2.5 mr-1" /> Gestionar Matriz
                                        </Button>
                                    </div>
                                )}
                            </Card>

                            {/* Modal de Gestión de Combinaciones */}
                            <Dialog open={isComboModalOpen} onOpenChange={setIsComboModalOpen}>
                                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                            Matriz de Combinaciones de Máquinas
                                        </DialogTitle>
                                        <DialogDescription>
                                            Define qué combinaciones de presentaciones son seguras y cuáles están prohibidas por flujo de masa o marca.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-6 py-4">
                                        <section className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-black text-emerald-700 uppercase tracking-tight">✅ Combinaciones Seguras</h3>
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                                    const id = 's' + Date.now();
                                                    setSafeCombinations([...safeCombinations, { id, m1: '(Cualquiera)', m2: '(Cualquiera)', m3: '(Cualquiera)', label: 'Nuevo Combo' }]);
                                                }}>
                                                    + Añadir
                                                </Button>
                                            </div>
                                            <div className="border rounded-lg overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-muted text-muted-foreground">
                                                        <tr>
                                                            <th className="p-2 text-left">M1</th>
                                                            <th className="p-2 text-left">M2</th>
                                                            <th className="p-2 text-left">M3</th><th className="p-2 text-left">M4</th>
                                                            <th className="p-2 text-left">Etiqueta/Estado (Auto)</th>
                                                            <th className="p-2 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {safeCombinations.map((c, idx) => (
                                                            <tr key={c.id}>
                                                                <td className="p-1">
                                                                    <Select value={c.m1} onValueChange={(val) => {
                                                                        const next = [...safeCombinations];
                                                                        next[idx].m1 = val;
                                                                        next[idx].label = generateAutoLabel(val, c.m2, c.m3, c.m4, false);
                                                                        setSafeCombinations(next);
                                                                    }}>
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-emerald-600 px-2 py-1.5 uppercase bg-slate-50/50">Estados de Máquina</SelectLabel>
                                                                                <SelectItem value="Apagada">Apagada</SelectItem>
                                                                                <SelectItem value="(Cualquiera)">(Cualquiera)</SelectItem>
                                                                            </SelectGroup>
                                                                            <Separator className="my-1" />
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-blue-600 px-2 py-1.5 uppercase bg-slate-50/50">Productos Registrados</SelectLabel>
                                                                                {products.map(p => (
                                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                                ))}
                                                                            </SelectGroup>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td>
                                                                <td className="p-1">
                                                                    <Select value={c.m2} onValueChange={(val) => {
                                                                        const next = [...safeCombinations];
                                                                        next[idx].m2 = val;
                                                                        next[idx].label = generateAutoLabel(c.m1, val, c.m3, c.m4, false);
                                                                        setSafeCombinations(next);
                                                                    }}>
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-emerald-600 px-2 py-1.5 uppercase bg-slate-50/50">Estados de Máquina</SelectLabel>
                                                                                <SelectItem value="Apagada">Apagada</SelectItem>
                                                                                <SelectItem value="(Cualquiera)">(Cualquiera)</SelectItem>
                                                                            </SelectGroup>
                                                                            <Separator className="my-1" />
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-blue-600 px-2 py-1.5 uppercase bg-slate-50/50">Productos Registrados</SelectLabel>
                                                                                {products.map(p => (
                                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                                ))}
                                                                            </SelectGroup>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td>
                                                                <td className="p-1">
                                                                    <Select value={c.m3} onValueChange={(val) => {
                                                                        const next = [...safeCombinations];
                                                                        next[idx].m3 = val;
                                                                        next[idx].label = generateAutoLabel(c.m1, c.m2, val, c.m4, false);
                                                                        setSafeCombinations(next);
                                                                    }}>
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-emerald-600 px-2 py-1.5 uppercase bg-slate-50/50">Estados de Máquina</SelectLabel>
                                                                                <SelectItem value="Apagada">Apagada</SelectItem>
                                                                                <SelectItem value="(Cualquiera)">(Cualquiera)</SelectItem>
                                                                            </SelectGroup>
                                                                            <Separator className="my-1" />
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-blue-600 px-2 py-1.5 uppercase bg-slate-50/50">Productos Registrados</SelectLabel>
                                                                                {products.map(p => (
                                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                                ))}
                                                                            </SelectGroup>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td>
                                                                <td className="p-1">
                                                                    <Select value={c.m4} onValueChange={(val) => {
                                                                        const next = [...safeCombinations];
                                                                        next[idx].m4 = val;
                                                                        next[idx].label = generateAutoLabel(c.m1, c.m2, c.m3, val, false);
                                                                        setSafeCombinations(next);
                                                                    }}>
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-emerald-600 px-2 py-1.5 uppercase bg-slate-50/50">Estados de Máquina</SelectLabel>
                                                                                <SelectItem value="Apagada">Apagada</SelectItem>
                                                                                <SelectItem value="(Cualquiera)">(Cualquiera)</SelectItem>
                                                                            </SelectGroup>
                                                                            <Separator className="my-1" />
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-blue-600 px-2 py-1.5 uppercase bg-slate-50/50">Productos Registrados</SelectLabel>
                                                                                {products.map(p => (
                                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                                ))}
                                                                            </SelectGroup>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td><td className="p-1 px-2">
                                                                    <div className="h-7 flex items-center text-[10px] text-muted-foreground font-medium italic truncate max-w-[250px]">
                                                                        {generateAutoLabel(c.m1, c.m2, c.m3, c.m4, false)}
                                                                    </div>
                                                                </td>
                                                                <td className="p-1">
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setSafeCombinations(safeCombinations.filter(x => x.id !== c.id))}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>

                                        <section className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-black text-destructive uppercase tracking-tight">❌ Combinaciones Prohibidas</h3>
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                                                    const id = 'p' + Date.now();
                                                    setProhibitedCombinations([...prohibitedCombinations, { id, m1: '(Cualquiera)', m2: '(Cualquiera)', m3: '(Cualquiera)', label: 'Nuevo Bloqueo' }]);
                                                }}>
                                                    + Añadir
                                                </Button>
                                            </div>
                                            <div className="border rounded-lg overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-muted text-muted-foreground">
                                                        <tr>
                                                            <th className="p-2 text-left">M1</th>
                                                            <th className="p-2 text-left">M2</th>
                                                            <th className="p-2 text-left">M3</th><th className="p-2 text-left">M4</th>
                                                            <th className="p-2 text-left">Razón de Prohibición (Auto)</th>
                                                            <th className="p-2 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y">
                                                        {prohibitedCombinations.map((c, idx) => (
                                                            <tr key={c.id}>
                                                                <td className="p-1">
                                                                    <Select value={c.m1} onValueChange={(val) => {
                                                                        const next = [...prohibitedCombinations];
                                                                        next[idx].m1 = val;
                                                                        next[idx].label = generateAutoLabel(val, c.m2, c.m3, c.m4, true);
                                                                        setProhibitedCombinations(next);
                                                                    }}>
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-emerald-600 px-2 py-1.5 uppercase bg-slate-50/50">Estados de Máquina</SelectLabel>
                                                                                <SelectItem value="Apagada">Apagada</SelectItem>
                                                                                <SelectItem value="(Cualquiera)">(Cualquiera)</SelectItem>
                                                                            </SelectGroup>
                                                                            <Separator className="my-1" />
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-blue-600 px-2 py-1.5 uppercase bg-slate-50/50">Productos Registrados</SelectLabel>
                                                                                {products.map(p => (
                                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                                ))}
                                                                            </SelectGroup>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td>
                                                                <td className="p-1">
                                                                    <Select value={c.m2} onValueChange={(val) => {
                                                                        const next = [...prohibitedCombinations];
                                                                        next[idx].m2 = val;
                                                                        next[idx].label = generateAutoLabel(c.m1, val, c.m3, c.m4, true);
                                                                        setProhibitedCombinations(next);
                                                                    }}>
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-emerald-600 px-2 py-1.5 uppercase bg-slate-50/50">Estados de Máquina</SelectLabel>
                                                                                <SelectItem value="Apagada">Apagada</SelectItem>
                                                                                <SelectItem value="(Cualquiera)">(Cualquiera)</SelectItem>
                                                                            </SelectGroup>
                                                                            <Separator className="my-1" />
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-blue-600 px-2 py-1.5 uppercase bg-slate-50/50">Productos Registrados</SelectLabel>
                                                                                {products.map(p => (
                                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                                ))}
                                                                            </SelectGroup>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td>
                                                                <td className="p-1">
                                                                    <Select value={c.m3} onValueChange={(val) => {
                                                                        const next = [...prohibitedCombinations];
                                                                        next[idx].m3 = val;
                                                                        next[idx].label = generateAutoLabel(c.m1, c.m2, val, c.m4, true);
                                                                        setProhibitedCombinations(next);
                                                                    }}>
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-emerald-600 px-2 py-1.5 uppercase bg-slate-50/50">Estados de Máquina</SelectLabel>
                                                                                <SelectItem value="Apagada">Apagada</SelectItem>
                                                                                <SelectItem value="(Cualquiera)">(Cualquiera)</SelectItem>
                                                                            </SelectGroup>
                                                                            <Separator className="my-1" />
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-blue-600 px-2 py-1.5 uppercase bg-slate-50/50">Productos Registrados</SelectLabel>
                                                                                {products.map(p => (
                                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                                ))}
                                                                            </SelectGroup>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td>
                                                                <td className="p-1">
                                                                    <Select value={c.m4} onValueChange={(val) => {
                                                                        const next = [...prohibitedCombinations];
                                                                        next[idx].m4 = val;
                                                                        next[idx].label = generateAutoLabel(c.m1, c.m2, c.m3, val, true);
                                                                        setProhibitedCombinations(next);
                                                                    }}>
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-emerald-600 px-2 py-1.5 uppercase bg-slate-50/50">Estados de Máquina</SelectLabel>
                                                                                <SelectItem value="Apagada">Apagada</SelectItem>
                                                                                <SelectItem value="(Cualquiera)">(Cualquiera)</SelectItem>
                                                                            </SelectGroup>
                                                                            <Separator className="my-1" />
                                                                            <SelectGroup>
                                                                                <SelectLabel className="text-[10px] font-black text-blue-600 px-2 py-1.5 uppercase bg-slate-50/50">Productos Registrados</SelectLabel>
                                                                                {products.map(p => (
                                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                                ))}
                                                                            </SelectGroup>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </td><td className="p-1 px-2">
                                                                    <div className="h-7 flex items-center text-[10px] text-destructive/80 font-medium italic truncate max-w-[250px]">
                                                                        {generateAutoLabel(c.m1, c.m2, c.m3, c.m4, true)}
                                                                    </div>
                                                                </td>
                                                                <td className="p-1">
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setProhibitedCombinations(prohibitedCombinations.filter(x => x.id !== c.id))}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t">
                                        <Button onClick={() => setIsComboModalOpen(false)} className="bg-emerald-600 hover:bg-emerald-700">
                                            Guardar y Cerrar
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={isViewConfigModalOpen} onOpenChange={setIsViewConfigModalOpen}>
                                <DialogContent className="sm:max-w-[450px]">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Settings2 className="h-5 w-5 text-primary" />
                                            Configuración de Tabla
                                        </DialogTitle>
                                        <DialogDescription>
                                            Seleccione cómo desea visualizar los turnos en la tabla de proyección.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="grid gap-6 py-4">
                                        {/* Sección Granel */}
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                                                <div className="w-1.5 h-3 bg-emerald-500 rounded-full" />
                                                Máquina Granel
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all hover:bg-emerald-500/5 text-center",
                                                        granelDisplayMode === 'combined' ? "border-emerald-500 bg-emerald-500/5 shadow-sm" : "border-muted"
                                                    )}
                                                    onClick={() => setGranelDisplayMode('combined')}
                                                >
                                                    <Layers className={cn("h-5 w-5", granelDisplayMode === 'combined' ? "text-emerald-600" : "text-muted-foreground")} />
                                                    <div className="text-[11px] font-bold">General</div>
                                                    {granelDisplayMode === 'combined' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                                                </div>
                                                <div
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all hover:bg-emerald-500/5 text-center",
                                                        granelDisplayMode === 'split' ? "border-emerald-500 bg-emerald-500/5 shadow-sm" : "border-muted"
                                                    )}
                                                    onClick={() => setGranelDisplayMode('split')}
                                                >
                                                    <ArrowLeftRight className={cn("h-5 w-5", granelDisplayMode === 'split' ? "text-emerald-600" : "text-muted-foreground")} />
                                                    <div className="text-[11px] font-bold">Día / Noche</div>
                                                    {granelDisplayMode === 'split' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                                                </div>
                                            </div>
                                        </div>


                                    </div>
                                    <DialogFooter>
                                        <Button className="w-full" onClick={() => setIsViewConfigModalOpen(false)}>Aplicar y Cerrar</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                        </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                        {isSummaryView ? (
                            <div id="resumen-detallado" className="flex-1 overflow-y-auto p-4 scroll-smooth">
                                <div className="max-w-7xl mx-auto w-full pt-4 flex flex-col gap-3 pb-8">
                                    <div className="flex items-center justify-between mb-4 px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-1.5 bg-primary rounded-full"></div>
                                            <h2 className="font-black uppercase tracking-widest text-xl">
                                                Reporte de Producción por Envasadora
                                            </h2>
                                        </div>

                                        <div className="flex items-center gap-3 bg-muted/30 px-3 py-1.5 rounded-full border border-muted-foreground/10 shadow-sm">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground">
                                                <CalendarIcon className="h-3 w-3 text-primary" />
                                                <span>PERIODO:</span>
                                                <span className="text-primary">{groupedWeeks[0].weeks[0].days[0].toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                                                <span>-</span>
                                                <span className="text-primary">{groupedWeeks[groupedWeeks.length - 1].weeks[groupedWeeks[groupedWeeks.length - 1].weeks.length - 1].days[groupedWeeks[groupedWeeks.length - 1].weeks[groupedWeeks[groupedWeeks.length - 1].weeks.length - 1].days.length - 1].toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                            <div className="h-3 w-[1px] bg-muted-foreground/20"></div>
                                            <div className="text-[9px] font-black text-primary uppercase">
                                                {totalWeeksInProjection} Sems / {totalWeeksInProjection * 7} Días
                                            </div>
                                            <div className="h-3 w-[1px] bg-muted-foreground/20"></div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase">
                                                <span className="opacity-70">Proyectado:</span>
                                                <span className="text-blue-600 font-black">
                                                    {new Set(Object.values(productionStats.byMachine).flatMap(m => Object.values(m.products).flatMap(p => Array.from(p.weeks)))).size} Sems / {new Set(Object.values(productionStats.byMachine).flatMap(m => Array.from(m.dates))).size} Días
                                                </span>
                                            </div>
                                            {totalPlannedQQ > 0 && (
                                                <>
                                                    <div className="h-3 w-[1px] bg-muted-foreground/20"></div>
                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase">
                                                        <span className="opacity-70">Balance:</span>
                                                        <span className={cn("font-black", fulfillmentPct >= 100 ? "text-emerald-600" : "text-amber-600")}>
                                                            {totalFamiliarQQ.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {totalPlannedQQ.toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ
                                                        </span>
                                                        <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black", fulfillmentPct >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                                            {fulfillmentPct >= 100 ? "+" : ""}{fulfillmentPct.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {(() => {
                                        const activeMachinesCount = machines.filter(m => machineConfig[m.id]?.active).length;
                                        const totalUsedMachineDays = Object.values(productionStats.byMachine).reduce((acc, m) => acc + m.dates.size, 0);
                                        const totalCapacityMachineDays = activeMachinesCount * totalWeeksInProjection * 7;
                                        const occupationPct = totalCapacityMachineDays > 0 ? (totalUsedMachineDays / totalCapacityMachineDays) * 100 : 0;
                                        const projectedWeeksCount = Object.keys(productionStats.byWeek).length;
                                        const projectedDaysCount = productionStats.totalProductionDays;
                                        const totalProductionHours = (productionStats.totalProductionShiftsDia * horasTurnoDia) + (productionStats.totalProductionShiftsNoc * horasTurnoNoche);

                                        const firstDate = groupedWeeks[0]?.weeks[0]?.days[0];
                                        const lastGroup = groupedWeeks[groupedWeeks.length - 1];
                                        const lastWeek = lastGroup?.weeks[lastGroup.weeks.length - 1];
                                        const lastDate = lastWeek?.days[lastWeek.days.length - 1];

                                        return (
                                            <div className="flex flex-col xl:flex-row gap-4 mb-8">
                                                {/* Lado Izquierdo: Información General (La Principal) */}
                                                <div className="xl:w-1/4 flex">
                                                    <Card className="bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 shadow-2xl border-none overflow-hidden relative flex-1">
                                                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                                                        <CardContent className="py-3 px-4 flex flex-col text-white h-full relative z-10">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="p-1.5 bg-white/10 rounded-lg shadow-inner">
                                                                    <LayoutDashboard className="h-4 w-4 text-indigo-300" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-300/60 leading-none mb-0.5">Panel Control</div>
                                                                    <div className="text-base font-black tracking-tight leading-none">Información General</div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2 flex-1">
                                                                <div className="grid grid-cols-2 gap-2 border-b border-white/5 pb-2">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] uppercase font-black text-indigo-300/40 mb-0.5 tracking-wider">Producción Total</span>
                                                                        <span className="text-xl font-black">{(totalFamiliarQQ + totalGranelQQ).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-[10px] font-normal opacity-40">QQ</span></span>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-[8px] uppercase font-black text-indigo-300/40 mb-0.5 tracking-wider">Tonelaje Total</span>
                                                                        <span className="text-xl font-black">{((totalFamiliarQQ + totalGranelQQ) / 20).toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[10px] font-normal opacity-40">Ton</span></span>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-2 border-b border-white/5 py-1.5">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] uppercase font-black text-indigo-300/40 mb-0.5 tracking-wider">Familiar</span>
                                                                        <div className="flex items-baseline gap-1">
                                                                            <span className="text-sm font-black text-white">
                                                                                {((totalFamiliarQQ / (totalFamiliarQQ + totalGranelQQ || 1)) * 100).toFixed(1)}%
                                                                            </span>
                                                                            <span className="text-[9px] font-bold text-white/30 tracking-tighter">({totalFamiliarQQ.toLocaleString()} QQ)</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col text-right">
                                                                        <span className="text-[8px] uppercase font-black text-emerald-300/40 mb-0.5 tracking-wider">Granel</span>
                                                                        <div className="flex items-baseline gap-1 justify-end">
                                                                            <span className="text-sm font-black text-emerald-300">
                                                                                {((totalGranelQQ / (totalFamiliarQQ + totalGranelQQ || 1)) * 100).toFixed(1)}%
                                                                            </span>
                                                                            <span className="text-[9px] font-bold text-white/30 tracking-tighter">({totalGranelQQ.toLocaleString()} QQ)</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 gap-2 pt-1">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] uppercase font-black text-indigo-300/40 mb-0.5 tracking-wider">Cumplimiento</span>
                                                                        <div className="flex items-baseline gap-2">
                                                                            <span className={cn("text-lg font-black", fulfillmentPct >= 100 ? "text-emerald-400" : "text-amber-400")}>
                                                                                {fulfillmentPct.toFixed(1)}%
                                                                            </span>
                                                                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden self-center">
                                                                                <div
                                                                                    className={cn("h-full", fulfillmentPct >= 100 ? "bg-emerald-500" : "bg-amber-500")}
                                                                                    style={{ width: `${Math.min(100, fulfillmentPct)}%` }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[8px] uppercase font-black text-indigo-300/40 mb-0.5 tracking-wider">Días Operativos</span>
                                                                            <span className="text-lg font-black">{productionStats.totalProductionDays} <span className="text-[10px] font-normal opacity-40">Días</span></span>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[8px] uppercase font-black text-rose-300/40 mb-0.5 tracking-wider">Días Parados</span>
                                                                            <span className="text-lg font-black text-rose-200">
                                                                                {groupedWeeks.reduce((acc, g) => acc + g.weeks.reduce((wAcc, w) => wAcc + w.days.length, 0), 0) - productionStats.totalProductionDays}
                                                                                <span className="text-[10px] font-normal opacity-40 ml-1">Días</span>
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 pt-2 border-t border-white/10 space-y-1.5 bg-white/5 p-2 rounded-lg">
                                                                <div className="text-[8px] font-black uppercase text-indigo-300/60 mb-0.5 border-b border-white/10 pb-0.5">Total de Personal</div>
                                                                <div className="flex justify-between items-center text-[9px] font-bold">
                                                                    <span className="text-white/50">Supervisor:</span> <span className="text-indigo-200">{laborStats.globalTotalSupDia + laborStats.globalTotalSupNoc}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-[9px] font-bold">
                                                                    <span className="text-white/50">Operador:</span> <span className="text-indigo-200">{laborStats.globalTotalOpDia + laborStats.globalTotalOpNoc}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-[9px] font-bold">
                                                                    <span className="text-white/50">Envasador:</span> <span className="text-indigo-200">{laborStats.globalTotalEnvDia + laborStats.globalTotalEnvNoc}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-[9px] font-bold">
                                                                    <span className="text-white/50">Granelero:</span> <span className="text-indigo-200">{laborStats.globalTotalGraDia + laborStats.globalTotalGraNoc}</span>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>

                                                {/* Lado Derecho: 2 Filas de 3 Tarjetas */}
                                                <div className="xl:w-3/4 flex flex-col gap-4">
                                                    {/* Fila Superior */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <Card className="bg-slate-950 shadow-lg border-none">
                                                            <CardContent className="py-3 px-4 flex flex-col items-center justify-center text-white h-full min-h-[160px]">
                                                                <PackageCheck className="h-6 w-6 mb-1.5 opacity-80 text-blue-400" />
                                                                <div className="text-2xl font-black">
                                                                    {(totalFamiliarQQ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                    <span className="text-[10px] font-normal opacity-40 ml-1">QQ</span>
                                                                </div>
                                                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Total Familiar</div>
                                                                <div className="text-[11px] mt-1 opacity-80 font-medium mb-2 text-blue-300 flex flex-col items-center">
                                                                    <span>{familiarDays} Días Usados</span>
                                                                    <span className="text-[10px] font-normal bg-white/20 text-white px-2 py-0.5 rounded mt-1">
                                                                        {((totalFamiliarQQ / (totalFamiliarQQ + totalGranelQQ || 1)) * 100).toFixed(1)}% de la Produccion
                                                                    </span>
                                                                </div>
                                                                <div className="mt-1 pt-2 border-t border-white/20 w-full text-[9px] flex flex-col gap-1 opacity-90">
                                                                    <div className="grid grid-cols-3 w-full border-b border-white/5 pb-0.5">
                                                                        <div className="flex gap-1"><span>Sup:</span> <span className="font-bold text-white">{laborStats.familiarBreakdown.sup}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{laborStats.familiarBreakdown.supDia}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{laborStats.familiarBreakdown.supNoc}</span></div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 w-full border-b border-white/5 py-0.5">
                                                                        <div className="flex gap-1"><span>Op:</span> <span className="font-bold text-white">{laborStats.familiarBreakdown.op}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{laborStats.familiarBreakdown.opDia}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{laborStats.familiarBreakdown.opNoc}</span></div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 w-full pt-0.5">
                                                                        <div className="flex gap-1"><span>Env:</span> <span className="font-bold text-white">{Math.round(laborStats.familiarBreakdown.env)}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{Math.round(laborStats.familiarBreakdown.envDia)}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{Math.round(laborStats.familiarBreakdown.envNoc)}</span></div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                        <Card className="bg-blue-900 shadow-lg border-none">
                                                            <CardContent className="py-3 px-4 flex flex-col items-center justify-center text-white text-center h-full min-h-[160px]">
                                                                <Package className="h-6 w-6 mb-1.5 opacity-80 text-blue-300" />
                                                                <div className="text-2xl font-black">
                                                                    {(totalSacosQQ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                    <span className="text-[10px] font-normal opacity-40 ml-1">QQ</span>
                                                                </div>
                                                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Total Sacos</div>
                                                                <div className="text-[11px] mt-1 opacity-80 font-medium mb-2 text-blue-200 flex flex-col items-center">
                                                                    <span>{sacosDays} Días</span>
                                                                    <span className="text-[10px] font-normal bg-white/20 text-white px-2 py-0.5 rounded mt-1">
                                                                        {((totalSacosQQ / (totalFamiliarQQ || 1)) * 100).toFixed(1)}% del Familiar
                                                                    </span>
                                                                </div>
                                                                <div className="mt-1 pt-2 border-t border-white/20 w-full text-[9px] flex flex-col gap-1 opacity-90">
                                                                    <div className="grid grid-cols-3 w-full border-b border-white/5 pb-0.5">
                                                                        <div className="flex gap-1"><span>Sup:</span> <span className="font-bold text-white">{laborStats.sacoBreakdown.sup}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{laborStats.sacoBreakdown.supDia}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{laborStats.sacoBreakdown.supNoc}</span></div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 w-full border-b border-white/5 py-0.5">
                                                                        <div className="flex gap-1"><span>Op:</span> <span className="font-bold text-white">{laborStats.sacoBreakdown.op}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{laborStats.sacoBreakdown.opDia}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{laborStats.sacoBreakdown.opNoc}</span></div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 w-full pt-0.5">
                                                                        <div className="flex gap-1"><span>Env:</span> <span className="font-bold text-white">{Math.round(laborStats.sacoBreakdown.env)}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{Math.round(laborStats.sacoBreakdown.envDia)}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{Math.round(laborStats.sacoBreakdown.envNoc)}</span></div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                        <Card className="bg-orange-800 shadow-lg border-none">
                                                            <CardContent className="py-3 px-4 flex flex-col items-center justify-center text-white text-center h-full min-h-[160px]">
                                                                <Boxes className="h-6 w-6 mb-1.5 opacity-80 text-orange-400" />
                                                                <div className="text-2xl font-black">
                                                                    {(totalFardosQQ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                    <span className="text-[10px] font-normal opacity-40 ml-1">QQ</span>
                                                                </div>
                                                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Total Fardos</div>
                                                                <div className="text-[11px] mt-1 opacity-80 font-medium mb-2 text-orange-300 flex flex-col items-center">
                                                                    <span>{fardosDays} Días | {totalFardos.toLocaleString()} Unid.</span>
                                                                    <span className="text-[10px] font-normal bg-white/20 text-white px-2 py-0.5 rounded mt-1">
                                                                        {((totalFardosQQ / (totalFamiliarQQ || 1)) * 100).toFixed(1)}% del Familiar
                                                                    </span>
                                                                </div>
                                                                <div className="mt-1 pt-2 border-t border-white/20 w-full text-[9px] flex flex-col gap-1 opacity-90">
                                                                    <div className="grid grid-cols-3 w-full border-b border-white/5 pb-0.5">
                                                                        <div className="flex gap-1"><span>Sup:</span> <span className="font-bold text-white">{laborStats.fardoBreakdown.sup}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{laborStats.fardoBreakdown.supDia}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{laborStats.fardoBreakdown.supNoc}</span></div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 w-full pt-0.5">
                                                                        <div className="flex gap-1"><span>Op:</span> <span className="font-bold text-white">{laborStats.fardoBreakdown.op}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{laborStats.fardoBreakdown.opDia}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{laborStats.fardoBreakdown.opNoc}</span></div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </div>

                                                    {/* Fila Inferior */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <Card className="bg-emerald-800 shadow-lg border-none">
                                                            <CardContent className="py-3 px-4 flex flex-col items-center justify-center text-white text-center h-full min-h-[160px]">
                                                                <Database className="h-6 w-6 mb-1.5 opacity-80 text-emerald-400" />
                                                                <div className="text-2xl font-black">
                                                                    {(totalGranelQQ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                    <span className="text-[10px] font-normal opacity-40 ml-1">QQ</span>
                                                                </div>
                                                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Total Granel</div>
                                                                <div className="text-[11px] mt-1 opacity-80 font-medium mb-2 text-emerald-300 flex flex-col items-center">
                                                                    <span>{granelDays} Días Usados</span>
                                                                    <span className="text-[10px] font-normal bg-white/20 text-white px-2 py-0.5 rounded mt-1">
                                                                        {((totalGranelQQ / (totalFamiliarQQ + totalGranelQQ || 1)) * 100).toFixed(1)}% de la Produccion
                                                                    </span>
                                                                </div>
                                                                <div className="mt-1 pt-2 border-t border-white/20 w-full text-[9px] flex flex-col gap-1 opacity-90">
                                                                    <div className="grid grid-cols-3 w-full border-b border-white/5 pb-0.5">
                                                                        <div className="flex gap-1"><span>Sup:</span> <span className="font-bold text-white">{laborStats.granelBreakdown.sup}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{laborStats.granelBreakdown.supDia}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{laborStats.granelBreakdown.supNoc}</span></div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 w-full pt-0.5">
                                                                        <div className="flex gap-1"><span>Gra:</span> <span className="font-bold text-white">{laborStats.granelBreakdown.gra}</span></div>
                                                                        <div className="flex gap-1 justify-center border-l border-white/10"><span>Dias:</span> <span className="font-bold text-white">{laborStats.granelBreakdown.graDia}</span></div>
                                                                        <div className="flex gap-1 justify-end border-l border-white/10"><span>Noches:</span> <span className="font-bold text-white">{laborStats.granelBreakdown.graNoc}</span></div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                        <Card className="bg-cyan-800 shadow-lg border-none">
                                                            <CardContent className="py-4 px-5 flex flex-col items-center justify-center text-white text-center h-full min-h-[140px]">
                                                                <CalendarRange className="h-7 w-7 mb-2 text-cyan-300" />
                                                                <div className="flex flex-col items-center">
                                                                    <div className="text-xl font-black">{projectedWeeksCount} Sems / {projectedDaysCount} Días</div>
                                                                    <div className="text-[10px] font-bold text-cyan-300/90 flex items-center gap-1 mt-0.5">
                                                                        <span>{firstDate?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                                                                        <ArrowRight className="h-2 w-2" />
                                                                        <span>{lastDate?.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">Tiempo con Producción</div>
                                                                <div className="mt-2 pt-2 border-t border-white/20 w-full text-[10px] flex flex-col gap-1 opacity-90">
                                                                    <div className="flex justify-between font-medium"><span>Total Horas:</span> <span className="font-bold text-cyan-200">{totalProductionHours.toLocaleString()} h</span></div>
                                                                    <div className="flex justify-between"><span>Día:</span> <span className="font-bold">{productionStats.totalProductionShiftsDia}</span></div>
                                                                    <div className="flex justify-between"><span>Noche:</span> <span className="font-bold">{productionStats.totalProductionShiftsNoc}</span></div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                        <Card className="bg-slate-800 shadow-lg border-none">
                                                            <CardContent className="py-4 px-5 flex flex-col items-center justify-center text-white text-center h-full min-h-[140px]">
                                                                <Users className="h-7 w-7 mb-2 text-slate-300" />
                                                                <div className="text-xl font-black">
                                                                    $ {laborStats.totalCosto.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                </div>
                                                                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Costo Mano de Obra</div>
                                                                <div className="text-[9px] mt-1 opacity-60 font-medium border-b border-white/10 pb-1 mb-1 w-full">
                                                                    ${laborStats.costoPorQQ.toFixed(2)} / QQ
                                                                </div>
                                                                <div className="pt-1 w-full text-[10px] flex flex-col gap-1 opacity-90">
                                                                    <div className="flex justify-between"><span>Día:</span> <span className="font-bold">$ {laborStats.totalCostoDia.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                                                    <div className="flex justify-between"><span>Noche:</span> <span className="font-bold">$ {laborStats.totalCostoNoc.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}


                                    {/* Consolidated Report */}
                                    <CombinedReport
                                        id="reporte-consolidado-grafico-view"
                                        productionData={productionStats.byProduct}
                                        plannedGoals={plannedGoals}
                                        products={products}
                                        totalSupply={dailySupply * productionStats.totalProductionDays}
                                        totalFamiliarQQ={totalFamiliarQQ}
                                        totalGranelQQ={totalGranelQQ}
                                        fulfillmentPct={fulfillmentPct}
                                        totalPlannedQQ={totalPlannedQQ}
                                    />

                                    <div className="w-full overflow-x-auto py-2">
                                        <LaborWeeklyChart
                                            laborWeeklyDetail={laborStats.weeklyDetail}
                                            totalPersTurnosGlobal={laborStats.totalPersTurnosGlobal}
                                        />
                                    </div>

                                    {/* Global Product Summary Section */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-2 mb-4 px-1">
                                            <div className="h-4 w-1.5 bg-blue-600 rounded-full"></div>
                                            <h3 className="font-bold uppercase tracking-wider text-sm">Resumen por Presentación</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            {Object.entries(productionStats.byProduct)
                                                .sort((a, b) => b[1].qq - a[1].qq)
                                                .map(([pId, data]) => {
                                                    const product = products.find(p => p.id === pId);
                                                    if (!product) return null;
                                                    const avgSpeed = data.count > 0 ? data.speedSum / data.count : 0;
                                                    const calendarDays = data.dates.size;
                                                    const totalShifts = data.count;

                                                    return (
                                                        <Card key={pId} className="border-l-4 shadow-sm hover:shadow-md transition-shadow overflow-hidden" style={{ borderLeftColor: product.color }}>
                                                            <CardContent className="p-3 space-y-2">
                                                                <div className="flex items-start justify-between gap-2">
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Presentación</span>
                                                                        <span className="text-sm font-bold leading-tight" title={product.productName}>{product.productName}</span>
                                                                    </div>
                                                                    <Badge variant="outline" className="text-[10px] py-1 h-fit whitespace-nowrap bg-primary/5 border-primary/20 font-black shrink-0">
                                                                        {data.qq.toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ
                                                                    </Badge>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                                                                            <CalendarIcon className="h-2.5 w-2.5" /> Días Totales
                                                                        </div>
                                                                        <div className="text-base font-black text-primary leading-tight">{calendarDays}</div>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                                                                            <RefreshCw className="h-2.5 w-2.5" /> Turnos
                                                                        </div>
                                                                        <div className="text-base font-black text-blue-600 leading-tight">{totalShifts}</div>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                                                                            <Zap className="h-2.5 w-2.5" /> Vel. Prom
                                                                        </div>
                                                                        <div className="text-base font-black text-amber-600 leading-tight">{avgSpeed.toFixed(1)} <span className="text-[9px] font-normal">BPM</span></div>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                                                                            <Box className="h-2.5 w-2.5" /> Unidades
                                                                        </div>
                                                                        <div className="text-base font-black text-emerald-600 leading-tight">
                                                                            {Math.round(data.units).toLocaleString()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="pt-2 border-t mt-1 grid grid-cols-3 gap-2">
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                                                                            Supervisor
                                                                        </div>
                                                                        <div className="text-[11px] font-black text-slate-700 leading-tight">
                                                                            {data.supervisors} <span className="text-[9px] font-normal">Total</span>
                                                                        </div>
                                                                        <div className="text-[9px] text-muted-foreground font-medium leading-tight mt-0.5 flex flex-col">
                                                                            <span>{data.supervisorsDay} Dia</span>
                                                                            <span>{data.supervisorsNight} Noche</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1 text-[8px] font-bold text-muted-foreground uppercase">
                                                                            Operador
                                                                        </div>
                                                                        <div className="text-[11px] font-black text-slate-700 leading-tight">
                                                                            {data.operators} <span className="text-[9px] font-normal">Total</span>
                                                                        </div>
                                                                        <div className="text-[9px] text-muted-foreground font-medium leading-tight mt-0.5 flex flex-col">
                                                                            <span>{data.operatorsDay} Dia</span>
                                                                            <span>{data.operatorsNight} Noche</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase">
                                                                            Envasador
                                                                        </div>
                                                                        <div className="text-[11px] font-black text-slate-700 leading-tight">
                                                                            {data.envasadores} <span className="text-[9px] font-normal">Total</span>
                                                                        </div>
                                                                        <div className="text-[9px] text-muted-foreground font-medium leading-tight mt-0.5 flex flex-col">
                                                                            <span>{data.envasadoresDay} Dia</span>
                                                                            <span>{data.envasadoresNight} Noche</span>
                                                                            <div className="mt-1 flex items-center gap-1.5 pt-1 border-t border-slate-100">
                                                                                <Users className="w-2.5 h-2.5 text-blue-500" />
                                                                                <span className="text-slate-700 font-bold">{data.envasadores} Jornadas</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    );
                                                })}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 mb-4 px-1">
                                        <div className="h-4 w-1.5 bg-primary rounded-full"></div>
                                        <h3 className="font-bold uppercase tracking-wider text-sm">Detalle por Envasadora</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {machines.filter(m => productionStats.byMachine[m.id]?.qq > 0).map(machine => {
                                            const stats = productionStats.byMachine[machine.id];
                                            const machineProducts = Object.entries(stats.products);
                                            return (
                                                <Card key={machine.id} className="border shadow-md overflow-hidden bg-card/50 flex flex-col">
                                                    <CardContent className="p-4 flex flex-col h-full">
                                                        {/* Header Machine */}
                                                        <div className="flex items-center justify-between mb-4 pb-2 border-b">
                                                            <div className="flex items-center gap-3">
                                                                <div className="relative w-10 h-10 bg-white rounded-lg border shadow-sm p-1">
                                                                    <Image src={machine.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/envasadora.png?alt=media"} alt={`M${machine.id}`} fill className="object-contain" unoptimized />
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-black text-primary leading-none uppercase">Maquina #{machine.id}</div>
                                                                    <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{machineProducts.length} presentaciones producidas</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-4">
                                                                <div className="text-right">
                                                                    <div className="text-lg font-black text-primary leading-none">{Math.round(stats.qq).toLocaleString()}</div>
                                                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Total QQ</div>
                                                                </div>
                                                                <div className="h-8 w-[1px] bg-border mx-1"></div>
                                                                <div className="text-right">
                                                                    <div className="text-lg font-black text-blue-600 leading-none">{(stats.qq * 0.05).toFixed(1)}</div>
                                                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">TM</div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Machine KPIs */}
                                                        <div className="grid grid-cols-3 gap-2 mb-4">
                                                            <div className="bg-muted/50 rounded p-2 text-center">
                                                                <div className="text-xs font-black text-primary">{stats.dates.size}</div>
                                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">Días Ops</div>
                                                            </div>
                                                            <div className="bg-muted/50 rounded p-2 text-center">
                                                                <div className="text-xs font-black text-amber-600">
                                                                    {((stats.dates.size / (totalWeeksInProjection * 7)) * 100).toFixed(0)}%
                                                                </div>
                                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">% Uso</div>
                                                            </div>
                                                            <div className="bg-muted/50 rounded p-2 text-center">
                                                                <div className="text-xs font-black text-emerald-600">
                                                                    {Math.round(stats.qq / stats.dates.size).toLocaleString()}
                                                                </div>
                                                                <div className="text-[8px] font-bold text-muted-foreground uppercase">QQ/Día</div>
                                                            </div>
                                                        </div>

                                                        {/* Breakdown Table */}
                                                        <div className="flex-1 overflow-auto">
                                                            <table className="w-full text-[10px]">
                                                                <thead>
                                                                    <tr className="text-muted-foreground border-b uppercase font-bold text-[8px] tracking-wider">
                                                                        <th className="text-left pb-1">Presentación</th>
                                                                        <th className="text-center pb-1">Sems</th>
                                                                        <th className="text-center pb-1">Días</th>
                                                                        <th className="text-center pb-1">Turno</th>
                                                                        <th className="text-right pb-1">Unidades</th>
                                                                        <th className="text-right pb-1">QQ</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-border/50">
                                                                    {machineProducts.map(([pId, pStats]) => {
                                                                        const product = products.find(p => p.id === pId);
                                                                        if (!product) return null;
                                                                        const isFardo = product.primaryPackaging === 'fardo' || !!product.bundleWeight;
                                                                        return (
                                                                            <tr key={pId} className="group hover:bg-muted/30 transition-colors">
                                                                                <td className="py-2 pr-2">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: product.color }}></div>
                                                                                        <div className="font-bold" title={product.productName}>{product.productName}</div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="py-2 text-center font-medium">{pStats.weeks.size}</td>
                                                                                <td className="py-2 text-center font-black text-primary">{pStats.dates.size}</td>
                                                                                <td className="py-2 text-center font-black text-blue-600">{pStats.shifts}</td>
                                                                                <td className="py-2 text-right">
                                                                                    <div className="font-bold">{Math.round(pStats.units).toLocaleString()}</div>

                                                                                </td>
                                                                                <td className="py-2 text-right font-black text-primary">
                                                                                    {Math.round(pStats.qq).toLocaleString()}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* Footer Stats */}
                                                        <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-4">
                                                            <div className="bg-muted/30 p-2 rounded-lg">
                                                                <div className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">Uso de Máquina</div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-black text-primary">{stats.dates.size} <span className="text-[8px] font-normal">Días</span></span>
                                                                    <span className="text-[9px] font-bold text-primary/70">{((stats.dates.size / (totalWeeksInProjection * 7)) * 100).toFixed(0)}%</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                                                                <div className="text-[8px] font-bold text-primary/70 uppercase mb-0.5">Prom. Semanal</div>
                                                                <div className="text-xs font-black text-primary">
                                                                    {Math.round(stats.qq / (totalWeeksInProjection || 1)).toLocaleString()} <span className="text-[8px] font-normal">QQ/Sem</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>

                                    <div className="flex items-center gap-2 mb-4 px-1 mt-8">
                                        <div className="h-4 w-1.5 bg-indigo-600 rounded-full"></div>
                                        <h3 className="font-bold uppercase tracking-wider text-sm">Planificación de Mano de Obra</h3>
                                    </div>

                                    <Card className="border shadow-md overflow-hidden bg-card/30">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead className="bg-slate-100 border-b">
                                                    <tr>
                                                        <th className="px-3 py-3 text-left font-black text-slate-600 uppercase">Semana / Mes</th>
                                                        <th className="px-3 py-3 text-center font-black text-slate-600 uppercase">Días</th>
                                                        <th className="px-3 py-3 text-center font-black text-slate-400 uppercase">Tipo</th>
                                                        <th className="px-3 py-3 text-center font-black text-blue-600 uppercase">Contratista Día</th>
                                                        <th className="px-3 py-3 text-center font-black text-indigo-800 uppercase">Contratista Noche</th>
                                                        <th className="px-3 py-3 text-right font-black text-blue-600/80 uppercase">Costo Día</th>
                                                        <th className="px-3 py-3 text-right font-black text-indigo-800/80 uppercase">Costo Noche</th>
                                                        <th className="px-3 py-3 text-right font-black text-emerald-600 uppercase">Costo Semanal</th>
                                                        <th className="px-3 py-3 text-right font-black text-slate-600 uppercase">$/QQ</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {groupedWeeks.flatMap(group =>
                                                        group.weeks.map((week, idx) => {
                                                            const wStats = laborStats.weeklyDetail[week.weekNum];
                                                            if (!wStats) return null;

                                                            const wProd = productionStats.byWeek[week.weekNum];
                                                            const weekQQ = wProd ? (wProd.familiarQQ + wProd.granelQQ) : 0;
                                                            const weekCostoQQ = weekQQ > 0 ? wStats.totalCosto / weekQQ : 0;
                                                            const opDays = week.days.filter(d => {
                                                                const dateStr = d.toISOString().split('T')[0];
                                                                return Object.values(machines).some(m => {
                                                                    const oD = overrides[`${m.id}-${dateStr}-dia`];
                                                                    const oN = overrides[`${m.id}-${dateStr}-noche`];
                                                                    return (!oD?.inactive && (!!oD)) ||
                                                                        (!oN?.inactive && (!!oN));
                                                                });
                                                            }).length;

                                                            return (
                                                                <tr key={week.weekNum} className="hover:bg-muted/30 transition-colors">
                                                                    <td className="px-3 py-2.5 font-medium">
                                                                        {idx === 0 && <span className="text-[9px] text-muted-foreground block font-black uppercase mb-0.5">{group.monthName}</span>}
                                                                        <span className="font-bold">Semana {week.weekNum}</span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-center font-bold text-slate-500">{opDays}</td>
                                                                    <td className="px-3 py-2.5 text-center">
                                                                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                                                                            {laborType === 'contractor' ? 'Contratista' : 'Zafra'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-center">
                                                                        <Badge variant="outline" className="font-black text-blue-600 bg-blue-50 border-blue-100 text-[10px]">
                                                                            {wStats.totalEnvasadoresDia} Pers.
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-center">
                                                                        <Badge variant="outline" className="font-black text-indigo-800 bg-indigo-50 border-indigo-100 text-[10px]">
                                                                            {wStats.totalEnvasadoresNoche} Pers.
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-right font-bold text-blue-600/70">
                                                                        $ {wStats.totalCostoDia.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-right font-bold text-indigo-800/70">
                                                                        $ {wStats.totalCostoNoc.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-right font-black text-emerald-700">
                                                                        $ {wStats.totalCosto.toLocaleString()}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-right font-bold text-slate-500">
                                                                        $ {weekCostoQQ.toFixed(2)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                                <tfoot className="bg-slate-50 font-black border-t">
                                                    <tr>
                                                        <td colSpan={3} className="px-3 py-3 uppercase text-[10px] text-slate-500">Totales Temporada</td>
                                                        <td className="px-3 py-3 text-center text-blue-600">{Object.values(laborStats.weeklyDetail).reduce((acc, curr) => acc + curr.totalEnvasadoresDia, 0).toLocaleString()} Pers.</td>
                                                        <td className="px-3 py-3 text-center text-indigo-800">{Object.values(laborStats.weeklyDetail).reduce((acc, curr) => acc + curr.totalEnvasadoresNoche, 0).toLocaleString()} Pers.</td>
                                                        <td className="px-3 py-3 text-right text-blue-600/80">$ {Object.values(laborStats.weeklyDetail).reduce((acc, curr) => acc + curr.totalCostoDia, 0).toLocaleString()}</td>
                                                        <td className="px-3 py-3 text-right text-indigo-800/80">$ {Object.values(laborStats.weeklyDetail).reduce((acc, curr) => acc + curr.totalCostoNoc, 0).toLocaleString()}</td>
                                                        <td className="px-3 py-3 text-right text-emerald-700">$ {laborStats.totalCosto.toLocaleString()}</td>
                                                        <td className="px-3 py-3 text-right text-slate-500">$ {laborStats.costoPorQQ.toFixed(2)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 p-1 overflow-hidden">
                                {renderTable()}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Dialog open={!!editingOverride} onOpenChange={(open) => !open && setEditingOverride(null)}>
                <DialogContent className="sm:max-w-md border-primary/20 shadow-xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="border-b p-6 pb-3 shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            {editingOverride?.machineId === 99 ? (
                                <Database className="h-6 w-6 text-emerald-600" />
                            ) : (
                                <Box className="h-6 w-6 text-primary" />
                            )}
                            {editingOverride?.machineId === 99 ? 'Ajuste de Granel' : 'Ajuste de Producción'}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium">
                            {editingOverride?.machineId === 99 ? (
                                <span className="text-emerald-600 font-bold">Máquina Granel 50KG</span>
                            ) : (
                                <>Tecnotok <span className="text-primary font-bold">#{editingOverride?.machineId}</span></>
                            )}
                            {" "}Turno <span className={cn("font-bold uppercase", editingOverride?.machineId === 99 ? "text-emerald-600" : "text-primary")}>{editingOverride?.shift}</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-5">
                        {/* Estado y SincronizaciÃ³n */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border">
                                <div className="flex items-center gap-2">
                                    <div className={cn("p-1.5 rounded-full shrink-0", editingOverride?.inactive ? "bg-muted" : "bg-primary/10")}>
                                        {editingOverride?.inactive ? <PowerOff className="h-4 w-4 text-muted-foreground" /> : <Power className="h-4 w-4 text-primary" />}
                                    </div>
                                    <div className="min-w-0">
                                        <Label className="text-xs font-bold leading-none truncate block">
                                            {editingOverride?.inactive ? 'Inactivo' : 'Activo'}
                                        </Label>
                                        <p className="text-[9px] text-muted-foreground truncate">Turno</p>
                                    </div>
                                </div>
                                <Switch
                                    disabled={isReadOnly}
                                    className="scale-75 origin-right shrink-0"
                                    checked={!editingOverride?.inactive}
                                    onCheckedChange={(val) => setEditingOverride(prev => prev ? { ...prev, inactive: !val } : null)}
                                />
                            </div>

                            <div className="flex items-center justify-between p-2.5 bg-primary/5 rounded-lg border border-primary/20">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-full bg-primary/10 text-primary shrink-0">
                                        <ArrowLeftRight className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <Label className="text-xs font-bold leading-none truncate block">Sincronizar</Label>
                                        <p className="text-[9px] text-muted-foreground truncate">Día/Noche</p>
                                    </div>
                                </div>
                                <Switch
                                    disabled={isReadOnly}
                                    className="scale-75 origin-right shrink-0"
                                    checked={!!editingOverride?.applyToBothShifts}
                                    onCheckedChange={(val) => setEditingOverride(prev => prev ? { ...prev, applyToBothShifts: val } : null)}
                                />
                            </div>
                        </div>

                        {/* Rango de Fechas */}
                        <div className="grid grid-cols-2 gap-4 pt-2 border-b pb-4">
                            <div className="space-y-1.5">
                                <Label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                    <CalendarIcon className="h-3.5 w-3.5" /> Inicio
                                </Label>
                                <div className="h-10 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm font-bold flex items-center text-muted-foreground">
                                    {formatDateDisplay(editingOverride?.startDate)}
                                </div>
                            </div>
                            <div className="space-y-1.5 flex flex-col">
                                <Label className="text-[11px] font-bold text-primary uppercase flex items-center gap-1.5">
                                    <CalendarRange className="h-3.5 w-3.5" /> Final Proyectado
                                </Label>
                                <Input
                                    disabled={isReadOnly}
                                    type="date"
                                    value={editingOverride?.endDate || ''}
                                    min={editingOverride?.startDate}
                                    onChange={(e) => setEditingOverride(prev => prev ? { ...prev, endDate: e.target.value } : null)}
                                    className="h-10 text-sm font-black border-primary/20 bg-white"
                                />
                            </div>
                        </div>

                        {/* Selección de Días de Paro (Chips) */}
                        {editingOverride?.startDate && editingOverride?.endDate && (
                            <div className="space-y-2 pt-2 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                                        <PowerOff className="h-3 w-3 text-destructive" /> Días de Paro en el Rango
                                    </Label>
                                    <button
                                        disabled={isReadOnly}
                                        className="text-[9px] text-blue-600 font-bold hover:underline"
                                        onClick={() => setEditingOverride(prev => prev ? { ...prev, inactiveDays: {} } : null)}
                                    >
                                        Limpiar todos
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1 p-2 border rounded-xl bg-muted/5 max-h-[280px] overflow-y-auto custom-scrollbar">
                                    {(() => {
                                        const start = new Date(editingOverride.startDate + "T12:00:00");
                                        const end = new Date(editingOverride.endDate + "T12:00:00");
                                        const chips = [];
                                        let curr = new Date(start);
                                        const totalDaysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                        const isLimitExceeded = totalDaysInRange > 186;
                                        const startYear = start.getFullYear();
                                        const endYear = end.getFullYear();
                                        const holidaysStart = getEcuadorHolidays(startYear);
                                        const holidaysEnd = startYear !== endYear ? getEcuadorHolidays(endYear) : null;

                                        while (curr <= end && chips.length < 186) {
                                            const dStr = curr.toISOString().split('T')[0];
                                            const isInactive = editingOverride.inactiveDays?.[dStr];
                                            const dayNum = curr.getDate();
                                            const dayName = curr.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().charAt(0);

                                            const isWeekend = curr.getDay() === 0 || curr.getDay() === 6;
                                            const isHoliday = holidaysStart.has(dStr) || (holidaysEnd?.has(dStr) ?? false);

                                            chips.push(
                                                <button
                                                    disabled={isReadOnly}
                                                    key={dStr}
                                                    onClick={() => setEditingOverride(prev => {
                                                        if (!prev) return null;
                                                        const next = { ...(prev.inactiveDays || {}) };
                                                        next[dStr] = !next[dStr];
                                                        return { ...prev, inactiveDays: next };
                                                    })}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center w-8 h-10 rounded-lg border transition-all shadow-sm shrink-0",
                                                        isInactive
                                                            ? "bg-destructive/10 border-destructive/30 text-destructive scale-95"
                                                            : isHoliday
                                                                ? "bg-indigo-50 border-indigo-200 text-indigo-700 hover:border-indigo-400"
                                                                : isWeekend
                                                                    ? "bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400"
                                                                    : "bg-white border-primary/10 text-primary hover:border-primary/40",
                                                        isReadOnly && "opacity-50 cursor-not-allowed"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "text-[7px] font-black opacity-60 leading-none mb-0.5",
                                                        isHoliday ? "text-indigo-600" : (isWeekend ? "text-amber-600" : "")
                                                    )}>
                                                        {dayName}
                                                    </span>
                                                    <span className="text-[10px] font-bold leading-none">{dayNum}</span>
                                                    {isInactive && <div className="w-0.5 h-0.5 bg-destructive rounded-full mt-0.5" />}
                                                    {isHoliday && !isInactive && <div className="w-0.5 h-0.5 bg-indigo-500 rounded-full mt-0.5" />}
                                                </button>
                                            );
                                            curr.setDate(curr.getDate() + 1);
                                        }

                                        if (isLimitExceeded) {
                                            chips.push(
                                                <div key="limit-warning" className="w-full mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                                                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                                    <p className="text-[10px] text-amber-700 font-medium leading-tight">
                                                        Límite ampliado: Se muestran los primeros 186 días (6 meses) para optimizar el rendimiento. Por favor, programe el resto en un segundo bloque si es necesario.
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return chips;
                                    })()}
                                </div>
                                <p className="text-[8px] text-muted-foreground italic px-1">
                                    Selecciona los días individuales que deseas marcar como **paro**.
                                </p>
                            </div>
                        )}

                        {!editingOverride?.inactive && editingOverride?.machineId !== 99 && (
                            <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-xl border border-border/50 shadow-inner">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-muted-foreground mb-1">Producto</Label>
                                    <Select disabled={isReadOnly} value={editingOverride?.currentProductId || ''} onValueChange={(val) => {
                                        const speed = plannedSpeeds[val] || editingOverride?.currentSpeed || 0;
                                        setEditingOverride(prev => prev ? { ...prev, currentProductId: val, currentSpeed: speed } : null);
                                    }}>
                                        <SelectTrigger className="h-10 bg-white border-border/50 font-bold">
                                            <SelectValue placeholder="Seleccionar producto" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {products.map((p) => (
                                                <SelectItem key={p.id} value={p.id} className="font-bold">
                                                    {p.productName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-muted-foreground mb-1">Velocidad (BPM)</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            disabled={isReadOnly}
                                            type="number"
                                            value={editingOverride?.currentSpeed || 0}
                                            onChange={(e) => setEditingOverride(prev => prev ? { ...prev, currentSpeed: Number(e.target.value) } : null)}
                                            className="h-10 text-lg font-black text-center border-primary/30"
                                        />
                                        <div className="flex flex-col shrink-0">
                                            <span className="text-[10px] font-bold text-primary leading-none uppercase">BPM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="border-t p-6 gap-2 shrink-0 bg-gray-50/50">
                        <Button variant="outline" onClick={() => setEditingOverride(null)} className="flex-1 h-10">{isReadOnly ? 'Cerrar' : 'Cancelar'}</Button>
                        {!isReadOnly && <Button onClick={applyEditOverride} className="flex-1 h-10 shadow-lg shadow-primary/20">Programar Cambios</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <SaveSnapshotDialog
                open={isSaveSnapshotOpen}
                onOpenChange={setIsSaveSnapshotOpen}
                name={snapshotName}
                setName={setSnapshotName}
                onSave={handleSaveSnapshot}
                isSaving={isSavingSnapshot}
            />

            <RenameSnapshotDialog
                open={isRenameOpen}
                onOpenChange={setIsRenameOpen}
                name={renameName}
                setName={setRenameName}
                onSave={confirmRename}
            />

            <HistorySidebar
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                snapshots={snapshots}
                isLoading={isLoadingHistory}
                activeSnapshotId={activeSnapshotId}
                onLoad={loadSnapshot}
                onDelete={handleDeleteSnapshot}
                onRename={handleRenameSnapshot}
            />

            <GoalsModal
                open={isGoalsModalOpen}
                onOpenChange={setIsGoalsModalOpen}
                products={products}
                plannedGoals={plannedGoals}
                setPlannedGoals={setPlannedGoals}
                plannedSpeeds={plannedSpeeds}
                setPlannedSpeeds={setPlannedSpeeds}
                dailySupply={dailySupply}
                setDailySupply={setDailySupply}
                isReadOnly={isReadOnly}
            />

            <Dialog open={isPDFModalOpen} onOpenChange={setIsPDFModalOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" /> Exportar Reporte de Proyección
                        </DialogTitle>
                        <DialogDescription>
                            Seleccione el nivel de detalle requerido para el informe técnico de producción.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-4 py-4">
                        <Button
                            variant="outline"
                            className="h-auto min-h-[80px] w-full flex flex-col items-start gap-1 p-4 border-2 hover:border-primary hover:bg-primary/5 group transition-all whitespace-normal"
                            onClick={() => {
                                handleGeneratePDF('semana');
                                setIsPDFModalOpen(false);
                            }}
                        >
                            <div className="flex items-center gap-2 font-black text-primary uppercase tracking-tight">
                                <CalendarIcon className="h-4 w-4" /> Reporte Consolidado (Semanal)
                            </div>
                            <p className="text-[10px] text-muted-foreground text-left leading-tight group-hover:text-primary/70 w-full">
                                Resumen estratégico por semanas y balances totales de inventario.
                            </p>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-auto min-h-[80px] w-full flex flex-col items-start gap-1 p-4 border-2 hover:border-primary hover:bg-primary/5 group transition-all whitespace-normal"
                            onClick={() => {
                                handleGeneratePDF('dia');
                                setIsPDFModalOpen(false);
                            }}
                        >
                            <div className="flex items-center gap-2 font-black text-primary uppercase tracking-tight">
                                <Clock className="h-4 w-4" /> Reporte Detallado (Diario)
                            </div>
                            <p className="text-[10px] text-muted-foreground text-left leading-tight group-hover:text-primary/70 w-full">
                                Desglose operativo por turnos, máquinas y fechas específicas.
                            </p>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-auto min-h-[80px] w-full flex flex-col items-start gap-1 p-4 border-2 hover:border-primary hover:bg-primary/5 group transition-all whitespace-normal"
                            onClick={() => {
                                handleGeneratePDF('visual');
                                setIsPDFModalOpen(false);
                            }}
                        >
                            <div className="flex items-center gap-2 font-black text-primary uppercase tracking-tight">
                                <ImageIcon className="h-4 w-4" /> Reporte Visual (Gráficos)
                            </div>
                            <p className="text-[10px] text-muted-foreground text-left leading-tight group-hover:text-primary/70 w-full">
                                Versión gráfica simplificada con balances consolidados y visualización de datos.
                            </p>
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Hidden container for PDF chart capture - using opacity 0 instead of visibility hidden for html2canvas */}
            <div style={{ position: 'absolute', left: '-9999px', top: '0', width: '1400px', zIndex: -100, opacity: 0, pointerEvents: 'none' }}>
                <div className="bg-white p-8 space-y-12">
                    {/* SECCIÓN 1: TARJETAS DE INFORMACIÓN */}
                    <div id="pdf-cards-container" className="w-full pb-10">
                        <div className="flex items-center gap-3 mb-8 border-b-2 border-blue-100 pb-4">
                            <PackageCheck className="h-10 w-10 text-blue-600" />
                            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-800">Resumen Ejecutivo de Operación</h2>
                        </div>
                        <div className="grid grid-cols-4 gap-8">
                            <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-2xl flex flex-col justify-between min-h-[180px]">
                                <div>
                                    <div className="text-4xl font-black mb-1">{totalFamiliarQQ.toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</div>
                                    <div className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em]">Total Familiar</div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/10 space-y-1.5 text-[12px]">
                                    <div className="flex justify-between"><span>Supervisor:</span> <b className="text-blue-300">{laborStats.familiarBreakdown.sup}</b></div>
                                    <div className="flex justify-between"><span>Operador:</span> <b className="text-blue-300">{laborStats.familiarBreakdown.op}</b></div>
                                    <div className="flex justify-between"><span>Envasadores:</span> <b className="text-blue-300">{Math.round(laborStats.familiarBreakdown.env)}</b></div>
                                </div>
                            </div>
                            <div className="bg-emerald-700 rounded-2xl p-8 text-white shadow-2xl flex flex-col justify-between min-h-[180px]">
                                <div>
                                    <div className="text-4xl font-black mb-1">{totalGranelQQ.toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</div>
                                    <div className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em]">Total Granel</div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/10 space-y-1.5 text-[12px]">
                                    <div className="flex justify-between"><span>Supervisor:</span> <b className="text-emerald-200">{laborStats.granelBreakdown.sup}</b></div>
                                    <div className="flex justify-between"><span>Operador:</span> <b className="text-emerald-200">{laborStats.granelBreakdown.op}</b></div>
                                    <div className="flex justify-between"><span>Granelero:</span> <b className="text-emerald-200">{Math.round(laborStats.granelBreakdown.gra)}</b></div>
                                </div>
                            </div>
                            <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-2xl flex flex-col justify-between min-h-[180px]">
                                <div>
                                    <div className="text-4xl font-black mb-1">{productionStats.totalProductionDays}</div>
                                    <div className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em]">Días con Producción</div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/10 space-y-3 text-[12px]">
                                    <div className="flex justify-between items-center">
                                        <span>Turno Día:</span>
                                        <span className="bg-white/20 px-3 py-1 rounded-lg font-black">{productionStats.totalProductionShiftsDia} Días</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Turno Noche:</span>
                                        <span className="bg-white/20 px-3 py-1 rounded-lg font-black">{productionStats.totalProductionShiftsNoc} Días</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-indigo-700 rounded-2xl p-8 text-white shadow-2xl flex flex-col justify-between min-h-[180px]">
                                <div>
                                    <div className="text-4xl font-black mb-1">{fulfillmentPct.toFixed(1)}%</div>
                                    <div className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em]">Cumplimiento Meta</div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/10 text-[11px] opacity-80 leading-relaxed italic">
                                    Meta planificada de {totalPlannedQQ.toLocaleString()} QQ para el periodo actual.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 2: RESUMEN POR PRESENTACIÓN */}
                    <div id="pdf-resumen-container" className="w-full pt-12 pb-10">
                        <div className="flex items-center gap-4 mb-10 border-b-2 border-blue-100 pb-5">
                            <LayoutDashboard className="h-10 w-10 text-blue-600" />
                            <h2 className="text-3xl font-black uppercase tracking-tight text-slate-800">Resumen Detallado por Presentación</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {Object.entries(productionStats.byProduct)
                                .sort((a, b) => b[1].qq - a[1].qq)
                                .map(([pId, data]) => {
                                    const product = products.find(p => p.id === pId);
                                    if (!product) return null;
                                    return (
                                        <div key={pId} className="border-l-8 rounded-r-xl border shadow-sm p-5 bg-slate-50 flex flex-col justify-between" style={{ borderLeftColor: product.color }}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">Producto</div>
                                                    <div className="text-lg font-black text-slate-800 leading-tight">{product.productName}</div>
                                                </div>
                                                <div className="bg-white px-3 py-1.5 rounded-lg border shadow-sm text-right">
                                                    <div className="text-xl font-black text-primary leading-none">{data.qq.toLocaleString()} QQ</div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 border-t pt-4">
                                                <div>
                                                    <div className="text-[8px] font-bold text-muted-foreground uppercase">Días Ops</div>
                                                    <div className="text-sm font-black">{data.dates.size}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[8px] font-bold text-muted-foreground uppercase">Turnos</div>
                                                    <div className="text-sm font-black text-blue-600">{data.count}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[8px] font-bold text-muted-foreground uppercase">Unidades</div>
                                                    <div className="text-sm font-black text-emerald-600">{Math.round(data.units).toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* SECCIÓN 3: BALANCES */}
                    <div id="pdf-balances-container" className="w-full pt-10">
                        <CombinedReport
                            id="reporte-consolidado-grafico-pdf"
                            isPDF={true}
                            productionData={productionStats.byProduct}
                            plannedGoals={plannedGoals}
                            products={products}
                            totalSupply={dailySupply * productionStats.totalProductionDays}
                            totalFamiliarQQ={totalFamiliarQQ}
                            totalGranelQQ={totalGranelQQ}
                            fulfillmentPct={fulfillmentPct}
                            totalPlannedQQ={totalPlannedQQ}
                        />
                    </div>

                    {/* SECCIÓN 4: MANO DE OBRA */}
                    <div id="pdf-mano-obra-container" className="w-full pt-10">
                        <LaborWeeklyChart
                            id="labor-weekly-chart-pdf"
                            laborWeeklyDetail={laborStats.weeklyDetail}
                            totalPersTurnosGlobal={laborStats.totalPersTurnosGlobal}
                            isPDF={true}
                        />
                    </div>
                </div>
            </div>

            {/* Autonomous Agent View */}
            {isAgentViewOpen && (
                <AutonomousAgentView
                    isOpen={isAgentViewOpen}
                    onClose={() => setIsAgentViewOpen(false)}
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
                    advisorInput={{
                        goals: products.filter((p: any) => (plannedGoals[p.id] || 0) > 0).map((p: any) => ({
                            productId: p.id,
                            productName: p.productName,
                            targetQQ: plannedGoals[p.id],
                            presentationWeightKg: (p as any).presentationWeight || null,
                            allowedMachines: [1, 2, 3].filter(id => machines.some((m: any) => m.id === id))
                        })),
                        machines: [1, 2, 3, 4].map(id => ({ id, name: 'Maquina ' + id, baseSpeed: machines.find((m: any) => m.id === id)?.speed || 100 })),
                        shifts: { dayHours: horasTurnoDia, nightHours: horasTurnoNoche },
                        efficiency: rendimiento,
                        supply: dailySupply,
                        maxWeeks: groupedWeeks.reduce((acc: any, g: any) => acc + g.weeks.length, 0),
                        holidays: Array.from(getEcuadorHolidays(new Date(zafraStartDate).getFullYear())),
                        safeCombinations,
                        prohibitedCombinations,
                        plannedSpeeds,
                        season,
                        labor: { type: laborType, dayRate: fixedDayRate, nightRate: fixedNightRate },
                        availableDays: season === 'zafra' ? 'Lunes a Domingo (24/7)' : 'Lunes a Sábado',
                        projectionMode,
                        maxDays: groupedWeeks.reduce((acc: any, g: any) => acc + g.weeks.reduce((wAcc: any, w: any) => wAcc + w.days.length, 0), 0),
                    }}
                    groupedWeeks={groupedWeeks}
                    classifyProduct={classifyProduct}
                    generateAutoLabel={generateAutoLabel}
                    onApplyOverrides={(smartEngineOverrides: any, scenarioName: string) => {
                        setActiveScenarioName(scenarioName);
                        setOverrides(smartEngineOverrides);
                        setProjectionMode('auto');
                    }}
                />
            )}
        </div>
    );
}

function HistorySidebar({
    open,
    onOpenChange,
    snapshots,
    isLoading,
    activeSnapshotId,
    onLoad,
    onDelete,
    onRename
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    snapshots: any[],
    isLoading: boolean,
    activeSnapshotId: string | null,
    onLoad: (s: any, readOnly?: boolean) => void,
    onDelete: (e: React.MouseEvent, id: string) => void,
    onRename: (e: React.MouseEvent, id: string, name: string) => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1000px] h-full sm:h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" /> Historial de Proyecciones
                    </DialogTitle>
                    <DialogDescription>
                        Gestiona y visualiza tus escenarios de producción guardados.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-2">
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Cargando historial...</p>
                        </div>
                    ) : snapshots.length === 0 ? (
                        <div className="text-center py-20">
                            <Archive className="h-10 w-10 mx-auto text-muted-foreground opacity-20 mb-2" />
                            <p className="text-sm text-muted-foreground">No hay escenarios guardados.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {snapshots.map((s) => {
                                const isActive = activeSnapshotId === s.id;
                                return (
                                    <div
                                        key={s.id}
                                        className={cn(
                                            "group p-4 border rounded-xl transition-all relative",
                                            isActive
                                                ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-md"
                                                : "hover:border-primary/50 hover:bg-primary/5"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    {isActive && <CheckCircle2 className="h-4 w-4 text-primary animate-in zoom-in duration-300" />}
                                                    <h4 className={cn(
                                                        "font-bold text-sm transition-colors leading-tight whitespace-pre-wrap",
                                                        isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                                                    )}>
                                                        {s.name}
                                                    </h4>
                                                    {isActive && (
                                                        <Badge variant="outline" className="h-4 px-1 text-[8px] font-black border-primary bg-primary/10 text-primary uppercase animate-pulse">
                                                            Actual
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {(() => {
                                                            const date = s.updatedAt || s.createdAt;
                                                            if (date?.toDate) return format(date.toDate(), 'dd/MM/yyyy HH:mm');
                                                            if (date instanceof Date) return format(date, 'dd/MM/yyyy HH:mm');
                                                            return 'Fecha no disponible';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem onClick={() => onLoad(s, true)} className="cursor-pointer gap-2">
                                                        <Eye className="h-4 w-4 text-blue-500" />
                                                        <span>Ver Proyección</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onLoad(s, false)} className="cursor-pointer gap-2">
                                                        <Pencil className="h-4 w-4 text-amber-500" />
                                                        <span>Cargar Escenario</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => onRename(e as any, s.id, s.name)} className="cursor-pointer gap-2">
                                                        <Edit className="h-4 w-4 text-primary" />
                                                        <span>Renombrar</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={(e) => onDelete(e as any, s.id)}
                                                        className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span>Eliminar</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-dashed">
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="bg-primary/5 text-[10px] py-0 px-2 font-medium border-primary/20">
                                                    {(s.summary?.totalQQ || 0).toLocaleString()} QQ
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground font-medium uppercase">Total Proyectado</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-[10px] font-bold text-primary hover:bg-primary/10 px-2"
                                                onClick={() => onLoad(s)}
                                            >
                                                CARGAR <ArrowRight className="h-3 w-3 ml-1" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <DialogFooter className="p-4 border-t">
                    <Button variant="outline" className="w-full h-10 font-bold" onClick={() => onOpenChange(false)}>
                        Cerrar Historial
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function OnDemandReportModal({
    isOpen,
    onClose,
    liveSimulationResults,
    machines,
    products,
    simulationState,
    shiftType,
}: {
    isOpen: boolean;
    onClose: () => void;
    liveSimulationResults: any;
    machines: MachineState[];
    products: ProductDefinition[];
    simulationState: SimulationState;
    shiftType: 'day' | 'night';
}) {
    const reportRef = React.useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

    if (!isOpen) return null;

    const formatSeconds = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const handleDownloadPdf = async () => {
        if (!reportRef.current) return;
        setIsGeneratingPdf(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const canvas = await html2canvas(reportRef.current, {
                scale: 3, // Higher scale for better quality
                backgroundColor: '#ffffff',
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Calculate dimensions to fit A4
            const margin = 15;
            const contentWidth = pageWidth - (margin * 2);
            const contentHeight = (canvas.height * contentWidth) / canvas.width;

            // Add a subtle border to the PDF page
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.1);
            pdf.rect(5, 5, pageWidth - 10, pageHeight - 10);

            pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
            pdf.save(`Reporte_Operaciones_${shiftType}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Actual Data
    const actualQQProduced = simulationState.totalQQProduced;
    const actualQQPacked = liveSimulationResults.totalQQPacked;
    const currentSiloLevel = simulationState.silos.reduce((sum, s) => sum + s.currentQQ, 0);
    const maxSiloCapacity = simulationState.silos.reduce((sum, s) => sum + s.capacityQQ, 0);

    const machineActuals = machines.filter(m => m.productId !== 'inactive').map(machine => {
        const totalUnits = simulationState.machineTotals[machine.id] || 0;
        const product = products.find(p => p.id === machine.productId);
        const totalKg = totalUnits * (product?.presentationWeight || 0);
        const totalQQ = totalKg / KG_PER_QUINTAL;
        let unitsPerBundle = 1;
        if (product && product.presentationWeight && product.presentationWeight > 0) {
            if (product.primaryPackaging === 'fardo' && product.bundleWeight) {
                unitsPerBundle = Math.round(product.bundleWeight / product.presentationWeight);
            } else if (product.primaryPackaging === 'saco' || product.primaryPackaging === 'granel' || !product.bundleWeight) {
                unitsPerBundle = Math.round((product.sackWeight || 50) / product.presentationWeight);
            } else {
                unitsPerBundle = Math.round((product.bundleWeight || 1) / product.presentationWeight);
            }
        }
        const totalBundles = totalUnits / (unitsPerBundle || 1);

        const getPalletCapacity = (p: any): number => {
            if (!p) return 35;
            if (p.unitsPerPallet && p.unitsPerPallet > 0) return p.unitsPerPallet;
            const name = (p.productName || '').toLowerCase();
            if (name.includes('1 kg -blanca (50 kg) don antonio')) return 165;
            if (name.includes('1 kg -blanca (12 kg)')) return 165;
            if (name.includes('12 kg') || name.includes('12kg')) return 165;
            if (name.includes('25 kg') || name.includes('500 g')) return 72;
            return 35;
        };
        const sacksPerPallet = getPalletCapacity(product);
        const totalPallets = totalBundles / sacksPerPallet;

        return {
            id: machine.id,
            productName: product?.productName,
            units: totalUnits,
            qq: totalQQ,
            bundles: totalBundles,
            unitLabel: getUnitLabel(product),
            speed: machine.speed,
            pallets: totalPallets
        };
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-secondary rounded-lg">
                                <FileText className="h-6 w-6 text-foreground" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold">Reporte de Operaciones (Actual)</DialogTitle>
                                <DialogDescription className="font-medium text-muted-foreground">
                                    Resumen de la simulaciÃ³n en curso
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-10 px-12 space-y-8 bg-white text-slate-900 shadow-2xl rounded-sm max-w-[95%] mx-auto" ref={reportRef}>
                    <div className="border-b-2 border-primary pb-6 mb-8 flex justify-between items-end">
                        <div>
                            <h2 className="text-3xl font-black text-primary uppercase tracking-tighter">Control 7</h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sistema de SimulaciÃ³n Industrial</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha del Reporte</p>
                            <p className="font-mono font-bold">{new Date().toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="p-4 rounded-xl border bg-card text-center space-y-1">
                            <Beaker className="h-5 w-5 mx-auto text-pink-500 mb-1" />
                            <div className="text-xl font-bold">{simulationState.totalMasasSent}</div>
                            <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">Masas Recibidas</div>
                        </div>
                        <div className="p-4 rounded-xl border bg-card text-center space-y-1">
                            <Waves className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                            <div className="text-xl font-bold">{actualQQProduced.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                            <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">QQ Producidos (Tachos)</div>
                        </div>
                        <div className="p-4 rounded-xl border bg-card text-center space-y-1">
                            <Warehouse className="h-5 w-5 mx-auto text-green-500 mb-1" />
                            <div className="text-xl font-bold">{actualQQPacked.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                            <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">QQ Empacados</div>
                        </div>
                        <div className="p-4 rounded-xl border bg-card text-center space-y-1">
                            <Package className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                            <div className="text-xl font-bold">{Math.floor(liveSimulationResults.totalUnitsProduced).toLocaleString()}</div>
                            <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">Unidades Totales</div>
                        </div>
                        <div className="p-4 rounded-xl border bg-card text-center space-y-1">
                            <Clock className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                            <div className="text-xl font-bold">{formatSeconds(simulationState.elapsedTime)}</div>
                            <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">Tiempo OperaciÃ³n</div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            Estado Actual de los Silos
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {simulationState.silos.map(s => (
                                <div key={s.id} className="p-4 border rounded-xl bg-muted/10 space-y-2">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>{s.name}</span>
                                        <span>{s.capacityQQ > 0 ? (s.currentQQ / s.capacityQQ * 100).toFixed(1) : 0}%</span>
                                    </div>
                                    <Progress value={s.capacityQQ > 0 ? (s.currentQQ / s.capacityQQ) * 100 : 0} className="h-3" />
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{s.currentQQ.toLocaleString(undefined, { maximumFractionDigits: 1 })} QQ</span>
                                        <span>MÃ¡x: {s.capacityQQ.toLocaleString()} QQ</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {simulationState.siloHistory && simulationState.siloHistory.length > 0 && (
                            <div className="mt-6 p-4 border rounded-xl bg-muted/10 h-64">
                                <h5 className="text-xs font-bold uppercase text-muted-foreground mb-4 text-center">Comportamiento del Nivel por Hora (QQ)</h5>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={simulationState.siloHistory} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                        <XAxis dataKey="time" height={20} tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <RechartsTooltip />
                                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                                        {simulationState.silos.map((s, idx) => {
                                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                                            return (
                                                <Line
                                                    key={s.id}
                                                    type="monotone"
                                                    dataKey={`silo_${s.id}`}
                                                    name={s.name}
                                                    stroke={colors[idx % colors.length]}
                                                    strokeWidth={2}
                                                    dot={true}
                                                />
                                            );
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <PackageCheck className="h-4 w-4" />
                            Producción Actual por Máquina
                        </h4>
                        <div className="grid gap-3">
                            {machineActuals.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No hay máquinas configuradas.</p>
                            ) : (
                                machineActuals.map(mp => (
                                    <div key={mp.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border bg-muted/20 gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                                                {mp.id}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">Máquina {mp.id}</div>
                                                <div className="text-[10px] text-muted-foreground">{mp.productName}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end text-right">
                                            <div>
                                                <div className="font-mono font-bold text-sm">{Math.floor(mp.bundles).toLocaleString()} {mp.unitLabel}s</div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground">{(mp.speed || 0).toFixed(1)} u/min</span>
                                                    <span className="text-[10px] font-bold text-primary">Pallets: {mp.pallets.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <div className="w-20 sm:w-24">
                                                <div className="font-mono font-bold text-sm text-primary">{(mp.qq || 0).toFixed(1)} QQ</div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex gap-2 border-t pt-4">
                    <Button variant="outline" onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex-1 sm:flex-none">
                        {isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}
                    </Button>
                    <Button className="w-full sm:w-auto" onClick={onClose}>
                        Cerrar Reporte
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SaveSnapshotDialog({
    open,
    onOpenChange,
    name,
    setName,
    onSave,
    isSaving
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    name: string,
    setName: (val: string) => void,
    onSave: () => void,
    isSaving: boolean
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Save className="h-5 w-5 text-primary" /> Guardar Escenario
                    </DialogTitle>
                    <DialogDescription>
                        Asigna un nombre descriptivo para identificar este escenario en el historial.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="snapshotName">Nombre del Escenario</Label>
                        <Textarea
                            id="snapshotName"
                            placeholder="Ej. Plan de Contingencia..."
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
                            className="min-h-[100px] resize-none font-medium leading-relaxed uppercase"
                            autoFocus
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button onClick={onSave} disabled={isSaving || !name.trim()}>
                        {isSaving ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                            </>
                        ) : "Guardar Escenario"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RenameSnapshotDialog({
    open,
    onOpenChange,
    name,
    setName,
    onSave
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    name: string,
    setName: (val: string) => void,
    onSave: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Edit className="h-5 w-5 text-primary" /> Renombrar Escenario
                    </DialogTitle>
                    <DialogDescription>
                        Actualiza el nombre del escenario guardado.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="renameSnapshotName">Nombre del Escenario</Label>
                        <Textarea
                            id="renameSnapshotName"
                            placeholder="Nuevo nombre..."
                            value={name}
                            onChange={(e) => setName(e.target.value.toUpperCase())}
                            className="min-h-[100px] resize-none font-medium leading-relaxed uppercase"
                            autoFocus
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={onSave} disabled={!name.trim()}>
                        Guardar Cambios
                    </Button>
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

    const [bufferTankCapacityQQ, setBufferTankCapacityQQ] = React.useState(380);
    const [bufferTransferTimeMinutes, setBufferTransferTimeMinutes] = React.useState(5);
    const [targetShiftHours, setTargetShiftHours] = React.useState(11);
    const [isShiftGoalEnabled, setIsShiftGoalEnabled] = React.useState(true);
    const [isProjectionReportOpen, setIsProjectionReportOpen] = React.useState(false);

    const [isSaveSnapshotOpen, setIsSaveSnapshotOpen] = React.useState(false);
    const [snapshotName, setSnapshotName] = React.useState('');
    const [isSavingSnapshot, setIsSavingSnapshot] = React.useState(false);
    const [isRenameOpen, setIsRenameOpen] = React.useState(false);
    const [renameId, setRenameId] = React.useState('');
    const [renameName, setRenameName] = React.useState('');
    const searchParams = useSearchParams();
    const router = useRouter();

    const isProjectionView = searchParams.get('view') === 'projection';
    const [projectionHours, setProjectionHours] = React.useState(8);
    const [isAutoStartEnabled, setIsAutoStartEnabled] = React.useState(false);
    const [isReserveSiloEnabled, setIsReserveSiloEnabled] = React.useState(false);
    const [shiftType, setShiftType] = React.useState<'day' | 'night'>('day');
    const [dayLunchBreak, setDayLunchBreak] = React.useState({ start: '12:00', end: '13:00', enabled: true });
    const [nightDinnerBreak, setNightDinnerBreak] = React.useState({ start: '00:00', end: '01:00', enabled: true });
    const [nightBreakfastBreak, setNightBreakfastBreak] = React.useState({ start: '06:00', end: '06:30', enabled: true });
    const [isGranelActive, setIsGranelActive] = React.useState(false);
    const [granelSpeed, setGranelSpeed] = React.useState(100);

    // --- UI State ---
    const [editingMachine, setEditingMachine] = React.useState<MachineState | null>(null);
    const [editingSilo, setEditingSilo] = React.useState<SiloState | TachosSimState | null>(null);
    const [editingReceiver, setEditingReceiver] = React.useState<ReceiverState | null>(null);
    const [editingCentrifuges, setEditingCentrifuges] = React.useState(false);
    const [editingWrapper, setEditingWrapper] = React.useState<WrapperState | null>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [showImages, setShowImages] = React.useState(true);
    const [isShiftConfigOpen, setIsShiftConfigOpen] = React.useState(false);

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

    // Ref to track if auto-start has already fired in the current cycle
    const autoStartTriggeredRef = React.useRef(false);

    const isReserveSiloEnabledRef = React.useRef(isReserveSiloEnabled);
    React.useEffect(() => { isReserveSiloEnabledRef.current = isReserveSiloEnabled; }, [isReserveSiloEnabled]);

    const shiftTypeRef = React.useRef(shiftType);
    React.useEffect(() => { shiftTypeRef.current = shiftType; }, [shiftType]);

    const dayLunchBreakRef = React.useRef(dayLunchBreak);
    React.useEffect(() => { dayLunchBreakRef.current = dayLunchBreak; }, [dayLunchBreak]);

    const nightDinnerBreakRef = React.useRef(nightDinnerBreak);
    React.useEffect(() => { nightDinnerBreakRef.current = nightDinnerBreak; }, [nightDinnerBreak]);

    const nightBreakfastBreakRef = React.useRef(nightBreakfastBreak);
    React.useEffect(() => { nightBreakfastBreakRef.current = nightBreakfastBreak; }, [nightBreakfastBreak]);

    const isGranelActiveRef = React.useRef(isGranelActive);
    React.useEffect(() => { isGranelActiveRef.current = isGranelActive; }, [isGranelActive]);

    const granelSpeedRef = React.useRef(granelSpeed);
    React.useEffect(() => { granelSpeedRef.current = granelSpeed; }, [granelSpeed]);

    const productsRef = React.useRef(products);
    React.useEffect(() => { productsRef.current = products; }, [products]);

    const wrappersRef = React.useRef(wrappers);
    React.useEffect(() => { wrappersRef.current = wrappers; }, [wrappers]);

    const createInitialSimulationState = React.useCallback((): SimulationState => {
        const initialQQInReceivers = receivers.reduce((sum, r) => sum + r.currentQQ, 0);
        return {
            elapsedTime: 0,
            virtualTimeSeconds: shiftType === 'day' ? 7 * 3600 : 18 * 3600, // 07:00 or 18:00
            isBreakActive: false,
            machineTotals: { 1: 0, 2: 0, 3: 0, 4: 0 },
            wrappers: {
                '1': { buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] },
                '2': { buffer: 0, currentBundleProgress: 0, totalBundles: 0, conveyorBelt: [] },
            },
            isFinished: false,
            silos: silos.map(s => ({ ...s, currentQQ: 0 })),
            receivers: receivers.map(r => ({ ...r, currentQQ: 0, state: 'idle', fillProgress: 0, drainingBy: [] })),
            centrifuges: centrifuges.map(c => ({ ...c, state: 'idle', stageTimeRemaining: 0, stageProgress: 0, timeIntoCycle: 0, currentLoadQQ: 0 })),
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
            siloHistory: [],
            totalGranelQQ: 0,
        };
    }, [silos, receivers, centrifuges, tachosCookTime, tachosTransferTime, tachosImageUrl]);

    const [simulationState, setSimulationState] = React.useState<SimulationState>(createInitialSimulationState);

    const handleManualSendMasa = () => {
        const availableReceiver = simulationState.receivers.find(r => r.state === 'idle');

        if (simulationState.tachos.state === 'sending') {
            toast({ title: 'Tachos Ocupados', description: 'Ya se estÃ¡ enviando una masa actualmente.', variant: 'destructive' });
            return;
        }

        if (!availableReceiver && simulationState.tachos.state !== 'cooking') {
            toast({ title: 'Sin Recibidores', description: 'No hay recibidores disponibles para la masa.', variant: 'destructive' });
            return;
        }

        setSimulationState(prev => {
            const currentAvailable = prev.receivers.find(r => r.state === 'idle');

            // If cooking, skip or send
            if (prev.tachos.state === 'cooking') {
                if (!currentAvailable) {
                    return {
                        ...prev,
                        tachos: { ...prev.tachos, state: 'ready', timeRemaining: 0, progress: 100 }
                    };
                }
                return {
                    ...prev,
                    receivers: prev.receivers.map(r => r.id === currentAvailable.id ? { ...r, state: 'filling' } : r),
                    tachos: {
                        ...prev.tachos,
                        state: 'sending',
                        targetReceiverId: currentAvailable.id,
                        timeRemaining: prev.tachos.transferTimeSeconds,
                        progress: 0,
                    },
                    totalMasasSent: prev.totalMasasSent + 1,
                };
            }

            // Normal case (ready or idle)
            if (!currentAvailable) return prev;

            return {
                ...prev,
                receivers: prev.receivers.map(r => r.id === currentAvailable.id ? { ...r, state: 'filling' } : r),
                tachos: {
                    ...prev.tachos,
                    state: 'sending',
                    targetReceiverId: currentAvailable.id,
                    timeRemaining: prev.tachos.transferTimeSeconds,
                    progress: 0,
                },
                totalMasasSent: prev.totalMasasSent + 1,
            };
        });

        toast({ title: 'Masa Procesada', description: 'AcciÃ³n manual ejecutada correctamente.' });
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

    const formatVirtualTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600) % 24;
        const m = Math.floor((seconds % 3600) / 60);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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
                { id: 1, productId: 'inactive', speed: 38, loss: 0, isSimulatingActive: false, keepActiveDuringBreaks: false },
                { id: 2, productId: 'inactive', speed: 38, loss: 0, isSimulatingActive: false, keepActiveDuringBreaks: false },
                { id: 3, productId: 'inactive', speed: 38, loss: 0, isSimulatingActive: false, keepActiveDuringBreaks: false },
                { id: 4, productId: 'inactive', speed: 38, loss: 0, isSimulatingActive: false, keepActiveDuringBreaks: false },
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
            targetShiftHours: 11,
            isShiftGoalEnabled: true,
            isAutoStartEnabled: false,
            isReserveSiloEnabled: false,
            shiftType: 'day',
            dayLunchBreak: { start: '12:00', end: '13:00', enabled: true },
            nightDinnerBreak: { start: '00:00', end: '01:00', enabled: true },
            nightBreakfastBreak: { start: '06:00', end: '06:30', enabled: true },
            isGranelActive: false,
            granelSpeed: 100, // Default Granel speed in QQ/hour or similar? Let's use a reasonable default.
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
                        const final = { ...dm, ...sm };
                        if (final.speed === 0 || final.speed === 30) final.speed = 38;
                        return final;
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
                isSimulatingActive: m.isSimulatingActive ?? false
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
            setTargetShiftHours(params.targetShiftHours ?? 11);
            setIsShiftGoalEnabled(params.isShiftGoalEnabled ?? true);
            setIsAutoStartEnabled(params.isAutoStartEnabled ?? false);
            setIsReserveSiloEnabled(params.isReserveSiloEnabled ?? false);
            setShiftType(params.shiftType ?? 'day');
            setDayLunchBreak(params.dayLunchBreak ?? { start: '12:00', end: '13:00', enabled: true });
            setNightDinnerBreak(params.nightDinnerBreak ?? { start: '00:00', end: '01:00', enabled: true });
            setNightBreakfastBreak(params.nightBreakfastBreak ?? { start: '06:00', end: '06:30', enabled: true });
            setIsGranelActive(params.isGranelActive ?? false);
            setGranelSpeed(params.granelSpeed ?? 100);

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
            machines: machines.map(({ imageUrl, ...m }) => m),
            wrappers: wrappers.map(({ buffer, currentBundleProgress, totalBundles, conveyorBelt, imageUrl, ...w }) => w),
            silos: silos.map(({ imageUrl, currentQQ, ...s }) => s),
            receivers: receivers.map(({ currentQQ, state, fillProgress, drainingBy, transferRate, ...r }) => r),
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
            shiftType: shiftType,
            dayLunchBreak: dayLunchBreak,
            nightDinnerBreak: nightDinnerBreak,
            nightBreakfastBreak: nightBreakfastBreak,
            isGranelActive: isGranelActive,
            granelSpeed: granelSpeed,
        };
        try {
            window.localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(paramsToSave));
        } catch (error) {
            console.error("Error saving params to localStorage", error);
        }
    }, [isClient, machines, wrappers, silos, receivers, tachosCookTime, tachosTransferTime, tachosGoal, isTachosAuto, isTachosGoalEnabled, masaQQAmount, centrifugeBatchSizeQQ, centrifugeLoadTime, centrifugeWashTime, centrifugePurgeTime, centrifugeStartInterval, isCentrifugesAuto, bufferTankCapacityQQ, bufferTransferTimeMinutes, targetShiftHours, isShiftGoalEnabled, isAutoStartEnabled, isReserveSiloEnabled, shiftType, dayLunchBreak, nightDinnerBreak, nightBreakfastBreak]);

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

            // Save as nested object so loader (firestoreImages.machines[id]) can read it correctly
            let updatePayload: Record<string, any>;
            if (type === 'tachos') {
                updatePayload = { tachos: downloadURL };
            } else {
                updatePayload = { [`${type}s`]: { [id]: downloadURL } };
            }
            const docRef = doc(db, FIRESTORE_ASSETS_PATH, 'images');
            await setDoc(docRef, updatePayload, { merge: true });

            if (type === 'machine') {
                setMachines(prev => prev.map(m => m.id === id ? { ...m, imageUrl: downloadURL } : m));
            } else if (type === 'silo') {
                setSilos(prev => prev.map(s => s.id === id ? { ...s, imageUrl: downloadURL } : s));
            } else if (type === 'wrapper') {
                setWrappers(prev => prev.map(w => w.id === id ? { ...w, imageUrl: downloadURL } : w));
            } else if (type === 'tachos') {
                setTachosImageUrl(downloadURL);
            }
            toast({ title: "Imagen actualizada", description: "La nueva imagen se ha guardado correctamente." });

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

    const handleSiloSave = (updatedSilo: Omit<SiloState, 'imageUrl' | 'currentQQ'>) => {
        setSilos(prev => prev.map(s => s.id === updatedSilo.id ? { ...s, ...updatedSilo } : s));
    };

    const handleReceiverSave = (updatedReceiver: Omit<ReceiverState, 'imageUrl' | 'currentQQ' | 'state' | 'fillProgress' | 'drainingBy'>) => {
        setReceivers(prev => prev.map(r => r.id === updatedReceiver.id ? { ...r, ...updatedReceiver } : r));
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
                    title: "AcciÃƒÆ’Ã‚Â³n Bloqueada",
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

                // Calculate virtual time
                const shiftStartSeconds = shiftTypeRef.current === 'day' ? 7 * 3600 : 18 * 3600;
                let currentVirtualTime = shiftStartSeconds + nextState.elapsedTime;
                // Handle midnight crossover for night shift
                if (currentVirtualTime >= 24 * 3600) currentVirtualTime -= 24 * 3600;
                nextState.virtualTimeSeconds = currentVirtualTime;

                // Helper to check if a time is within a break
                const isTimeInBreak = (currentTime: number, breakConfig: { start: string, end: string, enabled: boolean }) => {
                    if (!breakConfig.enabled) return false;
                    const timeToSecs = (timeStr: string) => {
                        const [h, m] = timeStr.split(':').map(Number);
                        return h * 3600 + m * 60;
                    };
                    const start = timeToSecs(breakConfig.start);
                    const end = timeToSecs(breakConfig.end);

                    if (start <= end) {
                        return currentTime >= start && currentTime < end;
                    } else {
                        // Overnight break (e.g., 23:30 to 00:30)
                        return currentTime >= start || currentTime < end;
                    }
                };

                // Check for active breaks based on shift
                let isBreak = false;
                if (shiftTypeRef.current === 'day') {
                    isBreak = isTimeInBreak(currentVirtualTime, dayLunchBreakRef.current);
                } else {
                    isBreak = isTimeInBreak(currentVirtualTime, nightDinnerBreakRef.current) ||
                        isTimeInBreak(currentVirtualTime, nightBreakfastBreakRef.current);
                }
                nextState.isBreakActive = isBreak;

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
                // - El tanque pulmon solo acepta masa cuando esta COMPLETAMENTE VACÃƒÆ’Ã‚ O.
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
                    // Recibidor vaciado â†’ liberar (idle) para que pueda recibir nueva masa del tacho
                    if (activeDraining.currentQQ <= 0.01) {
                        activeDraining.currentQQ = 0;
                        activeDraining.transferRate = null;
                        activeDraining.state = 'idle';
                    }
                } else {
                    // 2. No hay drenado activo -> iniciar SOLO si el tanque esta VACÃƒÆ’Ã‚ O
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

                    // MODO AUTOMÃƒÆ’Ã‚ TICO: Las centrifugas inician cuando se activa el modo de drenado
                    // (al llegar al 50%) y continÃƒÆ’Ã‚Âºan operando hasta que el tanque se vacÃƒÆ’Ã‚Â­e.
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
                        if (reserveSilo && reserveSilo.currentQQ < reserveSilo.capacityQQ && isReserveSiloEnabledRef.current) targetSilos.push(reserveSilo);

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

                // PACKAGING PAUSE LOGIC: Only skip if break is active
                if (nextState.isBreakActive) {
                    canProduceAllRequired = false;
                }

                // Temporary objects to store consumption to apply after verification
                const consumptionBySilo: Record<string, number> = { familiar: 0, reserva: 0 };
                const machineCanProduce: Record<number, boolean> = {};

                activeMachines.forEach(machine => {
                    // Check if machine should be active during break
                    const shouldProcess = !nextState.isBreakActive || machine.keepActiveDuringBreaks;

                    if (shouldProcess) {
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
                    } else {
                        machineCanProduce[machine.id] = false;
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
                // Simulation ends when the total elapsed time reaches the shift duration
                if (isShiftGoalEnabledRef.current && nextState.elapsedTime >= (targetShiftHoursRef.current * 3600)) {
                    nextState.isFinished = true;
                }

                // 5. Auto-Start Logic (30% Silo Level) - Trigger-based
                const familiarSiloForStart = nextState.silos.find(s => s.id === 'familiar');
                const familiarLevelPercent = familiarSiloForStart ? (familiarSiloForStart.currentQQ / familiarSiloForStart.capacityQQ) * 100 : 0;

                // Reset trigger if level drops significantly (hysteresis)
                if (familiarLevelPercent < 5) {
                    autoStartTriggeredRef.current = false;
                }

                // Trigger auto-start if enabled, threshold reached, and hasn't fired yet
                if (isAutoStartEnabledRef.current === true && familiarLevelPercent >= 30 && !autoStartTriggeredRef.current) {
                    const machinesToStart = machinesRef.current.filter(m => m.productId !== 'inactive' && !m.isSimulatingActive);
                    if (machinesToStart.length > 0) {
                        autoStartTriggeredRef.current = true;
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

                // Record history every virtual hour
                const virtualHour = Math.floor(nextState.virtualTimeSeconds / 3600);
                const prevVirtualHour = Math.floor(prev.virtualTimeSeconds / 3600);
                if (virtualHour > prevVirtualHour || nextState.siloHistory.length === 0) {
                    const formatHour = virtualHour >= 24 ? virtualHour - 24 : virtualHour;
                    const timeString = `${formatHour.toString().padStart(2, '0')}:00`;
                    const historyEntry: any = { time: timeString };
                    nextState.silos.forEach(s => {
                        historyEntry[`silo_${s.id}`] = Math.round(s.currentQQ);
                    });
                    nextState.siloHistory.push(historyEntry);
                }

                return nextState;
            });
        }, tickRateMs);
    };

    const resetSimulation = () => {
        pauseClock();
        setSimulationState(createInitialSimulationState());
        setIsTachosAuto(false);
        // Reset all machines to inactive
        setMachines(prev => prev.map(m => ({ ...m, isSimulatingActive: false })));
        // Reset the auto-start trigger
        autoStartTriggeredRef.current = false;
    };


    const toggleMachineActive = (machineId: number) => {
        setMachines(prev => prev.map(m => {
            if (m.id === machineId) {
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
            const bagsPerMinuteForThisWrapper = connectedMachines.reduce((machineSum, machine) => machineSum + (machine.speed * (1 - machine.loss / 100)), 0);

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
                    advice: "Casi al lÃƒÆ’Ã‚Â­mite de la demanda de empaque."
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
                    message: "Nivel CrÃƒÆ’Ã‚Â­tico de AzÃƒÆ’Ã‚Âºcar",
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
            totalQQPacked: simulationState.totalQQPacked,
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

    if (isProjectionView) {
        return <ProductionProjectionView onClose={() => { router.push('/ia'); }} machines={machines} products={products} />;
    }

    return (
        <div className="bg-background min-h-screen text-foreground flex-1">
            <Header title="Panel de Operaciones" icon={Activity}>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsProjectionReportOpen(true)}
                        disabled={simulationState.elapsedTime === 0}
                        title={simulationState.elapsedTime === 0 ? "Inicia la simulación para generar un reporte" : "Generar Reporte"}
                    >
                        <FileText className="h-4 w-4" />
                    </Button>

                </div>
            </Header>

            <main className="p-3 md:p-6 lg:p-8 space-y-6 md:space-y-8">
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

                {simulationState.isBreakActive && (
                    <Alert className="border-2 bg-amber-500/10 text-amber-600 border-amber-500/50 animate-pulse">
                        <Clock className="h-5 w-5" />
                        <AlertTitle className="font-bold uppercase">
                            {shiftType === 'day' ? 'PAUSA DE ALMUERZO ACTIVADA' : 'PAUSA DE ALIMENTACIÃ“N ACTIVADA'}
                        </AlertTitle>
                        <AlertDescription>
                            Periodo de descanso programado activo. Las mÃ¡quinas en modo pausa estÃ¡n detenidas; el resto de la planta y mÃ¡quinas configuradas continÃºan operando.
                        </AlertDescription>
                    </Alert>
                )}

                {!isClient ? (
                    <div className="flex justify-center items-center h-64">
                        <p className="text-muted-foreground">Cargando panel de operaciones...</p>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 md:mb-8">
                            <h3 className="text-base md:text-lg font-semibold text-center mb-3 md:mb-4">Flujo del Proceso de Produccion</h3>
                            <div className="flex items-center p-4 md:p-8 border border-primary/20 rounded-3xl bg-card/30 backdrop-blur-xl shadow-2xl overflow-x-auto gap-3 md:gap-6 justify-start md:justify-around transition-all hover:bg-card/40">
                                <TooltipProvider> <Tooltip> <TooltipTrigger>
                                    <div className="flex flex-col items-center gap-1 text-center min-w-[60px] md:min-w-[80px]">
                                        <Beaker className="h-6 w-6 md:h-10 md:w-10 text-primary" />
                                        <h4 className="font-semibold text-xs md:text-sm">Tachos</h4>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">{simulationState.totalMasasSent} Masas</p>
                                    </div>
                                </TooltipTrigger> <TooltipContent><p>Inicio: GeneraciÃ³n de masa.</p></TooltipContent> </Tooltip> </TooltipProvider>
                                <ArrowRight className="h-4 w-4 md:h-8 md:w-8 text-muted-foreground shrink-0" />
                                <TooltipProvider> <Tooltip> <TooltipTrigger>
                                    <div className="flex flex-col items-center gap-1 text-center min-w-[60px] md:min-w-[80px]">
                                        <Droplets className="h-6 w-6 md:h-10 md:w-10 text-primary" />
                                        <h4 className="font-semibold text-xs md:text-sm">Recibidores</h4>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">{(totalQQInReceivers ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</p>
                                    </div>
                                </TooltipTrigger> <TooltipContent><p>Almacenamiento temporal de masa.</p></TooltipContent> </Tooltip> </TooltipProvider>
                                <ArrowRight className="h-4 w-4 md:h-8 md:w-8 text-muted-foreground shrink-0" />
                                <TooltipProvider> <Tooltip> <TooltipTrigger>
                                    <div className="flex flex-col items-center gap-1 text-center min-w-[60px] md:min-w-[80px]">
                                        <Activity className="h-6 w-6 md:h-10 md:w-10 text-primary" />
                                        <h4 className="font-semibold text-xs">T. Pulmon</h4>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">{(simulationState.bufferTankQQ ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</p>
                                    </div>
                                </TooltipTrigger> <TooltipContent><p>Pulmon de almacenamiento intermedio.</p></TooltipContent> </Tooltip> </TooltipProvider>
                                <ArrowRight className="h-4 w-4 md:h-8 md:w-8 text-muted-foreground shrink-0" />
                                <TooltipProvider> <Tooltip> <TooltipTrigger>
                                    <div className="flex flex-col items-center gap-1 text-center min-w-[60px] md:min-w-[80px]">
                                        <Hourglass className="h-6 w-6 md:h-10 md:w-10 text-primary" />
                                        <h4 className="font-semibold text-xs">Centrifugas</h4>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">{(simulationState.totalQQProduced ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</p>
                                    </div>
                                </TooltipTrigger>  <TooltipContent> <p>Total de azucar purgada y lavada.</p> </TooltipContent> </Tooltip> </TooltipProvider>
                                <ArrowRight className="h-4 w-4 md:h-8 md:w-8 text-muted-foreground shrink-0" />
                                <TooltipProvider>  <Tooltip>  <TooltipTrigger>
                                    <div className="flex flex-col items-center gap-1 text-center min-w-[60px] md:min-w-[80px]">
                                        <Warehouse className="h-6 w-6 md:h-10 md:w-10 text-primary" />
                                        <h4 className="font-semibold text-xs md:text-sm">Silos</h4>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">{(simulationState.silos.find(s => s.id === 'familiar')?.currentQQ ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} QQ</p>
                                    </div>
                                </TooltipTrigger>  <TooltipContent> <p>Almacenamiento de azucar seca.</p> </TooltipContent> </Tooltip> </TooltipProvider>
                                <ArrowRight className="h-4 w-4 md:h-8 md:w-8 text-muted-foreground shrink-0" />
                                <TooltipProvider>  <Tooltip>  <TooltipTrigger>
                                    <div className={cn("flex flex-col items-center gap-1 text-center p-1 rounded-md min-w-[60px] md:min-w-[90px]", liveSimulationResults.bottleneck === 'wrapper' && 'bg-destructive/10')}>
                                        <Package className="h-6 w-6 md:h-10 md:w-10 text-primary" />
                                        <h4 className="font-semibold text-xs md:text-sm">Envasado</h4>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">{Math.floor(liveSimulationResults.totalUnitsProduced ?? 0).toLocaleString()} Fundas</p>
                                    </div>
                                </TooltipTrigger>  <TooltipContent> <p>Produccion de las envasadoras.</p> </TooltipContent> </Tooltip> </TooltipProvider>
                                <ArrowRight className="h-4 w-4 md:h-8 md:w-8 text-muted-foreground shrink-0" />
                                <TooltipProvider>  <Tooltip>  <TooltipTrigger>
                                    <div className="flex flex-col items-center gap-1 text-center min-w-[60px] md:min-w-[90px]">
                                        <PackageCheck className="h-6 w-6 md:h-10 md:w-10 text-primary" />
                                        <h4 className="font-semibold text-xs md:text-sm">Enfardado</h4>
                                        <p className="text-[10px] md:text-xs text-muted-foreground">{(staticSimulationResults.bundlesPerMinute ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} F/Min</p>
                                    </div>
                                </TooltipTrigger>  <TooltipContent> <p>Capacidad teÃ³rica de empaque final en fardos por minuto.</p> </TooltipContent> </Tooltip> </TooltipProvider>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <Card className="border-none bg-card/60 backdrop-blur-md shadow-2xl ring-1 ring-primary/20 overflow-hidden">
                                <CardHeader className="flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="flex flex-col gap-1">
                                        <CardTitle>Controles de Simulacion</CardTitle>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <CalendarDays className="h-3 w-3" />
                                                <span>Turno {shiftType === 'day' ? 'Dia (07:00 - 17:59)' : 'Noche (18:00 - 06:59)'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-end mr-4">
                                            <div className="text-2xl md:text-4xl font-mono font-bold tracking-tighter text-primary">
                                                {formatVirtualTime(simulationState.virtualTimeSeconds)}
                                            </div>
                                            <div className="text-[10px] md:text-xs uppercase font-bold text-muted-foreground">Hora Virtual</div>
                                        </div>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="outline" size="icon" onClick={() => (document.getElementById('shift-config-trigger') as any)?.click()}>
                                                        <Settings2 className="h-5 w-5 text-primary" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Configurar Turno y Descansos</p></TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" onClick={handleShowImagesChange}>
                                                        {showImages ? <ImageOff className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{showImages ? 'Ocultar ImÃƒÆ’Ã‚Â¡genes' : 'Mostrar ImÃƒÆ’Ã‚Â¡genes'}</p>
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
                                                                    Â¿Estas seguro? Esto restaurara todos los parametros de la simulacion (en este navegador) y las imagenes (para todos los usuarios) a sus valores originales.
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
                                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                        <Button onClick={startClock} disabled={isSimulating} variant="secondary" className="flex-1 sm:flex-none">
                                            <Play className="mr-2 h-4 w-4" /> Iniciar
                                        </Button>
                                        <Button onClick={pauseClock} disabled={!isSimulating} variant="destructive" className="flex-1 sm:flex-none">
                                            <Pause className="mr-2 h-4 w-4" /> Detener
                                        </Button>
                                        <Button onClick={resetSimulation} variant="outline" className="flex-1 sm:flex-none">
                                            <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 items-end">
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

                                        <div className="pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
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
                                                        <TooltipProvider> <Tooltip> <TooltipTrigger asChild><Activity className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger> <TooltipContent><p className="w-60 text-xs text-center border-none shadow-none bg-transparent">Las maquinas se encenderan solas cuando el silo familiar tenga suficiente reserva (30%) para asegurar produccion continua.</p></TooltipContent> </Tooltip> </TooltipProvider>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground line-clamp-1">Nivel optimo de inicio</div>
                                                </div>
                                                <Switch checked={isAutoStartEnabled} onCheckedChange={setIsAutoStartEnabled} />
                                            </div>
                                            <div className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-xs font-semibold">Reserva (M4)</Label>
                                                        <TooltipProvider> <Tooltip> <TooltipTrigger asChild><Database className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger> <TooltipContent><p className="w-60 text-xs text-center border-none shadow-none bg-transparent text-xs">Activa el consumo desde el Silo de Reserva de 150 QQ para la Maquina 4.</p></TooltipContent> </Tooltip> </TooltipProvider>
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
                                                <Image src={simTachos.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/Tachos.jpg?alt=media"} alt={simTachos.name} width={600} height={400} className="object-contain w-full h-full" unoptimized />
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
                                            <div className='text-center border bg-white/50 backdrop-blur-sm rounded-lg p-2 shadow-inner'>
                                                <p className="text-xs text-muted-foreground">Total Masas Enviadas</p>
                                                <p className="text-lg font-bold text-primary">{simulationState.totalMasasSent}</p>
                                            </div>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="lg"
                                                            variant={simTachos.state === 'cooking' ? "destructive" : "default"}
                                                            className={cn("w-full group h-10 md:h-12 px-4 md:px-6 rounded-full font-bold transition-all hover:scale-105 active:scale-95 shadow-lg", simTachos.state === 'cooking' && "animate-pulse")}
                                                            onClick={handleManualSendMasa}
                                                            disabled={!isSimulating || simTachos.state === 'sending'}
                                                        >
                                                            <Zap className={cn("mr-2 h-4 w-4 md:h-5 md:w-5", simTachos.state === 'cooking' && "animate-bounce")} />
                                                            <span className="text-xs md:text-sm font-bold uppercase tracking-tight">
                                                                {simTachos.state === 'cooking' ? 'FORZAR ENVIO!' : 'ENVIAR MASA'}
                                                            </span>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="max-w-[200px] text-center text-xs">
                                                        {simTachos.state === 'cooking'
                                                            ? "Termina la cocciÃ³n inmediatamente para enviar la masa."
                                                            : "Inicia el envÃ­o de una nueva masa si hay recibidores libres."}
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
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
                                                            {isCentrifugesAuto ? 'âš¡ Auto' : 'ÃƒÂ°Ã…Â¸Ã¢â‚¬â€œÃ‚Â Manual'}
                                                        </Badge>
                                                    </h3>
                                                    {isCentrifugesAuto && (
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Inicia al â‰¥ 50% del tanque pulmon
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
                                                            <Badge variant="destructive" className="text-[10px] animate-pulse">CAPACIDAD CRÃƒÆ’Ã‚ÂTICA</Badge>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingSilo(silo)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                {showImages && (
                                                    <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden my-2">
                                                        <Image src={simSilo.imageUrl || "https://firebasestorage.googleapis.com/v0/b/control-7-61a3f.appspot.com/o/S.Fam.jpeg?alt=media"} alt={simSilo.name} width={600} height={400} className="object-contain w-full h-full" unoptimized />
                                                    </div>
                                                )}
                                                <div className="space-y-1.5">
                                                    <Label className='text-xs text-muted-foreground'>Capacidad: {(simSilo.capacityQQ ?? 0).toLocaleString()} QQ</Label>
                                                </div>
                                                <div className="space-y-2 pt-2">
                                                    <Label className="text-sm">Nivel: {(simSilo.currentQQ ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} QQ ({(fillPercentage ?? 0).toFixed(1)}%)</Label>
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                                                                        <p className="font-bold text-sm">{(unitsPerMinuteNeto ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                                                    </div>
                                                                    <div className="bg-background p-1 rounded-md border">
                                                                        <p className="text-muted-foreground">{getUnitLabel(product)}s/Min</p>
                                                                        <p className="font-bold text-sm text-green-600">{(fardosPerMinuteNeto ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
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
                                                                    <Progress value={(wrapperState.currentBundleProgress / (dynamicUPB || 1)) * 100} indicatorClassName="bg-primary shadow-[0_0_12px_rgba(59,130,246,0.6)]" className="h-2.5" />
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
                                            <p className="font-medium">Esperando produccion para iniciar estiba...</p>
                                            <p className="text-xs">Los pallets apareceran aqui una vez que las envasadoras o enfardadoras completen unidades.</p>
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

                            <div className="space-y-4 md:space-y-6">
                                <h3 className="font-semibold text-lg md:text-xl text-center">Resultados Globales de la Linea</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                                <Card className="border-none bg-card/60 backdrop-blur-md shadow-2xl ring-1 ring-primary/10">
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



                        <Dialog open={isShiftConfigOpen} onOpenChange={setIsShiftConfigOpen}>
                            <DialogTrigger asChild>
                                <button id="shift-config-trigger" className="hidden" />
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                        <Settings2 className="h-5 w-5" />
                                        ConfiguraciÃ³n de Turno Real
                                    </DialogTitle>
                                    <DialogDescription>
                                        Configure el horario de producción y los periodos de descanso.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-6 py-4">
                                    <div className="space-y-3">
                                        <Label>Seleccionar Turno</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                variant={shiftType === 'day' ? 'default' : 'outline'}
                                                className="flex flex-col gap-2 h-auto py-4"
                                                onClick={() => {
                                                    setShiftType('day');
                                                    setTargetShiftHours(11);
                                                }}
                                            >
                                                <Sun className="h-6 w-6" />
                                                <div className="text-center">
                                                    <div className="font-bold">Dia</div>
                                                    <div className="text-[10px] opacity-80">07:00 - 17:59</div>
                                                </div>
                                            </Button>
                                            <Button
                                                variant={shiftType === 'night' ? 'default' : 'outline'}
                                                className="flex flex-col gap-2 h-auto py-4"
                                                onClick={() => {
                                                    setShiftType('night');
                                                    setTargetShiftHours(13);
                                                }}
                                            >
                                                <Moon className="h-6 w-6" />
                                                <div className="text-center">
                                                    <div className="font-bold">Noche</div>
                                                    <div className="text-[10px] opacity-80">18:00 - 06:59</div>
                                                </div>
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                            <Utensils className="h-4 w-4" />
                                            Descansos Programados (Pausa Empaque)
                                        </h4>

                                        {shiftType === 'day' ? (
                                            <div className="space-y-4 border rounded-lg p-3 bg-muted/30">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Utensils className="h-4 w-4 text-primary" />
                                                        <span className="font-medium text-sm">Almuerzo</span>
                                                    </div>
                                                    <Switch
                                                        checked={dayLunchBreak.enabled}
                                                        onCheckedChange={(val) => setDayLunchBreak(prev => ({ ...prev, enabled: val }))}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Inicio</Label>
                                                        <Input
                                                            type="time"
                                                            value={dayLunchBreak.start}
                                                            onChange={(e) => setDayLunchBreak(prev => ({ ...prev, start: e.target.value }))}
                                                            disabled={!dayLunchBreak.enabled}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[10px] uppercase text-muted-foreground">Fin</Label>
                                                        <Input
                                                            type="time"
                                                            value={dayLunchBreak.end}
                                                            onChange={(e) => setDayLunchBreak(prev => ({ ...prev, end: e.target.value }))}
                                                            disabled={!dayLunchBreak.enabled}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-4 border rounded-lg p-3 bg-muted/30">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Utensils className="h-4 w-4 text-primary" />
                                                            <span className="font-medium text-sm">Merienda</span>
                                                        </div>
                                                        <Switch
                                                            checked={nightDinnerBreak.enabled}
                                                            onCheckedChange={(val) => setNightDinnerBreak(prev => ({ ...prev, enabled: val }))}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Inicio</Label>
                                                            <Input
                                                                type="time"
                                                                value={nightDinnerBreak.start}
                                                                onChange={(e) => setNightDinnerBreak(prev => ({ ...prev, start: e.target.value }))}
                                                                disabled={!nightDinnerBreak.enabled}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Fin</Label>
                                                            <Input
                                                                type="time"
                                                                value={nightDinnerBreak.end}
                                                                onChange={(e) => setNightDinnerBreak(prev => ({ ...prev, end: e.target.value }))}
                                                                disabled={!nightDinnerBreak.enabled}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 border rounded-lg p-3 bg-muted/30">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Coffee className="h-4 w-4 text-primary" />
                                                            <span className="font-medium text-sm">Desayuno</span>
                                                        </div>
                                                        <Switch
                                                            checked={nightBreakfastBreak.enabled}
                                                            onCheckedChange={(val) => setNightBreakfastBreak(prev => ({ ...prev, enabled: val }))}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Inicio</Label>
                                                            <Input
                                                                type="time"
                                                                value={nightBreakfastBreak.start}
                                                                onChange={(e) => setNightBreakfastBreak(prev => ({ ...prev, start: e.target.value }))}
                                                                disabled={!nightBreakfastBreak.enabled}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[10px] uppercase text-muted-foreground">Fin</Label>
                                                            <Input
                                                                type="time"
                                                                value={nightBreakfastBreak.end}
                                                                onChange={(e) => setNightBreakfastBreak(prev => ({ ...prev, end: e.target.value }))}
                                                                disabled={!nightBreakfastBreak.enabled}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <Separator />

                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                            <Activity className="h-4 w-4" />
                                            Estado de MÃ¡quinas en Pausa
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {machines.map(m => (
                                                <div key={m.id} className={cn(
                                                    "text-[10px] p-2 rounded border flex items-center justify-between",
                                                    m.keepActiveDuringBreaks ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-muted-foreground/10 opacity-60"
                                                )}>
                                                    <span className="font-medium">MÃ¡quina {m.id}</span>
                                                    <Badge variant={m.keepActiveDuringBreaks ? "default" : "outline"} className="text-[8px] h-4 px-1">
                                                        {m.keepActiveDuringBreaks ? "ACTIVA" : "PAUSA"}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic">
                                            * Configure la actividad individual editando cada mÃ¡quina en el tablero principal.
                                        </p>
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button className="w-full" onClick={() => setIsShiftConfigOpen(false)}>
                                        Aplicar ConfiguraciÃ³n
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {simulationState.isFinished && (
                            <Dialog open={simulationState.isFinished} onOpenChange={() => { }}>
                                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader className="border-b pb-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                    <Factory className="h-6 w-6 text-primary" />
                                                </div>
                                                <div>
                                                    <DialogTitle className="text-2xl font-bold">Reporte de Fin de Turno</DialogTitle>
                                                    <DialogDescription className="font-medium text-primary">
                                                        Turno {shiftType === 'day' ? 'Dia' : 'Noche'} completado exitosamente
                                                    </DialogDescription>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-muted-foreground uppercase">DuraciÃ³n Total</div>
                                                <div className="text-xl font-mono font-bold">{targetShiftHours} Horas</div>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    <div className="py-6 space-y-8">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="p-4 rounded-xl border-2 bg-card text-center space-y-1">
                                                <Package className="h-5 w-5 mx-auto text-primary mb-1" />
                                                <div className="text-2xl font-bold">{Math.floor(liveSimulationResults.totalUnitsProduced).toLocaleString()}</div>
                                                <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">Total Unidades</div>
                                            </div>
                                            <div className="p-4 rounded-xl border-2 bg-card text-center space-y-1">
                                                <Warehouse className="h-5 w-5 mx-auto text-primary mb-1" />
                                                <div className="text-2xl font-bold">{liveSimulationResults.totalQQPacked.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                                                <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">Quintales (QQ)</div>
                                            </div>
                                            <div className="p-4 rounded-xl border-2 bg-card text-center space-y-1">
                                                <Zap className="h-5 w-5 mx-auto text-primary mb-1" />
                                                <div className="text-2xl font-bold">{liveSimulationResults.globalEfficiency.toFixed(1)}%</div>
                                                <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">Eficiencia OEE</div>
                                            </div>
                                            <div className="p-4 rounded-xl border-2 bg-card text-center space-y-1">
                                                <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
                                                <div className="text-2xl font-bold">{formatSeconds(simulationState.accumulatedOperationSeconds)}</div>
                                                <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">Tiempo OperaciÃ³n</div>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="space-y-4">
                                            <h4 className="font-bold text-sm flex items-center gap-2">
                                                <Activity className="h-4 w-4" />
                                                Resumen de Producción por Máquina
                                            </h4>
                                            <div className="grid gap-3">
                                                {machines.filter(m => m.productId !== 'inactive').map(machine => {
                                                    const totalUnits = simulationState.machineTotals[machine.id] || 0;
                                                    const product = products.find(p => p.id === machine.productId);
                                                    const totalKg = totalUnits * (product?.presentationWeight || 0);
                                                    const totalQQ = totalKg / KG_PER_QUINTAL;

                                                    return (
                                                        <div key={machine.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                                                                    {machine.id}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-sm">Máquina {machine.id}</div>
                                                                    <div className="text-[10px] text-muted-foreground">{product?.productName}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="font-mono font-bold text-sm">{Math.floor(totalUnits).toLocaleString()} {getUnitLabel(product)}</div>
                                                                <div className="text-[10px] font-medium text-primary">{totalQQ.toFixed(1)} QQ</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-start gap-3">
                                            <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                            <div>
                                                <h5 className="font-bold text-sm">Observaciones del Turno</h5>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    La eficiencia global del {liveSimulationResults.globalEfficiency.toFixed(1)}% refleja el impacto de las pausas programadas y la capacidad de silo.
                                                    {liveSimulationResults.bottleneck === 'wrapper' ? ' El cuello de botella principal se detecta en el área de enfardado.' : ' El flujo de producción se mantuvo estable durante el turno.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <DialogFooter className="flex flex-col sm:flex-row gap-3 border-t pt-4">
                                        <Button variant="outline" className="flex-1" onClick={() => {
                                            const csvContent = "data:text/csv;charset=utf-8," +
                                                "Maquina,Producto,Unidades,QQ\n" +
                                                machines.filter(m => m.productId !== 'inactive').map(m => {
                                                    const units = simulationState.machineTotals[m.id] || 0;
                                                    const p = products.find(prod => prod.id === m.productId);
                                                    return `${m.id},${p?.productName},${units},${(units * (p?.presentationWeight || 0) / KG_PER_QUINTAL).toFixed(2)}`;
                                                }).join("\n");
                                            const encodedUri = encodeURI(csvContent);
                                            const link = document.createElement("a");
                                            link.setAttribute("href", encodedUri);
                                            link.setAttribute("download", `reporte_turno_${shiftType}_${new Date().toLocaleDateString()}.csv`);
                                            document.body.appendChild(link);
                                            link.click();
                                        }}>
                                            Descargar Datos (CSV)
                                        </Button>
                                        <Button className="flex-1 font-bold" onClick={resetSimulation}>
                                            Cerrar y Nuevo Turno
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

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
                                isReserveEnabled={isReserveSiloEnabled}
                                onReserveToggle={setIsReserveSiloEnabled}
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
                        <OnDemandReportModal
                            isOpen={isProjectionReportOpen}
                            onClose={() => setIsProjectionReportOpen(false)}
                            liveSimulationResults={liveSimulationResults}
                            machines={machines}
                            products={products}
                            simulationState={simulationState}
                            shiftType={shiftType}
                        />

                    </>
                )}
            </main>


        </div>
    );
}

function GoalsModal({
    open,
    onOpenChange,
    products,
    plannedGoals,
    setPlannedGoals,
    plannedSpeeds,
    setPlannedSpeeds,
    dailySupply,
    setDailySupply,
    isReadOnly
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    products: ProductDefinition[],
    plannedGoals: Record<string, number>,
    setPlannedGoals: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    plannedSpeeds: Record<string, number>,
    setPlannedSpeeds: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    dailySupply: number,
    setDailySupply: (val: number) => void,
    isReadOnly?: boolean
}) {
    const [localGoals, setLocalGoals] = React.useState<Record<string, number>>(plannedGoals);
    const [localSpeeds, setLocalSpeeds] = React.useState<Record<string, number>>(plannedSpeeds);
    const [localSupply, setLocalSupply] = React.useState<number>(dailySupply);

    React.useEffect(() => {
        if (open) {
            setLocalGoals(plannedGoals);
            setLocalSpeeds(plannedSpeeds);
            setLocalSupply(dailySupply);
        }
    }, [open, plannedGoals, plannedSpeeds]);

    const handleSave = () => {
        setPlannedGoals(localGoals);
        setPlannedSpeeds(localSpeeds);
        setDailySupply(localSupply);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" /> Metas de Producción (QQ)
                    </DialogTitle>
                    <DialogDescription>
                        Ingresa la cantidad de Quintales (QQ) que deseas alcanzar para cada presentación en este periodo.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto py-4 space-y-3 pr-2">
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 mb-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                <div>
                                    <h4 className="text-sm font-black text-primary uppercase">Suministro Diario</h4>
                                    <p className="text-[10px] text-muted-foreground leading-tight">Total de azúcar recibida por día para calcular el balance de granel.</p>
                                </div>
                            </div>
                            <div className="relative shrink-0">
                                <Input
                                    disabled={isReadOnly}
                                    type="number"
                                    value={localSupply}
                                    onChange={(e) => setLocalSupply(Number(e.target.value))}
                                    className="w-32 h-10 text-lg font-black bg-white border-primary/30 text-center pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/50">QQ</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2 px-1">
                        <div className="h-px flex-1 bg-border"></div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Metas por Producto</span>
                        <div className="h-px flex-1 bg-border"></div>
                    </div>

                    {products.map(product => (
                        <div key={product.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: product.color }}></div>
                                    <span className="text-[10px] font-bold leading-none uppercase text-muted-foreground/60">Presentación</span>
                                </div>
                                <span className="text-xs font-black leading-tight break-words pr-2">{product.productName}</span>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground text-center">Velocidad</Label>
                                    <div className="relative">
                                        <Input
                                            disabled={isReadOnly}
                                            type="number"
                                            className="w-20 h-8 text-center font-black text-emerald-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            value={localSpeeds[product.id] || ''}
                                            onChange={(e) => setLocalSpeeds(prev => ({ ...prev, [product.id]: Number(e.target.value) }))}
                                            placeholder="0"
                                        />
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-emerald-600/50">bpm</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label className="text-[9px] uppercase font-bold text-muted-foreground text-center">Meta QQ</Label>
                                    <div className="relative">
                                        <Input
                                            disabled={isReadOnly}
                                            type="number"
                                            className="w-24 h-8 text-center font-black text-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            value={localGoals[product.id] || ''}
                                            onChange={(e) => setLocalGoals(prev => ({ ...prev, [product.id]: Number(e.target.value) }))}
                                            placeholder="0"
                                        />
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-primary/50">QQ</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">{isReadOnly ? 'Cerrar' : 'Cancelar'}</Button>
                    {!isReadOnly && <Button onClick={handleSave} className="flex-1">Guardar Metas</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}



function CombinedReport({
    productionData,
    plannedGoals,
    products,
    totalSupply,
    totalFamiliarQQ,
    totalGranelQQ,
    fulfillmentPct,
    totalPlannedQQ,
    id,
    isPDF
}: {
    productionData: Record<string, { qq: number }>,
    plannedGoals: Record<string, number>,
    products: ProductDefinition[],
    totalSupply: number,
    totalFamiliarQQ: number,
    totalGranelQQ: number,
    fulfillmentPct: number,
    totalPlannedQQ: number,
    id?: string,
    isPDF?: boolean
}) {
    const comparisonData = products
        .filter(p => productionData[p.id]?.qq > 0 || (plannedGoals[p.id] || 0) > 0)
        .map(p => {
            const projected = Math.round(productionData[p.id]?.qq || 0);
            const planned = Math.round(plannedGoals[p.id] || 0);
            const diff = projected - planned;
            const percentage = planned > 0 ? (projected / planned) * 100 : 0;

            return {
                name: p.productName,
                projected,
                planned,
                diff,
                percentage: (percentage > 100 ? "+" : "") + percentage.toFixed(1) + '%',
                color: p.color
            };
        })
        .sort((a, b) => b.projected - a.projected);

    const totalPlanned = comparisonData.reduce((sum, d) => sum + d.planned, 0);
    const totalFulfillment = totalPlanned > 0 ? (totalFamiliarQQ / totalPlanned) * 100 : 0;

    const balance = Math.max(0, totalSupply - totalFamiliarQQ - totalGranelQQ);
    const bulkData = [
        { name: 'Granel', value: totalGranelQQ, color: '#10b981' }
    ];

    if (comparisonData.length === 0) return null;

    return (
        <Card id={id} className="mt-2 border shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <BarChartIcon className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Reporte Consolidado de Balances</CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <div className="flex flex-col gap-1.5 bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded bg-indigo-500/20 border border-indigo-500"></div>
                                <span>Familiar: <span className="text-indigo-600 font-black ml-1">{totalFamiliarQQ.toLocaleString()}</span></span>
                            </div>
                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-indigo-100 text-indigo-700 border-indigo-200 font-black">
                                {(totalFamiliarQQ + totalGranelQQ) > 0 ? ((totalFamiliarQQ / (totalFamiliarQQ + totalGranelQQ)) * 100).toFixed(1) : 0}% de Producción
                            </Badge>
                        </div>
                        <div className="flex flex-col gap-1.5 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500"></div>
                                <span>Granel: <span className="text-emerald-600 font-black ml-1">{totalGranelQQ.toLocaleString()}</span></span>
                            </div>
                            <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-emerald-100 text-emerald-700 border-emerald-200 font-black">
                                {(totalFamiliarQQ + totalGranelQQ) > 0 ? ((totalGranelQQ / (totalFamiliarQQ + totalGranelQQ)) * 100).toFixed(1) : 0}% de Producción
                            </Badge>
                        </div>
                        <div className="h-4 w-px bg-border mx-1"></div>
                        <div className="flex flex-col gap-1.5 bg-primary/5 px-2 py-1 rounded border border-primary/10">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded bg-primary shadow-sm"></div>
                                <span>Meta: <span className="text-primary font-black ml-1">{totalPlannedQQ.toLocaleString()}</span></span>
                            </div>
                            <Badge variant={fulfillmentPct >= 100 ? "outline" : "outline"} className={cn("text-[8px] h-3.5 px-1 font-black", fulfillmentPct >= 100 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-primary/10 text-primary border-primary/20")}>
                                {fulfillmentPct.toFixed(1)}% Cumplimiento
                            </Badge>
                        </div>
                        <div className={cn("flex flex-col gap-1.5 px-2 py-1 rounded border ml-1", totalFamiliarQQ >= totalPlannedQQ ? "bg-emerald-500/5 border-emerald-500/10" : "bg-destructive/5 border-destructive/10")}>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight">
                                <div className={cn("w-2.5 h-2.5 rounded shadow-sm", totalFamiliarQQ >= totalPlannedQQ ? "bg-emerald-500" : "bg-destructive")}></div>
                                <span>{totalFamiliarQQ >= totalPlannedQQ ? "Excedente" : "Diferencia"}: <span className={cn("font-black ml-1", totalFamiliarQQ >= totalPlannedQQ ? "text-emerald-700" : "text-destructive")}>{totalFamiliarQQ >= totalPlannedQQ ? "+" : ""}{(totalFamiliarQQ - totalPlannedQQ).toLocaleString()}</span></span>
                            </div>
                            <Badge variant="outline" className={cn("text-[8px] h-3.5 px-1 font-black", totalFamiliarQQ >= totalPlannedQQ ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-destructive/10 text-destructive border-destructive/20")}>
                                {Math.abs((totalFamiliarQQ - totalPlannedQQ) / (totalPlannedQQ || 1) * 100).toFixed(1)}% {totalFamiliarQQ >= totalPlannedQQ ? "por encima" : "faltante"}
                            </Badge>
                        </div>

                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] divide-x divide-border">
                    {/* Left Chart: Plan vs Projection */}
                    <div className="p-6">
                        <h3 className="text-xs font-black uppercase text-muted-foreground mb-6 flex items-center gap-2 tracking-widest">
                            <Target className="h-4 w-4 text-primary" /> 1. Balance por Producto (Planificado vs. Proyección)
                        </h3>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }} barGap={8}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        interval={0}
                                        height={80}
                                        tick={{ fontSize: 10, fontWeight: 700 }}
                                    />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 700 }} label={{ value: 'Quintales (QQ)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fontWeight: 800, fill: '#64748b' } }} />
                                    <RechartsTooltip
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div className="bg-white border shadow-xl rounded-lg p-3 space-y-2 min-w-[200px]">
                                                        <div className="flex items-center gap-2 border-b pb-1">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                                                            <div className="text-xs font-black uppercase">{d.name}</div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-muted-foreground">Proyectado:</span>
                                                                <span className="font-black text-primary">{d.projected.toLocaleString()} QQ</span>
                                                            </div>
                                                            <div className="flex justify-between text-[11px]">
                                                                <span className="text-muted-foreground">Planificado:</span>
                                                                <span className="font-black text-muted-foreground">{d.planned.toLocaleString()} QQ</span>
                                                            </div>
                                                            <div className="pt-1 mt-1 border-t flex justify-between items-center">
                                                                <span className="text-[10px] font-bold uppercase">Cumplimiento:</span>
                                                                <Badge variant={parseFloat(d.percentage.replace('+', '')) >= 100 ? "default" : "destructive"} className="text-[10px] h-5 py-0">{d.percentage}</Badge>
                                                            </div>
                                                            <div className="flex justify-between text-[10px]">
                                                                <span className="text-muted-foreground">Diferencia:</span>
                                                                <span className={cn("font-bold", d.diff >= 0 ? "text-emerald-600" : "text-destructive")}>
                                                                    {d.diff >= 0 ? "+" : ""}{d.diff.toLocaleString()} QQ
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="projected" name="Proyectado" radius={[4, 4, 0, 0]} isAnimationActive={!isPDF}>
                                        {comparisonData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                        <LabelList
                                            dataKey="projected"
                                            content={(props: any) => {
                                                const { x, y, width, value, index } = props;
                                                const d = comparisonData[index];
                                                if (!d) return null;
                                                return (
                                                    <g>
                                                        <text
                                                            x={x + width / 2}
                                                            y={y - 25}
                                                            fill={d.color}
                                                            textAnchor="middle"
                                                            style={{ fontSize: '10px', fontWeight: '900' }}
                                                        >
                                                            {d.percentage}
                                                        </text>
                                                        {/* Badge de resaltado para el valor QQ */}
                                                        <rect
                                                            x={x + width / 2 - 22}
                                                            y={y - 17}
                                                            width={44}
                                                            height={12}
                                                            rx={4}
                                                            fill={d.color}
                                                        />
                                                        <text
                                                            x={x + width / 2}
                                                            y={y - 8}
                                                            fill="#fff"
                                                            textAnchor="middle"
                                                            style={{ fontSize: '9px', fontWeight: '900' }}
                                                        >
                                                            {value.toLocaleString()}
                                                        </text>
                                                    </g>
                                                );
                                            }}
                                        />
                                    </Bar>
                                    <Bar dataKey="planned" name="Planificado" fill="hsl(var(--primary))" fillOpacity={0.8} radius={[4, 4, 0, 0]} isAnimationActive={!isPDF}>
                                        <LabelList
                                            dataKey="planned"
                                            content={(props: any) => {
                                                const { x, y, width, value } = props;
                                                if (value === undefined || value === null) return null;
                                                return (
                                                    <g>
                                                        <rect
                                                            x={x + width / 2 - 22}
                                                            y={y - 17}
                                                            width={44}
                                                            height={12}
                                                            rx={4}
                                                            fill="#64748b"
                                                        />
                                                        <text
                                                            x={x + width / 2}
                                                            y={y - 8}
                                                            fill="#fff"
                                                            textAnchor="middle"
                                                            style={{ fontSize: '9px', fontWeight: '900' }}
                                                        >
                                                            {value.toLocaleString()}
                                                        </text>
                                                    </g>
                                                );
                                            }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right Chart: Bulk Balance */}
                    <div className="p-6 bg-muted/5">
                        <h3 className="text-xs font-black uppercase text-muted-foreground mb-6 flex items-center gap-2 tracking-widest">
                            <Database className="h-4 w-4 text-emerald-600" /> 2. Balance Consolidado (Granel)
                        </h3>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={bulkData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 10, fontWeight: 700 }}
                                        height={80}
                                    />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                                    <RechartsTooltip
                                        cursor={{ fill: 'transparent' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
                                                    <div className="bg-white border shadow-xl rounded-lg p-3 space-y-1 min-w-[150px]">
                                                        <div className="text-xs font-black uppercase text-muted-foreground">{d.name}</div>
                                                        <div className="text-lg font-black" style={{ color: d.color }}>
                                                            {d.value.toLocaleString()} QQ
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground">
                                                            {((d.value / (totalFamiliarQQ + totalGranelQQ || 1)) * 100).toFixed(1)}% de la Producción Total
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60} isAnimationActive={!isPDF}>
                                        {bulkData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                        <LabelList dataKey="value" position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#64748b' }} formatter={(val: number) => val.toLocaleString()} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function LaborWeeklyChart({
    laborWeeklyDetail,
    totalPersTurnosGlobal,
    isPDF,
    id
}: {
    laborWeeklyDetail: Record<number, any>,
    totalPersTurnosGlobal: number,
    isPDF?: boolean,
    id?: string
}) {
    const data = Object.entries(laborWeeklyDetail).map(([weekNum, stats]) => ({
        name: `Sem ${weekNum}`,
        dia: stats.totalPersDia,
        noche: stats.totalPersNoche,
        total: stats.totalPersTurnos,
        details: {
            dia: { s: stats.totalSupDia, o: stats.totalOpDia, e: stats.totalEnvDia, g: stats.totalGraDia },
            noche: { s: stats.totalSupNoc, o: stats.totalOpNoc, e: stats.totalEnvNoc, g: stats.totalGraNoc }
        }
    }));

    if (data.length === 0) return null;

    return (
        <Card id={id} className="mt-6 border shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-lg font-black uppercase tracking-tight">PROYECCIÓN SEMANAL DE MANO DE OBRA</CardTitle>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-2">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded bg-blue-500"></div>
                                <span>Personal Día</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded bg-indigo-800"></div>
                                <span>Personal Noche</span>
                            </div>
                        </div>
                        <Badge variant="secondary" className="bg-blue-600 text-white font-black px-3 py-1 rounded-full text-xs">
                            Total: {totalPersTurnosGlobal.toLocaleString()} Pers./Turnos
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 40 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fontWeight: 700 }}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fontWeight: 700 }}
                                label={{ value: 'Total Pers./Turnos', angle: -90, position: 'insideLeft', offset: -10, style: { fontSize: 10, fontWeight: 800, fill: '#64748b' } }}
                            />
                            <RechartsTooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-white border shadow-xl rounded-lg p-3 space-y-2 min-w-[220px]">
                                                <div className="text-[10px] font-black text-muted-foreground border-b pb-1 uppercase">{d.name}</div>
                                                <div className="space-y-2">
                                                    <div className="pb-2 border-b">
                                                        <div className="flex justify-between items-center text-[10px] font-black text-blue-600 mb-1.5 uppercase">
                                                            <span>Desglose Día</span>
                                                        </div>
                                                        <div className="space-y-0.5 text-[9px] text-muted-foreground font-bold">
                                                            <div className="flex justify-between"><span>Supervisor:</span> <span>{d.details.dia.s}</span></div>
                                                            <div className="flex justify-between"><span>Operador:</span> <span>{d.details.dia.o}</span></div>
                                                            <div className="flex justify-between"><span>Envasadores (+Cosedor):</span> <span>{d.details.dia.e}</span></div>
                                                            <div className="flex justify-between"><span>Granelero:</span> <span>{d.details.dia.g}</span></div>
                                                            <div className="flex justify-between border-t border-dashed pt-1 mt-1 text-blue-700 font-black"><span>TOTAL DÍA:</span> <span>{d.dia} Pers.</span></div>
                                                        </div>
                                                    </div>
                                                    <div className="pb-1">
                                                        <div className="flex justify-between items-center text-[10px] font-black text-indigo-800 mb-1.5 uppercase">
                                                            <span>Desglose Noche</span>
                                                        </div>
                                                        <div className="space-y-0.5 text-[9px] text-muted-foreground font-bold">
                                                            <div className="flex justify-between"><span>Supervisor:</span> <span>{d.details.noche.s}</span></div>
                                                            <div className="flex justify-between"><span>Operador:</span> <span>{d.details.noche.o}</span></div>
                                                            <div className="flex justify-between"><span>Envasadores (+Cosedor):</span> <span>{d.details.noche.e}</span></div>
                                                            <div className="flex justify-between"><span>Granelero:</span> <span>{d.details.noche.g}</span></div>
                                                            <div className="flex justify-between border-t border-dashed pt-1 mt-1 text-indigo-900 font-black"><span>TOTAL NOCHE:</span> <span>{d.noche} Pers.</span></div>
                                                        </div>
                                                    </div>
                                                    <div className="pt-2 border-t flex justify-between items-center text-xs font-black bg-slate-50 -mx-3 -mb-3 px-3 py-2">
                                                        <span className="text-muted-foreground uppercase text-[10px]">Total Semanal:</span>
                                                        <span className="text-primary">{d.total.toLocaleString()} Pers./Turnos</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar
                                dataKey="dia"
                                name="Día"
                                fill="#3b82f6"
                                radius={[4, 4, 0, 0]}
                                isAnimationActive={!isPDF}
                            >
                                <LabelList dataKey="dia" position="top" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#3b82f6' }} />
                            </Bar>
                            <Bar
                                dataKey="noche"
                                name="Noche"
                                fill="#3730a3"
                                radius={[4, 4, 0, 0]}
                                isAnimationActive={!isPDF}
                            >
                                <LabelList dataKey="noche" position="top" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#3730a3' }} />
                            </Bar>
                            <Line
                                type="monotone"
                                dataKey="total"
                                name="Total"
                                stroke="#f59e0b"
                                strokeWidth={3}
                                dot={{ fill: '#f59e0b', r: 4 }}
                                isAnimationActive={!isPDF}
                            >
                                <LabelList dataKey="total" position="top" style={{ fontSize: '10px', fontWeight: '900', fill: '#b45309' }} offset={10} />
                            </Line>
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

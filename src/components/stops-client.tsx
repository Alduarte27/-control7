'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, HardHat, Lock, Unlock, Settings, X, PlusCircle, Calendar as CalendarIcon, Activity, History, MoreVertical, Save, RefreshCw, CheckCircle2, Upload, FileUp, FileText, Percent, Users, Wrench, AlertTriangle, TableProperties, Eye, EyeOff, Cpu, Clock, Edit2, Trash2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition, DailyLog, MachineLog, TimeSlot, StopData, StopCause, StopType, Operator, Supervisor, MaintenanceType, CategoryDefinition, BitacoraSettings, MachineOEE, QualityParams, QualityRange, QualityWeights, WeightRange, WeightTypeKey, WeightUnit } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { format, parse, setMinutes, getMinutes, getHours, isToday, isValid, getDayOfYear, addDays, addMinutes, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import StopRegistrationModal from './stop-registration-modal';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn, isObservationEvent } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Separator } from './ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';
import LogImportWizard from './log-import-wizard';

import LogHistoryModal from './log-history-modal';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
export const MACHINES_CONFIG = [
    { id: 'machine_1', name: 'Tecnotok #1' },
    { id: 'machine_2', name: 'Tecnotok #2' },
    { id: 'machine_3', name: 'Tecnotok #3' },
    { id: 'machine_4', name: 'Tecnotok #4' },
    { id: 'machine_7', name: 'Enfardadora #1' },
    { id: 'machine_8', name: 'Enfardadora #2' },
    { id: 'machine_5', name: 'Granelera #1' },
    { id: 'machine_6', name: 'Granelera #2' },
];

const NUM_MACHINES = 8;
const TIME_SLOTS_PER_HOUR = 2; // 30-minute intervals
const AUTOSAVE_DELAY = 2000; // 2 seconds

const GRANEL_DEFAULT_OPTIONS = [
    { id: 'granel_50kg_blanca', productName: 'Granel 50Kg - Blanca', color: '#3b82f6' },
    { id: 'granel_50kg_morena', productName: 'Granel 50Kg - Morena', color: '#d97706' },
    { id: 'granel_50kg_observacion', productName: 'Granel 50Kg - Observacion', color: '#6b7280' },
];

import { SHIFT_CONFIG, ShiftTimeConfig } from '@/lib/config/shifts';

// This function generates the display slots for the table based on the selected shift
export const generateDisplayTimeSlots = (shift: 'day' | 'night', config?: ShiftTimeConfig) => {
    const slots = [];
    const activeConfig = config || SHIFT_CONFIG[shift];
    const { startHour, endHour } = activeConfig;
    
    // Calculate total hours
    let totalHours = endHour - startHour;
    if (totalHours <= 0) {
        totalHours += 24; // Crosses midnight
    }

    for (let i = 0; i < totalHours * TIME_SLOTS_PER_HOUR; i++) {
        const hour = (startHour + Math.floor(i / TIME_SLOTS_PER_HOUR)) % 24;
        const minute = (i % TIME_SLOTS_PER_HOUR) * (60 / TIME_SLOTS_PER_HOUR);
        slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
    return slots;
};

// Verifica que la hora HH:mm sea válida y esté dentro del rango del turno
export const isTimeInShift = (t: string, shift: 'day' | 'night', config?: ShiftTimeConfig): boolean => {
    if (!/^\d{2}:\d{2}$/.test(t)) return false;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return false;
    
    const activeConfig = config || SHIFT_CONFIG[shift];
    const { startHour, endHour } = activeConfig;
    
    if (startHour < endHour) {
        // e.g. 07:00 to 18:00
        return h >= startHour && h < endHour;
    } else {
        // e.g. 18:00 to 07:00 (crosses midnight)
        return h >= startHour || h < endHour;
    }
};

const WEIGHT_TYPE_KEYS: WeightTypeKey[] = ['funda', 'sacos', 'fardos'];

const toWeightRange = (p: any): WeightRange | null => {
    if (!p || typeof p !== 'object') return null;
    if (typeof p.min !== 'number' || typeof p.max !== 'number') return null;
    if (p.min >= p.max) return null;
    return {
        id: typeof p.id === 'string' ? p.id : Math.random().toString(36).substr(2, 9),
        min: p.min,
        max: p.max,
        avg: typeof p.avg === 'number' ? p.avg : (p.min + p.max) / 2,
        unit: p.unit === 'g' ? 'g' : 'kg',
        color: typeof p.color === 'string' ? p.color : 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 font-semibold',
    };
};

// Convierte qualityWeights al formato { producto: { tipo: WeightRange[] } }.
// Migra el formato viejo (plano { min, max, avg, color } o { tipo: { min, max, avg, unit } })
// y descarta claves inválidas.
const normalizeQualityWeights = (data: unknown): QualityWeights => {
    const result: QualityWeights = {};
    if (!data || typeof data !== 'object') return result;
    for (const [productId, value] of Object.entries(data as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') continue;
        const v = value as Record<string, unknown>;
        // Formato viejo plano: { min, max, avg, color }
        if (typeof v.min === 'number' && typeof v.max === 'number') {
            const base = toWeightRange(v);
            if (base) {
                result[productId] = {
                    funda: [{ ...base, id: Math.random().toString(36).substr(2, 9) }],
                    sacos: [{ ...base, id: Math.random().toString(36).substr(2, 9) }],
                    fardos: [{ ...base, id: Math.random().toString(36).substr(2, 9) }],
                };
            }
            continue;
        }
        const nested: Partial<Record<WeightTypeKey, WeightRange[]>> = {};
        for (const key of WEIGHT_TYPE_KEYS) {
            const p = v[key];
            if (Array.isArray(p)) {
                const seen = new Set<string>();
                const ranges = p.map(toWeightRange).filter((r): r is WeightRange => {
                    if (!r) return false;
                    if (seen.has(r.id)) return false;
                    seen.add(r.id);
                    return true;
                });
                if (ranges.length > 0) nested[key] = ranges;
            } else {
                const range = toWeightRange(p);
                if (range) nested[key] = [range];
            }
        }
        if (Object.keys(nested).length > 0) result[productId] = nested;
    }
    return result;
};

// --- Configuration Modal ---
function ConfigurationModal({
    isOpen,
    onClose,
    stopTypes,
    stopCauses,
    operators,
    bulkOperators,
    supervisors,
    maintenanceTypes,
    hiddenMachines = [],
    onToggleMachineVisibility,
    onConfigSave,
    products = [],
}: {
    isOpen: boolean;
    onClose: () => void;
    stopTypes: StopType[];
    stopCauses: StopCause[];
    operators: Operator[];
    bulkOperators: Operator[];
    supervisors: Supervisor[];
    maintenanceTypes: MaintenanceType[];
    hiddenMachines?: string[];
    onToggleMachineVisibility: (machineId: string, isVisible: boolean) => void;
    onConfigSave: (type: 'stopType' | 'stopCause' | 'operator' | 'bulkOperator' | 'supervisor' | 'maintenanceType', data: any, action: 'add' | 'edit' | 'delete') => Promise<void>;
    products?: ProductDefinition[];
}) {
    const [newCauseName, setNewCauseName] = React.useState('');
    const [newCauseColor, setNewCauseColor] = React.useState('#ef4444');
    const [newCauseType, setNewCauseType] = React.useState<'planned' | 'unplanned' | 'observation'>('planned');
    const [newCauseMaintType, setNewCauseMaintType] = React.useState<string>('__none__');
    const [newCauseDesc, setNewCauseDesc] = React.useState('');
    const [isCauseFormOpen, setIsCauseFormOpen] = React.useState(false);
    const [editingCauseId, setEditingCauseId] = React.useState<string | null>(null);
    const [newOperatorName, setNewOperatorName] = React.useState('');
    const [newBulkOperatorName, setNewBulkOperatorName] = React.useState('');
    const [newSupervisorName, setNewSupervisorName] = React.useState('');
    const [newMaintTypeName, setNewMaintTypeName] = React.useState('');
    const [newMaintTypeDesc, setNewMaintTypeDesc] = React.useState('');
    const [isMaintFormOpen, setIsMaintFormOpen] = React.useState(false);
    const [editingMaintTypeId, setEditingMaintTypeId] = React.useState<string | null>(null);
    const [newStopTypeName, setNewStopTypeName] = React.useState('');
    const [newStopTypeIsPlanned, setNewStopTypeIsPlanned] = React.useState(false);
    
    // Dispatch Sync state
    const [dispatchSyncActive, setDispatchSyncActive] = React.useState<boolean>(false);
    const [dispatchSyncTime, setDispatchSyncTime] = React.useState<string>('06:00');
    const [dispatchApiUrl, setDispatchApiUrl] = React.useState<string>('');
    const [dispatchApiToken, setDispatchApiToken] = React.useState<string>('');

    // Quality Params state
    const [qualityParams, setQualityParams] = React.useState<QualityParams>({});
    const [selectedQualityProduct, setSelectedQualityProduct] = React.useState<string>('granel'); // 'grasshopper', 'familiar', 'granel'
    const [selectedQualityParam, setSelectedQualityParam] = React.useState<string>('humedad'); // 'color', 'humedad', 'turbiedad'
    const [newQualityMin, setNewQualityMin] = React.useState<string>('');
    const [newQualityMax, setNewQualityMax] = React.useState<string>('');
    const [newQualityColor, setNewQualityColor] = React.useState<string>('bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 font-semibold');

    // Presentation weights state (peso por presentación / tipo / unidad)
    const [qualityWeights, setQualityWeights] = React.useState<QualityWeights>({});
    const [enfardadoraConnections, setEnfardadoraConnections] = React.useState<{ [enfardadoraId: string]: string[] }>({
        'machine_7': ['machine_1', 'machine_2'],
        'machine_8': ['machine_3', 'machine_4'],
    });
    const [selectedWeightProduct, setSelectedWeightProduct] = React.useState<string>('');
    const [selectedWeightType, setSelectedWeightType] = React.useState<WeightTypeKey>('funda');
    const [newWeightUnit, setNewWeightUnit] = React.useState<WeightUnit>('kg');
    const [newWeightMin, setNewWeightMin] = React.useState<string>('');
    const [newWeightMax, setNewWeightMax] = React.useState<string>('');
    const [newWeightColor, setNewWeightColor] = React.useState<string>('bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 font-semibold');
    const [editingWeightRangeId, setEditingWeightRangeId] = React.useState<string | null>(null);
    const [editingWeightType, setEditingWeightType] = React.useState<WeightTypeKey | null>(null);
    const [editingQualityRangeId, setEditingQualityRangeId] = React.useState<string | null>(null);

    const WEIGHT_TYPES: { key: WeightTypeKey; label: string }[] = [
        { key: 'funda', label: 'Funda' },
        { key: 'sacos', label: 'Sacos' },
        { key: 'fardos', label: 'Fardos' },
    ];

    const productOptions = [
        ...products.filter(p => p.isActive).map(p => ({ id: p.id, name: p.productName, color: p.color })),
        { id: 'granel', name: 'Granel', color: '#6b7280' },
    ];

    React.useEffect(() => {
        if (selectedWeightProduct && productOptions.some(p => p.id === selectedWeightProduct)) return;
        if (productOptions.length > 0) setSelectedWeightProduct(productOptions[0].id);
    }, [isOpen, products]);

    React.useEffect(() => {
        if (isOpen) {
            const fetchQuality = async () => {
                const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
                const snap = await getDoc(settingsDocRef);
                console.log('DEBUG [Calidad] snapshot existe:', snap.exists(), '| metadatos:', snap.metadata);
                if (snap.exists()) {
                    const settings = snap.data() as BitacoraSettings;
                    console.log('DEBUG [Calidad] qualityWeights crudo desde Firestore:', JSON.stringify(settings.qualityWeights));
                    if (settings.qualityParams) setQualityParams(settings.qualityParams);
                    if (settings.qualityWeights) setQualityWeights(normalizeQualityWeights(settings.qualityWeights));
                    if (settings.enfardadoraConnections) setEnfardadoraConnections(settings.enfardadoraConnections);
                    if (settings.dispatchSyncActive !== undefined) setDispatchSyncActive(settings.dispatchSyncActive);
                    if (settings.dispatchSyncTime) setDispatchSyncTime(settings.dispatchSyncTime);
                    if (settings.dispatchApiUrl) setDispatchApiUrl(settings.dispatchApiUrl);
                    if (settings.dispatchApiToken) setDispatchApiToken(settings.dispatchApiToken);
                }
            };
            fetchQuality();
        }
    }, [isOpen]);

    const handleSaveDispatchSync = async () => {
        try {
            const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
            await setDoc(settingsDocRef, { 
                dispatchSyncActive, 
                dispatchSyncTime,
                dispatchApiUrl,
                dispatchApiToken
            }, { merge: true });
            toast({ title: 'Éxito', description: 'Configuración de despacho guardada' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo guardar la configuración', variant: 'destructive' });
        }
    };

    const handleSaveEnfardadoraConnections = async (newConnections: { [enfardadoraId: string]: string[] }) => {
        setEnfardadoraConnections(newConnections);
        try {
            const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
            await setDoc(settingsDocRef, { enfardadoraConnections: newConnections }, { merge: true });
            toast({ title: 'Éxito', description: 'Conexiones guardadas' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron guardar las conexiones', variant: 'destructive' });
        }
    };

    const handleSaveQualityParams = async (newParams: QualityParams, action: 'save' | 'delete' = 'save') => {
        setQualityParams(newParams);
        try {
            const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
            await setDoc(settingsDocRef, { qualityParams: newParams }, { mergeFields: ['qualityParams'] });
            toast({ title: 'Éxito', description: action === 'delete' ? 'Rango de calidad eliminado' : 'Parámetros de calidad guardados' });
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron guardar los parámetros', variant: 'destructive' });
        }
    };

    const handleAddQualityRange = () => {
        if (!newQualityMin || !newQualityMax) {
            toast({ title: 'Error', description: 'Ingresa un valor mínimo y máximo', variant: 'destructive' });
            return;
        }
        const min = parseFloat(newQualityMin);
        const max = parseFloat(newQualityMax);
        if (min >= max) {
            toast({ title: 'Error', description: 'El valor mínimo debe ser menor al máximo', variant: 'destructive' });
            return;
        }

        const categoryKey = `${selectedQualityProduct}_${selectedQualityParam}`;
        const currentCategoryParams = qualityParams[categoryKey] || [];
        let newCategoryParams: QualityRange[];
        if (editingQualityRangeId) {
            newCategoryParams = currentCategoryParams.map(r => r.id === editingQualityRangeId
                ? { ...r, min, max, color: newQualityColor }
                : r);
        } else {
            newCategoryParams = [...currentCategoryParams, {
                id: Math.random().toString(36).substr(2, 9),
                min,
                max,
                color: newQualityColor,
            }];
        }
        const newParams = {
            ...qualityParams,
            [categoryKey]: newCategoryParams
        };
        handleSaveQualityParams(newParams);
        setNewQualityMin('');
        setNewQualityMax('');
        setEditingQualityRangeId(null);
    };

    const handleEditQualityRange = (categoryKey: string, rangeId: string) => {
        const range = qualityParams[categoryKey]?.find(r => r.id === rangeId);
        if (!range) return;
        const [product, param] = categoryKey.split('_');
        if (product && param) {
            setSelectedQualityProduct(product);
            setSelectedQualityParam(param);
        }
        setNewQualityMin(String(range.min));
        setNewQualityMax(String(range.max));
        setNewQualityColor(range.color);
        setEditingQualityRangeId(rangeId);
    };

    const handleCancelEditQualityRange = () => {
        setEditingQualityRangeId(null);
        setNewQualityMin('');
        setNewQualityMax('');
    };

    const handleDeleteQualityRange = (categoryKey: string, rangeId: string) => {
        const currentCategoryParams = qualityParams[categoryKey] || [];
        const newParams = {
            ...qualityParams,
            [categoryKey]: currentCategoryParams.filter(r => r.id !== rangeId)
        };
        handleSaveQualityParams(newParams, 'delete');
        if (editingQualityRangeId === rangeId) {
            setEditingQualityRangeId(null);
            setNewQualityMin('');
            setNewQualityMax('');
        }
    };

    const handleSaveQualityWeights = async (newWeights: QualityWeights, action: 'save' | 'delete' = 'save') => {
        setQualityWeights(newWeights);
        console.log('DEBUG [Calidad] Persistiendo qualityWeights:', JSON.stringify(newWeights));
        try {
            const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
            await setDoc(settingsDocRef, { qualityWeights: newWeights }, { mergeFields: ['qualityWeights'] });
            console.log('DEBUG [Calidad] Write OK');
            toast({ title: 'Éxito', description: action === 'delete' ? 'Rango de peso eliminado' : 'Pesos por presentación guardados' });
        } catch (error) {
            console.error('DEBUG [Calidad] ERROR al persistir qualityWeights:', error);
            toast({ title: 'Error', description: 'No se pudieron guardar los pesos', variant: 'destructive' });
        }
    };

    const handleSaveWeightParams = () => {
        const min = parseFloat(newWeightMin);
        const max = parseFloat(newWeightMax);
        if (isNaN(min) || isNaN(max)) {
            toast({ title: 'Error', description: 'Ingresa el peso Mínimo y Máximo', variant: 'destructive' });
            return;
        }
        if (min >= max) {
            toast({ title: 'Error', description: 'El peso mínimo debe ser menor al máximo', variant: 'destructive' });
            return;
        }
        if (!selectedWeightProduct) {
            toast({ title: 'Error', description: 'Selecciona una presentación', variant: 'destructive' });
            return;
        }
        const avg = (min + max) / 2;
        const currentProduct = { ...(qualityWeights[selectedWeightProduct] || {}) };
        if (editingWeightRangeId && editingWeightType) {
            // Modo edición: el rango puede moverse a otro tipo de peso
            const updatedRange: WeightRange = { id: editingWeightRangeId, min, max, avg, unit: newWeightUnit, color: newWeightColor };
            const originalType = editingWeightType;
            const fromRanges = (currentProduct[originalType] || []).filter(r => r.id !== editingWeightRangeId);
            const next: Partial<Record<WeightTypeKey, WeightRange[]>> = { ...currentProduct };
            if (fromRanges.length > 0) next[originalType] = fromRanges;
            else delete next[originalType];
            if (selectedWeightType === originalType) {
                next[selectedWeightType] = [...fromRanges, updatedRange];
            } else {
                next[selectedWeightType] = [...(next[selectedWeightType] || []), updatedRange];
            }
            const newWeights = { ...qualityWeights, [selectedWeightProduct]: next };
            handleSaveQualityWeights(newWeights);
        } else {
            // Modo alta: se agrega un nuevo rango
            const currentRanges = currentProduct[selectedWeightType] || [];
            const newWeights = {
                ...qualityWeights,
                [selectedWeightProduct]: {
                    ...currentProduct,
                    [selectedWeightType]: [...currentRanges, {
                        id: Math.random().toString(36).substr(2, 9),
                        min,
                        max,
                        avg,
                        unit: newWeightUnit,
                        color: newWeightColor,
                    }],
                },
            };
            handleSaveQualityWeights(newWeights);
        }
        setNewWeightMin('');
        setNewWeightMax('');
        setEditingWeightRangeId(null);
        setEditingWeightType(null);
    };

    const handleEditWeightRange = (productId: string, type: WeightTypeKey, rangeId: string) => {
        const range = qualityWeights[productId]?.[type]?.find(r => r.id === rangeId);
        if (!range) return;
        setSelectedWeightProduct(productId);
        setSelectedWeightType(type);
        setNewWeightUnit(range.unit);
        setNewWeightMin(String(range.min));
        setNewWeightMax(String(range.max));
        setNewWeightColor(range.color);
        setEditingWeightRangeId(rangeId);
        setEditingWeightType(type);
    };

    const handleCancelEditWeightRange = () => {
        setEditingWeightRangeId(null);
        setEditingWeightType(null);
        setNewWeightMin('');
        setNewWeightMax('');
    };

    const handleDeleteWeightRange = (productId: string, type: WeightTypeKey, rangeId: string) => {
        console.log('DEBUG [Calidad] Eliminando rango', { productId, type, rangeId });
        console.log('DEBUG [Calidad] Estado actual qualityWeights en modal:', JSON.stringify(qualityWeights));
        const currentProduct = { ...(qualityWeights[productId] || {}) };
        const currentRanges = (currentProduct[type] || []).filter(r => r.id !== rangeId);
        const newWeights = { ...qualityWeights };
        if (currentRanges.length > 0) {
            currentProduct[type] = currentRanges;
            newWeights[productId] = currentProduct;
        } else {
            delete currentProduct[type];
            if (Object.keys(currentProduct).length > 0) {
                newWeights[productId] = currentProduct;
            } else {
                delete newWeights[productId];
            }
        }
        console.log('DEBUG [Calidad] newWeights tras eliminar:', JSON.stringify(newWeights));
        handleSaveQualityWeights(newWeights, 'delete');
        if (editingWeightRangeId === rangeId) {
            setEditingWeightRangeId(null);
            setEditingWeightType(null);
            setNewWeightMin('');
            setNewWeightMax('');
        }
    };

    const { toast } = useToast();

    const handleStartEditCause = (cause: StopCause) => {
        setEditingCauseId(cause.id);
        setNewCauseName(cause.name);
        setNewCauseColor(cause.color);
        setNewCauseType(cause.type || 'planned');
        setNewCauseMaintType(cause.maintenanceType || '__none__');
        setNewCauseDesc(cause.description || '');
        setIsCauseFormOpen(true);
    };

    const handleCancelEditCause = () => {
        setEditingCauseId(null);
        setNewCauseName('');
        setNewCauseType('planned');
        setNewCauseMaintType('__none__');
        setNewCauseDesc('');
        setIsCauseFormOpen(false);
    };

    const handleStartEditMaintType = (mt: MaintenanceType) => {
        setEditingMaintTypeId(mt.id);
        setNewMaintTypeName(mt.name);
        setNewMaintTypeDesc(mt.description || '');
        setIsMaintFormOpen(true);
    };

    const handleCancelEditMaintType = () => {
        setEditingMaintTypeId(null);
        setNewMaintTypeName('');
        setNewMaintTypeDesc('');
        setIsMaintFormOpen(false);
    };

    const handleAdd = async (type: 'stopType' | 'stopCause' | 'operator' | 'bulkOperator' | 'supervisor' | 'maintenanceType') => {
        let data: any;
        let name: string = '';
        switch (type) {
            case 'stopType':
                name = newStopTypeName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del tipo es obligatorio.', variant: 'destructive' });
                    return;
                }
                data = { name, isPlanned: newStopTypeIsPlanned };
                await onConfigSave(type, data, 'add');
                setNewStopTypeName('');
                setNewStopTypeIsPlanned(false);
                break;
            case 'stopCause':
                name = newCauseName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del motivo es obligatorio.', variant: 'destructive' });
                    return;
                }
                data = { name, color: newCauseColor, type: newCauseType, maintenanceType: newCauseMaintType === '__none__' ? '' : newCauseMaintType, description: newCauseDesc };
                if (editingCauseId) {
                    await onConfigSave(type, { ...data, id: editingCauseId }, 'edit');
                    setEditingCauseId(null);
                } else {
                    await onConfigSave(type, data, 'add');
                }
                setNewCauseName('');
                setNewCauseType('planned');
                setNewCauseMaintType('__none__');
                setNewCauseDesc('');
                setIsCauseFormOpen(false);
                break;
            case 'operator':
                name = newOperatorName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del operador es obligatorio.', variant: 'destructive' });
                    return;
                }
                data = { name };
                await onConfigSave(type, data, 'add');
                setNewOperatorName('');
                break;
            case 'bulkOperator':
                name = newBulkOperatorName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del operador de granel es obligatorio.', variant: 'destructive' });
                    return;
                }
                data = { name };
                await onConfigSave(type, data, 'add');
                setNewBulkOperatorName('');
                break;
            case 'supervisor':
                name = newSupervisorName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del supervisor es obligatorio.', variant: 'destructive' });
                    return;
                }
                data = { name };
                await onConfigSave(type, data, 'add');
                setNewSupervisorName('');
                break;
            case 'maintenanceType':
                name = newMaintTypeName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del tipo de mtto. es obligatorio.', variant: 'destructive' });
                    return;
                }
                data = { name, description: newMaintTypeDesc };
                if (editingMaintTypeId) {
                    await onConfigSave(type, { ...data, id: editingMaintTypeId }, 'edit');
                    setEditingMaintTypeId(null);
                } else {
                    await onConfigSave(type, data, 'add');
                }
                setNewMaintTypeName('');
                setNewMaintTypeDesc('');
                setIsMaintFormOpen(false);
                break;
        }
    };

    const handleDelete = async (type: 'stopType' | 'stopCause' | 'operator' | 'bulkOperator' | 'supervisor' | 'maintenanceType', id: string) => {
        await onConfigSave(type, { id }, 'delete');
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-7xl h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
                <DialogHeader className="px-6 py-5 border-b bg-muted/20">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <Settings className="w-6 h-6 text-indigo-600" />
                        Configuración de la Bitácora
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden p-6 bg-muted/10">
                    <Tabs defaultValue="hierarchy" className="h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-6 mb-6 bg-muted/50 p-1">
                            <TabsTrigger value="maintenance" className="text-xs sm:text-sm py-2">Categorías</TabsTrigger>
                            <TabsTrigger value="causes" className="text-xs sm:text-sm py-2"><AlertTriangle className="w-4 h-4 mr-1.5 shrink-0 hidden md:inline" /> Motivos</TabsTrigger>
                            <TabsTrigger value="hierarchy" className="text-xs sm:text-sm py-2">Jerarquía</TabsTrigger>
                            <TabsTrigger value="personnel" className="text-xs sm:text-sm py-2"><Users className="w-4 h-4 mr-1.5 shrink-0 hidden md:inline" /> Personal</TabsTrigger>
                            <TabsTrigger value="machines" className="text-xs sm:text-sm py-2"><EyeOff className="w-4 h-4 mr-1.5 shrink-0 hidden md:inline" /> Máquinas</TabsTrigger>
                            <TabsTrigger value="quality" className="text-xs sm:text-sm py-2"><Activity className="w-4 h-4 mr-1.5 shrink-0 hidden md:inline" /> Calidad</TabsTrigger>
                        </TabsList>


                        {/* TAB 2: CATEGORIAS DE MANTENIMIENTO */}
                        <TabsContent value="maintenance" className="flex-1 overflow-hidden data-[state=active]:flex flex-col gap-6 mt-0 h-full">
                            <Card className="flex-1 flex flex-col overflow-hidden w-full border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Wrench className="h-5 w-5 text-indigo-500" /> {editingMaintTypeId ? 'Editar Categoría' : (isMaintFormOpen ? 'Nueva Categoría' : 'Categorías (Mtto / Áreas)')}
                                        </CardTitle>
                                        {!isMaintFormOpen && !editingMaintTypeId && (
                                            <Button onClick={() => setIsMaintFormOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                                                <PlusCircle className="h-4 w-4 mr-2" /> Añadir Categoría
                                            </Button>
                                        )}
                                    </div>
                                    {(isMaintFormOpen || editingMaintTypeId) && (
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start mt-4">
                                            <div className="md:col-span-4 space-y-1.5">
                                                <Label htmlFor="new-maint-name" className="text-xs text-muted-foreground">Nombre de Categoría</Label>
                                                <Input id="new-maint-name" placeholder="Ej. Operacional, Calidad..." value={newMaintTypeName} onChange={e => setNewMaintTypeName(e.target.value)} />
                                            </div>
                                            <div className="md:col-span-6 space-y-1.5">
                                                <Label htmlFor="new-maint-desc" className="text-xs text-muted-foreground">Descripción (opcional)</Label>
                                                <Input id="new-maint-desc" placeholder="Descripción breve..." value={newMaintTypeDesc} onChange={e => setNewMaintTypeDesc(e.target.value)} />
                                            </div>
                                            <div className="md:col-span-2 flex gap-1 items-end h-full pt-6">
                                                <Button variant="secondary" className="flex-1 px-2" onClick={() => handleAdd('maintenanceType')}>
                                                    {editingMaintTypeId ? <Save className="h-4 w-4 mr-1" /> : <PlusCircle className="h-4 w-4 mr-1" />}
                                                    {editingMaintTypeId ? 'Guardar' : 'Añadir'}
                                                </Button>
                                                <Button variant="outline" size="icon" onClick={() => { handleCancelEditMaintType(); setIsMaintFormOpen(false); }}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-0 bg-muted/5">
                                    <ul className="divide-y divide-border">
                                        {maintenanceTypes.map(mt => (
                                            <li key={mt.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm">{mt.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50" onClick={() => handleStartEditMaintType(mt)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete('maintenanceType', mt.id)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </li>
                                        ))}
                                        {maintenanceTypes.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground">No hay categorías configuradas.</div>
                                        )}
                                    </ul>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB 3: MOTIVOS */}
                        <TabsContent value="causes" className="flex-1 overflow-hidden data-[state=active]:flex gap-6 mt-0 h-full">
                            <Card className="flex-1 flex flex-col overflow-hidden border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg">
                                            {editingCauseId ? 'Editar Motivo' : (isCauseFormOpen ? 'Añadir Nuevo Motivo' : 'Motivos configurados')}
                                        </CardTitle>
                                        {!isCauseFormOpen && !editingCauseId && (
                                            <Button onClick={() => setIsCauseFormOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                                                <PlusCircle className="h-4 w-4 mr-2" /> Añadir Motivo
                                            </Button>
                                        )}
                                    </div>
                                    {(isCauseFormOpen || editingCauseId) && (
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mt-4">
                                            <div className="md:col-span-3 space-y-1.5">
                                                <Label htmlFor="new-cause-name" className="text-xs text-muted-foreground">Nombre del Motivo</Label>
                                                <Input id="new-cause-name" value={newCauseName} onChange={e => setNewCauseName(e.target.value)} placeholder="Ej. Fallo eléctrico..." />
                                            </div>
                                            <div className="md:col-span-4 space-y-1.5">
                                                <Label htmlFor="new-cause-desc" className="text-xs text-muted-foreground">Descripción (opcional)</Label>
                                                <Input id="new-cause-desc" value={newCauseDesc} onChange={e => setNewCauseDesc(e.target.value)} placeholder="Descripción breve..." />
                                            </div>
                                            <div className="md:col-span-1 space-y-1.5">
                                                <Label htmlFor="new-cause-color" className="text-xs text-muted-foreground">Color</Label>
                                                <Input id="new-cause-color" type="color" value={newCauseColor} onChange={e => setNewCauseColor(e.target.value)} className="p-1 h-10 w-full cursor-pointer" />
                                            </div>
                                            <div className="md:col-span-3 space-y-1.5">
                                                <Label htmlFor="new-cause-type" className="text-xs text-muted-foreground">Tipo</Label>
                                                <Select value={newCauseType} onValueChange={(v: any) => setNewCauseType(v)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="planned">Planificada</SelectItem>
                                                        <SelectItem value="unplanned">No Planificada</SelectItem>
                                                        <SelectItem value="observation">Observación</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2 space-y-1.5">
                                                <Label htmlFor="new-cause-maint" className="text-xs text-muted-foreground">Categoría (Área)</Label>
                                                <Select value={newCauseMaintType} onValueChange={(v) => setNewCauseMaintType(v)}>
                                                    <SelectTrigger id="new-cause-maint"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">-- Ninguna --</SelectItem>
                                                        {maintenanceTypes.map(mt => (
                                                            <SelectItem key={mt.id} value={mt.id}>{mt.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2 flex gap-1 items-end">
                                                <Button onClick={() => handleAdd('stopCause')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 p-0" title={editingCauseId ? "Guardar" : "Añadir"}>
                                                    {editingCauseId ? <Save className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                                                </Button>
                                                <Button onClick={() => { handleCancelEditCause(); setIsCauseFormOpen(false); }} variant="outline" className="flex-1 p-0" title="Cancelar">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-0 bg-muted/5">
                                    <ul className="divide-y divide-border">
                                        {stopCauses.map(cause => {
                                            const maintType = maintenanceTypes.find(mt => mt.id === cause.maintenanceType);
                                            return (
                                                <li key={cause.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-3 font-medium">
                                                            <span className="h-4 w-4 rounded-full shadow-sm border border-black/10 shrink-0" style={{ backgroundColor: cause.color }} />
                                                            {cause.name}
                                                            <Badge variant={cause.type === 'planned' ? 'secondary' : (cause.type === 'observation' ? 'outline' : 'destructive')} className={`ml-2 font-normal ${cause.type === 'observation' ? 'text-blue-600 border-blue-200 bg-blue-50' : ''}`}>
                                                                {cause.type === 'planned' ? 'Planificada' : (cause.type === 'observation' ? 'Observación' : 'No Planificada')}
                                                            </Badge>
                                                        </span>
                                                    </div>
                                                    <span className="flex items-center gap-2 shrink-0">
                                                        {maintType && (
                                                            <Badge variant="outline" className='ml-2 font-normal text-indigo-600 border-indigo-200 bg-indigo-50'>
                                                                {maintType.name}
                                                            </Badge>
                                                        )}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50" onClick={() => handleStartEditCause(cause)}>
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete('stopCause', cause.id)}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </li>
                                            )
                                        })}
                                        {stopCauses.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground">No hay motivos configurados.</div>
                                        )}
                                    </ul>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB 4: VISTA JERARQUICA */}
                        <TabsContent value="hierarchy" className="flex-1 overflow-hidden data-[state=active]:flex flex-col gap-6 mt-0 h-full">
                            <Card className="flex-1 flex flex-col overflow-hidden w-full border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b">
                                    <CardTitle className="text-lg flex items-center gap-2"><Factory className="h-5 w-5 text-indigo-500" /> Árbol de Paradas</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-4 bg-muted/5">
                                    {stopCauses.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">No hay motivos configurados.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {(() => {
                                                const groupedByMaint: Record<string, typeof stopCauses> = {};
                                                stopCauses.forEach(c => {
                                                    const key = c.maintenanceType || '__none__';
                                                    if (!groupedByMaint[key]) groupedByMaint[key] = [];
                                                    groupedByMaint[key].push(c);
                                                });
                                                return Object.entries(groupedByMaint).map(([maintId, causesInMaint]) => {
                                                    const maint = maintId === '__none__' ? null : maintenanceTypes.find(m => m.id === maintId);
                                                    const maintName = maintId === '__none__' ? 'Sin Categoría' : maint?.name || 'Desconocida';
                                                    const maintDesc = maint?.description;

                                                    const plannedCauses = causesInMaint.filter(c => c.type === 'planned');
                                                    const unplannedCauses = causesInMaint.filter(c => c.type === 'unplanned');
                                                    const observationCauses = causesInMaint.filter(c => c.type === 'observation');

                                                    return (
                                                        <div key={maintId} className="border rounded-md bg-card shadow-sm overflow-hidden">
                                                            <div className="bg-muted px-4 py-3 border-b flex flex-col gap-1">
                                                                <div className="font-semibold text-indigo-700 flex items-center gap-2">
                                                                    <Factory className="w-4 h-4" />
                                                                    {maintName}
                                                                </div>
                                                                {maintDesc && <div className="text-xs text-muted-foreground ml-6 leading-relaxed">{maintDesc}</div>}
                                                            </div>
                                                            <div className="p-0">
                                                                {plannedCauses.length > 0 && (
                                                                    <div className="border-b last:border-0">
                                                                        <div className="px-4 py-1.5 bg-green-50/50 text-green-700 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            Planificada
                                                                        </div>
                                                                        <ul className="divide-y divide-border">
                                                                            {plannedCauses.map(cause => (
                                                                                <li key={cause.id} className="flex items-center justify-between p-3 pl-8 hover:bg-muted/50 transition-colors">
                                                                                    <div className="flex flex-col gap-1">
                                                                                        <span className="flex items-center gap-3 font-medium text-sm">
                                                                                            <span className="h-3 w-3 rounded-full shadow-sm border border-black/10 shrink-0" style={{ backgroundColor: cause.color }} />
                                                                                            {cause.name}
                                                                                        </span>
                                                                                        {cause.description && <span className="text-xs text-muted-foreground ml-6 leading-relaxed">{cause.description}</span>}
                                                                                    </div>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {unplannedCauses.length > 0 && (
                                                                    <div className="border-b last:border-0">
                                                                        <div className="px-4 py-1.5 bg-red-50/50 text-red-700 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                                                                            <AlertTriangle className="w-3 h-3" />
                                                                            No Planificada
                                                                        </div>
                                                                        <ul className="divide-y divide-border">
                                                                            {unplannedCauses.map(cause => (
                                                                                <li key={cause.id} className="flex items-center justify-between p-3 pl-8 hover:bg-muted/50 transition-colors">
                                                                                    <div className="flex flex-col gap-1">
                                                                                        <span className="flex items-center gap-3 font-medium text-sm">
                                                                                            <span className="h-3 w-3 rounded-full shadow-sm border border-black/10 shrink-0" style={{ backgroundColor: cause.color }} />
                                                                                            {cause.name}
                                                                                        </span>
                                                                                        {cause.description && <span className="text-xs text-muted-foreground ml-6 leading-relaxed">{cause.description}</span>}
                                                                                    </div>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                                {observationCauses.length > 0 && (
                                                                    <div className="border-b last:border-0">
                                                                        <div className="px-4 py-1.5 bg-blue-50/50 text-blue-700 text-xs font-medium uppercase tracking-wider flex items-center gap-2">
                                                                            <Eye className="w-3 h-3" />
                                                                            Observación / Novedad
                                                                        </div>
                                                                        <ul className="divide-y divide-border">
                                                                            {observationCauses.map(cause => (
                                                                                <li key={cause.id} className="flex items-center justify-between p-3 pl-8 hover:bg-muted/50 transition-colors">
                                                                                    <div className="flex flex-col gap-1">
                                                                                        <span className="flex items-center gap-3 font-medium text-sm">
                                                                                            <span className="h-3 w-3 rounded-full shadow-sm border border-black/10 shrink-0" style={{ backgroundColor: cause.color }} />
                                                                                            {cause.name}
                                                                                        </span>
                                                                                        {cause.description && <span className="text-xs text-muted-foreground ml-6 leading-relaxed">{cause.description}</span>}
                                                                                    </div>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="personnel" className="flex-1 overflow-hidden data-[state=active]:flex gap-6 mt-0 h-full">
                            {/* Operators */}
                            <Card className="flex-1 flex flex-col overflow-hidden border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b">
                                    <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-indigo-500" /> Operadores</CardTitle>
                                    <div className="flex items-end gap-2 mt-4">
                                        <div className="flex-grow space-y-1.5">
                                            <Label htmlFor="new-op-name" className="text-xs text-muted-foreground">Nuevo Operador</Label>
                                            <Input id="new-op-name" placeholder="Nombre completo..." value={newOperatorName} onChange={e => setNewOperatorName(e.target.value)} />
                                        </div>
                                        <Button variant="secondary" onClick={() => handleAdd('operator')}><PlusCircle className="h-4 w-4 mr-2" /> Añadir</Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-0 bg-muted/5">
                                    <ul className="divide-y divide-border">
                                        {operators.map(op => (
                                            <li key={op.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                                <span className="font-medium text-sm">{op.name}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete('operator', op.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </li>
                                        ))}
                                        {operators.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground">No hay operadores configurados.</div>
                                        )}
                                    </ul>
                                </CardContent>
                            </Card>

                            {/* Bulk Operators */}
                            <Card className="flex-1 flex flex-col overflow-hidden border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b">
                                    <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-indigo-500" /> Operadores Granel</CardTitle>
                                    <div className="flex items-end gap-2 mt-4">
                                        <div className="flex-grow space-y-1.5">
                                            <Label htmlFor="new-bulk-op-name" className="text-xs text-muted-foreground">Nuevo Op. Granel</Label>
                                            <Input id="new-bulk-op-name" placeholder="Nombre completo..." value={newBulkOperatorName} onChange={e => setNewBulkOperatorName(e.target.value)} />
                                        </div>
                                        <Button variant="secondary" onClick={() => handleAdd('bulkOperator')}><PlusCircle className="h-4 w-4 mr-2" /> Añadir</Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-0 bg-muted/5">
                                    <ul className="divide-y divide-border">
                                        {bulkOperators.map(op => (
                                            <li key={op.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                                <span className="font-medium text-sm">{op.name}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete('bulkOperator', op.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </li>
                                        ))}
                                        {bulkOperators.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground">No hay operadores de granel configurados.</div>
                                        )}
                                    </ul>
                                </CardContent>
                            </Card>

                            {/* Supervisors */}
                            <Card className="flex-1 flex flex-col overflow-hidden border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b">
                                    <CardTitle className="text-lg flex items-center gap-2"><HardHat className="h-5 w-5 text-indigo-500" /> Supervisores</CardTitle>
                                    <div className="flex items-end gap-2 mt-4">
                                        <div className="flex-grow space-y-1.5">
                                            <Label htmlFor="new-sup-name" className="text-xs text-muted-foreground">Nuevo Supervisor</Label>
                                            <Input id="new-sup-name" placeholder="Nombre completo..." value={newSupervisorName} onChange={e => setNewSupervisorName(e.target.value)} />
                                        </div>
                                        <Button variant="secondary" onClick={() => handleAdd('supervisor')}><PlusCircle className="h-4 w-4 mr-2" /> Añadir</Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-0 bg-muted/5">
                                    <ul className="divide-y divide-border">
                                        {supervisors.map(sup => (
                                            <li key={sup.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                                <span className="font-medium text-sm">{sup.name}</span>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete('supervisor', sup.id)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </li>
                                        ))}
                                        {supervisors.length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground">No hay supervisores configurados.</div>
                                        )}
                                    </ul>
                                </CardContent>
                            </Card>
                        </TabsContent>


                        <TabsContent value="machines" className="flex-1 overflow-hidden data-[state=active]:flex flex-col mt-0 h-full">
                            <Card className="flex-1 flex flex-col overflow-hidden w-full border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Eye className="h-5 w-5 text-indigo-500" /> Visibilidad de Máquinas en Bitácora
                                    </CardTitle>
                                    <CardDescription className="text-xs text-muted-foreground">
                                        Activa o desactiva las máquinas para mostrar u ocultar sus columnas en la tabla de registro de producción.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-4 bg-muted/5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {MACHINES_CONFIG.map(m => {
                                            const isVisible = !hiddenMachines.includes(m.id);
                                            const isEnfardadora = m.id === 'machine_7' || m.id === 'machine_8';
                                            return (
                                                <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg bg-card shadow-sm hover:border-indigo-200 transition-colors">
                                                    <div className="flex items-center gap-3 font-medium text-sm">
                                                        <Cpu className="h-5 w-5 text-indigo-600" />
                                                        <span>{m.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {isEnfardadora && isVisible && (
                                                            <div className="flex items-center gap-1.5 mr-2">
                                                                {MACHINES_CONFIG.filter(tm => ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(tm.id)).map(tecnotok => {
                                                                    const currentConnections = enfardadoraConnections[m.id] || [];
                                                                    const isSelected = currentConnections.includes(tecnotok.id);
                                                                    return (
                                                                        <button
                                                                            key={tecnotok.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                let newConn = [...currentConnections];
                                                                                if (!isSelected) {
                                                                                    newConn.push(tecnotok.id);
                                                                                } else {
                                                                                    newConn = newConn.filter(id => id !== tecnotok.id);
                                                                                }
                                                                                const newAllConnections = { ...enfardadoraConnections, [m.id]: newConn };
                                                                                handleSaveEnfardadoraConnections(newAllConnections);
                                                                            }}
                                                                            className={cn(
                                                                                "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors",
                                                                                isSelected 
                                                                                    ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100" 
                                                                                    : "bg-white text-slate-500 border-slate-300 hover:border-slate-400 dark:bg-slate-800 dark:border-slate-700"
                                                                            )}
                                                                            title={`Conectar con ${tecnotok.name}`}
                                                                        >
                                                                            {tecnotok.name.replace('Tecnotok ', 'T')}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                        <Badge variant={isVisible ? "outline" : "secondary"} className="text-xs font-normal hidden sm:inline-flex">
                                                            {isVisible ? 'Visible' : 'Oculta'}
                                                        </Badge>
                                                        <Switch
                                                            checked={isVisible}
                                                            onCheckedChange={(checked) => onToggleMachineVisibility(m.id, checked)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        {/* TAB: CALIDAD */}
                        <TabsContent value="quality" className="flex-1 overflow-y-auto data-[state=active]:flex flex-col gap-6 mt-0">
                            <Card className="w-full border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b space-y-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Activity className="h-5 w-5 text-indigo-500" /> Parámetros de Calidad
                                        </CardTitle>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-1/3">
                                            <Label>Producto</Label>
                                            <Select value={selectedQualityProduct} onValueChange={setSelectedQualityProduct} disabled={!!editingQualityRangeId}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="grasshopper">Grasshopper (Ingreso)</SelectItem>
                                                    <SelectItem value="familiar">Familiar (Salida)</SelectItem>
                                                    <SelectItem value="granel">Granel (Salida)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-1/3">
                                            <Label>Parámetro</Label>
                                            <Select value={selectedQualityParam} onValueChange={setSelectedQualityParam} disabled={!!editingQualityRangeId}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="humedad">Humedad</SelectItem>
                                                    <SelectItem value="color">Color</SelectItem>
                                                    <SelectItem value="turbiedad">Turbiedad</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-end">
                                        <div className="w-1/4">
                                            <Label>Mínimo</Label>
                                            <Input type="number" step="0.01" value={newQualityMin} onChange={e => setNewQualityMin(e.target.value)} />
                                        </div>
                                        <div className="w-1/4">
                                            <Label>Máximo</Label>
                                            <Input type="number" step="0.01" value={newQualityMax} onChange={e => setNewQualityMax(e.target.value)} />
                                        </div>
                                        <div className="w-1/4">
                                            <Label>Color de Fondo</Label>
                                            <Select value={newQualityColor} onValueChange={setNewQualityColor}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 font-semibold">Verde (Bueno)</SelectItem>
                                                    <SelectItem value="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 font-semibold">Amarillo (Alerta)</SelectItem>
                                                    <SelectItem value="bg-orange-200 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100 font-semibold">Naranja (Precaución)</SelectItem>
                                                    <SelectItem value="bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-100 font-semibold">Rojo (Peligro)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-1/4 flex items-end gap-2">
                                            <Button onClick={handleAddQualityRange} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                                                <Save className="h-4 w-4 mr-2" /> {editingQualityRangeId ? 'Guardar' : 'Añadir Rango'}
                                            </Button>
                                            {editingQualityRangeId && (
                                                <Button variant="outline" size="icon" title="Cancelar edición" onClick={handleCancelEditQualityRange}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 bg-muted/5">
                                    <Table wrapperClassName="max-h-72">
                                        <TableHeader>
                                            <TableRow className="bg-muted/60 hover:bg-muted/60">
                                                <TableHead className="w-16 pl-4">Color</TableHead>
                                                <TableHead>Rango</TableHead>
                                                <TableHead className="text-right pr-4">Acción</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(qualityParams[`${selectedQualityProduct}_${selectedQualityParam}`] || []).map((range, index) => (
                                                <TableRow key={`${range.id}-${index}`}>
                                                    <TableCell className="pl-4">
                                                        <div className={cn("w-6 h-6 rounded border", range.color)}></div>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        De <b>{range.min}</b> a <b>{range.max}</b>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-2">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600" title="Editar rango" onClick={() => handleEditQualityRange(`${selectedQualityProduct}_${selectedQualityParam}`, range.id)}>
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 hover:text-red-600" title="Eliminar rango" onClick={() => handleDeleteQualityRange(`${selectedQualityProduct}_${selectedQualityParam}`, range.id)}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {!(qualityParams[`${selectedQualityProduct}_${selectedQualityParam}`]?.length > 0) && (
                                        <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                                            <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
                                            <p>No hay rangos definidos para este parámetro.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            {/* Pesos por presentación */}
                            <Card className="w-full border shadow-sm">
                                <CardHeader className="bg-card pb-4 border-b space-y-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Scale className="h-5 w-5 text-indigo-500" /> Pesos por Presentación
                                        </CardTitle>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-1/3">
                                            <Label>Presentación</Label>
                                            <Select value={selectedWeightProduct} onValueChange={setSelectedWeightProduct} disabled={!!editingWeightRangeId}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {productOptions.map(p => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            <span className="flex items-center gap-2">
                                                                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: p.color || '#6b7280' }} />
                                                                {p.name}
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-1/6">
                                            <Label>Tipo de Peso</Label>
                                            <Select value={selectedWeightType} onValueChange={(v) => setSelectedWeightType(v as WeightTypeKey)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {WEIGHT_TYPES.map(t => (
                                                        <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-1/6">
                                            <Label>Unidad</Label>
                                            <Select value={newWeightUnit} onValueChange={(v) => setNewWeightUnit(v as WeightUnit)}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="g">Gramos (g)</SelectItem>
                                                    <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 items-end">
                                        <div className="w-1/5">
                                            <Label>Mínimo</Label>
                                            <Input type="number" step="0.01" value={newWeightMin} onChange={e => setNewWeightMin(e.target.value)} />
                                        </div>
                                        <div className="w-1/5">
                                            <Label>Máximo</Label>
                                            <Input type="number" step="0.01" value={newWeightMax} onChange={e => setNewWeightMax(e.target.value)} />
                                        </div>
                                        <div className="w-1/5">
                                            <Label>Promedio (auto)</Label>
                                            <Input type="number" disabled value={newWeightMin && newWeightMax ? (((parseFloat(newWeightMin) + parseFloat(newWeightMax)) / 2).toFixed(2)) : ''} />
                                        </div>
                                        <div className="w-1/4">
                                            <Label>Color de Fondo</Label>
                                            <Select value={newWeightColor} onValueChange={setNewWeightColor}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 font-semibold">Verde (Bueno)</SelectItem>
                                                    <SelectItem value="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 font-semibold">Amarillo (Alerta)</SelectItem>
                                                    <SelectItem value="bg-orange-200 dark:bg-orange-900/40 text-orange-900 dark:text-orange-100 font-semibold">Naranja (Precaución)</SelectItem>
                                                    <SelectItem value="bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-100 font-semibold">Rojo (Peligro)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-1/5 flex items-end gap-2">
                                            <Button onClick={handleSaveWeightParams} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                                                <Save className="h-4 w-4 mr-2" /> {editingWeightRangeId ? 'Guardar' : 'Añadir Rango'}
                                            </Button>
                                            {editingWeightRangeId && (
                                                <Button variant="outline" size="icon" title="Cancelar edición" onClick={handleCancelEditWeightRange}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 bg-muted/5">
                                    <Table wrapperClassName="max-h-72">
                                        <TableHeader>
                                            <TableRow className="bg-muted/60 hover:bg-muted/60">
                                                <TableHead className="pl-4">Color</TableHead>
                                                <TableHead>Presentación</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead className="text-right">Rango</TableHead>
                                                <TableHead className="text-right">Promedio</TableHead>
                                                <TableHead>Unidad</TableHead>
                                                <TableHead className="text-right pr-4">Acción</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Object.entries(qualityWeights).flatMap(([productId, productParams]) => {
                                                const product = productOptions.find(p => p.id === productId);
                                                return (Object.entries(productParams) as [WeightTypeKey, WeightRange[]][])
                                                    .filter(([type]) => WEIGHT_TYPE_KEYS.includes(type))
                                                    .flatMap(([type, ranges]) => {
                                                        const typeLabel = WEIGHT_TYPES.find(t => t.key === type)?.label || type;
                                                        return ranges.map((range, index) => (
                                                            <TableRow key={`${productId}-${type}-${range.id}-${index}`}>
                                                                <TableCell className="pl-4">
                                                                    <div className={cn("w-6 h-6 rounded border", range.color)}></div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <span className="flex items-center gap-2">
                                                                        <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: product?.color || '#6b7280' }} />
                                                                        <span className="font-medium">{product ? product.name : productId}</span>
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">{typeLabel}</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono">
                                                                    De <b>{range.min}</b> a <b>{range.max}</b>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-muted-foreground">{range.avg}</TableCell>
                                                                <TableCell className="text-muted-foreground">{range.unit === 'g' ? 'Gramos (g)' : 'Kilogramos (kg)'}</TableCell>
                                                                <TableCell className="text-right pr-2">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <Button variant="ghost" size="icon" className="text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600" title="Editar rango" onClick={() => handleEditWeightRange(productId, type, range.id)}>
                                                                            <Edit2 className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 hover:text-red-600" title="Eliminar rango" onClick={() => handleDeleteWeightRange(productId, type, range.id)}>
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ));
                                                    });
                                            })}
                                        </TableBody>
                                    </Table>
                                    {Object.keys(qualityWeights).length === 0 && (
                                        <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                                            <Scale className="h-8 w-8 text-muted-foreground/50" />
                                            <p>No hay pesos definidos para las presentaciones.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* TAB 7: DESPACHO */}

                    </Tabs>
                </div>
                <DialogFooter className="px-6 py-4 border-t bg-muted/10">
                    <DialogClose asChild>
                        <Button variant="secondary">Cerrar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const SaveStatusIndicator = ({ status, onSave }: { status: 'dirty' | 'saving' | 'saved' | 'idle', onSave: () => void }) => {
    if (status === 'idle') {
        return (
            <Button onClick={onSave}>
                <Save className="mr-2 h-4 w-4" /> Guardar Cambios
            </Button>
        );
    }

    const config = {
        dirty: { text: 'Guardar Cambios', icon: <Save className="h-4 w-4" />, color: 'text-white', buttonVariant: 'default' as 'default' },
        saving: { text: 'Guardando...', icon: <RefreshCw className="h-4 w-4 animate-spin" />, color: 'text-blue-600', buttonVariant: 'outline' as 'outline' },
        saved: { text: 'Sincronizado', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600', buttonVariant: 'outline' as 'outline' }
    };

    const current = config[status as keyof typeof config] || config.saved;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button 
                        variant={current.buttonVariant} 
                        onClick={status === 'dirty' ? onSave : undefined} 
                        disabled={status === 'saving'}
                        className={status === 'saved' ? "border-green-200 bg-green-50 hover:bg-green-50 cursor-default shadow-none" : ""}
                    >
                        <div className={cn("flex items-center gap-2", current.color)}>
                            {current.icon}
                            <span>{current.text}</span>
                        </div>
                        {status === 'dirty' && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500"></span>}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    {status === 'dirty' && <p>Tienes cambios sin guardar.</p>}
                    {status === 'saving' && <p>Guardando tus cambios en la nube.</p>}
                    {status === 'saved' && <p>Todos los cambios están guardados.</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export const formatEmpaqueObservation = (text: string): string => {
    if (!text) return text;
    
    // 1. Split text to isolate parentheses content
    const parts = text.split(/(\([^)]+\))/g);
    
    const processedParts = parts.map(part => {
        if (part.startsWith('(') && part.endsWith(')')) {
            return part; // Keep parentheses content exactly as is
        }
        
        // Lowercase fully uppercase words outside parentheses
        return part.split(/(\s+)/).map(word => {
            if (word === word.toUpperCase() && /[A-ZÁÉÍÓÚÑÜ]/.test(word)) {
                return word.toLowerCase();
            }
            return word;
        }).join('');
    });
    
    const result = processedParts.join('');
    
    // 2. Smart Capitalization
    let capitalizeNext = true;
    let finalResult = '';
    let parenDepth = 0;
    
    for (let i = 0; i < result.length; i++) {
        const char = result[i];
        
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
        
        const isLetter = /[a-záéíóúñü]/i.test(char);
        
        if (capitalizeNext && isLetter && parenDepth === 0) {
            finalResult += char.toUpperCase();
            capitalizeNext = false;
        } else {
            finalResult += char;
            if (/[.!?\n:]/.test(char) && parenDepth === 0) {
                capitalizeNext = true;
            } else if (/[a-záéíóúñü0-9]/i.test(char) && parenDepth === 0) {
                capitalizeNext = false;
            }
        }
    }
    return finalResult;
};

export default function StopsClient({
    prefetchedProducts,
    initialDate,
    initialShift,
    initialMode
}: {
    prefetchedProducts: ProductDefinition[],
    initialDate?: string,
    initialShift?: 'day' | 'night',
    initialMode?: 'read' | 'edit'
}) {
    const [dailyLog, setDailyLog] = React.useState<DailyLog | null>(null);
    const [stopTypes, setStopTypes] = React.useState<StopType[]>([]);
    const [stopCauses, setStopCauses] = React.useState<StopCause[]>([]);
    const [operators, setOperators] = React.useState<Operator[]>([]);
    const [bulkOperators, setBulkOperators] = React.useState<Operator[]>([]);
    const [supervisors, setSupervisors] = React.useState<Supervisor[]>([]);
    const [maintenanceTypes, setMaintenanceTypes] = React.useState<MaintenanceType[]>([]);
    const [allCategories, setAllCategories] = React.useState<CategoryDefinition[]>([]);
    const [loading, setLoading] = React.useState(true);
    const hiddenMachines = React.useMemo(() => {
        return dailyLog?.hiddenMachines || [];
    }, [dailyLog?.hiddenMachines]);

    const handleToggleMachineVisibility = (machineId: string, isVisible: boolean) => {
        setDailyLog(prev => {
            if (!prev) return prev;
            const currentHidden = prev.hiddenMachines || [];
            let updated: string[];
            if (isVisible) {
                updated = currentHidden.filter(id => id !== machineId);
            } else {
                updated = [...currentHidden, machineId];
            }
            const updatedLog = { ...prev, hiddenMachines: updated };
            handleSaveLog(updatedLog, false);
            return updatedLog;
        });
        const prev = settingsHiddenMachinesRef.current;
        let next: string[];
        if (isVisible) {
            next = prev.filter(id => id !== machineId);
        } else if (!prev.includes(machineId)) {
            next = [...prev, machineId];
        } else {
            next = prev;
        }
        settingsHiddenMachinesRef.current = next;
        const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
        setDoc(settingsDocRef, { hiddenMachines: next }, { merge: true }).catch(err =>
            console.error("Error persistiendo visibilidad de máquinas:", err)
        );
    };
    // Si no hay fecha inicial y la hora actual cruza la medianoche (antes del fin del turno noche), pertenece al día anterior
    const getInitialDate = (): Date => {
        if (initialDate) return parse(initialDate, 'yyyy-MM-dd', new Date());
        const now = new Date();
        const hour = now.getHours();
        const nightEnd = SHIFT_CONFIG.night.endHour;
        if (hour >= 0 && hour < nightEnd) {
            return addDays(now, -1);
        }
        return now;
    };
    const [date, setDate] = React.useState<Date>(getInitialDate());
    const [modalState, setModalState] = React.useState<{ isOpen: boolean; machineId: string; timeSlot: string; stopData?: StopData } | null>(null);
    const [configModalOpen, setConfigModalOpen] = React.useState(false);
    const [importWizardOpen, setImportWizardOpen] = React.useState(false);

    const [historyModalOpen, setHistoryModalOpen] = React.useState(false);
    const { toast } = useToast();
    const isReadOnly = initialMode === 'read';
    const [weightHeaderType, setWeightHeaderType] = React.useState<{ [key: string]: string }>({
        machine_1: 'weight',
        machine_2: 'weight',
        machine_3: 'weight',
        machine_4: 'weight',
        machine_7: 'bundle_weight',
        machine_8: 'bundle_weight',
        machine_5: 'weight',
        machine_6: 'weight',
    });
    const [qualityParams, setQualityParams] = React.useState<QualityParams>({});
    const [qualityWeights, setQualityWeights] = React.useState<QualityWeights>({});
    const [enfardadoraConnections, setEnfardadoraConnections] = React.useState<{ [enfardadoraId: string]: string[] }>({
        'machine_7': ['machine_1', 'machine_2'],
        'machine_8': ['machine_3', 'machine_4'],
    });
    const [machineOEE, setMachineOEE] = React.useState<{ [key: string]: MachineOEE }>({});
    const settingsHiddenMachinesRef = React.useRef<string[]>([]);
    const [pendingProductChange, setPendingProductChange] = React.useState<{ machineId: string; productId: string } | null>(null);
    const defaultChangeTime = `${String(SHIFT_CONFIG.day.startHour).padStart(2, '0')}:00`;
    const [selectedChangeTime, setSelectedChangeTime] = React.useState<string>(defaultChangeTime);


    const [saveStatus, setSaveStatus] = React.useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
    const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const [highlightedTime, setHighlightedTime] = React.useState<string | null>(null);
    const [highlightedColumnIndex, setHighlightedColumnIndex] = React.useState<number | null>(null);

    const [copiedStop, setCopiedStop] = React.useState<StopData | null>(null);
    const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
    const [isSelecting, setIsSelecting] = React.useState(false);
    const [selectionStartCell, setSelectionStartCell] = React.useState<{ r: number, c: number } | null>(null);
    const [selectionEndCell, setSelectionEndCell] = React.useState<{ r: number, c: number } | null>(null);
    const [editingCellId, setEditingCellId] = React.useState<string | null>(null);

    const CELL_COLS = React.useMemo(() => {
        const cols: any[] = [];
        MACHINES_CONFIG.forEach(m => {
            if (hiddenMachines.includes(m.id)) return;
            const isTecnotok = ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(m.id);
            const isEnfardadora = m.id === 'machine_7' || m.id === 'machine_8';
            cols.push({ type: 'obs', machineId: m.id });
            cols.push({ type: 'input', machineId: m.id, getField: () => (weightHeaderType[m.id] || 'weight') as keyof TimeSlot });
            if (isTecnotok) {
                cols.push({ type: 'input', machineId: m.id, getField: () => 'bundle_weight' as keyof TimeSlot });
            } else if (isEnfardadora) {
                cols.push({ type: 'input', machineId: m.id, getField: () => 'peso_funda' as keyof TimeSlot });
            }
        });
        cols.push(
            { type: 'input', getField: () => 'masa' as keyof TimeSlot },
            { type: 'input', getField: () => 'flujo' as keyof TimeSlot },
            { type: 'input', getField: () => 'ns_fam' as keyof TimeSlot },
            { type: 'input', getField: () => 'ns_1' as keyof TimeSlot },
            { type: 'input', getField: () => 'ns_2' as keyof TimeSlot },
            { type: 'input', getField: () => 'in_color' as keyof TimeSlot },
            { type: 'input', getField: () => 'in_hum' as keyof TimeSlot },
            { type: 'input', getField: () => 'in_turb' as keyof TimeSlot },
            { type: 'input', getField: () => 'in_cv' as keyof TimeSlot },
            { type: 'input', getField: () => 'out_fam_color' as keyof TimeSlot },
            { type: 'input', getField: () => 'out_fam_hum' as keyof TimeSlot },
            { type: 'input', getField: () => 'out_fam_turb' as keyof TimeSlot },
            { type: 'input', getField: () => 'out_gra_color' as keyof TimeSlot },
            { type: 'input', getField: () => 'out_gra_hum' as keyof TimeSlot },
            { type: 'input', getField: () => 'out_gra_turb' as keyof TimeSlot },
            { type: 'input', getField: () => 'empaque_obs' as keyof TimeSlot }
        );
        return cols;
    }, [weightHeaderType]);

    const getColumnIndex = React.useCallback((field: string, machineId?: string) => {
        if (machineId) {
            return CELL_COLS.findIndex(c => c.machineId === machineId && (
                (field === 'obs' && c.type === 'obs') ||
                (field !== 'obs' && c.getField?.() === field)
            ));
        }
        return CELL_COLS.findIndex(c => !c.machineId && c.getField?.() === field);
    }, [CELL_COLS]);

    React.useEffect(() => {
        if (!isSelecting || !selectionStartCell || !selectionEndCell) return;
        const newSet = new Set<string>();
        const r1 = Math.min(selectionStartCell.r, selectionEndCell.r);
        const r2 = Math.max(selectionStartCell.r, selectionEndCell.r);
        const c1 = Math.min(selectionStartCell.c, selectionEndCell.c);
        const c2 = Math.max(selectionStartCell.c, selectionEndCell.c);

        for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
                newSet.add(r + '|' + c);
            }
        }
        setSelectedCells(newSet);
    }, [isSelecting, selectionStartCell, selectionEndCell]);

    React.useEffect(() => {
        const handleEnd = () => setIsSelecting(false);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('pointerup', handleEnd);
        window.addEventListener('blur', handleEnd);
        return () => {
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('pointerup', handleEnd);
            window.removeEventListener('blur', handleEnd);
        };
    }, []);

    const handleCellMouseDown = React.useCallback((r: number, c: number, e: React.MouseEvent) => {
        if (isReadOnly || e.button !== 0) return;
        setHighlightedColumnIndex(c);
        setIsSelecting(true);
        setSelectionStartCell({ r, c });
        setSelectionEndCell({ r, c });
        setSelectedCells(new Set([r + '|' + c]));
    }, [isReadOnly]);

    const handleCellMouseEnter = React.useCallback((r: number, c: number) => {
        setHighlightedColumnIndex(c);
        if (isSelecting) {
            setSelectionEndCell({ r, c });
        }
    }, [isSelecting]);

    const getMachineColStart = (machineId: string): number => {
        let start = 0;
        for (const m of MACHINES_CONFIG) {
            if (m.id === machineId) return start;
            const isT = ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(m.id);
            const isE = m.id === 'machine_7' || m.id === 'machine_8';
            start += (isT || isE ? 3 : 2);
        }
        return start;
    };

    const isColHovered = React.useCallback((start: number, count: number) => {
        return highlightedColumnIndex !== null && highlightedColumnIndex >= start && highlightedColumnIndex < start + count;
    }, [highlightedColumnIndex]);

    const TOTAL_MACHINE_COLS = React.useMemo(() => MACHINES_CONFIG.reduce((acc, m) => {
        const isT = ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(m.id);
        const isE = m.id === 'machine_7' || m.id === 'machine_8';
        return acc + (isT || isE ? 3 : 2);
    }, 0), []);


    const isCurrentDay = React.useMemo(() => {
        if (isToday(date)) return true;
        // Turno noche cubre hasta la hora de fin configurada del día siguiente.
        // Si la hora cruza la medianoche (antes del fin del turno), el log de "ayer" sigue siendo el activo.
        const hour = new Date().getHours();
        const nightEnd = SHIFT_CONFIG.night.endHour;
        if (hour >= 0 && hour < nightEnd) {
            const yesterday = addDays(new Date(), -1);
            return format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd');
        }
        return false;
    }, [date]);

    const timeSlotsForTable = React.useMemo(() => generateDisplayTimeSlots(dailyLog?.shift || 'day'), [dailyLog?.shift]);

    const stopCausesMap = React.useMemo(() => {
        return new Map(stopCauses.map(cause => [cause.name, cause]));
    }, [stopCauses]);

    const familiarCategoryId = React.useMemo(() => {
        return allCategories.find(c => c.name.toLowerCase() === 'familiar')?.id;
    }, [allCategories]);

    const familiarProducts = React.useMemo(() => {
        if (!familiarCategoryId) return prefetchedProducts;
        return prefetchedProducts.filter(p => p.categoryId === familiarCategoryId);
    }, [prefetchedProducts, familiarCategoryId]);

    // Productos disponibles para las graneleras (#1 y #2): opciones de granel
    // predeterminadas (matcheadas contra la configuración) más el producto
    // "Residual" configurado en el sistema.
    const granelProducts = React.useMemo(() => {
        const matchedDefaults = GRANEL_DEFAULT_OPTIONS.map(opt => {
            const existing = prefetchedProducts.find(p =>
                p.id === opt.id ||
                p.productName.toLowerCase().trim() === opt.productName.toLowerCase().trim() ||
                (p.productName.toLowerCase().includes('granel') && p.productName.toLowerCase().includes(opt.productName.split('-')[1]?.trim().toLowerCase() || ''))
            );
            return existing || (opt as unknown as any);
        });
        const residual = prefetchedProducts.filter(p =>
            !matchedDefaults.some(m => m.id === p.id) &&
            p.productName.toLowerCase().includes('residual')
        );
        return [...matchedDefaults, ...residual];
    }, [prefetchedProducts]);

    const usedMasaValues = React.useMemo(() => {
        if (!dailyLog?.timeSlots) return new Set<string>();
        const used = new Set<string>();
        Object.values(dailyLog.timeSlots).forEach((slot) => {
            if (slot.masa && slot.masa !== '_') {
                used.add(String(slot.masa));
            }
        });
        return used;
    }, [dailyLog?.timeSlots]);

    const getMachineHeaderStyle = React.useCallback((machineId: string) => {
        const productId = dailyLog?.machines?.[machineId]?.productId;

        // 1. Sin producción seleccionado -> Fondo GRIS sutil
        if (!productId || productId === 'no_production') {
            return {
                className: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300',
                style: {}
            };
        }

        // 2. Buscar producto y su color hex configurado
        const foundProd = prefetchedProducts.find(p => p.id === productId)
            || familiarProducts.find(p => p.id === productId)
            || prefetchedProducts.find(p => {
                if (productId === 'granel_50kg_blanca' && p.productName.toLowerCase().includes('blanca')) return true;
                if (productId === 'granel_50kg_morena' && p.productName.toLowerCase().includes('morena')) return true;
                if (productId === 'granel_50kg_observacion' && (p.productName.toLowerCase().includes('observacion') || p.productName.toLowerCase().includes('observación'))) return true;
                return false;
            });

        let hexColor: string | undefined = foundProd?.color;

        // Fallback si no está registrado
        if (!hexColor) {
            if (productId === 'granel_50kg_blanca') hexColor = '#3b82f6';
            else if (productId === 'granel_50kg_morena') hexColor = '#d97706';
            else if (productId === 'granel_50kg_observacion') hexColor = '#6b7280';
        }

        if (hexColor) {
            return {
                className: 'font-semibold text-slate-900 dark:text-slate-100',
                style: {
                    backgroundColor: `${hexColor}25`, // Opacidad suave al 15% para que no resalten bordes ni estridentes
                }
            };
        }

        return {
            className: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300',
            style: {}
        };
    }, [dailyLog?.machines, prefetchedProducts, familiarProducts]);

    const getProductName = React.useCallback((productId: string | undefined | null) => {
        if (!productId) return '-- Sin Producción --';
        const found = prefetchedProducts.find(p => p.id === productId)
            || familiarProducts.find(p => p.id === productId)
            || granelProducts.find(p => p.id === productId)
            || prefetchedProducts.find(p => {
                if (productId === 'granel_50kg_blanca' && p.productName.toLowerCase().includes('blanca')) return true;
                if (productId === 'granel_50kg_morena' && p.productName.toLowerCase().includes('morena')) return true;
                if (productId === 'granel_50kg_observacion' && (p.productName.toLowerCase().includes('observacion') || p.productName.toLowerCase().includes('observación'))) return true;
                return false;
            });
        return found?.productName || productId;
    }, [prefetchedProducts, familiarProducts, granelProducts]);

    const getProductColor = React.useCallback((productId: string | undefined | null): string | undefined => {
        if (!productId) return undefined;
        const found = prefetchedProducts.find(p => p.id === productId)
            || familiarProducts.find(p => p.id === productId)
            || granelProducts.find(p => p.id === productId)
            || prefetchedProducts.find(p => {
                if (productId === 'granel_50kg_blanca' && p.productName.toLowerCase().includes('blanca')) return true;
                if (productId === 'granel_50kg_morena' && p.productName.toLowerCase().includes('morena')) return true;
                if (productId === 'granel_50kg_observacion' && (p.productName.toLowerCase().includes('observacion') || p.productName.toLowerCase().includes('observación'))) return true;
                return false;
            });
        return found?.color
            || (productId === 'granel_50kg_blanca' ? '#3b82f6'
                : productId === 'granel_50kg_morena' ? '#d97706'
                    : productId === 'granel_50kg_observacion' ? '#6b7280'
                        : undefined);
    }, [prefetchedProducts, familiarProducts, granelProducts]);

    // Reconstruye la presentación activa en cada franja a partir del historial de cambios
    const getActiveProductIdForMachine = React.useCallback((machineId: string, slotTime: string): string => {
        const machine = dailyLog?.machines?.[machineId];
        if (!machine) return '';
        const shift = dailyLog?.shift || 'day';
        const timeToMins = (tStr: string) => {
            const [h, m] = tStr.split(':').map(Number);
            let total = h * 60 + m;
            if (shift === 'night' && h < 18) total += 24 * 60;
            return total;
        };
        const changes = (machine.productChanges || []).slice().sort((a, b) => timeToMins(a.at) - timeToMins(b.at));
        if (changes.length === 0) return machine.productId || '';
        const slotMins = timeToMins(slotTime);
        let active = changes[0].from || '';
        for (const c of changes) {
            if (timeToMins(c.at) <= slotMins) active = c.to || '';
            else break;
        }
        return active;
    }, [dailyLog?.machines, dailyLog?.shift]);

    React.useEffect(() => {
        const fetchSettings = async () => {
            const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
            const settingsDocSnap = await getDoc(settingsDocRef);
            if (settingsDocSnap.exists()) {
                const settings = settingsDocSnap.data() as BitacoraSettings;
                if (settings.weightHeaderType) {
                    setWeightHeaderType(settings.weightHeaderType);
                }
                if (settings.qualityParams) {
                    setQualityParams(settings.qualityParams);
                }
                if (settings.qualityWeights) {
                    setQualityWeights(normalizeQualityWeights(settings.qualityWeights));
                }
                if (Array.isArray(settings.hiddenMachines)) {
                    settingsHiddenMachinesRef.current = settings.hiddenMachines;
                }
            }
        };
        fetchSettings();
    }, []);

    const getColorForValue = React.useCallback((categoryKey: string, value: string | undefined) => {
        if (!value || !qualityParams[categoryKey]) return undefined;
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return undefined;

        const ranges = qualityParams[categoryKey];
        for (const range of ranges) {
            if (numValue >= range.min && numValue <= range.max) {
                return range.color; // e.g., 'bg-green-100...'
            }
        }
        return undefined;
    }, [qualityParams]);

    // Colorea la celda de peso según el tipo de peso y las bandas de la presentación activa en esa franja
    const getWeightTypeKey = React.useCallback((field: string, machineId: string): WeightTypeKey | undefined => {
        if (field === 'peso_funda') return 'funda';
        if (field === 'weight') return 'sacos';
        if (field === 'bundle_weight') {
            return ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(machineId) ? 'funda' : 'fardos';
        }
        return undefined;
    }, []);

    const getWeightCellColor = React.useCallback((machineId: string, slotTime: string, value: string | undefined, field: string): string => {
        if (!value || !machineId) return '';
        const typeKey = getWeightTypeKey(field, machineId);
        if (!typeKey) return '';
        const productId = getActiveProductIdForMachine(machineId, slotTime);
        if (!productId) return '';
        const ranges = qualityWeights[productId]?.[typeKey];
        if (!ranges?.length) return '';
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '';
        for (const range of ranges) {
            if (numValue >= range.min && numValue <= range.max) {
                return cn('font-semibold', range.color);
            }
        }
        return '';
    }, [getActiveProductIdForMachine, getWeightTypeKey, qualityWeights]);

    const getContrastTextColor = React.useCallback((hexColor: string): string => {
        if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
        let hex = hexColor.replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq >= 128 ? '#0f172a' : '#ffffff';
    }, []);

    const handleWeightHeaderTypeChange = async (machineId: string, value: string) => {
        const newTypes = { ...weightHeaderType, [machineId]: value };
        setWeightHeaderType(newTypes);
        try {
            const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
            await setDoc(settingsDocRef, { weightHeaderType: newTypes }, { merge: true });
        } catch (error) {
            console.error("Failed to save weight header type to Firestore", error);
        }
    };

    const createEmptyLog = React.useCallback((logDate: Date, shift: 'day' | 'night'): DailyLog => {
        const machineEntries: { [machineId: string]: MachineLog } = {};
        for (let i = 1; i <= NUM_MACHINES; i++) {
            machineEntries[`machine_${i}`] = {
                productId: '',
            };
        }
        return {
            id: `${format(logDate, 'yyyy-MM-dd')}_${shift}`,
            operador: '',
            operadorGranel: '',
            supervisor: '',
            lote: String(format(logDate, 'd', { locale: es })),
            shift: shift,
            shiftConfig: SHIFT_CONFIG[shift],
            machines: machineEntries,
            timeSlots: {}
        };
    }, []);

    const handleSaveLog = React.useCallback(async (logToSave: DailyLog | null, showToast = true) => {
        if (!logToSave || !logToSave.id) return;

        setSaveStatus('saving');
        try {
            const cleanLog = JSON.parse(JSON.stringify(logToSave));

            const docRef = doc(db, 'dailyLogs', cleanLog.id);
            await setDoc(docRef, cleanLog);

            setSaveStatus('saved');
            if (showToast) {
                toast({ title: 'Progreso Guardado', description: `Se guardaron los cambios para el día ${cleanLog.id}.` });
            }
        } catch (error) {
            console.error("Error saving daily log:", error);
            setSaveStatus('dirty');
            if (showToast) {
                toast({ title: 'Error', description: 'No se pudo guardar la bitácora.', variant: 'destructive' });
            }
        }
    }, [toast]);

    const calculateOEE = React.useCallback(() => {
        if (!dailyLog) return;

        const currentShift = dailyLog?.shift || initialShift || 'day';
        const plannedTime = (currentShift === 'night' ? 13 : 11) * 60; // Día: 07:00-18:00 (11h = 660m), Noche: 18:00-07:00 (13h = 780m)
        const newOEE: { [key: string]: MachineOEE } = {};

        for (let i = 1; i <= NUM_MACHINES; i++) {
            const machineId = `machine_${i}`;
            const machineLog = dailyLog.machines[machineId];

            if (!machineLog || !machineLog.productId) {
                newOEE[machineId] = { availability: 0, performance: 0, quality: 0, oee: 0 };
                continue;
            }

            let totalStopTime = 0;
            let actualProductionSlots = 0;
            let theoreticalProductionSlots = 0;

            timeSlotsForTable.forEach(time => {
                const slotData = dailyLog.timeSlots[time]?.[machineId];
                if (slotData) {
                    if (slotData.stops) {
                        (slotData.stops as StopData[]).forEach(stop => {
                            const stopCauseConfig = stopCausesMap.get(stop.reason);
                            if (!isObservationEvent(stop, stopCauseConfig)) {
                                totalStopTime += stop.duration;
                            }
                        });
                    }
                    // Deprecated: OEE preview calculation using 'bundle_weight' has been removed because 'bundle_weight' was misused for 'Peso Funda'.
                    // Actual production counts should be fetched from the main production record, not calculated from Peso Funda.
                }
            });

            const runTime = plannedTime - totalStopTime;
            const availability = (runTime / plannedTime) * 100;
            const performance = theoreticalProductionSlots > 0 ? (actualProductionSlots / theoreticalProductionSlots) * 100 : 0;
            const quality = 100; // Assuming 100% quality for now

            const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;

            newOEE[machineId] = {
                availability: parseFloat(availability.toFixed(1)),
                performance: parseFloat(performance.toFixed(1)),
                quality: parseFloat(quality.toFixed(1)),
                oee: parseFloat(oee.toFixed(1)),
            };
        }
        setMachineOEE(newOEE);
    }, [dailyLog, timeSlotsForTable, stopCausesMap]);

    React.useEffect(() => {
        calculateOEE();
    }, [dailyLog, calculateOEE]);


    React.useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            setSaveStatus('idle');
            const currentShift = dailyLog?.shift || initialShift || (new Date().getHours() < 18 && new Date().getHours() >= 7 ? 'day' : 'night');
            const logId = `${format(date, 'yyyy-MM-dd')}_${currentShift}`;

            try {
                const logDocSnap = await getDoc(doc(db, 'dailyLogs', logId));

                let logData: DailyLog;
                if (logDocSnap.exists()) {
                    logData = logDocSnap.data() as DailyLog;
                } else {
                    logData = { ...createEmptyLog(date, currentShift), hiddenMachines: [...settingsHiddenMachinesRef.current] };
                }

                if (!logData.machines) logData.machines = {};
                for (let i = 1; i <= NUM_MACHINES; i++) {
                    const machineId = `machine_${i}`;
                    if (!logData.machines[machineId]) {
                        logData.machines[machineId] = { productId: '' };
                    }
                }

                // Upgrade old default (day of month) to new default (day of year)
                if (!logData.lote || logData.lote === String(format(date, 'd', { locale: es }))) {
                    logData.lote = String(getDayOfYear(date));
                }
                if (!logData.operador) logData.operador = '';
                if (logData.operadorGranel === undefined) logData.operadorGranel = '';
                if (!logData.supervisor) logData.supervisor = '';
                if (!logData.timeSlots) logData.timeSlots = {};
                if (!logData.shift) logData.shift = currentShift;

                setDailyLog(logData);
                setSaveStatus('saved');

            } catch (error) {
                console.error("Error fetching daily log:", error);
                toast({ title: 'Error', description: 'No se pudo cargar la bitácora.', variant: 'destructive' });
                setDailyLog(createEmptyLog(date, currentShift));
            }
            setLoading(false);
        };

        fetchLog();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, createEmptyLog, initialShift]);


    const fetchCatalogs = React.useCallback(async () => {
        try {
            const [typesSnap, causesSnap, operatorsSnap, bulkOperatorsSnap, supervisorsSnap, maintTypesSnap, categoriesSnap, settingsSnap] = await Promise.all([
                getDocs(query(collection(db, 'stopTypes'), orderBy('name'))),
                getDocs(query(collection(db, 'stopCauses'), orderBy('name'))),
                getDocs(query(collection(db, 'operators'), orderBy('name'))),
                getDocs(query(collection(db, 'bulkOperators'), orderBy('name'))),
                getDocs(query(collection(db, 'supervisors'), orderBy('name'))),
                getDocs(query(collection(db, 'maintenanceTypes'), orderBy('name'))),
                getDocs(query(collection(db, 'categories'), orderBy('name'))),
                getDoc(doc(db, 'appConfiguration', 'bitacora_settings'))
            ]);
            setStopTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StopType)));
            setStopCauses(causesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StopCause)));
            setOperators(operatorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Operator)));
            setBulkOperators(bulkOperatorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Operator)));
            setSupervisors(supervisorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supervisor)));
            setMaintenanceTypes(maintTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceType)));
            setAllCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryDefinition)));
            
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data() as BitacoraSettings;
                if (settings.weightHeaderType) setWeightHeaderType(settings.weightHeaderType);
                if (settings.qualityParams) setQualityParams(settings.qualityParams);
                if (settings.qualityWeights) setQualityWeights(settings.qualityWeights);
                if (settings.enfardadoraConnections) setEnfardadoraConnections(settings.enfardadoraConnections);
            }
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar los catálogos de configuración.', variant: 'destructive' });
        }
    }, [toast]);

    React.useEffect(() => {
        fetchCatalogs();
    }, [fetchCatalogs]);

    // Auto-save effect for all dates
    React.useEffect(() => {
        if (saveStatus === 'dirty') {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
            autoSaveTimerRef.current = setTimeout(() => {
                handleSaveLog(dailyLog, false);
            }, AUTOSAVE_DELAY);
        }

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [dailyLog, saveStatus, handleSaveLog]);


    const triggerChange = (updater: (prev: DailyLog) => DailyLog) => {
        setDailyLog(prev => {
            if (!prev) return null;
            setSaveStatus('dirty');
            return updater(prev);
        });
    };

    const handleHeaderChange = (field: keyof Omit<DailyLog, 'id' | 'machines' | 'timeSlots'>, value: string) => {
        const updater = (prevLog: DailyLog) => {
            const newLog = { ...prevLog, [field]: value };
            if (field === 'shift') {
                const newShift = value as 'day' | 'night';
                newLog.id = `${format(date, 'yyyy-MM-dd')}_${newShift}`;
            }
            return newLog;
        };

        if (field === 'shift') {
            const currentSaveStatus = saveStatus;
            const logToSave = dailyLog;

            const performShiftChange = () => {
                setDailyLog(prev => {
                    if (!prev) return null;
                    const newLog = updater(prev);
                    // This will trigger the main useEffect to fetch the new log data
                    setDate(d => new Date(d));
                    setDailyLog(newLog); // Optimistically set the shift
                    return newLog;
                });
            }

            if (currentSaveStatus === 'dirty') {
                handleSaveLog(logToSave, true).then(() => {
                    performShiftChange();
                });
            } else {
                performShiftChange();
            }

        } else {
            triggerChange(updater);
        }
    };

    const handleDateChange = (newDate: Date | undefined) => {
        if (newDate) {
            if (saveStatus === 'dirty') {
                if (!confirm("Tienes cambios sin guardar. ¿Estás seguro de que quieres cambiar de fecha? Se perderán los cambios.")) {
                    return;
                }
            }
            setDate(newDate);
        }
    };

    const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const dateValue = e.target.value;
        const parsedDate = parse(dateValue, 'yyyy-MM-dd', new Date());
        if (isValid(parsedDate)) {
            handleDateChange(parsedDate);
        }
    };


    const handleMachineProductChange = (machineId: string, productId: string) => {
        if (!dailyLog) return;
        const actualProductId = productId === 'no_production' ? '' : productId;
        const prevProductId = dailyLog.machines?.[machineId]?.productId || '';
        if (prevProductId === actualProductId) return;
        const now = new Date();
        const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${now.getMinutes() < 30 ? '00' : '30'}`;
        setSelectedChangeTime(defaultTime);
        setPendingProductChange({ machineId, productId: actualProductId });
    };

    const applyProductChange = (machineId: string, actualProductId: string, at: string) => {
        triggerChange(prev => {
            const newMachines = { ...prev.machines };
            const prevMachine = newMachines[machineId];
            const prevProductId = prevMachine?.productId || '';
            const changes = prevMachine?.productChanges ? [...prevMachine.productChanges] : [];
            changes.push({ from: prevProductId, to: actualProductId, at });
            newMachines[machineId] = {
                ...(prevMachine || { productId: '' }),
                productId: actualProductId,
                productChanges: changes,
            };
            return { ...prev, machines: newMachines };
        });
    };

    const handleConfirmProductChange = () => {
        if (!pendingProductChange) return;
        applyProductChange(pendingProductChange.machineId, pendingProductChange.productId, selectedChangeTime);
        setPendingProductChange(null);
    };

    const isChangeTimeValid = React.useMemo(() => {
        return isTimeInShift(selectedChangeTime, dailyLog?.shift || 'day');
    }, [selectedChangeTime, dailyLog?.shift]);

    const handleDeleteProductChange = (machineId: string, index: number) => {
        triggerChange(prev => {
            const prevMachine = prev.machines?.[machineId];
            if (!prevMachine) return prev;
            const changes = prevMachine.productChanges || [];
            if (index < 0 || index >= changes.length) return prev;
            const oldInitial = changes[0].from;
            const newChanges = changes.filter((_, i) => i !== index);
            if (newChanges.length > 0) {
                if (index === 0) {
                    newChanges[0] = { ...newChanges[0], from: oldInitial };
                } else {
                    const fixIdx = Math.min(index, newChanges.length - 1);
                    const prevTo = newChanges[fixIdx - 1]?.to ?? oldInitial;
                    newChanges[fixIdx] = { ...newChanges[fixIdx], from: prevTo };
                }
            }
            const newProductId = newChanges.length > 0 ? newChanges[newChanges.length - 1].to : oldInitial;
            return {
                ...prev,
                machines: {
                    ...prev.machines,
                    [machineId]: { ...prevMachine, productId: newProductId, productChanges: newChanges },
                },
            };
        });
    };

    const handleCellChange = (timeSlot: string, field: keyof TimeSlot, value: string | number, machineId?: string) => {
        triggerChange(prev => {
            const newTimeSlots = JSON.parse(JSON.stringify(prev.timeSlots));
            const valueToSet = value === '_' ? '' : value;

            if (!newTimeSlots[timeSlot]) {
                newTimeSlots[timeSlot] = {};
            }

            const timeSlotData = newTimeSlots[timeSlot] as TimeSlot;

            if (machineId) {
                if (!timeSlotData[machineId] || typeof timeSlotData[machineId] !== 'object') {
                    timeSlotData[machineId] = {};
                }
                const machineData = timeSlotData[machineId] as { [key: string]: any };
                machineData[field as string] = valueToSet;
                if ((field === 'obs' || field === 'observation' || field === 'novedades') && valueToSet === '') {
                    delete machineData.obs;
                    delete machineData.observation;
                    delete machineData.novedades;
                }

                // Auto-calculate primary weight and peso_funda for Enfardadoras based on their connected Tecnotoks
                if (machineId && machineId.startsWith('machine_') && parseInt(machineId.split('_')[1]) >= 1 && parseInt(machineId.split('_')[1]) <= 4) {
                    const currentFieldConfig = weightHeaderType[machineId] || 'weight';
                    if (field === currentFieldConfig || field === 'bundle_weight') {
                        Object.entries(enfardadoraConnections).forEach(([enfardadoraId, connectedTecnotoks]) => {
                            if (connectedTecnotoks.includes(machineId)) {
                                let sum = 0;
                                let count = 0;
                                connectedTecnotoks.forEach(tecnotokId => {
                                    const activeProductId = getActiveProductIdForMachine(tecnotokId, timeSlot);
                                    let isFardoProduct = false;
                                    if (activeProductId) {
                                        const product = prefetchedProducts.find(p => p.id === activeProductId);
                                        if (product && (product.primaryPackaging === 'fardo' || product.productName?.toLowerCase().includes('fardo') || product.productName?.toLowerCase().includes('(12 kg)'))) {
                                            isFardoProduct = true;
                                        }
                                    }
                                    if (isFardoProduct) {
                                        const tField = field === currentFieldConfig ? ((weightHeaderType[tecnotokId] || 'weight') as string) : 'bundle_weight';
                                        const val = Number(timeSlotData[tecnotokId]?.[tField]);
                                        if (!isNaN(val) && val > 0) {
                                            sum += val;
                                            count++;
                                        }
                                    }
                                });

                                const eField = field === currentFieldConfig ? ((weightHeaderType[enfardadoraId] || 'weight') as string) : 'peso_funda';
                                if (!timeSlotData[enfardadoraId]) timeSlotData[enfardadoraId] = {};

                                if (count > 0) {
                                    const decimalPlaces = field === 'bundle_weight' ? 1 : 2;
                                    const avg = Number((sum / count).toFixed(decimalPlaces)).toString();
                                    (timeSlotData[enfardadoraId] as any)[eField] = avg;
                                } else {
                                    delete (timeSlotData[enfardadoraId] as any)[eField];
                                }
                            }
                        });
                    }
                }
            } else {
                (timeSlotData as any)[field] = valueToSet;
            }

            return { ...prev, timeSlots: newTimeSlots };
        });
    };


    const handleStopSave = (stopData: StopData) => {
        if (!modalState) return;

        triggerChange(prev => {
            const { machineId } = modalState;
            const newTimeSlots = JSON.parse(JSON.stringify(prev.timeSlots));

            if (modalState.stopData && modalState.stopData.startTime !== stopData.startTime) {
                const oldStartTime = parse(modalState.stopData.startTime, 'HH:mm', new Date());
                const oldRegistrationSlotKey = format(setMinutes(oldStartTime, getMinutes(oldStartTime) < 30 ? 0 : 30), 'HH:mm');

                if (newTimeSlots[oldRegistrationSlotKey]?.[machineId]?.stops) {
                    const oldMachineSlot = newTimeSlots[oldRegistrationSlotKey][machineId];
                    if (oldMachineSlot.stops) {
                        oldMachineSlot.stops = oldMachineSlot.stops.filter((s: StopData) => s.id !== stopData.id);
                        if (oldMachineSlot.stops.length === 0) {
                            delete oldMachineSlot.stops;
                        }
                    }
                }
            }

            const newStartTime = parse(stopData.startTime, 'HH:mm', new Date());
            const newRegistrationSlotKey = format(setMinutes(newStartTime, getMinutes(newStartTime) < 30 ? 0 : 30), 'HH:mm');

            if (!newTimeSlots[newRegistrationSlotKey]) {
                newTimeSlots[newRegistrationSlotKey] = {};
            }
            if (!newTimeSlots[newRegistrationSlotKey][machineId]) {
                newTimeSlots[newRegistrationSlotKey][machineId] = {};
            }

            const newMachineSlot = newTimeSlots[newRegistrationSlotKey][machineId];
            if (!newMachineSlot.stops) {
                newMachineSlot.stops = [];
            }

            const existingStopIndex = newMachineSlot.stops.findIndex((s: StopData) => s.id === stopData.id);
            if (existingStopIndex > -1) {
                newMachineSlot.stops[existingStopIndex] = stopData;
            } else {
                newMachineSlot.stops.push(stopData);
            }

            return { ...prev, timeSlots: newTimeSlots };
        });

        toast({ title: 'Parada Registrada', description: `Se guardó la parada para la máquina ${modalState.machineId.split('_')[1]} de ${stopData.startTime} a ${stopData.endTime}.` });
        setModalState(null);
    };

    const handleDeleteStop = (timeSlot: string, machineId: string, stopId: string) => {
        const numId = machineId.replace(/\D/g, '');
        triggerChange(prev => {
            if (!prev) return prev;
            const newTimeSlots = JSON.parse(JSON.stringify(prev.timeSlots));

            Object.keys(newTimeSlots).forEach(slotKey => {
                const slotObj = newTimeSlots[slotKey];
                if (slotObj && typeof slotObj === 'object') {
                    Object.keys(slotObj).forEach(mKey => {
                        const isMatch = mKey === machineId || mKey === `m${numId}` || mKey === `machine${numId}` || mKey === numId;
                        if (isMatch && slotObj[mKey] && Array.isArray(slotObj[mKey].stops)) {
                            slotObj[mKey].stops = slotObj[mKey].stops.filter((stop: StopData) => stop.id !== stopId);
                            if (slotObj[mKey].stops.length === 0) {
                                delete slotObj[mKey].stops;
                            }
                        }
                    });
                }
            });

            return { ...prev, timeSlots: newTimeSlots };
        });
        toast({ title: "Parada Eliminada", description: "La parada ha sido eliminada.", variant: "destructive" });
    };

    const handleCopyStop = (stopData: StopData) => {
        setCopiedStop(stopData);
        toast({
            title: "Parada Copiada",
            description: `Se copió la parada "${stopData.reason}" (${stopData.duration} min). Haz clic derecho en otra casilla de observación para pegarla.`
        });
    };

    const handlePasteStop = (targetTime: string, targetMachineId: string) => {
        if (!copiedStop) {
            toast({ title: "Atención", description: "No hay ninguna parada copiada.", variant: "destructive" });
            return;
        }
        const targetStart = parse(targetTime, 'HH:mm', new Date());
        const duration = copiedStop.duration || 0;
        const targetEnd = addMinutes(targetStart, duration);
        const newStartTimeStr = format(targetStart, 'HH:mm');
        const newEndTimeStr = format(targetEnd, 'HH:mm');

        const newStopId = Math.random().toString(36).substr(2, 9);
        const newStop: StopData = {
            ...copiedStop,
            id: newStopId,
            startTime: newStartTimeStr,
            endTime: newEndTimeStr,
        };

        triggerChange(prev => {
            const newTimeSlots = JSON.parse(JSON.stringify(prev.timeSlots || {}));
            const newRegistrationSlotKey = format(setMinutes(targetStart, getMinutes(targetStart) < 30 ? 0 : 30), 'HH:mm');

            if (!newTimeSlots[newRegistrationSlotKey]) {
                newTimeSlots[newRegistrationSlotKey] = {};
            }
            if (!newTimeSlots[newRegistrationSlotKey][targetMachineId]) {
                newTimeSlots[newRegistrationSlotKey][targetMachineId] = {};
            }

            const newMachineSlot = newTimeSlots[newRegistrationSlotKey][targetMachineId];
            if (!newMachineSlot.stops) {
                newMachineSlot.stops = [];
            }
            newMachineSlot.stops.push(newStop);

            return { ...prev, timeSlots: newTimeSlots };
        });

        const machineNum = targetMachineId.replace(/\D/g, '');
        toast({
            title: "Parada Pegada",
            description: `Se pegó "${newStop.reason}" (${duration}m) en Máquina ${machineNum} a las ${newStartTimeStr}.`
        });
    };


    const handleConfigSave = async (
        type: 'stopType' | 'stopCause' | 'operator' | 'bulkOperator' | 'supervisor' | 'maintenanceType',
        data: any,
        action: 'add' | 'edit' | 'delete'
    ) => {
        const collectionNameMap = {
            stopType: 'stopTypes',
            stopCause: 'stopCauses',
            operator: 'operators',
            bulkOperator: 'bulkOperators',
            supervisor: 'supervisors',
            maintenanceType: 'maintenanceTypes',
        };
        const collectionName = collectionNameMap[type];

        try {
            if (action === 'add') {
                await addDoc(collection(db, collectionName), data);
                toast({ title: `Nuevo ${type} añadido` });
            } else if (action === 'edit') {
                const { id, ...updateData } = data;
                await updateDoc(doc(db, collectionName, id), updateData);
                toast({ title: `${type} actualizado` });
            } else if (action === 'delete') {
                await deleteDoc(doc(db, collectionName, data.id));
                toast({ title: `${type} eliminado` });
            }
            fetchCatalogs();
        } catch (e) {
            toast({ title: 'Error', description: `No se pudo actualizar el catálogo de ${type}.`, variant: 'destructive' });
        }
    };

    const handleImportComplete = () => {
        setImportWizardOpen(false);
        // Reload current log to reflect imported data
        const currentShift = dailyLog?.shift || initialShift || 'day';
        const logId = `${format(date, 'yyyy-MM-dd')}_${currentShift}`;
        const logDocRef = doc(db, 'dailyLogs', logId);

        getDoc(logDocRef).then((logDocSnap) => {
            if (logDocSnap.exists()) {
                setDailyLog(logDocSnap.data() as DailyLog);
            }
        });
        toast({ title: "Importación Finalizada", description: "Los datos han sido cargados." });
    }

    const allStops = React.useMemo(() => {
        if (!dailyLog) return [];
        const stops: (StopData & { machineId: string })[] = [];
        Object.values(dailyLog.timeSlots).forEach(slot => {
            if (!slot || typeof slot !== 'object') return;
            Object.entries(slot).forEach(([mId, machineData]) => {
                if (machineData && typeof machineData === 'object' && 'stops' in machineData && Array.isArray(machineData.stops)) {
                    let normId = mId;
                    if (!normId.startsWith('machine_')) {
                        const num = normId.replace(/\D/g, '');
                        if (num) normId = `machine_${num}`;
                    }
                    (machineData.stops as StopData[]).forEach(stop => {
                        stops.push({ ...stop, machineId: normId });
                    });
                }
            });
        });
        return stops;
    }, [dailyLog]);


    const presentationCell = (time: string, machineId: string) => {
        const productId = getActiveProductIdForMachine(machineId, time);
        const color = getProductColor(productId);
        return (
            <td
                title={productId ? getProductName(productId) : 'Sin producción'}
                className="p-0.5 min-w-[3rem] text-center align-middle"
            >
                <div className="flex items-center justify-center gap-1">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color || '#ccc' }}></span>
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color || '#ccc' }}></span>
                </div>
            </td>
        );
    };

    const observationCell = (time: string, machineId: string) => {
        const r = timeSlotsForTable.indexOf(time);
        const c = getColumnIndex('obs', machineId);
        const isSelected = selectedCells.has(r + '|' + c);

        const currentShift = dailyLog?.shift || 'day';
        const timeToMins = (tStr: string) => {
            const [h, m] = tStr.split(':').map(Number);
            let total = h * 60 + m;
            if (currentShift === 'night' && h < 18) {
                total += 24 * 60;
            }
            return total;
        };

        const cellStartMins = timeToMins(time);
        const cellEndMins = cellStartMins + 30;

        const stopsInCell = allStops.filter(stop => {
            if (stop.machineId !== machineId) return false;
            try {
                const stopStartMins = timeToMins(stop.startTime);
                let stopEndMins = timeToMins(stop.endTime);
                if (stopEndMins < stopStartMins) {
                    stopEndMins += 24 * 60;
                } else if (stopEndMins === stopStartMins) {
                    return stopStartMins >= cellStartMins && stopStartMins < cellEndMins;
                }
                return stopStartMins < cellEndMins && stopEndMins > cellStartMins;
            } catch (e) {
                return false;
            }
        });

        const machineData = dailyLog?.timeSlots[time]?.[machineId] as any;
        const textObs = machineData?.obs || machineData?.observation || machineData?.novedades || '';

        const handleCellClick = () => {
            if (isReadOnly) return;
            setModalState({ isOpen: true, machineId, timeSlot: time });
        };

        const onKeyDown = (e: React.KeyboardEvent) => {
            if (handleArrowNavigation(e, r, c)) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCellClick();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && (editingCellId !== `cell-input-${r}-${c}` || selectedCells.size > 1)) {
                e.preventDefault();
                handleDeleteCell(time, 'obs', machineId);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                if (selectedCells.size > 1) {
                    e.preventDefault();
                    handleCopyCell(textObs);
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                handlePasteCell(time, 'obs', machineId);
            }
        };

        const handleStopClick = (e: React.MouseEvent, stop: StopData) => {
            e.stopPropagation();
            if (isReadOnly) return;
            setModalState({ isOpen: true, machineId, timeSlot: stop.startTime, stopData: stop });
        };

        return (
            <td className={cn("p-0.5 relative select-none", isSelected && "ring-1 ring-blue-500 z-10")} onClick={handleCellClick} onMouseDown={(e) => handleCellMouseDown(r, c, e)} onMouseEnter={() => handleCellMouseEnter(r, c)} onFocus={() => { setHighlightedTime(time); setHighlightedColumnIndex(c); }}>
                <ContextMenu>
                    <ContextMenuTrigger asChild>
                        <div 
                            id={`cell-input-${r}-${c}`}
                            tabIndex={0}
                            onKeyDown={onKeyDown}
                            className={cn("w-full min-h-[2rem] flex flex-col items-center justify-start gap-1 cursor-pointer hover:bg-accent/50 rounded-sm p-0.5 relative group/cell outline-none focus-visible:ring-1 focus-visible:ring-inset", isSelected && "bg-blue-100/50 dark:bg-blue-900/30")}
                        >
                            {stopsInCell.map(stopData => {
                                const stopStartTime = parse(stopData.startTime, 'HH:mm', new Date());
                                const stopCauseConfig = stopCausesMap.get(stopData.reason);
                                const badgeColor = stopCauseConfig ? stopCauseConfig.color : (stopData.type === 'planned' ? '#3b82f6' : (stopData.type === 'observation' ? '#9ca3af' : '#ef4444'));
                                const textColor = getContrastTextColor(badgeColor);

                                return (
                                    <TooltipProvider key={stopData.id}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        'relative group/pill w-full flex items-center min-h-[1.5rem]',
                                                    )}
                                                    onClick={(e) => handleStopClick(e, stopData)}
                                                >
                                                    <Badge
                                                        style={{ backgroundColor: badgeColor, color: textColor }}
                                                        className={cn("truncate cursor-pointer w-full justify-center font-semibold text-xs border border-black/15 shadow-sm py-0.5 px-1.5")}
                                                    >
                                                        {`${stopData.reason} (${stopData.duration}m)`}
                                                    </Badge>
                                                    {!isReadOnly && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                handleDeleteStop(stopData.startTime, machineId, stopData.id);
                                                            }}
                                                            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-slate-900 text-white hover:bg-red-600 flex items-center justify-center text-xs shadow-sm opacity-0 group-hover/pill:opacity-100 transition-all z-20 cursor-pointer"
                                                            title="Eliminar parada"
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <div className="space-y-1 text-xs max-w-xs">
                                                    {stopData.type && <p><strong className="font-semibold">Tipo:</strong> {stopData.type === 'planned' ? 'Planificada' : (stopData.type === 'observation' ? 'Observación' : 'No Planificada')}</p>}
                                                    {stopData.maintenanceType && <p><strong className="font-semibold">Tipo Mtto:</strong> {stopData.maintenanceType}</p>}
                                                    {stopData.reason && <p><strong className="font-semibold">Motivo:</strong> {stopData.reason}</p>}
                                                    {stopData.cause && <p><strong className="font-semibold">Causa:</strong> {stopData.cause}</p>}
                                                    {stopData.startTime && <p><strong className="font-semibold">Horario:</strong> {stopData.startTime} - {stopData.endTime || stopData.startTime} ({stopData.duration || 0} min)</p>}
                                                    {stopData.solution && <p><strong className="font-semibold">Solución:</strong> {stopData.solution}</p>}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )
                            })}
                            {stopsInCell.length === 0 && textObs && (
                                <div className="relative group/obs w-full flex items-center justify-center">
                                    <Badge variant="outline" className="truncate w-full justify-center text-[10px] py-0 px-1 font-normal border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                                        {textObs}
                                    </Badge>
                                    {!isReadOnly && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleCellChange(time, 'obs', '', machineId);
                                            }}
                                            className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs opacity-0 group-hover/obs:opacity-100 hover:bg-red-600 transition-opacity z-20"
                                            title="Eliminar observación"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            )}
                            {stopsInCell.length === 0 && !textObs && (
                                <span className="text-muted-foreground text-xs opacity-0 group-hover/cell:opacity-100">Registrar...</span>
                            )}
                        </div>
                    </ContextMenuTrigger>
                    {!isReadOnly && (
                        <ContextMenuContent className="w-56">
                            {stopsInCell.length > 0 && (
                                <>
                                    {stopsInCell.map(s => (
                                        <ContextMenuItem key={s.id} onClick={(e) => { e.stopPropagation(); handleCopyStop(s); }}>
                                            Copiar parada: {s.reason} ({s.duration}m)
                                        </ContextMenuItem>
                                    ))}
                                </>
                            )}
                            {copiedStop && (
                                <ContextMenuItem onClick={(e) => { e.stopPropagation(); handlePasteStop(time, machineId); }}>
                                    Pegar parada: {copiedStop.reason} ({copiedStop.duration}m)
                                </ContextMenuItem>
                            )}
                            <ContextMenuItem onClick={(e) => { e.stopPropagation(); setModalState({ isOpen: true, machineId, timeSlot: time }); }}>
                                Registrar nueva parada
                            </ContextMenuItem>
                        </ContextMenuContent>
                    )}
                </ContextMenu>
            </td>
        );
    }


    const getCellValue = (r: number, c: number) => {
        const time = timeSlotsForTable[r];
        if (!time) return '';
        const colDef = CELL_COLS[c];
        if (!colDef) return '';
        if (colDef.type === 'obs' && colDef.machineId) {
            const timeSlotData = dailyLog?.timeSlots[time];
            const machineData = timeSlotData?.[colDef.machineId] as any;
            return machineData?.obs || machineData?.observation || machineData?.novedades || '';
        }
        if (colDef.type !== 'input' || !colDef.getField) return '';

        const field = colDef.getField();
        const timeSlotData = dailyLog?.timeSlots[time];
        if (!timeSlotData) return '';

        if (colDef.machineId) {
            const machineData = timeSlotData[colDef.machineId];
            return (machineData && typeof machineData === 'object' && field in machineData) ? String((machineData as any)[field] ?? '') : '';
        } else {
            return (typeof timeSlotData === 'object' && field in timeSlotData) ? String((timeSlotData as any)[field] ?? '') : '';
        }
    };

    const setCellValue = (r: number, c: number, value: string) => {
        const time = timeSlotsForTable[r];
        if (!time) return;
        const colDef = CELL_COLS[c];
        if (!colDef) return;
        if (colDef.type === 'obs' && colDef.machineId) {
            handleCellChange(time, 'obs', value, colDef.machineId);
            return;
        }
        if (colDef.type !== 'input' || !colDef.getField) return;
        handleCellChange(time, colDef.getField(), value, colDef.machineId);
    };

    const handleCopyCell = async (singleValue?: string) => {
        try {
            if (selectedCells.size > 1) {
                let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
                selectedCells.forEach(id => {
                    const [rStr, cStr] = id.split('|');
                    const r = parseInt(rStr, 10);
                    const c = parseInt(cStr, 10);
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                });

                let tsv = '';
                for (let r = minR; r <= maxR; r++) {
                    const rowVals = [];
                    for (let c = minC; c <= maxC; c++) {
                        if (selectedCells.has(r + '|' + c)) {
                            rowVals.push(getCellValue(r, c));
                        } else {
                            rowVals.push('');
                        }
                    }
                    tsv += rowVals.join('\t') + '\n';
                }
                await navigator.clipboard.writeText(tsv.trimEnd());
                toast({ title: 'Copiado', description: 'Celdas copiadas al portapapeles.', duration: 2000 });
            } else if (singleValue !== undefined) {
                await navigator.clipboard.writeText(singleValue);
                toast({ title: 'Copiado', description: 'Valor copiado al portapapeles.', duration: 2000 });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'No se pudo copiar el valor.', variant: 'destructive' });
        }
    };

    const handleCutCell = async (time: string, field: keyof TimeSlot, value: string, machineId?: string) => {
        await handleCopyCell(value);
        const r = timeSlotsForTable.indexOf(time);
        const c = getColumnIndex(field as string, machineId);
        handleDeleteCell(time, field, machineId);
    };

    const handleArrowNavigation = (e: React.KeyboardEvent, r: number, c: number) => {
        let shouldHandle = false;
        let targetR = r;
        let targetC = c;

        if (e.key === 'ArrowDown') {
            shouldHandle = true; targetR = r + 1;
        } else if (e.key === 'ArrowUp') {
            shouldHandle = true; targetR = r - 1;
        } else if (e.key === 'ArrowLeft') {
            shouldHandle = true; targetC = c - 1;
        } else if (e.key === 'ArrowRight') {
            shouldHandle = true; targetC = c + 1;
        }

        if (shouldHandle && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            const target = e.target as HTMLInputElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                if (editingCellId === target.id) {
                    shouldHandle = false;
                }
            }
        }

        if (shouldHandle) {
            setEditingCellId(null);
            const nextEl = document.getElementById(`cell-input-${targetR}-${targetC}`);
            if (nextEl) {
                e.preventDefault();
                let newStart = selectionStartCell;
                let newEnd = { r: targetR, c: targetC };
                
                if (e.shiftKey) {
                    if (!newStart || selectedCells.size <= 1) {
                        newStart = { r, c };
                        setSelectionStartCell(newStart);
                    }
                } else {
                    newStart = { r: targetR, c: targetC };
                    setSelectionStartCell(newStart);
                }
                
                setSelectionEndCell(newEnd);
                
                const newSet = new Set<string>();
                const r1 = Math.min(newStart!.r, newEnd.r);
                const r2 = Math.max(newStart!.r, newEnd.r);
                const c1 = Math.min(newStart!.c, newEnd.c);
                const c2 = Math.max(newStart!.c, newEnd.c);
                for (let rr = r1; rr <= r2; rr++) {
                    for (let cc = c1; cc <= c2; cc++) {
                        newSet.add(rr + '|' + cc);
                    }
                }
                setSelectedCells(newSet);
                
                // Update highlights
                setHighlightedTime(timeSlotsForTable[targetR]);
                setHighlightedColumnIndex(targetC);
                
                // Focus the next element
                nextEl.focus();
                
                return true;
            }
        }
        return false;
    };

    const handlePasteCell = async (time: string, field: keyof TimeSlot, machineId?: string, pastedText?: string) => {
        try {
            const text = pastedText !== undefined ? pastedText : await navigator.clipboard.readText();
            if (text === undefined || text === null || text === '') return;

            const rows = text.replace(/\r?\n$/, '').split(/\r?\n/);
            if (rows.length === 1 && rows[0].indexOf('\t') === -1 && selectedCells.size > 1) {
                const val = rows[0];
                selectedCells.forEach(id => {
                    const [rStr, cStr] = id.split('|');
                    setCellValue(parseInt(rStr, 10), parseInt(cStr, 10), val);
                });
            } else {
                const r = timeSlotsForTable.indexOf(time);
                const c = getColumnIndex(field as string, machineId);
                let currentR = r;
                rows.forEach(row => {
                    const cols = row.split('\t');
                    let currentC = c;
                    cols.forEach(val => {
                        setCellValue(currentR, currentC, val);
                        currentC++;
                    });
                    currentR++;
                });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'No se pudo pegar el valor.', variant: 'destructive' });
        }
    };

    const handleDeleteCell = (time: string, field: keyof TimeSlot, machineId?: string) => {
        if (selectedCells.size > 1) {
            selectedCells.forEach(id => {
                const [rStr, cStr] = id.split('|');
                setCellValue(parseInt(rStr, 10), parseInt(cStr, 10), '');
            });
        } else {
            handleCellChange(time, field, '', machineId);
        }
    };
    const inputCell = (time: string, field: keyof TimeSlot, machineId?: string) => {
        const isPercentageField = ['ns_fam', 'ns_1', 'ns_2'].includes(field as string);
        const r = timeSlotsForTable.indexOf(time);
        const c = getColumnIndex(field as string, machineId);
        const isSelected = selectedCells.has(r + '|' + c);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setEditingCellId(`cell-input-${r}-${c}`);
            const rawValue = e.target.value;
            let valueToSet: string | number = isPercentageField ? rawValue.replace(/%/g, '') : rawValue;

            if (field === 'bundle_weight' || field === 'weight' || field === 'peso_funda') {
                if (rawValue.trim() === '') {
                    valueToSet = '';
                } else {
                    const digits = rawValue.replace(/\D/g, '');
                    if (digits) {
                        const num = Number(digits);
                        if (field === 'peso_funda' || (field === 'bundle_weight' && (machineId === 'machine_1' || machineId === 'machine_2' || machineId === 'machine_3' || machineId === 'machine_4'))) {
                            valueToSet = (num / 10).toFixed(1);
                        } else if (field === 'weight' || (field === 'bundle_weight' && (machineId === 'machine_7' || machineId === 'machine_8'))) {
                            valueToSet = (num / 100).toFixed(2);
                        } else {
                            valueToSet = num.toString();
                        }
                    } else {
                        valueToSet = '';
                    }
                }
            }

            handleCellChange(time, field, valueToSet, machineId);
        };

        let value: string;
        const timeSlotData = dailyLog?.timeSlots[time];
        if (machineId) {
            const machineData = timeSlotData?.[machineId];
            value = (machineData && typeof machineData === 'object' && field in machineData) ? String((machineData as any)[field] ?? '') : '';
        } else {
            value = (timeSlotData && typeof timeSlotData === 'object' && field in timeSlotData) ? String((timeSlotData as any)[field] ?? '') : '';
        }

        const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setEditingCellId(null);
            
            let finalValue = e.target.value;
            if (isPercentageField) {
                finalValue = finalValue.replace(/%/g, '');
            }
            if (field === 'empaque_obs') {
                finalValue = formatEmpaqueObservation(finalValue);
            }
            
            // Si el valor del DOM es diferente al estado de React (por ejemplo, por una 
            // corrección ortográfica donde onChange no se disparó), actualizamos el estado.
            if (finalValue !== value) {
                handleCellChange(time, field, finalValue, machineId);
            }
        };

        const onKeyDown = (e: React.KeyboardEvent) => {
            if (handleArrowNavigation(e, r, c)) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                const nextEl = document.getElementById(`cell-input-${r + 1}-${c}`);
                if (nextEl) nextEl.focus();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && (editingCellId !== `cell-input-${r}-${c}` || selectedCells.size > 1)) {
                e.preventDefault();
                handleDeleteCell(time, field as keyof TimeSlot, machineId);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                if (selectedCells.size > 1) {
                    e.preventDefault();
                    handleCopyCell(String(value));
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                handlePasteCell(time, field as keyof TimeSlot, machineId);
            }
        };

        const cleanValue = isPercentageField && typeof value === 'string' ? value.replace(/%/g, '') : value;
        const displayValue = isPercentageField && cleanValue ? `${cleanValue}%` : value;

        let qualityColorClass = '';
        if (field === 'in_color') qualityColorClass = getColorForValue('grasshopper_color', value) || '';
        else if (field === 'in_turb') qualityColorClass = getColorForValue('grasshopper_turbiedad', value) || '';
        else if (field === 'out_fam_color') qualityColorClass = getColorForValue('familiar_color', value) || '';
        else if (field === 'out_fam_turb') qualityColorClass = getColorForValue('familiar_turbiedad', value) || '';
        else if (field === 'out_gra_color') qualityColorClass = getColorForValue('granel_color', value) || '';
        else if (field === 'out_gra_turb') qualityColorClass = getColorForValue('granel_turbiedad', value) || '';

        if ((field === 'bundle_weight' || field === 'weight' || field === 'peso_funda') && machineId) {
            const weightColorClass = getWeightCellColor(machineId, time, value, field as string);
            if (weightColorClass) qualityColorClass = cn(qualityColorClass, weightColorClass);
        }

        return (
            <td className={cn("p-0 relative select-none", qualityColorClass, isSelected && "ring-1 ring-blue-500 z-10")} onMouseDown={(e) => handleCellMouseDown(r, c, e)} onMouseEnter={() => handleCellMouseEnter(r, c)} onFocus={() => { setHighlightedTime(time); setHighlightedColumnIndex(c); }}>
                <ContextMenu>
                    <ContextMenuTrigger asChild>
                        <div className="h-full w-full">
                            {field === 'empaque_obs' ? (
                                <textarea
                                    id={`cell-input-${r}-${c}`}
                                    spellCheck={true}
                                    lang="es"
                                    ref={(node) => {
                                        if (node) {
                                            node.oninput = (e: Event) => {
                                                const target = e.target as HTMLTextAreaElement;
                                                if (target.value !== displayValue) {
                                                    handleChange({ target: { value: target.value } } as any);
                                                }
                                            };
                                        }
                                    }}
                                    className={cn("border-none rounded-none focus-visible:ring-1 focus-visible:ring-inset min-h-[32px] h-full resize-y text-xs w-full bg-transparent outline-none p-2", isSelected && "bg-blue-100/50 dark:bg-blue-900/30")}
                                    value={displayValue}
                                    onChange={handleChange as any}
                                    onBlur={handleBlur as any}
                                    onKeyDown={onKeyDown}
                                    onDoubleClick={(e) => setEditingCellId(e.currentTarget.id)}
                                    onContextMenu={(e) => {
                                        if (!e.currentTarget.readOnly) {
                                            e.stopPropagation();
                                        }
                                    }}
                                    onFocus={(e) => {
                                        if (!e.currentTarget.readOnly && editingCellId !== e.currentTarget.id) {
                                            e.currentTarget.select();
                                        }
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const pastedText = e.clipboardData.getData('text');
                                        handlePasteCell(time, field as keyof TimeSlot, machineId, pastedText);
                                    }}
                                    disabled={isReadOnly}
                                    readOnly={Boolean(displayValue) && editingCellId !== `cell-input-${r}-${c}`}
                                    rows={1}
                                    style={{ fieldSizing: 'content' } as any}
                                />
                            ) : (
                                <Input
                                    id={`cell-input-${r}-${c}`}
                                    type="text"
                                    inputMode={field === 'bundle_weight' || field === 'weight' || field === 'peso_funda' ? 'decimal' : undefined}
                                    className={cn("border-none rounded-none focus-visible:ring-1 focus-visible:ring-inset h-8 text-xs w-full bg-transparent outline-none", isSelected && "bg-blue-100/50 dark:bg-blue-900/30", (field === 'bundle_weight' || field === 'weight' || field === 'peso_funda') && "font-mono")}
                                    value={displayValue}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    onKeyDown={onKeyDown}
                                    onDoubleClick={(e) => setEditingCellId(e.currentTarget.id)}
                                    onFocus={(e) => {
                                        if (!e.currentTarget.readOnly && editingCellId !== e.currentTarget.id) {
                                            e.currentTarget.select();
                                        }
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        const pastedText = e.clipboardData.getData('text');
                                        handlePasteCell(time, field as keyof TimeSlot, machineId, pastedText);
                                    }}
                                    disabled={isReadOnly}
                                    readOnly={Boolean(displayValue) && editingCellId !== `cell-input-${r}-${c}`}
                                />
                            )}
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-40">
                        <ContextMenuItem onClick={() => handleCopyCell(String(value))}>Copiar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleCutCell(time, field, String(value), machineId)}>Cortar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handlePasteCell(time, field, machineId)}>Pegar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDeleteCell(time, field, machineId)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">Eliminar registro</ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            </td>
        );
    }

    const masaSelectCell = (time: string) => {
        const field = 'masa';
        const value = dailyLog?.timeSlots[time]?.[field] || '';
        const r = timeSlotsForTable.indexOf(time);
        const c = getColumnIndex(field);
        const isSelected = selectedCells.has(r + '|' + c);

        const handleValueChange = (newValue: string) => {
            handleCellChange(time, field, newValue);
        };

        const onKeyDownCapture = (e: React.KeyboardEvent) => {
            if (handleArrowNavigation(e, r, c)) {
                e.stopPropagation();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const nextEl = document.getElementById(`cell-input-${r + 1}-${c}`);
                if (nextEl) nextEl.focus();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteCell(time, field as keyof TimeSlot);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                if (selectedCells.size > 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopyCell(String(value));
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                e.stopPropagation();
                handlePasteCell(time, field as keyof TimeSlot);
            }
        };

        const availableNums = Array.from({ length: 8 }, (_, i) => String(i + 1)).filter(num => {
            if (num === String(value)) return true;
            return !usedMasaValues.has(num);
        });

        return (
            <td className={cn("p-0 relative select-none", isSelected && "ring-1 ring-blue-500 z-10")} onMouseDown={(e) => handleCellMouseDown(r, c, e)} onMouseEnter={() => handleCellMouseEnter(r, c)} onFocus={() => { setHighlightedTime(time); setHighlightedColumnIndex(c); }}>
                <ContextMenu>
                    <ContextMenuTrigger asChild>
                        <div className="h-full w-full" onKeyDownCapture={onKeyDownCapture}>
                            <Select value={value} onValueChange={handleValueChange} disabled={isReadOnly}>
                                <SelectTrigger id={`cell-input-${r}-${c}`} className={cn("border-none rounded-none focus:ring-1 focus:ring-inset h-8 text-xs w-full bg-transparent outline-none", isSelected && "bg-blue-100/50 dark:bg-blue-900/30")}>
                                    <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_">-</SelectItem>
                                    {availableNums.map(num => (
                                        <SelectItem key={num} value={num}>{num}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-40">
                        <ContextMenuItem onClick={() => handleCopyCell(value)}>Copiar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleCutCell(time, field as keyof TimeSlot, value)}>Cortar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handlePasteCell(time, field as keyof TimeSlot)}>Pegar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDeleteCell(time, field as keyof TimeSlot)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">Eliminar registro</ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            </td>
        );
    };

    const flujoSelectCell = (time: string) => {
        const field = 'flujo';
        const value = dailyLog?.timeSlots[time]?.[field] || '';
        const options = ["Familiar", "Familiar/Granel 2", "Granel 2", "Granel 1"];
        const r = timeSlotsForTable.indexOf(time);
        const c = getColumnIndex(field);
        const isSelected = selectedCells.has(r + '|' + c);

        const handleValueChange = (newValue: string) => {
            handleCellChange(time, field, newValue);
        };

        const onKeyDownCapture = (e: React.KeyboardEvent) => {
            if (handleArrowNavigation(e, r, c)) {
                e.stopPropagation();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const nextEl = document.getElementById(`cell-input-${r + 1}-${c}`);
                if (nextEl) nextEl.focus();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteCell(time, field as keyof TimeSlot);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                if (selectedCells.size > 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopyCell(String(value));
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                e.stopPropagation();
                handlePasteCell(time, field as keyof TimeSlot);
            }
        };

        return (
            <td className={cn("p-0 relative select-none", isSelected && "ring-1 ring-blue-500 z-10")} onMouseDown={(e) => handleCellMouseDown(r, c, e)} onMouseEnter={() => handleCellMouseEnter(r, c)} onFocus={() => { setHighlightedTime(time); setHighlightedColumnIndex(c); }}>
                <ContextMenu>
                    <ContextMenuTrigger asChild>
                        <div className="h-full w-full" onKeyDownCapture={onKeyDownCapture}>
                            <Select value={value} onValueChange={handleValueChange} disabled={isReadOnly}>
                                <SelectTrigger id={`cell-input-${r}-${c}`} className={cn("border-none rounded-none focus:ring-1 focus:ring-inset h-8 text-xs w-full bg-transparent outline-none", isSelected && "bg-blue-100/50 dark:bg-blue-900/30")}>
                                    <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_">-</SelectItem>
                                    {options.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-40">
                        <ContextMenuItem onClick={() => handleCopyCell(value)}>Copiar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleCutCell(time, field as keyof TimeSlot, value)}>Cortar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handlePasteCell(time, field as keyof TimeSlot)}>Pegar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDeleteCell(time, field as keyof TimeSlot)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">Eliminar registro</ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            </td>
        );
    };


    const humSelectCell = (time: string, field: 'in_hum' | 'out_fam_hum' | 'out_gra_hum') => {
        const r = timeSlotsForTable.indexOf(time);
        const c = getColumnIndex(field);
        const isSelected = selectedCells.has(r + '|' + c);

        const value = dailyLog?.timeSlots[time]?.[field] || '';
        const options = ["0.01", "0.02", "0.03", "0.04", "0.05", "0.06", "0.07", "0.08"];

        const handleValueChange = (newValue: string) => {
            handleCellChange(time, field, newValue);
        };

        const onKeyDownCapture = (e: React.KeyboardEvent) => {
            if (handleArrowNavigation(e, r, c)) {
                e.stopPropagation();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                const nextEl = document.getElementById(`cell-input-${r + 1}-${c}`);
                if (nextEl) nextEl.focus();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteCell(time, field as keyof TimeSlot);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                if (selectedCells.size > 1) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopyCell(String(value));
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                e.stopPropagation();
                handlePasteCell(time, field as keyof TimeSlot);
            }
        };

        let qualityColorClass = '';
        if (field === 'in_hum') qualityColorClass = getColorForValue('grasshopper_humedad', value) || '';
        else if (field === 'out_fam_hum') qualityColorClass = getColorForValue('familiar_humedad', value) || '';
        else if (field === 'out_gra_hum') qualityColorClass = getColorForValue('granel_humedad', value) || '';

        return (
            <td className={cn("p-0 relative select-none", qualityColorClass, isSelected && "ring-1 ring-blue-500 z-10")} onMouseDown={(e) => handleCellMouseDown(r, c, e)} onMouseEnter={() => handleCellMouseEnter(r, c)} onFocus={() => { setHighlightedTime(time); setHighlightedColumnIndex(c); }}>
                <ContextMenu>
                    <ContextMenuTrigger asChild>
                        <div className="h-full w-full" onKeyDownCapture={onKeyDownCapture}>
                            <Select value={value} onValueChange={handleValueChange} disabled={isReadOnly}>
                                <SelectTrigger id={`cell-input-${r}-${c}`} className={cn("border-none rounded-none focus:ring-1 focus:ring-inset h-8 text-xs w-full bg-transparent outline-none", isSelected && "bg-blue-100/50 dark:bg-blue-900/30")}>
                                    <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_">-</SelectItem>
                                    {options.map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-40">
                        <ContextMenuItem onClick={() => handleCopyCell(value)}>Copiar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleCutCell(time, field as keyof TimeSlot, value)}>Cortar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handlePasteCell(time, field as keyof TimeSlot)}>Pegar</ContextMenuItem>
                        <ContextMenuItem onClick={() => handleDeleteCell(time, field as keyof TimeSlot)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">Eliminar registro</ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            </td>
        );
    };

    return (
        <div className="absolute inset-0 bg-background flex flex-col text-foreground overflow-hidden">
            <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-b bg-card flex-shrink-0 z-30 min-w-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-sm md:text-lg font-bold text-foreground truncate max-w-[200px] sm:max-w-none ml-1">Bitácora de Producción</h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    {/* Desktop Buttons */}
                    <div className="hidden md:flex items-center gap-2">

                        {!isReadOnly && (
                            isCurrentDay ?
                                <SaveStatusIndicator status={saveStatus} onSave={() => handleSaveLog(dailyLog, true)} /> :
                                <Button onClick={() => handleSaveLog(dailyLog, true)}><Save className="mr-2 h-4 w-4" /> Guardar Cambios</Button>
                        )}

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild variant="ghost" size="icon">
                                        <Link href="/oee">
                                            <Activity className="h-4 w-4 text-indigo-600" />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Análisis de Paradas</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild variant="ghost" size="icon">
                                        <Link href={`/report?date=${date ? format(date, 'yyyy-MM-dd') : ''}&shift=${dailyLog?.shift ?? 'day'}`}>
                                            <FileText className="h-4 w-4 text-green-600" />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Reporte de Pesos</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => setConfigModalOpen(true)}>
                                        <Settings className="h-4 w-4 text-orange-600" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Configuración de Bitácora</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                    </div>
                    <div className="flex items-center gap-2">

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => setHistoryModalOpen(true)}>
                                        <History className="h-4 w-4 text-rose-600" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Historial de Bitácoras</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild variant="ghost" size="icon">
                                        <Link href="/log-table">
                                            <TableProperties className="h-4 w-4 text-amber-600" />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Tabla Consolidada de Datos</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    {/* Mobile Dropdown */}
                    <div className="md:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {!isReadOnly && <DropdownMenuItem onClick={() => handleSaveLog(dailyLog, true)}><Save className="mr-2 h-4 w-4" />Guardar</DropdownMenuItem>}

                                <DropdownMenuItem onClick={() => setHistoryModalOpen(true)} className="flex items-center"><History className="mr-2 h-4 w-4" />Historial</DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/log-table" className="flex items-center"><TableProperties className="mr-2 h-4 w-4" />Tabla Consolidada</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/oee" className="flex items-center"><Activity className="mr-2 h-4 w-4" />Análisis</Link></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setConfigModalOpen(true)}><Settings className="mr-2 h-4 w-4" />Configuración</DropdownMenuItem>

                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
            <main className="p-2 md:p-4 flex-1 flex flex-col overflow-hidden min-w-0">
                {loading ? <p className="text-muted-foreground animate-pulse">Cargando bitácora...</p> : dailyLog && (
                    <div className="flex flex-col h-full space-y-2 overflow-hidden min-w-0">
                        {/* Header */}
                        {(() => {
                            const hasTecnotok = ['machine_1', 'machine_2', 'machine_3', 'machine_4', 'machine_7', 'machine_8'].some(m => !hiddenMachines.includes(m));
                            const hasGranel = ['machine_5', 'machine_6'].some(m => !hiddenMachines.includes(m));
                            const cols = hasTecnotok && hasGranel ? 6 : 5;
                            return (
                                <div className={hasTecnotok && hasGranel ? 'grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-2 p-2 border rounded-lg bg-card flex-shrink-0 overflow-x-auto' : 'grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 p-2 border rounded-lg bg-card flex-shrink-0 overflow-x-auto'}>
                                    {/* Operador Tecnotok */}
                                    {hasTecnotok && (
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs whitespace-nowrap">Operador:</Label>
                                            <Select value={dailyLog.operador || '__none__'} onValueChange={val => handleHeaderChange('operador', val === '__none__' ? '' : val)} disabled={isReadOnly}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-- Sin Asignar --" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">-- Sin Asignar --</SelectItem>
                                                    {operators.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {/* Operador Granel */}
                                    {hasGranel && (
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs whitespace-nowrap">Op. Granel:</Label>
                                            <Select value={dailyLog.operadorGranel || '__none__'} onValueChange={val => handleHeaderChange('operadorGranel', val === '__none__' ? '' : val)} disabled={isReadOnly}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-- Sin Asignar --" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">-- Sin Asignar --</SelectItem>
                                                    {bulkOperators.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {/* Supervisor */}
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs whitespace-nowrap">Supervisor:</Label>
                                        <Select value={dailyLog.supervisor || '__none__'} onValueChange={val => handleHeaderChange('supervisor', val === '__none__' ? '' : val)} disabled={isReadOnly}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-- Sin Asignar --" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">-- Sin Asignar --</SelectItem>
                                                {supervisors.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {/* Lote */}
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs whitespace-nowrap">Lote:</Label>
                                        <Input value={dailyLog.lote} onChange={e => handleHeaderChange('lote', e.target.value)} disabled={isReadOnly} className="h-8 text-xs" />
                                    </div>
                                    {/* Turno */}
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs whitespace-nowrap">Turno:</Label>
                                        <Select value={dailyLog.shift} onValueChange={val => handleHeaderChange('shift', val as 'day' | 'night')} disabled={isReadOnly}>
                                            <SelectTrigger className="h-8 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="day">Día</SelectItem>
                                                <SelectItem value="night">Noche</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {/* Fecha */}
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs whitespace-nowrap">Fecha:</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full md:w-auto justify-start text-left font-normal h-8 text-xs", !date && "text-muted-foreground")}
                                                    disabled={isReadOnly}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {date ? (
                                                        `${format(date, 'dd/MM/yyyy')} - Semana ${format(date, 'I', { locale: es })} (${format(startOfWeek(date, { weekStartsOn: 1 }), 'MMM d', { locale: es })} - ${format(endOfWeek(date, { weekStartsOn: 1 }), 'MMM d', { locale: es })})`
                                                    ) : (
                                                        <span>Elige una fecha</span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={date}
                                                    onSelect={(d) => {
                                                        if (d) handleDateChange(d);
                                                    }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Log Table */}
                        <div className="border rounded-lg bg-card flex-1 overflow-auto relative min-w-0">
                            <table className="table-fixed min-w-full text-xs border-collapse" style={{ zoom: 0.9 }}>
                                <thead className='sticky top-0 z-50 bg-card shadow-sm'>
                                    <tr className="divide-x divide-border">
                                        <th className="p-2 align-middle sticky left-0 z-50 bg-muted border-r border-border" rowSpan={3}>
                                            <div className="w-16 font-semibold text-center">Hora</div>
                                        </th>
                                        {MACHINES_CONFIG.map(m => {
                                            if (hiddenMachines.includes(m.id)) return null;
                                            const isTecnotok = ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(m.id);
                                            const isEnfardadora = m.id === 'machine_7' || m.id === 'machine_8';
                                            const headerStyle = getMachineHeaderStyle(m.id);
                                            return (
                                                <th key={m.id} className={cn("p-1 font-bold text-center transition-colors", headerStyle.className)} style={headerStyle.style} colSpan={isTecnotok || isEnfardadora ? 4 : 3}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span>{m.name}</span>
                                                        <button
                                                            type="button"
                                                            title="Ocultar máquina"
                                                            disabled={isReadOnly}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleToggleMachineVisibility(m.id, false);
                                                            }}
                                                            className="inline-flex h-4 w-4 items-center justify-center rounded text-current opacity-50 transition-opacity hover:opacity-100 disabled:opacity-20"
                                                        >
                                                            <EyeOff className="h-3 w-3" />
                                                        </button>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="p-1 bg-green-200/90 dark:bg-green-900/60 text-green-950 dark:text-green-100 font-bold" colSpan={9} rowSpan={1}>INGRESO DE PRODUCTO</th>
                                        <th colSpan={6} className="p-1 bg-blue-200/90 dark:bg-blue-900/60 text-blue-950 dark:text-blue-100 font-bold" rowSpan={1}>SALIDA DE PRODUCTO TERMINADO</th>
                                        <th rowSpan={3} className="p-1 bg-purple-200/90 dark:bg-purple-900/60 text-purple-950 dark:text-purple-100 font-bold min-w-80">NOVEDADES DE EMPAQUE DE AZÚCAR</th>
                                    </tr>
                                    <tr className="divide-x divide-border">
                                        {MACHINES_CONFIG.map(m => {
                                            if (hiddenMachines.includes(m.id)) return null;
                                            const isTecnotok = ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(m.id);
                                            const isEnfardadora = m.id === 'machine_7' || m.id === 'machine_8';
                                            const isGranel = m.id === 'machine_5' || m.id === 'machine_6';
                                            const headerStyle = getMachineHeaderStyle(m.id);
                                            return (
                                                <th key={m.id} className={cn("p-1 align-middle transition-colors", headerStyle.className)} style={headerStyle.style} colSpan={isTecnotok || isEnfardadora ? 4 : 3}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Select value={dailyLog.machines[m.id]?.productId} onValueChange={(val) => handleMachineProductChange(m.id, val)}>
                                                            <SelectTrigger className="h-8 text-xs bg-card justify-center">
                                                                <div className="flex items-center gap-2 truncate">
                                                                    {(prefetchedProducts.find(p => p.id === dailyLog.machines[m.id]?.productId) || familiarProducts.find(p => p.id === dailyLog.machines[m.id]?.productId) || granelProducts.find(p => p.id === dailyLog.machines[m.id]?.productId)) && (
                                                                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: (prefetchedProducts.find(p => p.id === dailyLog.machines[m.id]?.productId) || familiarProducts.find(p => p.id === dailyLog.machines[m.id]?.productId) || granelProducts.find(p => p.id === dailyLog.machines[m.id]?.productId))?.color || '#ccc' }}></span>
                                                                    )}
                                                                    <SelectValue placeholder="-- Sin Producción --" />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="no_production">-- Sin Producción --</SelectItem>
                                                                {(isGranel ? granelProducts : familiarProducts).map(p => (
                                                                    <SelectItem key={p.id} value={p.id}>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || '#ccc' }}></span>
                                                                            <span>{p.productName}</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {(() => {
                                                            const changes = dailyLog.machines[m.id]?.productChanges || [];
                                                            if (changes.length === 0) return null;
                                                            return (
                                                                <Popover>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 rounded-md bg-amber-500 text-white animate-pulse shadow-[0_0_10px_2px_rgba(245,158,11,0.9)] hover:bg-amber-400" title="Hay cambios de presentación registrados">
                                                                            <History className="h-4 w-4" />
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-80" align="start">
                                                                        <div className="text-sm font-bold mb-2">Historial de presentaciones</div>
                                                                        <div className="space-y-2 max-h-64 overflow-auto text-xs">
                                                                            <div className="flex items-center justify-between gap-2 border-b pb-1">
                                                                                <span className="text-muted-foreground">Inicio de turno</span>
                                                                                <span className="font-medium text-right">{getProductName(changes[0]?.from)}</span>
                                                                            </div>
                                                                            {changes.map((c, idx) => (
                                                                                <div key={idx} className="flex items-center justify-between gap-2">
                                                                                    <span className="text-muted-foreground whitespace-nowrap">{c.at}</span>
                                                                                    <span className="font-medium text-right flex-1">{getProductName(c.to)}</span>
                                                                                    {!isReadOnly && (
                                                                                        <button
                                                                                            type="button"
                                                                                            title="Eliminar este cambio"
                                                                                            onClick={() => handleDeleteProductChange(m.id, idx)}
                                                                                            className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive"
                                                                                        >
                                                                                            <Trash2 className="h-3 w-3" />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            );
                                                        })()}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="p-1 bg-green-200/90 dark:bg-green-900/60 text-green-950 dark:text-green-100 font-bold" colSpan={9}>GRASSHOPPER</th>
                                        <th className="p-1 bg-blue-200/90 dark:bg-blue-900/60 text-blue-950 dark:text-blue-100 font-bold" colSpan={3}>Familiar</th>
                                        <th className="p-1 bg-blue-200/90 dark:bg-blue-900/60 text-blue-950 dark:text-blue-100 font-bold" colSpan={3}>Granel 50 KG</th>
                                    </tr>
                                    <tr className="divide-x divide-border text-muted-foreground font-normal">
                                        {MACHINES_CONFIG.map(m => {
                                            if (hiddenMachines.includes(m.id)) return null;
                                            const isTecnotok = ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(m.id);
                                            const isEnfardadora = m.id === 'machine_7' || m.id === 'machine_8';
                                            const headerStyle = getMachineHeaderStyle(m.id);
                                            
                                            const currentProductId = dailyLog.machines[m.id]?.productId;
                                            const currentProduct = prefetchedProducts.find(p => p.id === currentProductId) || familiarProducts.find(p => p.id === currentProductId) || granelProducts.find(p => p.id === currentProductId);
                                            const isFardoProduct = currentProduct?.primaryPackaging === 'fardo';

                                            return (
                                                <React.Fragment key={m.id}>
                                                    <th className={cn("p-1 font-semibold min-w-[3rem] transition-colors", headerStyle.className)} style={headerStyle.style} title="Presentación">Ps</th>
                                                    <th className={cn("p-1 font-semibold min-w-[9rem] transition-colors", headerStyle.className, highlightedColumnIndex === getColumnIndex('obs', m.id) && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")} style={headerStyle.style}>Eventos / Paradas</th>
                                                    <th className={cn("p-1 font-semibold min-w-[6rem] text-center align-middle transition-colors", headerStyle.className, highlightedColumnIndex === getColumnIndex(weightHeaderType[m.id] || 'weight', m.id) && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")} style={headerStyle.style}>
                                                        {isFardoProduct || isEnfardadora ? 'P/Fardo' : 'P/Saco'}
                                                    </th>
                                                    {(isTecnotok || isEnfardadora) && (
                                                        <th className={cn("p-1 font-semibold min-w-[6rem] transition-colors", headerStyle.className, highlightedColumnIndex === (isTecnotok ? getColumnIndex('bundle_weight', m.id) : getColumnIndex('peso_funda', m.id)) && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")} style={headerStyle.style}>Peso Funda (g)</th>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                        <th className={cn("p-1 font-semibold bg-emerald-200/90 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 min-w-[3rem]", highlightedColumnIndex === getColumnIndex('masa') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Masa</th>
                                        <th className={cn("p-1 font-semibold bg-emerald-200/90 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 min-w-[9rem]", highlightedColumnIndex === getColumnIndex('flujo') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Flujo</th>
                                        <th className={cn("p-1 font-semibold bg-emerald-200/90 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 min-w-[3.5rem]", highlightedColumnIndex === getColumnIndex('ns_fam') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>NS-FA</th>
                                        <th className={cn("p-1 font-semibold bg-emerald-200/90 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 min-w-[3.5rem]", highlightedColumnIndex === getColumnIndex('ns_1') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>NS% 1</th>
                                        <th className={cn("p-1 font-semibold bg-emerald-200/90 dark:bg-emerald-900/60 text-emerald-950 dark:text-emerald-100 min-w-[3.5rem]", highlightedColumnIndex === getColumnIndex('ns_2') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>NS% 2</th>
                                        <th className={cn("p-1 font-semibold bg-lime-200/90 dark:bg-lime-900/60 text-lime-950 dark:text-lime-100 min-w-[3.5rem]", highlightedColumnIndex === getColumnIndex('in_color') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Color</th>
                                        <th className={cn("p-1 font-semibold bg-lime-200/90 dark:bg-lime-900/60 text-lime-950 dark:text-lime-100 min-w-[3rem]", highlightedColumnIndex === getColumnIndex('in_hum') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Hum</th>
                                        <th className={cn("p-1 font-semibold bg-lime-200/90 dark:bg-lime-900/60 text-lime-950 dark:text-lime-100 min-w-[3rem]", highlightedColumnIndex === getColumnIndex('in_turb') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Turb</th>
                                        <th className={cn("p-1 font-semibold bg-lime-200/90 dark:bg-lime-900/60 text-lime-950 dark:text-lime-100 min-w-[4rem]", highlightedColumnIndex === getColumnIndex('in_cv') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>CV</th>
                                        <th className={cn("p-1 font-semibold bg-sky-200/90 dark:bg-sky-900/60 text-sky-950 dark:text-sky-100 min-w-[3.5rem]", highlightedColumnIndex === getColumnIndex('out_fam_color') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Color</th>
                                        <th className={cn("p-1 font-semibold bg-sky-200/90 dark:bg-sky-900/60 text-sky-950 dark:text-sky-100 min-w-[3rem]", highlightedColumnIndex === getColumnIndex('out_fam_hum') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Hum</th>
                                        <th className={cn("p-1 font-semibold bg-sky-200/90 dark:bg-sky-900/60 text-sky-950 dark:text-sky-100 min-w-[3rem]", highlightedColumnIndex === getColumnIndex('out_fam_turb') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Turb</th>
                                        <th className={cn("p-1 font-semibold bg-teal-200/90 dark:bg-teal-900/60 text-teal-950 dark:text-teal-100 min-w-[3.5rem]", highlightedColumnIndex === getColumnIndex('out_gra_color') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Color</th>
                                        <th className={cn("p-1 font-semibold bg-teal-200/90 dark:bg-teal-900/60 text-teal-950 dark:text-teal-100 min-w-[3rem]", highlightedColumnIndex === getColumnIndex('out_gra_hum') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Hum</th>
                                        <th className={cn("p-1 font-semibold bg-teal-200/90 dark:bg-teal-900/60 text-teal-950 dark:text-teal-100 min-w-[3rem]", highlightedColumnIndex === getColumnIndex('out_gra_turb') && "shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.8)]")}>Turb</th>
                                    </tr>
                                </thead>
                                <tbody
                                    className="divide-y divide-border"
                                    onMouseLeave={() => {
                                        setHighlightedTime(null);
                                        setHighlightedColumnIndex(null);
                                    }}
                                >
                                    {timeSlotsForTable.map((time) => (
                                        <tr
                                            key={time}
                                            className="divide-x divide-border transition-colors"
                                            onMouseEnter={() => setHighlightedTime(time)}
                                        >
                                            <td className={cn(
                                                "p-1 w-24 text-center font-mono sticky left-0 z-40 transition-colors border-r border-border font-bold",
                                                highlightedTime === time
                                                    ? "bg-blue-200 text-blue-950 dark:bg-blue-900 dark:text-blue-100 border-l-4 border-l-blue-600 shadow-sm"
                                                    : "bg-background"
                                            )}>{time}</td>
                                            {MACHINES_CONFIG.map((m) => {
                                                if (hiddenMachines.includes(m.id)) return null;
                                                const isTecnotok = ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(m.id);
                                                const isEnfardadora = m.id === 'machine_7' || m.id === 'machine_8';
                                                return (
                                                    <React.Fragment key={m.id}>
                                                        {presentationCell(time, m.id)}
                                                        {observationCell(time, m.id)}
                                                        {inputCell(time, (weightHeaderType[m.id] || 'weight') as keyof TimeSlot, m.id)}
                                                        {isTecnotok && inputCell(time, 'bundle_weight', m.id)}
                                                        {isEnfardadora && inputCell(time, 'peso_funda', m.id)}
                                                    </React.Fragment>
                                                )
                                            })}
                                            {masaSelectCell(time)}
                                            {flujoSelectCell(time)}
                                            {inputCell(time, 'ns_fam')}
                                            {inputCell(time, 'ns_1')}
                                            {inputCell(time, 'ns_2')}
                                            {inputCell(time, 'in_color')}
                                            {humSelectCell(time, 'in_hum')}
                                            {inputCell(time, 'in_turb')}
                                            {inputCell(time, 'in_cv')}
                                            {inputCell(time, 'out_fam_color')}
                                            {humSelectCell(time, 'out_fam_hum')}
                                            {inputCell(time, 'out_fam_turb')}
                                            {inputCell(time, 'out_gra_color')}
                                            {humSelectCell(time, 'out_gra_hum')}
                                            {inputCell(time, 'out_gra_turb')}
                                            {inputCell(time, 'empaque_obs')}
                                        </tr>
                                    ))}

                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {modalState?.isOpen && dailyLog && (
                <StopRegistrationModal
                    isOpen={modalState.isOpen}
                    onClose={() => setModalState(null)}
                    onSave={handleStopSave}
                    machineId={modalState.machineId}
                    startTime={modalState.timeSlot}
                    stopData={modalState.stopData}
                    stopCauses={stopCauses}
                    maintenanceTypes={maintenanceTypes}
                    shift={dailyLog.shift}
                />
            )}
            {configModalOpen && (
                <ConfigurationModal
                    isOpen={configModalOpen}
                    onClose={() => {
                        setConfigModalOpen(false);
                        fetchCatalogs();
                    }}
                    stopTypes={stopTypes}
                    stopCauses={stopCauses}
                    operators={operators}
                    bulkOperators={bulkOperators}
                    supervisors={supervisors}
                    maintenanceTypes={maintenanceTypes}
                    hiddenMachines={hiddenMachines}
                    onToggleMachineVisibility={handleToggleMachineVisibility}
                    onConfigSave={handleConfigSave}
                    products={prefetchedProducts}
                />
            )}
            {importWizardOpen && (
                <LogImportWizard
                    isOpen={importWizardOpen}
                    onClose={() => setImportWizardOpen(false)}
                    onImportComplete={handleImportComplete}
                    stopCauses={stopCauses}
                    operators={operators}
                    supervisors={supervisors}
                />
            )}

            {historyModalOpen && (
                <LogHistoryModal
                    open={historyModalOpen}
                    onOpenChange={setHistoryModalOpen}
                    onLoadLog={(logDate, logShift, mode) => {
                        window.location.href = `/stops?date=${logDate}&shift=${logShift}&mode=${mode}`;
                    }}
                />
            )}
            {pendingProductChange && (
                <Dialog open={pendingProductChange !== null} onOpenChange={(open) => { if (!open) setPendingProductChange(null); }}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Cambio de presentación</DialogTitle>
                            <DialogDescription>
                                Selecciona la hora en que inició la nueva presentación en {MACHINES_CONFIG.find(m => m.id === pendingProductChange.machineId)?.name || 'la máquina'} (turno {dailyLog?.shift === 'night' ? 'noche' : 'día'}).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Franja del turno (selección rápida)</Label>
                            <Select
                                value={timeSlotsForTable.includes(selectedChangeTime) ? selectedChangeTime : undefined}
                                onValueChange={setSelectedChangeTime}
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Selecciona la franja del turno" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                    {timeSlotsForTable.map(slot => (
                                        <SelectItem key={slot} value={slot}>{slot} hrs</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="pt-1">
                                <Label className="text-xs text-muted-foreground">Hora exacta (editable)</Label>
                                <Input
                                    type="time"
                                    step="60"
                                    value={selectedChangeTime}
                                    onChange={(e) => setSelectedChangeTime(e.target.value)}
                                    className="h-9"
                                />
                            </div>
                            {!isChangeTimeValid && (
                                <p className="text-xs text-destructive">
                                    La hora debe estar dentro del turno ({dailyLog?.shift === 'night' 
                                      ? `${String(SHIFT_CONFIG.night.startHour).padStart(2, '0')}:00 – ${String(SHIFT_CONFIG.night.endHour - 1).padStart(2, '0')}:59` 
                                      : `${String(SHIFT_CONFIG.day.startHour).padStart(2, '0')}:00 – ${String(SHIFT_CONFIG.day.endHour - 1).padStart(2, '0')}:59`}).
                                </p>
                            )}
                        </div>
                        <DialogFooter className="gap-2">
                            <DialogClose asChild>
                                <Button variant="outline">Cancelar</Button>
                            </DialogClose>
                            <Button onClick={handleConfirmProductChange} disabled={!isChangeTimeValid}>Confirmar cambio</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

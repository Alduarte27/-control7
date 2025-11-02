'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, HardHat, Lock, Unlock, Settings, X, PlusCircle, Calendar as CalendarIcon, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition, DailyLog, MachineLog, TimeSlot, StopData, StopCause, Operator, Supervisor, MaintenanceType } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, getDocs, addDoc, deleteDoc, where } from 'firebase/firestore';
import { format, getDayOfYear, parse, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import StopRegistrationModal from './stop-registration-modal';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from '@/components/ui/alert-dialog';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import KpiCard from './kpi-card';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { DateRange } from 'react-day-picker';


const NUM_MACHINES = 3;
const TIME_SLOTS_PER_HOUR = 2; // 30-minute intervals

// This function generates the display slots for the table based on the selected shift
const generateDisplayTimeSlots = (shift: 'day' | 'night') => {
    const slots = [];
    if (shift === 'day') {
        const startHour = 7;
        for (let i = 0; i < 24; i++) { // 12 hours * 2 slots/hr
            const hour = startHour + Math.floor(i / TIME_SLOTS_PER_HOUR);
            const minute = (i % TIME_SLOTS_PER_HOUR) * (60 / TIME_SLOTS_PER_HOUR);
            if (hour < 19) {
              slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
            }
        }
    } else { // night shift
        const startHour = 19;
        for (let i = 0; i < 24; i++) { // 12 hours * 2 slots/hr
            const hour = (startHour + Math.floor(i / TIME_SLOTS_PER_HOUR)) % 24;
            const minute = (i % TIME_SLOTS_PER_HOUR) * (60 / TIME_SLOTS_PER_HOUR);
             if (hour >= 19 || hour < 7) {
                slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
            }
        }
    }
    return slots;
};

// --- Configuration Modal ---
function ConfigurationModal({
    isOpen,
    onClose,
    stopCauses,
    operators,
    supervisors,
    maintenanceTypes,
    onConfigSave,
}: {
    isOpen: boolean;
    onClose: () => void;
    stopCauses: StopCause[];
    operators: Operator[];
    supervisors: Supervisor[];
    maintenanceTypes: MaintenanceType[];
    onConfigSave: (type: 'stopCause' | 'operator' | 'supervisor' | 'maintenanceType', data: any, action: 'add' | 'delete') => Promise<void>;
}) {
    const [newCauseName, setNewCauseName] = React.useState('');
    const [newCauseColor, setNewCauseColor] = React.useState('#ef4444');
    const [newCauseType, setNewCauseType] = React.useState<'planned' | 'unplanned'>('planned');
    const [newOperatorName, setNewOperatorName] = React.useState('');
    const [newSupervisorName, setNewSupervisorName] = React.useState('');
    const [newMaintTypeName, setNewMaintTypeName] = React.useState('');
    const { toast } = useToast();

    const handleAdd = async (type: 'stopCause' | 'operator' | 'supervisor' | 'maintenanceType') => {
        let data: any;
        let name: string = '';
        switch (type) {
            case 'stopCause':
                name = newCauseName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del motivo es obligatorio.', variant: 'destructive'});
                    return;
                }
                data = { name, color: newCauseColor, type: newCauseType };
                await onConfigSave(type, data, 'add');
                setNewCauseName('');
                break;
            case 'operator':
                name = newOperatorName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del operador es obligatorio.', variant: 'destructive'});
                    return;
                }
                data = { name };
                await onConfigSave(type, data, 'add');
                setNewOperatorName('');
                break;
            case 'supervisor':
                name = newSupervisorName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del supervisor es obligatorio.', variant: 'destructive'});
                    return;
                }
                data = { name };
                await onConfigSave(type, data, 'add');
                setNewSupervisorName('');
                break;
            case 'maintenanceType':
                name = newMaintTypeName.trim();
                if (!name) {
                    toast({ title: 'Error', description: 'El nombre del tipo de mtto. es obligatorio.', variant: 'destructive'});
                    return;
                }
                data = { name };
                await onConfigSave(type, data, 'add');
                setNewMaintTypeName('');
                break;
        }
    };
    
    const handleDelete = async (type: 'stopCause' | 'operator' | 'supervisor' | 'maintenanceType', id: string) => {
        await onConfigSave(type, { id }, 'delete');
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Configuración de la Bitácora</DialogTitle>
                </DialogHeader>
                <div className="py-4 max-h-[70vh] overflow-y-auto">
                     <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Stop Causes */}
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">Motivos de Parada</h3>
                            <div className="space-y-2">
                                <div className="flex-grow space-y-1.5">
                                    <Label htmlFor="new-cause-name">Nombre del Motivo</Label>
                                    <Input id="new-cause-name" value={newCauseName} onChange={e => setNewCauseName(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="new-cause-color">Color</Label>
                                        <Input id="new-cause-color" type="color" value={newCauseColor} onChange={e => setNewCauseColor(e.target.value)} className="p-1 h-10"/>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="new-cause-type">Tipo</Label>
                                        <Select value={newCauseType} onValueChange={(v: any) => setNewCauseType(v)}>
                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="planned">Planificada</SelectItem>
                                                <SelectItem value="unplanned">No Planificada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <Button onClick={() => handleAdd('stopCause')} className="w-full">
                                <PlusCircle className="mr-2" /> Añadir Motivo
                            </Button>
                            <Separator />
                            <ul className="space-y-2 max-h-60 overflow-y-auto">
                                {stopCauses.map(cause => (
                                    <li key={cause.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted/50 rounded-md">
                                        <span className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cause.color }} />
                                            {cause.name}
                                            <Badge variant={cause.type === 'planned' ? 'secondary' : 'destructive'} className='text-xs'>{cause.type === 'planned' ? 'P' : 'NP'}</Badge>
                                        </span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete('stopCause', cause.id)}>
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {/* Maintenance Types */}
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">Tipos de Mantenimiento</h3>
                            <div className="flex items-end gap-2">
                                <div className="flex-grow space-y-1.5">
                                    <Label htmlFor="new-maint-name">Nombre</Label>
                                    <Input id="new-maint-name" value={newMaintTypeName} onChange={e => setNewMaintTypeName(e.target.value)} />
                                </div>
                                <Button onClick={() => handleAdd('maintenanceType')}><PlusCircle /></Button>
                            </div>
                            <Separator />
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {maintenanceTypes.map(mt => (
                                    <li key={mt.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted/50 rounded-md">
                                        <span>{mt.name}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete('maintenanceType', mt.id)}>
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {/* Operators */}
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">Operadores</h3>
                            <div className="flex items-end gap-2">
                                <div className="flex-grow space-y-1.5">
                                    <Label htmlFor="new-op-name">Nombre</Label>
                                    <Input id="new-op-name" value={newOperatorName} onChange={e => setNewOperatorName(e.target.value)} />
                                </div>
                                <Button onClick={() => handleAdd('operator')}><PlusCircle /></Button>
                            </div>
                            <Separator />
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {operators.map(op => (
                                    <li key={op.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted/50 rounded-md">
                                        <span>{op.name}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete('operator', op.id)}>
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                         {/* Supervisors */}
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg">Supervisores</h3>
                            <div className="flex items-end gap-2">
                                <div className="flex-grow space-y-1.5">
                                    <Label htmlFor="new-sup-name">Nombre</Label>
                                    <Input id="new-sup-name" value={newSupervisorName} onChange={e => setNewSupervisorName(e.target.value)} />
                                </div>
                                <Button onClick={() => handleAdd('supervisor')}><PlusCircle /></Button>
                            </div>
                            <Separator />
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {supervisors.map(sup => (
                                    <li key={sup.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted/50 rounded-md">
                                        <span>{sup.name}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete('supervisor', sup.id)}>
                                            <X className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cerrar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface AggregatedStopData {
    name: string;
    totalMinutes: number;
    color: string;
}

export default function StopsClient({ prefetchedProducts }: { prefetchedProducts: ProductDefinition[]}) {
    const [dailyLog, setDailyLog] = React.useState<DailyLog | null>(null);
    const [stopCauses, setStopCauses] = React.useState<StopCause[]>([]);
    const [operators, setOperators] = React.useState<Operator[]>([]);
    const [supervisors, setSupervisors] = React.useState<Supervisor[]>([]);
    const [maintenanceTypes, setMaintenanceTypes] = React.useState<MaintenanceType[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [date, setDate] = React.useState<Date>(new Date());
    const [modalState, setModalState] = React.useState<{isOpen: boolean; machineId: string; timeSlot: string; stopData?: StopData} | null>(null);
    const [configModalOpen, setConfigModalOpen] = React.useState(false);
    const { toast } = useToast();
    const [isAdminMode, setIsAdminMode] = React.useState(false);
    const isInitialMount = React.useRef(true);
    
    // OEE State
    const [oeeDateRange, setOeeDateRange] = React.useState<DateRange | undefined>({ from: addDays(new Date(), -7), to: new Date() });
    const [oeeLoading, setOeeLoading] = React.useState(false);
    const [machineStops, setMachineStops] = React.useState<{ [machineId: string]: number }>({});
    const [stopsByReason, setStopsByReason] = React.useState<AggregatedStopData[]>([]);
    
    const timeSlotsForTable = React.useMemo(() => generateDisplayTimeSlots(dailyLog?.shift || 'day'), [dailyLog?.shift]);

    const stopCausesMap = React.useMemo(() => {
        return new Map(stopCauses.map(cause => [cause.name, cause]));
    }, [stopCauses]);

    const createEmptyLog = React.useCallback((logDate: Date): DailyLog => {
        const machineEntries: { [machineId: string]: MachineLog } = {};
        for (let i = 1; i <= NUM_MACHINES; i++) {
            machineEntries[`machine_${i}`] = {
                productId: prefetchedProducts[0]?.id || '',
            };
        }
        return {
            id: format(logDate, 'yyyy-MM-dd'),
            operador: '',
            supervisor: '',
            lote: String(getDayOfYear(logDate)),
            shift: 'day',
            machines: machineEntries,
            timeSlots: {}
        };
    }, [prefetchedProducts]);

    const handleSaveLog = React.useCallback(async (logToSave: DailyLog, showToast = false) => {
        if (!logToSave) return;
        try {
            const docRef = doc(db, 'dailyLogs', logToSave.id);
            await setDoc(docRef, logToSave, { merge: true });
            if (showToast) {
                toast({ title: 'Progreso Guardado', description: `Se guardaron los cambios para el día ${logToSave.id}.` });
            }
        } catch (error) {
            console.error("Error saving daily log:", error);
            if (showToast) {
                toast({ title: 'Error', description: 'No se pudo guardar la bitácora.', variant: 'destructive' });
            }
        }
    }, [toast]);
    
    React.useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (!dailyLog) return;
        
        const handler = setTimeout(() => {
            handleSaveLog(dailyLog, true);
        }, 2000);

        return () => {
            clearTimeout(handler);
        };
    }, [dailyLog, handleSaveLog]);


    const fetchCatalogs = React.useCallback(async () => {
         try {
            const [causesSnap, operatorsSnap, supervisorsSnap, maintTypesSnap] = await Promise.all([
                getDocs(query(collection(db, 'stopCauses'), orderBy('name'))),
                getDocs(query(collection(db, 'operators'), orderBy('name'))),
                getDocs(query(collection(db, 'supervisors'), orderBy('name'))),
                getDocs(query(collection(db, 'maintenanceTypes'), orderBy('name'))),
            ]);
            setStopCauses(causesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StopCause)));
            setOperators(operatorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Operator)));
            setSupervisors(supervisorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supervisor)));
            setMaintenanceTypes(maintTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceType)));
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar los catálogos de configuración.', variant: 'destructive'});
        }
    }, [toast]);

    React.useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            isInitialMount.current = true; 
            const logId = format(date, 'yyyy-MM-dd');
            try {
                const logDocSnap = await getDoc(doc(db, 'dailyLogs', logId));

                if (logDocSnap.exists()) {
                    const data = logDocSnap.data() as DailyLog;
                    if (!data.machines) data.machines = createEmptyLog(date).machines;
                    if (!data.lote) data.lote = String(getDayOfYear(date));
                    if(!data.operador) data.operador = '';
                    if(!data.supervisor) data.supervisor = '';
                    setDailyLog(data);
                } else {
                    setDailyLog(createEmptyLog(date));
                }
            } catch (error) {
                console.error("Error fetching daily log:", error);
                toast({ title: 'Error', description: 'No se pudo cargar la bitácora.', variant: 'destructive' });
                setDailyLog(createEmptyLog(date));
            }
            setLoading(false);
        };

        fetchLog();
    }, [date, createEmptyLog, toast]);

    React.useEffect(() => {
        fetchCatalogs();
    }, [fetchCatalogs]);

    const handleFetchOeeData = React.useCallback(async () => {
        if (!oeeDateRange?.from || !oeeDateRange?.to) {
            return;
        }

        setOeeLoading(true);
        const start = format(oeeDateRange.from, 'yyyy-MM-dd');
        const end = format(oeeDateRange.to, 'yyyy-MM-dd');

        const aggregatedMachineStops: { [machineId: string]: number } = {};
        const aggregatedStopsByReason: { [reason: string]: number } = {};

        try {
            const logsQuery = query(
                collection(db, 'dailyLogs'),
                where('id', '>=', start),
                where('id', '<=', end)
            );
            const querySnapshot = await getDocs(logsQuery);

            querySnapshot.forEach(doc => {
                const log = doc.data() as DailyLog;
                Object.values(log.timeSlots).forEach(slot => {
                    Object.entries(slot).forEach(([key, value]) => {
                        if (key.startsWith('machine_') && typeof value === 'object' && value && 'stops' in value && Array.isArray(value.stops)) {
                            const machineId = key;
                            (value.stops as StopData[]).forEach(stop => {
                                if (!aggregatedMachineStops[machineId]) {
                                    aggregatedMachineStops[machineId] = 0;
                                }
                                aggregatedMachineStops[machineId] += stop.duration;

                                if (!aggregatedStopsByReason[stop.reason]) {
                                    aggregatedStopsByReason[stop.reason] = 0;
                                }
                                aggregatedStopsByReason[stop.reason] += stop.duration;
                            });
                        }
                    });
                });
            });

            setMachineStops(aggregatedMachineStops);

            const reasonData = Object.entries(aggregatedStopsByReason).map(([reason, minutes]) => ({
                name: reason,
                totalMinutes: minutes,
                color: stopCausesMap.get(reason)?.color || '#8884d8'
            })).sort((a,b) => b.totalMinutes - a.totalMinutes);

            setStopsByReason(reasonData);

        } catch (error) {
            console.error("Error fetching OEE data:", error);
        } finally {
            setOeeLoading(false);
        }
    }, [oeeDateRange, stopCausesMap]);


    const handleHeaderChange = (field: keyof Omit<DailyLog, 'id' | 'machines' | 'timeSlots'>, value: string) => {
        if (!dailyLog) return;
        setDailyLog(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleDateChange = (newDate: Date | undefined) => {
        if (newDate) {
            setDate(newDate);
        }
    };

    const handleMachineProductChange = (machineId: string, productId: string) => {
        if (!dailyLog) return;
        setDailyLog(prev => {
            if (!prev) return null;
            const newMachines = { ...prev.machines };
            if (!newMachines[machineId]) newMachines[machineId] = { productId: '' };
            newMachines[machineId].productId = productId;
            return { ...prev, machines: newMachines };
        });
    };

    const handleCellChange = (timeSlot: string, field: keyof TimeSlot, value: string) => {
       if (!dailyLog) return;
        setDailyLog(prev => {
            if (!prev) return null;
            const newTimeSlots = { ...prev.timeSlots };
            if (!newTimeSlots[timeSlot]) {
                newTimeSlots[timeSlot] = {};
            }
            newTimeSlots[timeSlot][field] = value;
            return { ...prev, timeSlots: newTimeSlots };
        });
    };

    const handleStopSave = (stopData: StopData) => {
        if (!dailyLog || !modalState) return;

        setDailyLog(prev => {
            if (!prev) return null;
            const { machineId } = modalState;
            const newTimeSlots = JSON.parse(JSON.stringify(prev.timeSlots));
            
            const registrationSlot = stopData.startTime.substring(0, 5);
            
            if (!newTimeSlots[registrationSlot]) newTimeSlots[registrationSlot] = {};
            
            const machineSlot = (newTimeSlots[registrationSlot][machineId] || {}) as { stops?: StopData[], weight?: string };
            if (!machineSlot.stops) {
                machineSlot.stops = [];
            }
            
            const existingStopIndex = machineSlot.stops.findIndex(s => s.id === stopData.id);
            if (existingStopIndex > -1) {
                machineSlot.stops[existingStopIndex] = stopData;
            } else {
                machineSlot.stops.push(stopData);
            }

            newTimeSlots[registrationSlot][machineId] = machineSlot;

            return { ...prev, timeSlots: newTimeSlots };
        });

        toast({ title: 'Parada Registrada', description: `Se guardó la parada para la máquina ${modalState.machineId.split('_')[1]} de ${stopData.startTime} a ${stopData.endTime}.` });
        setModalState(null);
    };

     const handleDeleteStop = (timeSlot: string, machineId: string, stopId: string) => {
        if (!dailyLog) return;

        setDailyLog(prev => {
            if (!prev) return null;

            const newTimeSlots = JSON.parse(JSON.stringify(prev.timeSlots));
            
            const registrationSlot = timeSlot.substring(0,5);

            if (!newTimeSlots[registrationSlot] || !newTimeSlots[registrationSlot][machineId]) return prev;

            const machineSlot = newTimeSlots[registrationSlot][machineId] as { stops?: StopData[] };
            
            if (machineSlot.stops) {
                machineSlot.stops = machineSlot.stops.filter(stop => stop.id !== stopId);
                if (machineSlot.stops.length === 0) {
                    delete machineSlot.stops;
                }
            }

            return { ...prev, timeSlots: newTimeSlots };
        });
        toast({ title: "Parada Eliminada", description: "La parada ha sido eliminada. Guarda los cambios para confirmar.", variant: "destructive" });
    };
    
    const handleToggleAdminMode = () => {
        if (isAdminMode) {
            setIsAdminMode(false);
            toast({ title: "Modo Admin Desactivado" });
        } else {
            const password = prompt("Ingresa la clave de administrador:");
            if (password === "ADMIN") {
                setIsAdminMode(true);
                toast({ title: "Modo Admin Activado", description: "Ahora puedes eliminar registros de paradas." });
            } else if (password !== null) { 
                toast({ title: "Clave Incorrecta", variant: "destructive" });
            }
        }
    };
    
    const handleConfigSave = async (
        type: 'stopCause' | 'operator' | 'supervisor' | 'maintenanceType',
        data: any,
        action: 'add' | 'delete'
    ) => {
        const collectionNameMap = {
            stopCause: 'stopCauses',
            operator: 'operators',
            supervisor: 'supervisors',
            maintenanceType: 'maintenanceTypes',
        };
        const collectionName = collectionNameMap[type];

        try {
            if (action === 'add') {
                await addDoc(collection(db, collectionName), data);
                toast({ title: `Nuevo ${type} añadido`});
            } else if (action === 'delete') {
                await deleteDoc(doc(db, collectionName, data.id));
                toast({ title: `${type} eliminado`});
            }
            fetchCatalogs(); 
        } catch(e) {
            toast({ title: 'Error', description: `No se pudo actualizar el catálogo de ${type}.`, variant: 'destructive'});
        }
    };

    const allStops = React.useMemo(() => {
        if (!dailyLog) return [];
        const stops: (StopData & { machineId: string })[] = [];
        Object.values(dailyLog.timeSlots).forEach(slot => {
            Object.entries(slot).forEach(([machineId, machineData]) => {
                if (machineData && 'stops' in machineData && machineData.stops) {
                     machineData.stops.forEach(stop => {
                        stops.push({ ...stop, machineId });
                    });
                }
            });
        });
        return stops;
    }, [dailyLog]);
    
    const observationCell = (time: string, machineId: string) => {
        
        const parseTime = (timeStr: string) => parse(timeStr, 'HH:mm', new Date());

        const cellStartTime = parseTime(time);
        const cellEndTime = new Date(cellStartTime.getTime() + 30 * 60 * 1000);

        const stopsInCell = allStops.filter(stop => {
             if (stop.machineId !== machineId) return false;
            const stopStartTime = parseTime(stop.startTime);
            const stopEndTime = parseTime(stop.endTime);
            return stopStartTime < cellEndTime && stopEndTime > cellStartTime;
        });

        const handleCellClick = () => {
            setModalState({ isOpen: true, machineId, timeSlot: time });
        };
        
        const handleStopClick = (e: React.MouseEvent, stop: StopData) => {
            e.stopPropagation(); 
            setModalState({ isOpen: true, machineId, timeSlot: stop.startTime, stopData: stop });
        };
        
        return (
            <td className="p-0.5" onClick={handleCellClick}>
                <div className="w-full h-8 flex flex-col items-center justify-start gap-0.5 cursor-pointer hover:bg-accent/50 rounded-sm p-0.5 overflow-hidden relative group/cell">
                    {stopsInCell.length > 0 ? (
                        stopsInCell.map(stopData => {
                           const isStartingCell = time === stopData.startTime.substring(0,5);
                           const stopCauseConfig = stopCauses.find(c => c.name === stopData.reason);
                           const badgeColor = stopCauseConfig ? stopCauseConfig.color : (stopData.type === 'planned' ? '#3b82f6' : '#ef4444');

                           return (
                             <TooltipProvider key={stopData.id}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div 
                                          className={cn(
                                            'relative group/pill w-full flex-grow flex items-center',
                                          )}
                                          onClick={(e) => handleStopClick(e, stopData)}
                                        >
                                            <Badge
                                                style={{ backgroundColor: badgeColor }}
                                                className={cn("truncate cursor-pointer h-full w-full flex-grow flex items-center text-white",
                                                   !isStartingCell && "opacity-60"
                                                )}
                                            >
                                               {isStartingCell ? `${stopData.reason} (${stopData.duration}m)` : ''}
                                            </Badge>
                                             {isAdminMode && isStartingCell && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                         <button 
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-black text-white flex items-center justify-center text-xs opacity-0 group-hover/pill:opacity-100"
                                                         >
                                                             &times;
                                                         </button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Confirmar Eliminación?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción eliminará permanentemente la parada "{stopData.reason}". No se puede deshacer.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteStop(stopData.startTime, machineId, stopData.id)}>Eliminar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="space-y-1 text-xs max-w-xs">
                                            <p><strong className="font-semibold">Tipo:</strong> {stopData.type === 'planned' ? 'Planificada' : 'No Planificada'}</p>
                                            {stopData.maintenanceType && <p><strong className="font-semibold">Tipo Mtto:</strong> {stopData.maintenanceType}</p>}
                                            {stopData.reason && <p><strong className="font-semibold">Motivo:</strong> {stopData.reason}</p>}
                                            <p><strong className="font-semibold">Causa:</strong> {stopData.cause}</p>
                                            <p><strong className="font-semibold">Duración:</strong> {stopData.duration} min ({stopData.startTime} - {stopData.endTime})</p>
                                            {stopData.solution && <p><strong className="font-semibold">Solución:</strong> {stopData.solution}</p>}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                           )
                        })
                    ) : (
                        <span className="text-muted-foreground text-xs opacity-0 group-hover/cell:opacity-100">Registrar...</span>
                    )}
                </div>
            </td>
        );
    }
    
    const inputCell = (time: string, field: keyof TimeSlot, machineId?: string) => {
        const fieldName = machineId ? `${machineId}_${field}`: field;
        
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            let valueToSet = e.target.value;
            if (machineId) {
                 setDailyLog(prev => {
                    if (!prev) return null;
                    const newTimeSlots = { ...prev.timeSlots };
                    if (!newTimeSlots[time]) newTimeSlots[time] = {};
                    
                    const machineObservations = { ...(newTimeSlots[time] as any)[machineId] || {} };
                    machineObservations[field] = valueToSet;

                    (newTimeSlots[time] as any)[machineId] = machineObservations;

                    return { ...prev, timeSlots: newTimeSlots };
                });
            } else {
                handleCellChange(time, field, valueToSet);
            }
        };

        let value;
        if (machineId) {
            value = (dailyLog?.timeSlots[time] as any)?.[machineId]?.[field] || '';
        } else {
            value = dailyLog?.timeSlots[time]?.[field] || '';
        }

        return (
            <td className="p-0">
                <Input 
                    className="border-none rounded-none focus-visible:ring-1 focus-visible:ring-inset h-8 text-xs"
                    value={value}
                    onChange={handleChange}
                />
            </td>
        );
    }
    
    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <HardHat className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Bitácora de Producción</h1>
                </div>
                <div className="flex items-center gap-2">
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant={isAdminMode ? 'destructive' : 'outline'} size="icon" onClick={handleToggleAdminMode}>
                                    {isAdminMode ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isAdminMode ? 'Desactivar Modo Admin' : 'Activar Modo Admin'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" onClick={() => setConfigModalOpen(true)}>
                                    <Settings className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Configuración de Bitácora</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <Button onClick={() => dailyLog && handleSaveLog(dailyLog, true)} disabled={loading}>Guardar Cambios</Button>
                    <Link href="/">
                        <Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver</Button>
                    </Link>
                </div>
            </header>
            <main className="p-4 md:p-6">
                 <Tabs defaultValue="log">
                    <TabsList>
                        <TabsTrigger value="log">Registro de Bitácora</TabsTrigger>
                        <TabsTrigger value="oee">Análisis de Paradas (Disponibilidad)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="log">
                        {loading ? <p>Cargando bitácora...</p> : dailyLog && (
                            <div className="space-y-4 pt-4">
                                {/* Header */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4 border rounded-lg bg-card">
                                    <div className="space-y-1.5">
                                        <Label>Operador</Label>
                                        <Select value={dailyLog.operador} onValueChange={val => handleHeaderChange('operador', val)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {operators.map(o => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Supervisor</Label>
                                         <Select value={dailyLog.supervisor} onValueChange={val => handleHeaderChange('supervisor', val)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {supervisors.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Lote</Label>
                                        <Input value={dailyLog.lote} onChange={e => handleHeaderChange('lote', e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Turno</Label>
                                        <Select value={dailyLog.shift} onValueChange={val => handleHeaderChange('shift', val)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="day">Día</SelectItem>
                                                <SelectItem value="night">Noche</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-1.5">
                                        <Label>Fecha</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start font-normal">
                                                    {format(date, "PPP", { locale: es })}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={date} onSelect={handleDateChange} />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                {/* Log Table */}
                                <div className="relative">
                                    <div className="w-full overflow-x-auto border rounded-lg bg-card">
                                        <table className="min-w-full text-xs">
                                            <thead className="text-center align-top">
                                                <tr className="divide-x divide-border">
                                                    <th rowSpan={3} className="p-1 w-24 sticky left-0 bg-muted/50 z-30 top-0">Hora</th>
                                                    {Array.from({ length: NUM_MACHINES }).map((_, i) => (
                                                        <th key={`machine_header_${i}`} colSpan={2} className="p-2 sticky bg-muted/50 z-10" style={{top: 0}}>Máquina #{i + 1}</th>
                                                    ))}
                                                    <th colSpan={9} className="p-2 sticky bg-green-100 dark:bg-green-900/50 z-10" style={{top: 0}}>INGRESO DE PRODUCTO FINAL/GRASSHOPPER</th>
                                                    <th colSpan={6} className="p-2 sticky bg-blue-100 dark:bg-blue-900/50 z-10" style={{top: 0}}>SALIDA DE PRODUCTO TERMINADO</th>
                                                    <th rowSpan={3} className="p-2 w-80 sticky bg-muted/50 z-10" style={{top: 0, right: 0}}>NOVEDADES DE EMPAQUE DE AZÚCAR</th>
                                                </tr>
                                                <tr className="divide-x divide-border">
                                                    {Array.from({ length: NUM_MACHINES }).map((_, i) => {
                                                        const machineId = `machine_${i + 1}`;
                                                        const selectedProductId = dailyLog.machines[machineId]?.productId || '';
                                                        const selectedProduct = prefetchedProducts.find(p => p.id === selectedProductId);

                                                        return (
                                                            <th key={`product_selector_${i}`} className="p-1 sticky z-20 bg-muted/50" colSpan={2} style={{top: '45px'}}>
                                                                <Select value={selectedProductId} onValueChange={(val) => handleMachineProductChange(machineId, val)}>
                                                                    <SelectTrigger className="h-8 text-xs">
                                                                        <div className="flex items-center gap-2 truncate">
                                                                            {selectedProduct && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProduct.color || '#ccc' }}></span>}
                                                                            <SelectValue placeholder="Producto" />
                                                                        </div>
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {prefetchedProducts.map(p => (
                                                                            <SelectItem key={p.id} value={p.id}>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || '#ccc' }}></span>
                                                                                    <span>{p.productName}</span>
                                                                                </div>
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </th>
                                                        );
                                                    })}
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-green-100 dark:bg-green-900/50" style={{top: '45px'}}>Masa</th>
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-green-100 dark:bg-green-900/50" style={{top: '45px'}}>Flujo</th>
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-green-100 dark:bg-green-900/50" style={{top: '45px'}}>NS-FAM</th>
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-green-100 dark:bg-green-900/50" style={{top: '45px'}}>NS% 1</th>
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-green-100 dark:bg-green-900/50" style={{top: '45px'}}>NS% 2</th>
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-yellow-100 dark:bg-yellow-900/50" style={{top: '45px'}}>Color</th>
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-yellow-100 dark:bg-yellow-900/50" style={{top: '45px'}}>Hum</th>
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-yellow-100 dark:bg-yellow-900/50" style={{top: '45px'}}>Turb</th>
                                                    <th rowSpan={2} className="p-1 font-normal text-muted-foreground sticky z-20 bg-yellow-100 dark:bg-yellow-900/50" style={{top: '45px'}}>CV</th>
                                                    <th colSpan={3} className="p-1 font-medium sticky z-20 bg-blue-100 dark:bg-blue-900/50" style={{top: '45px'}}>Familiar</th>
                                                    <th colSpan={3} className="p-1 font-medium sticky z-20 bg-blue-100 dark:bg-blue-900/50" style={{top: '45px'}}>Granel 50 KG</th>
                                                </tr>
                                                <tr className="divide-x divide-border">
                                                    {Array.from({ length: NUM_MACHINES }).map((_, i) => (
                                                        <React.Fragment key={`sub_header_${i}`}>
                                                            <th className="p-1 font-normal text-muted-foreground w-48 sticky z-20 bg-muted/50" style={{top: '90px'}}>Observación</th>
                                                            <th className="p-1 font-normal text-muted-foreground w-24 sticky z-20 bg-muted/50" style={{top: '90px'}}>Peso/Saco KG</th>
                                                        </React.Fragment>
                                                    ))}
                                                    <th className="p-1 font-normal text-muted-foreground sticky z-20 bg-blue-100 dark:bg-blue-900/50" style={{top: '90px'}}>Color</th>
                                                    <th className="p-1 font-normal text-muted-foreground sticky z-20 bg-blue-100 dark:bg-blue-900/50" style={{top: '90px'}}>Hum</th>
                                                    <th className="p-1 font-normal text-muted-foreground sticky z-20 bg-blue-100 dark:bg-blue-900/50" style={{top: '90px'}}>Turb</th>
                                                    <th className="p-1 font-normal text-muted-foreground sticky z-20 bg-blue-100 dark:bg-blue-900/50" style={{top: '90px'}}>Color</th>
                                                    <th className="p-1 font-normal text-muted-foreground sticky z-20 bg-blue-100 dark:bg-blue-900/50" style={{top: '90px'}}>Hum</th>
                                                    <th className="p-1 font-normal text-muted-foreground sticky z-20 bg-blue-100 dark:bg-blue-900/50" style={{top: '90px'}}>Turb</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {timeSlotsForTable.map((time) => (
                                                    <tr key={time} className="divide-x divide-border">
                                                        <td className="p-1 w-24 text-center font-mono sticky left-0 bg-card z-10">{time}</td>
                                                        {Array.from({ length: NUM_MACHINES }).map((_, machineIndex) => {
                                                            const machineId = `machine_${machineIndex + 1}`;
                                                            return (
                                                                <React.Fragment key={machineId}>
                                                                    {observationCell(time, machineId)}
                                                                    {inputCell(time, 'weight', machineId)}
                                                                </React.Fragment>
                                                            )
                                                        })}
                                                        {inputCell(time, 'masa')}
                                                        {inputCell(time, 'flujo')}
                                                        {inputCell(time, 'ns_fam')}
                                                        {inputCell(time, 'ns_1')}
                                                        {inputCell(time, 'ns_2')}
                                                        {inputCell(time, 'in_color')}
                                                        {inputCell(time, 'in_hum')}
                                                        {inputCell(time, 'in_turb')}
                                                        {inputCell(time, 'in_cv')}
                                                        {inputCell(time, 'out_fam_color')}
                                                        {inputCell(time, 'out_fam_hum')}
                                                        {inputCell(time, 'out_fam_turb')}
                                                        {inputCell(time, 'out_gra_color')}
                                                        {inputCell(time, 'out_gra_hum')}
                                                        {inputCell(time, 'out_gra_turb')}
                                                        {inputCell(time, 'empaque_obs')}
                                                    </tr>
                                                ))}

                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="oee">
                         <Card>
                            <CardHeader>
                                <CardTitle>Filtros de Análisis</CardTitle>
                                <CardDescription>Selecciona el rango de fechas para analizar las paradas.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col md:flex-row items-center gap-4">
                                <div className="grid gap-2">
                                    <Label>Rango de Fechas</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className="w-[300px] justify-start text-left font-normal"
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {oeeDateRange?.from ? (
                                                    oeeDateRange.to ? (
                                                        <>
                                                            {format(oeeDateRange.from, "LLL dd, y", { locale: es })} -{" "}
                                                            {format(oeeDateRange.to, "LLL dd, y", { locale: es })}
                                                        </>
                                                    ) : (
                                                        format(oeeDateRange.from, "LLL dd, y", { locale: es })
                                                    )
                                                ) : (
                                                    <span>Elige un rango</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                initialFocus
                                                mode="range"
                                                defaultMonth={oeeDateRange?.from}
                                                selected={oeeDateRange}
                                                onSelect={setOeeDateRange}
                                                numberOfMonths={2}
                                                locale={es}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <Button onClick={handleFetchOeeData} disabled={oeeLoading} className="mt-auto">
                                    {oeeLoading ? 'Analizando...' : 'Analizar Datos'}
                                </Button>
                            </CardContent>
                        </Card>
                        {oeeLoading ? <p className="text-center pt-8">Cargando datos de análisis...</p> : (
                            <div className='space-y-6 pt-6'>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Total de Tiempo de Parada por Máquina</CardTitle>
                                        <CardDescription>Suma de todos los minutos de parada para cada máquina en el período seleccionado.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {Object.keys(machineStops).length > 0 ? (
                                            Object.entries(machineStops).map(([machineId, minutes]) => (
                                                <KpiCard 
                                                    key={machineId}
                                                    title={`Máquina ${machineId.split('_')[1]}`}
                                                    value={`${Math.floor(minutes / 60)}h ${minutes % 60}m`}
                                                    subValue={`${minutes.toLocaleString()} minutos totales`}
                                                    icon={HardHat}
                                                    description="Tiempo total que esta máquina estuvo detenida."
                                                />
                                            ))
                                        ) : (
                                            <p className="col-span-full text-center text-muted-foreground py-8">No se encontraron datos de paradas para este rango.</p>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Desglose de Paradas por Motivo</CardTitle>
                                        <CardDescription>Tiempo total de parada (en minutos) agrupado por el motivo registrado.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {stopsByReason.length > 0 ? (
                                            <ChartContainer config={{}} className="w-full h-[400px]">
                                                <ResponsiveContainer>
                                                    <BarChart layout="vertical" data={stopsByReason}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis type="number" />
                                                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                                        <RechartsTooltip 
                                                            cursor={{ fill: 'rgba(200, 200, 200, 0.1)' }}
                                                            content={<ChartTooltipContent />}
                                                        />
                                                        <Bar dataKey="totalMinutes" name="Minutos" radius={[0, 4, 4, 0]}>
                                                            {stopsByReason.map((entry) => (
                                                                 <Bar key={entry.name} dataKey="totalMinutes" fill={entry.color} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : (
                                             <p className="col-span-full text-center text-muted-foreground py-8">No se encontraron datos de paradas para este rango.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>


                {modalState?.isOpen && (
                    <StopRegistrationModal 
                        isOpen={modalState.isOpen}
                        onClose={() => setModalState(null)}
                        onSave={handleStopSave}
                        machineId={modalState.machineId}
                        startTime={modalState.timeSlot}
                        stopData={modalState.stopData}
                        stopCauses={stopCauses}
                        maintenanceTypes={maintenanceTypes}
                    />
                )}
                {configModalOpen && (
                    <ConfigurationModal
                        isOpen={configModalOpen}
                        onClose={() => setConfigModalOpen(false)}
                        stopCauses={stopCauses}
                        operators={operators}
                        supervisors={supervisors}
                        maintenanceTypes={maintenanceTypes}
                        onConfigSave={handleConfigSave}
                    />
                )}
            </main>
        </div>
    );
}

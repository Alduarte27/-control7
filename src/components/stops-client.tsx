

'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, HardHat, Lock, Unlock, Settings, X, PlusCircle, Calendar as CalendarIcon, Activity, History, MoreVertical, Save, RefreshCw, CheckCircle2, Upload, HelpCircle, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition, DailyLog, MachineLog, TimeSlot, StopData, StopCause, Operator, Supervisor, MaintenanceType, CategoryDefinition } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { format, getDayOfYear, parse, setMinutes, getMinutes, getHours, isToday } from 'date-fns';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import LogImportWizard from './log-import-wizard';
import LogHelpDialog from './log-help-dialog';


const NUM_MACHINES = 3;
const TIME_SLOTS_PER_HOUR = 2; // 30-minute intervals
const AUTOSAVE_DELAY = 2000; // 2 seconds

// This function generates the display slots for the table based on the selected shift
export const generateDisplayTimeSlots = (shift: 'day' | 'night') => {
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
                    <Button variant={current.buttonVariant} onClick={status === 'dirty' ? onSave : undefined} disabled={status === 'saving' || status === 'saved'}>
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

export default function StopsClient({ 
    prefetchedProducts, 
    initialDate, 
    initialShift 
}: { 
    prefetchedProducts: ProductDefinition[], 
    initialDate?: string, 
    initialShift?: 'day' | 'night' 
}) {
    const [dailyLog, setDailyLog] = React.useState<DailyLog | null>(null);
    const [stopCauses, setStopCauses] = React.useState<StopCause[]>([]);
    const [operators, setOperators] = React.useState<Operator[]>([]);
    const [supervisors, setSupervisors] = React.useState<Supervisor[]>([]);
    const [maintenanceTypes, setMaintenanceTypes] = React.useState<MaintenanceType[]>([]);
    const [allCategories, setAllCategories] = React.useState<CategoryDefinition[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [date, setDate] = React.useState<Date>(initialDate ? parse(initialDate, 'yyyy-MM-dd', new Date()) : new Date());
    const [modalState, setModalState] = React.useState<{isOpen: boolean; machineId: string; timeSlot: string; stopData?: StopData} | null>(null);
    const [configModalOpen, setConfigModalOpen] = React.useState(false);
    const [importWizardOpen, setImportWizardOpen] = React.useState(false);
    const [helpModalOpen, setHelpModalOpen] = React.useState(false);
    const { toast } = useToast();
    const [isAdminMode, setIsAdminMode] = React.useState(false);
    const [weightHeaderType, setWeightHeaderType] = React.useState<{ [key: string]: string }>({
        machine_1: 'weight',
        machine_2: 'weight',
        machine_3: 'weight',
    });

    const [saveStatus, setSaveStatus] = React.useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
    const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const isCurrentDay = React.useMemo(() => isToday(date), [date]);
    
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
            supervisor: '',
            lote: String(getDayOfYear(logDate)),
            shift: shift,
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
            await setDoc(docRef, cleanLog, { merge: true });

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

    React.useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            setSaveStatus('idle');
            const currentShift = dailyLog?.shift || initialShift || (new Date().getHours() < 19 && new Date().getHours() >= 7 ? 'day' : 'night');
            const logId = `${format(date, 'yyyy-MM-dd')}_${currentShift}`;
            
            try {
                const logDocSnap = await getDoc(doc(db, 'dailyLogs', logId));

                let logData: DailyLog;
                if (logDocSnap.exists()) {
                    logData = logDocSnap.data() as DailyLog;
                } else {
                    logData = createEmptyLog(date, currentShift);
                }

                if (!logData.machines) logData.machines = {};
                for (let i = 1; i <= NUM_MACHINES; i++) {
                    const machineId = `machine_${i}`;
                    if (!logData.machines[machineId]) {
                        logData.machines[machineId] = { productId: '' };
                    }
                }

                if (!logData.lote) logData.lote = String(getDayOfYear(date));
                if (!logData.operador) logData.operador = '';
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
            const [causesSnap, operatorsSnap, supervisorsSnap, maintTypesSnap, categoriesSnap] = await Promise.all([
                getDocs(query(collection(db, 'stopCauses'), orderBy('name'))),
                getDocs(query(collection(db, 'operators'), orderBy('name'))),
                getDocs(query(collection(db, 'supervisors'), orderBy('name'))),
                getDocs(query(collection(db, 'maintenanceTypes'), orderBy('name'))),
                getDocs(query(collection(db, 'categories'), orderBy('name'))),
            ]);
            setStopCauses(causesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StopCause)));
            setOperators(operatorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Operator)));
            setSupervisors(supervisorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supervisor)));
            setMaintenanceTypes(maintTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceType)));
            setAllCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryDefinition)));
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudieron cargar los catálogos de configuración.', variant: 'destructive'});
        }
    }, [toast]);

    React.useEffect(() => {
        fetchCatalogs();
    }, [fetchCatalogs]);
    
    // Auto-save effect
    React.useEffect(() => {
        if (saveStatus === 'dirty' && isCurrentDay) {
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
    }, [dailyLog, saveStatus, isCurrentDay, handleSaveLog]);


    const triggerChange = (updater: (prev: DailyLog) => DailyLog) => {
        setDailyLog(prev => {
            if (!prev) return null;
            if (isCurrentDay) {
                setSaveStatus('dirty');
            } else {
                setSaveStatus('idle'); // When not current day, button should be primary "Guardar"
            }
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
                    if(!prev) return null;
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

    const handleMachineProductChange = (machineId: string, productId: string) => {
        if (!dailyLog) return;
        const actualProductId = productId === 'no_production' ? '' : productId;
        triggerChange(prev => {
            const newMachines = { ...prev.machines };
            if (!newMachines[machineId]) newMachines[machineId] = { productId: '' };
            newMachines[machineId].productId = actualProductId;
            return { ...prev, machines: newMachines };
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
        triggerChange(prev => {
            if (!prev) return prev;
            const newTimeSlots = JSON.parse(JSON.stringify(prev.timeSlots));
            
            const registrationSlot = format(setMinutes(parse(timeSlot, 'HH:mm', new Date()), getMinutes(parse(timeSlot, 'HH:mm', new Date())) < 30 ? 0 : 30), 'HH:mm');

            if (!newTimeSlots[registrationSlot]?.[machineId]?.stops) return prev;

            const machineSlot = newTimeSlots[registrationSlot][machineId] as { stops?: StopData[] };
            
            if (machineSlot.stops) {
                machineSlot.stops = machineSlot.stops.filter(stop => stop.id !== stopId);
                if (machineSlot.stops.length === 0) {
                    delete machineSlot.stops;
                }
            }

            return { ...prev, timeSlots: newTimeSlots };
        });
        toast({ title: "Parada Eliminada", description: "La parada ha sido eliminada.", variant: "destructive" });
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
      toast({title: "Importación Finalizada", description: "Los datos han sido cargados."});
    }

    const allStops = React.useMemo(() => {
        if (!dailyLog) return [];
        const stops: (StopData & { machineId: string })[] = [];
        Object.values(dailyLog.timeSlots).forEach(slot => {
            if (!slot || typeof slot !== 'object') return;
            Object.entries(slot).forEach(([machineId, machineData]) => {
                if (machineId.startsWith('machine_') && machineData && typeof machineData === 'object' && 'stops' in machineData && Array.isArray(machineData.stops)) {
                    (machineData.stops as StopData[]).forEach(stop => {
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
                    {stopsInCell.map(stopData => {
                        const stopStartTime = parse(stopData.startTime, 'HH:mm', new Date());
                        const isStartingCell = getHours(stopStartTime) === getHours(cellStartTime) && Math.floor(getMinutes(stopStartTime) / 30) === Math.floor(getMinutes(cellStartTime) / 30);
                        const stopCauseConfig = stopCausesMap.get(stopData.reason);
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
                                            className={cn("truncate cursor-pointer h-full w-full flex-grow flex items-center text-white")}
                                        >
                                            {isStartingCell ? `${stopData.reason} (${stopData.duration}m)` : '\u00A0'}
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
                                        {stopData.type && <p><strong className="font-semibold">Tipo:</strong> {stopData.type === 'planned' ? 'Planificada' : 'No Planificada'}</p>}
                                        {stopData.maintenanceType && <p><strong className="font-semibold">Tipo Mtto:</strong> {stopData.maintenanceType}</p>}
                                        {stopData.reason && <p><strong className="font-semibold">Motivo:</strong> {stopData.reason}</p>}
                                        {stopData.cause && <p><strong className="font-semibold">Causa:</strong> {stopData.cause}</p>}
                                        {stopData.duration > 0 && <p><strong className="font-semibold">Duración:</strong> {stopData.duration} min ({stopData.startTime} - {stopData.endTime})</p>}
                                        {stopData.solution && <p><strong className="font-semibold">Solución:</strong> {stopData.solution}</p>}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        )
                    })}
                    {stopsInCell.length === 0 && (
                        <span className="text-muted-foreground text-xs opacity-0 group-hover/cell:opacity-100">Registrar...</span>
                    )}
                </div>
            </td>
        );
    }
    
    const inputCell = (time: string, field: keyof TimeSlot, machineId?: string) => {
        const isPercentageField = ['ns_fam', 'ns_1', 'ns_2'].includes(field as string);
    
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const rawValue = e.target.value;
            let valueToSet: string | number = isPercentageField ? rawValue.replace(/%/g, '') : rawValue;
            
            if (field === 'speed') {
                const num = Number(valueToSet);
                if (!isNaN(num)) {
                    valueToSet = num;
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
        
        const displayValue = isPercentageField && value ? `${value}%` : value;

        return (
            <td className="p-0">
                <Input 
                    type={field === 'speed' ? 'number' : 'text'}
                    min={field === 'speed' ? '0' : undefined}
                    className="border-none rounded-none focus-visible:ring-1 focus-visible:ring-inset h-8 text-xs"
                    value={displayValue}
                    onChange={handleChange}
                />
            </td>
        );
    }

    const masaSelectCell = (time: string) => {
        const field = 'masa';
        const value = dailyLog?.timeSlots[time]?.[field] || '';

        const handleValueChange = (newValue: string) => {
            handleCellChange(time, field, newValue);
        };

        return (
            <td className="p-0">
                <Select value={value} onValueChange={handleValueChange}>
                    <SelectTrigger className="border-none rounded-none focus:ring-1 focus:ring-inset h-8 text-xs w-full">
                        <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_">-</SelectItem>
                        {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                            <SelectItem key={num} value={String(num)}>{num}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </td>
        );
    };
    
    const flujoSelectCell = (time: string) => {
        const field = 'flujo';
        const value = dailyLog?.timeSlots[time]?.[field] || '';
        const options = ["Familiar", "Familiar/Granel 2", "Granel 2", "Granel 1"];

        const handleValueChange = (newValue: string) => {
            handleCellChange(time, field, newValue);
        };

        return (
            <td className="p-0">
                <Select value={value} onValueChange={handleValueChange}>
                    <SelectTrigger className="border-none rounded-none focus:ring-1 focus:ring-inset h-8 text-xs w-full">
                        <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_">-</SelectItem>
                        {options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </td>
        );
    };

    const humSelectCell = (time: string, field: 'in_hum' | 'out_fam_hum' | 'out_gra_hum') => {
        const value = dailyLog?.timeSlots[time]?.[field] || '';
        const options = ["0.01", "0.02", "0.03", "0.04", "0.05", "0.06", "0.07", "0.08"];
        
        const handleValueChange = (newValue: string) => {
            handleCellChange(time, field, newValue);
        };

        return (
            <td className="p-0">
                <Select value={value} onValueChange={handleValueChange}>
                    <SelectTrigger className="border-none rounded-none focus:ring-1 focus:ring-inset h-8 text-xs w-full">
                        <SelectValue placeholder="-" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_">-</SelectItem>
                        {options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </td>
        );
    };
    
    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-b bg-card sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <HardHat className="h-8 w-8 text-primary" />
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">Bitácora de Producción</h1>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    {/* Desktop Buttons */}
                    <div className="hidden md:flex items-center gap-2">
                        
                         {isCurrentDay ? 
                            <SaveStatusIndicator status={saveStatus} onSave={() => handleSaveLog(dailyLog, true)} /> :
                            <Button onClick={() => handleSaveLog(dailyLog, true)}><Save className="mr-2 h-4 w-4" /> Guardar Cambios</Button>
                         }
                        
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild variant="outline" size="icon">
                                      <Link href="/log-history">
                                        <History className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Historial</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild variant="outline" size="icon">
                                      <Link href="/oee">
                                        <Activity className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Análisis de Paradas (OEE)</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={() => setImportWizardOpen(true)}>
                                        <FileUp className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Importar desde CSV</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant={isAdminMode ? 'destructive' : 'outline'} size="icon" onClick={handleToggleAdminMode}>
                                        {isAdminMode ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{isAdminMode ? 'Desactivar Modo Admin' : 'Activar Modo Admin'}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={() => setConfigModalOpen(true)}>
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Configuración de Bitácora</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={() => setHelpModalOpen(true)}>
                                        <HelpCircle className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Ayuda</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <Link href="/"><Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver</Button></Link>
                    {/* Mobile Dropdown */}
                    <div className="md:hidden">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleSaveLog(dailyLog, true)}><Save className="mr-2 h-4 w-4"/>Guardar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setImportWizardOpen(true)}><FileUp className="mr-2 h-4 w-4" />Importar desde CSV</DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/log-history" className="flex items-center"><History className="mr-2 h-4 w-4" />Historial</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/oee" className="flex items-center"><Activity className="mr-2 h-4 w-4" />Análisis</Link></DropdownMenuItem>
                                <DropdownMenuItem onClick={handleToggleAdminMode}><Lock className="mr-2 h-4 w-4" />Modo Admin</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setConfigModalOpen(true)}><Settings className="mr-2 h-4 w-4" />Configuración</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setHelpModalOpen(true)}><HelpCircle className="mr-2 h-4 w-4" />Ayuda</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
            <main className="p-2 md:p-6">
                {loading ? <p>Cargando bitácora...</p> : dailyLog && (
                    <div className="space-y-4 pt-4">
                        {/* Header */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4 border rounded-lg bg-card">
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
                                <Select value={dailyLog.shift} onValueChange={val => handleHeaderChange('shift', val as 'day' | 'night')}>
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
                         <div className="border rounded-lg bg-card max-h-[75vh] overflow-y-auto">
                             <div className="overflow-x-auto">
                                <table className="table-fixed min-w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="divide-x divide-border">
                                            <th className="p-1 align-bottom sticky left-0 z-25 bg-muted">
                                                <div className="w-20">Hora</div>
                                            </th>
                                            <th className="p-1 bg-purple-100 dark:bg-purple-900/50" colSpan={3}>Máquina #1</th>
                                            <th className="p-1 bg-purple-100 dark:bg-purple-900/50" colSpan={3}>Máquina #2</th>
                                            <th className="p-1 bg-purple-100 dark:bg-purple-900/50" colSpan={3}>Máquina #3</th>
                                            <th className="p-1 bg-green-100 dark:bg-green-900/50" colSpan={9} rowSpan={1}>INGRESO DE PRODUCTO</th>
                                            <th colSpan={6} className="p-1 bg-blue-100 dark:bg-blue-900/50" rowSpan={1}>SALIDA DE PRODUCTO TERMINADO</th>
                                            <th rowSpan={3} className="p-1 bg-purple-100 dark:bg-purple-900/50" style={{ minWidth: '40.4rem' }}>NOVEDADES DE EMPAQUE DE AZÚCAR</th>
                                        </tr>
                                        <tr className="divide-x divide-border">
                                            <th className="p-1 sticky left-0 z-30 bg-muted"></th>
                                            <th className="p-1 align-middle bg-purple-100 dark:bg-purple-900/50" colSpan={3}>
                                                 <Select value={dailyLog.machines['machine_1']?.productId} onValueChange={(val) => handleMachineProductChange('machine_1', val)}>
                                                    <SelectTrigger className="h-8 text-xs bg-card justify-center">
                                                        <div className="flex items-center gap-2 truncate">
                                                            {familiarProducts.find(p => p.id === dailyLog.machines['machine_1']?.productId) && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: familiarProducts.find(p => p.id === dailyLog.machines['machine_1']?.productId)?.color || '#ccc' }}></span>}
                                                            <SelectValue placeholder="-- Sin Producción --" />
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                         <SelectItem value="no_production">-- Sin Producción --</SelectItem>
                                                        {familiarProducts.map(p => (
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
                                            <th className="p-1 align-middle bg-purple-100 dark:bg-purple-900/50" colSpan={3}>
                                                 <Select value={dailyLog.machines['machine_2']?.productId} onValueChange={(val) => handleMachineProductChange('machine_2', val)}>
                                                    <SelectTrigger className="h-8 text-xs bg-card justify-center">
                                                        <div className="flex items-center gap-2 truncate">
                                                            {familiarProducts.find(p => p.id === dailyLog.machines['machine_2']?.productId) && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: familiarProducts.find(p => p.id === dailyLog.machines['machine_2']?.productId)?.color || '#ccc' }}></span>}
                                                            <SelectValue placeholder="-- Sin Producción --" />
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                         <SelectItem value="no_production">-- Sin Producción --</SelectItem>
                                                        {familiarProducts.map(p => (
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
                                            <th className="p-1 align-middle bg-purple-100 dark:bg-purple-900/50" colSpan={3}>
                                                 <Select value={dailyLog.machines['machine_3']?.productId} onValueChange={(val) => handleMachineProductChange('machine_3', val)}>
                                                    <SelectTrigger className="h-8 text-xs bg-card justify-center">
                                                        <div className="flex items-center gap-2 truncate">
                                                            {familiarProducts.find(p => p.id === dailyLog.machines['machine_3']?.productId) && <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: familiarProducts.find(p => p.id === dailyLog.machines['machine_3']?.productId)?.color || '#ccc' }}></span>}
                                                            <SelectValue placeholder="-- Sin Producción --" />
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                         <SelectItem value="no_production">-- Sin Producción --</SelectItem>
                                                        {familiarProducts.map(p => (
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
                                            <th className="p-1 bg-green-100 dark:bg-green-900/50" colSpan={9}>GRASSHOPPER</th>
                                            <th className="p-1 bg-blue-100 dark:bg-blue-900/50" colSpan={3}>Familiar</th>
                                            <th className="p-1 bg-blue-100 dark:bg-blue-900/50" colSpan={3}>Granel 50 KG</th>
                                        </tr>
                                        <tr className="divide-x divide-border text-muted-foreground font-normal">
                                            <th className="p-1 sticky left-0 z-30 bg-muted"></th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[9rem]">Observación</th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[6rem]">
                                                <Select value={weightHeaderType['machine_1']} onValueChange={(val) => setWeightHeaderType(p => ({...p, machine_1: val}))}>
                                                    <SelectTrigger className="h-8 text-xs bg-card border-none focus:ring-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="weight">P/Saco</SelectItem>
                                                        <SelectItem value="bundle_weight">P/Fardo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[6rem]">Velocidad (f/min)</th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[9rem]">Observación</th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[6rem]">
                                                 <Select value={weightHeaderType['machine_2']} onValueChange={(val) => setWeightHeaderType(p => ({...p, machine_2: val}))}>
                                                    <SelectTrigger className="h-8 text-xs bg-card border-none focus:ring-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="weight">P/Saco</SelectItem>
                                                        <SelectItem value="bundle_weight">P/Fardo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[6rem]">Velocidad (f/min)</th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[9rem]">Observación</th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[6rem]">
                                                 <Select value={weightHeaderType['machine_3']} onValueChange={(val) => setWeightHeaderType(p => ({...p, machine_3: val}))}>
                                                    <SelectTrigger className="h-8 text-xs bg-card border-none focus:ring-0">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="weight">P/Saco</SelectItem>
                                                        <SelectItem value="bundle_weight">P/Fardo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </th>
                                            <th className="p-1 font-normal bg-purple-100 dark:bg-purple-900/50 min-w-[6rem]">Velocidad (f/min)</th>

                                            <th className="p-1 font-normal bg-green-100 dark:bg-green-900/50 min-w-[3rem]">Masa</th>
                                            <th className="p-1 font-normal bg-green-100 dark:bg-green-900/50 min-w-[9rem]">Flujo</th>
                                            <th className="p-1 font-normal bg-green-100 dark:bg-green-900/50 min-w-[3.5rem]">NS-FA</th>
                                            <th className="p-1 font-normal bg-green-100 dark:bg-green-900/50 min-w-[3.5rem]">NS% 1</th>
                                            <th className="p-1 font-normal bg-green-100 dark:bg-green-900/50 min-w-[3.5rem]">NS% 2</th>
                                            <th className="p-1 font-normal bg-yellow-100 dark:bg-yellow-900/50 min-w-[3.5rem]">Color</th>
                                            <th className="p-1 font-normal bg-yellow-100 dark:bg-yellow-900/50 min-w-[3rem]">Hum</th>
                                            <th className="p-1 font-normal bg-yellow-100 dark:bg-yellow-900/50 min-w-[3rem]">Turb</th>
                                            <th className="p-1 font-normal bg-yellow-100 dark:bg-yellow-900/50 min-w-[4rem]">CV</th>
                                            <th className="p-1 font-normal bg-blue-100 dark:bg-blue-900/50 min-w-[3.5rem]">Color</th>
                                            <th className="p-1 font-normal bg-blue-100 dark:bg-blue-900/50 min-w-[3rem]">Hum</th>
                                            <th className="p-1 font-normal bg-blue-100 dark:bg-blue-900/50 min-w-[3rem]">Turb</th>
                                            <th className="p-1 font-normal bg-blue-100 dark:bg-blue-900/50 min-w-[3.5rem]">Color</th>
                                            <th className="p-1 font-normal bg-blue-100 dark:bg-blue-900/50 min-w-[3rem]">Hum</th>
                                            <th className="p-1 font-normal bg-blue-100 dark:bg-blue-900/50 min-w-[3rem]">Turb</th>
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
                                                            {inputCell(time, weightHeaderType[machineId] as keyof TimeSlot, machineId)}
                                                            {inputCell(time, 'speed', machineId)}
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
                    onClose={() => setConfigModalOpen(false)}
                    stopCauses={stopCauses}
                    operators={operators}
                    supervisors={supervisors}
                    maintenanceTypes={maintenanceTypes}
                    onConfigSave={handleConfigSave}
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
             {helpModalOpen && (
                <LogHelpDialog
                    isOpen={helpModalOpen}
                    onClose={() => setHelpModalOpen(false)}
                />
            )}
        </div>
    );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition, DailyLog, MachineLog, TimeSlotLog } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';

const NUM_MACHINES = 3;
const TIME_SLOTS_PER_HOUR = 2; // 30-minute intervals
const SHIFT_START_HOUR = 7;
const SHIFT_HOURS = 12;

const generateTimeSlots = () => {
    const slots = [];
    for (let i = 0; i < SHIFT_HOURS * TIME_SLOTS_PER_HOUR; i++) {
        const hour = SHIFT_START_HOUR + Math.floor(i / TIME_SLOTS_PER_HOUR);
        const minute = (i % TIME_SLOTS_PER_HOUR) * (60 / TIME_SLOTS_PER_HOUR);
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        slots.push(time);
    }
    return slots;
};

export default function StopsClient({ prefetchedProducts }: { prefetchedProducts: ProductDefinition[]}) {
    const [dailyLog, setDailyLog] = React.useState<DailyLog | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [date, setDate] = React.useState<Date>(new Date());
    const { toast } = useToast();
    const timeSlots = React.useMemo(() => generateTimeSlots(), []);
    
    const createEmptyLog = (logDate: Date): DailyLog => {
        const machineEntries: { [machineId: string]: MachineLog } = {};
        for (let i = 1; i <= NUM_MACHINES; i++) {
            machineEntries[`machine_${i}`] = {
                productId: prefetchedProducts[0]?.id || '',
            };
        }
        return {
            id: format(logDate, 'yyyy-MM-dd'),
            supervisor: '',
            lote: '',
            shift: 'day',
            machines: machineEntries,
            timeSlots: {}
        };
    };

    React.useEffect(() => {
        const fetchLog = async () => {
            setLoading(true);
            const logId = format(date, 'yyyy-MM-dd');
            try {
                const docRef = doc(db, 'dailyLogs', logId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as DailyLog;
                    // Ensure machines object exists
                    if (!data.machines) {
                        data.machines = createEmptyLog(date).machines;
                    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date]);

    const handleHeaderChange = (field: keyof DailyLog, value: string) => {
        if (!dailyLog) return;
        setDailyLog(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleMachineProductChange = (machineId: string, productId: string) => {
        if (!dailyLog) return;
        setDailyLog(prev => {
            if (!prev) return null;
            const newMachines = { ...prev.machines };
            newMachines[machineId].productId = productId;
            return { ...prev, machines: newMachines };
        });
    };

    const handleCellChange = (timeSlot: string, field: keyof TimeSlotLog, value: string) => {
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
    
    const handleSaveLog = async () => {
        if (!dailyLog) return;
        try {
            const docRef = doc(db, 'dailyLogs', dailyLog.id);
            await setDoc(docRef, dailyLog);
            toast({ title: 'Bitácora Guardada', description: `Se ha guardado el registro del día ${dailyLog.id}.` });
        } catch (error) {
            console.error("Error saving daily log:", error);
            toast({ title: 'Error', description: 'No se pudo guardar la bitácora.', variant: 'destructive' });
        }
    };
    
    const inputCell = (time: string, field: keyof TimeSlotLog, machineId?: string) => {
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
                    <Button onClick={handleSaveLog} disabled={loading}>Guardar Cambios</Button>
                    <Link href="/">
                        <Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver</Button>
                    </Link>
                </div>
            </header>
            <main className="p-4 md:p-6">
                {loading ? <p>Cargando bitácora...</p> : dailyLog && (
                    <div className="space-y-4">
                        {/* Header */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
                            <div className="space-y-1.5">
                                <Label>Supervisor</Label>
                                <Input value={dailyLog.supervisor} onChange={e => handleHeaderChange('supervisor', e.target.value)} />
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
                                        <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>

                        {/* Log Table */}
                        <div className="overflow-x-auto border rounded-lg bg-card">
                            <table className="min-w-full text-xs">
                                <thead className="bg-muted/50 text-center">
                                    <tr className="divide-x divide-border">
                                        <th rowSpan={2} className="p-1 w-24 sticky left-0 bg-muted/50 z-10">Hora</th>
                                        <th colSpan={9} className="p-2 bg-green-100 dark:bg-green-900/50">INGRESO DE PRODUCTO FINAL/GRASSHOPPER</th>
                                        <th colSpan={6} className="p-2 bg-blue-100 dark:bg-blue-900/50">SALIDA DE PRODUCTO TERMINADO</th>
                                        {Array.from({ length: NUM_MACHINES }).map((_, i) => (
                                            <th key={`machine_header_${i}`} colSpan={2} className="p-2">Máquina #{i + 1}</th>
                                        ))}
                                        <th rowSpan={2} className="p-2 w-64">NOVEDADES DE EMPAQUE DE AZÚCAR</th>
                                    </tr>
                                    <tr className="divide-x divide-border">
                                        <th className="p-1 font-normal text-muted-foreground bg-green-100 dark:bg-green-900/50">Masa</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-green-100 dark:bg-green-900/50">Flujo</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-green-100 dark:bg-green-900/50">NS-FAM</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-green-100 dark:bg-green-900/50">NS% 1</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-green-100 dark:bg-green-900/50">NS% 2</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-yellow-100 dark:bg-yellow-900/50">Color</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-yellow-100 dark:bg-yellow-900/50">Hum</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-yellow-100 dark:bg-yellow-900/50">Turb</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-yellow-100 dark:bg-yellow-900/50">CV</th>
                                        <th colSpan={3} className="p-1 font-medium bg-blue-100 dark:bg-blue-900/50">Familiar</th>
                                        <th colSpan={3} className="p-1 font-medium bg-blue-100 dark:bg-blue-900/50">Granel 50 KG</th>
                                        {Array.from({ length: NUM_MACHINES }).map((_, i) => (
                                            <React.Fragment key={`sub_header_${i}`}>
                                                <th className="p-1 font-normal text-muted-foreground w-48">Observación</th>
                                                <th className="p-1 font-normal text-muted-foreground w-24">Peso/Saco KG</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                     <tr className="divide-x divide-border">
                                        <th className="p-1 sticky left-0 bg-muted/50 z-10"></th>
                                        <th colSpan={5} className="p-1 bg-green-100 dark:bg-green-900/50"></th>
                                        <th className="p-1 bg-yellow-100 dark:bg-yellow-900/50"></th>
                                        <th className="p-1 bg-yellow-100 dark:bg-yellow-900/50"></th>
                                        <th className="p-1 bg-yellow-100 dark:bg-yellow-900/50"></th>
                                        <th className="p-1 bg-yellow-100 dark:bg-yellow-900/50"></th>
                                        <th className="p-1 font-normal text-muted-foreground bg-blue-100 dark:bg-blue-900/50">Color</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-blue-100 dark:bg-blue-900/50">Hum</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-blue-100 dark:bg-blue-900/50">Turb</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-blue-100 dark:bg-blue-900/50">Color</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-blue-100 dark:bg-blue-900/50">Hum</th>
                                        <th className="p-1 font-normal text-muted-foreground bg-blue-100 dark:bg-blue-900/50">Turb</th>
                                        {Array.from({ length: NUM_MACHINES }).map((_, i) => (
                                            <th key={`product_selector_${i}`} className="p-1" colSpan={2}>
                                                <Select value={dailyLog.machines[`machine_${i + 1}`]?.productId} onValueChange={(val) => handleMachineProductChange(`machine_${i + 1}`, val)}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Producto" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {prefetchedProducts.map(p => (
                                                            <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </th>
                                        ))}
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {timeSlots.map((time) => (
                                        <tr key={time} className="divide-x divide-border">
                                            <td className="p-1 w-24 text-center font-mono sticky left-0 bg-card z-10">{time}</td>
                                            {inputCell(time, 'masa')}
                                            {inputCell(time, 'flujo')}
                                            {inputCell(time, 'in_color', 'ns_fam')}
                                            {inputCell(time, 'in_color', 'ns_1')}
                                            {inputCell(time, 'in_color', 'ns_2')}
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
                                            {Array.from({ length: NUM_MACHINES }).map((_, machineIndex) => {
                                                const machineId = `machine_${machineIndex + 1}`;
                                                return (
                                                    <React.Fragment key={machineId}>
                                                        {inputCell(time, 'observation', machineId)}
                                                        {inputCell(time, 'weight', machineId)}
                                                    </React.Fragment>
                                                )
                                            })}
                                            {inputCell(time, 'empaque_obs')}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

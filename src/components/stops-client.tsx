'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';

const NUM_MACHINES = 3;
const TIME_SLOTS_PER_HOUR = 2; // 30-minute intervals
const SHIFT_START_HOUR = 7;
const SHIFT_HOURS = 12;

type MachineLog = {
  productId: string;
  observations: { [timeSlot: string]: string };
  weights: { [timeSlot: string]: string };
};

type DailyLog = {
  id: string; // YYYY-MM-DD
  operator: string;
  lot: string;
  shift: 'day' | 'night';
  machines: { [machineId: string]: MachineLog };
};

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
                observations: {},
                weights: {},
            };
        }
        return {
            id: format(logDate, 'yyyy-MM-dd'),
            operator: '',
            lot: '',
            shift: 'day',
            machines: machineEntries
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
                    setDailyLog(docSnap.data() as DailyLog);
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

    const handleCellChange = (machineId: string, timeSlot: string, field: 'observations' | 'weights', value: string) => {
       if (!dailyLog) return;
        setDailyLog(prev => {
            if (!prev) return null;
            const newMachines = { ...prev.machines };
            const machineLog = { ...newMachines[machineId] };
            machineLog[field] = { ...machineLog[field], [timeSlot]: value };
            newMachines[machineId] = machineLog;
            return { ...prev, machines: newMachines };
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
    
    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <HardHat className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Control de Piso</h1>
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
                                <Label>Operador</Label>
                                <Input value={dailyLog.operator} onChange={e => handleHeaderChange('operator', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Lote</Label>
                                <Input value={dailyLog.lot} onChange={e => handleHeaderChange('lot', e.target.value)} />
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
                            <table className="min-w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr className="divide-x divide-border">
                                        <th className="p-2 w-24 sticky left-0 bg-muted/50 z-10">Hora</th>
                                        {Array.from({ length: NUM_MACHINES }).map((_, i) => {
                                            const machineId = `machine_${i + 1}`;
                                            return (
                                                <th key={machineId} className="p-2" colSpan={2}>
                                                    <p>Máquina #{i + 1}</p>
                                                    <Select value={dailyLog.machines[machineId]?.productId} onValueChange={(val) => handleMachineProductChange(machineId, val)}>
                                                        <SelectTrigger className="h-8 mt-1 text-xs">
                                                            <SelectValue placeholder="Seleccionar producto" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {prefetchedProducts.map(p => (
                                                                <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                    <tr className="divide-x divide-border">
                                        <th className="p-2 w-24 sticky left-0 bg-muted/50 z-10"></th>
                                        {Array.from({ length: NUM_MACHINES }).map((_, i) => (
                                            <React.Fragment key={i}>
                                                <th className="p-2 font-normal text-muted-foreground w-64">Observación</th>
                                                <th className="p-2 font-normal text-muted-foreground w-32">Peso/Saco KG</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {timeSlots.map((time, timeIndex) => (
                                        <tr key={time} className="divide-x divide-border">
                                            <td className="p-2 w-24 text-center font-mono sticky left-0 bg-card z-10">
                                                {timeIndex % TIME_SLOTS_PER_HOUR === 0 && (
                                                    <span className="font-bold text-primary">{Math.floor(timeIndex / TIME_SLOTS_PER_HOUR) + 1}</span>
                                                )}
                                                <span className="ml-2">{time}</span>
                                            </td>
                                            {Array.from({ length: NUM_MACHINES }).map((_, machineIndex) => {
                                                const machineId = `machine_${machineIndex + 1}`;
                                                return (
                                                    <React.Fragment key={machineId}>
                                                        <td className="p-0">
                                                            <Input 
                                                                className="border-none rounded-none focus-visible:ring-1 focus-visible:ring-inset"
                                                                value={dailyLog.machines[machineId]?.observations?.[time] || ''}
                                                                onChange={e => handleCellChange(machineId, time, 'observations', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-0">
                                                            <Input
                                                                type="text"
                                                                className="border-none rounded-none focus-visible:ring-1 focus-visible:ring-inset"
                                                                value={dailyLog.machines[machineId]?.weights?.[time] || ''}
                                                                onChange={e => handleCellChange(machineId, time, 'weights', e.target.value)}
                                                            />
                                                        </td>
                                                    </React.Fragment>
                                                )
                                            })}
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

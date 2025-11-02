'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, PlusCircle, Trash2, Calendar as CalendarIcon, TimerOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition, CategoryDefinition, StopData } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { addStopAction, deleteStopAction } from '@/actions/stops-actions';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

const initialMachines = [
    { id: 'envasadora_1', name: 'Envasadora 1' },
    { id: 'envasadora_2', name: 'Envasadora 2' },
    { id: 'envasadora_3', name: 'Envasadora 3' },
    { id: 'envasadora_4', name: 'Envasadora 4' },
    { id: 'enfardadora_1', name: 'Enfardadora 1' },
    { id: 'enfardadora_2', name: 'Enfardadora 2' },
];

export default function StopsClient({ prefetchedProducts, prefetchedCategories }: { prefetchedProducts: ProductDefinition[], prefetchedCategories: CategoryDefinition[] }) {
    const [stops, setStops] = React.useState<StopData[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    // Form state
    const [machineId, setMachineId] = React.useState<string>('');
    const [cause, setCause] = React.useState('');
    const [startTime, setStartTime] = React.useState<Date | undefined>(new Date());
    const [endTime, setEndTime] = React.useState<Date | undefined>(new Date());
    const [stopType, setStopType] = React.useState<'planned' | 'unplanned'>('unplanned');
    
    // Derived machines list from ia-client logic might be better in the future
    const [machines] = React.useState(initialMachines);

    React.useEffect(() => {
        const fetchStops = async () => {
            setLoading(true);
            try {
                const stopsSnapshot = await getDocs(query(collection(db, 'stops'), orderBy('startTime', 'desc')));
                const stopsList = stopsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StopData));
                setStops(stopsList);
            } catch (error) {
                console.error("Error fetching stops:", error);
                toast({ title: 'Error', description: 'No se pudieron cargar las paradas.', variant: 'destructive' });
            }
            setLoading(false);
        };

        fetchStops();
    }, [toast]);

    const handleAddStop = async () => {
        if (!machineId || !cause || !startTime || !endTime) {
            toast({ title: 'Error', description: 'Todos los campos son obligatorios.', variant: 'destructive' });
            return;
        }

        if (endTime < startTime) {
            toast({ title: 'Error de Fechas', description: 'La hora de fin no puede ser anterior a la hora de inicio.', variant: 'destructive' });
            return;
        }

        const durationMinutes = differenceInMinutes(endTime, startTime);

        try {
            const newStopData = {
                machineId,
                cause,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                durationMinutes,
                type: stopType,
            };
            const newStop = await addStopAction(newStopData);
            setStops(prev => [newStop, ...prev]);

            // Reset form
            setMachineId('');
            setCause('');
            setStartTime(new Date());
            setEndTime(new Date());
            setStopType('unplanned');

            toast({ title: 'Parada Registrada', description: `Se ha añadido una parada para ${machines.find(m => m.id === machineId)?.name}.` });
        } catch (error) {
            console.error("Error adding stop:", error);
            toast({ title: 'Error', description: 'No se pudo registrar la parada.', variant: 'destructive' });
        }
    };
    
    const handleDeleteStop = async (stopId: string) => {
        try {
            await deleteStopAction(stopId);
            setStops(prev => prev.filter(s => s.id !== stopId));
            toast({ title: 'Registro Eliminado' });
        } catch (error) {
             toast({ title: 'Error', description: 'No se pudo eliminar el registro.', variant: 'destructive' });
        }
    };
    
    const formatDateTime = (isoString: string) => {
        try {
            return format(parseISO(isoString), "dd MMM yyyy, HH:mm", { locale: es });
        } catch (error) {
            return "Fecha inválida";
        }
    };

    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <TimerOff className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Análisis de Paradas y OEE</h1>
                </div>
                <Link href="/">
                    <Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver a Planificación</Button>
                </Link>
            </header>
            <main className="p-4 md:p-8 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Registrar Nueva Parada</CardTitle>
                        <CardDescription>Añade los detalles de una parada de máquina para el cálculo de OEE.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                            <div className="space-y-1.5">
                                <Label htmlFor="machine-select">Máquina</Label>
                                <Select value={machineId} onValueChange={setMachineId}>
                                    <SelectTrigger id="machine-select">
                                        <SelectValue placeholder="Seleccionar máquina" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {machines.map(m => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                                <Label htmlFor="stop-cause">Causa de la Parada</Label>
                                <Input id="stop-cause" value={cause} onChange={e => setCause(e.target.value)} placeholder="Ej: Falla en sensor, cambio de bobina..."/>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Tipo de Parada</Label>
                                <RadioGroup value={stopType} onValueChange={(val: 'planned' | 'unplanned') => setStopType(val)} className="flex items-center space-x-4 pt-2">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="unplanned" id="r-unplanned" />
                                        <Label htmlFor="r-unplanned">No Planificada</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="planned" id="r-planned" />
                                        <Label htmlFor="r-planned">Planificada</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div className="space-y-1.5">
                                <Label>Hora de Inicio</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {startTime ? format(startTime, "PPP, HH:mm", { locale: es }) : <span>Seleccionar fecha y hora</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={startTime} onSelect={setStartTime} />
                                        <div className="p-3 border-t border-border">
                                            <Input type="time" value={startTime ? format(startTime, "HH:mm") : ''} onChange={e => {
                                                const [h, m] = e.target.value.split(':');
                                                const newDate = new Date(startTime || new Date());
                                                newDate.setHours(Number(h), Number(m));
                                                setStartTime(newDate);
                                            }}/>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Hora de Fin</Label>
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {endTime ? format(endTime, "PPP, HH:mm", { locale: es }) : <span>Seleccionar fecha y hora</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={endTime} onSelect={setEndTime} />
                                        <div className="p-3 border-t border-border">
                                             <Input type="time" value={endTime ? format(endTime, "HH:mm") : ''} onChange={e => {
                                                const [h, m] = e.target.value.split(':');
                                                const newDate = new Date(endTime || new Date());
                                                newDate.setHours(Number(h), Number(m));
                                                setEndTime(newDate);
                                            }}/>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <Button onClick={handleAddStop}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Registrar Parada
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Paradas</CardTitle>
                        <CardDescription>Lista de todas las paradas registradas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <p>Cargando...</p> : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Máquina</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Causa</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Inicio</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fin</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración (min)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {stops.length > 0 ? stops.map(stop => (
                                            <tr key={stop.id}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{machines.find(m => m.id === stop.machineId)?.name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stop.cause}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(stop.startTime)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(stop.endTime)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stop.durationMinutes}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${stop.type === 'planned' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {stop.type === 'planned' ? 'Planificada' : 'No Planificada'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                             <Button variant="ghost" size="icon" className="text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                                <AlertDialogDescription>Esta acción no se puede deshacer. Esto eliminará permanentemente el registro de la parada.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteStop(stop.id)}>Eliminar</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">No hay paradas registradas.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
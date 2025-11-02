'use client';

import React from 'react';
import type { StopData, StopCause, MaintenanceType } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';

type StopRegistrationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (stopData: StopData) => void;
    machineId: string;
    startTime: string; // This is the initial time slot clicked
    stopCauses: StopCause[];
    maintenanceTypes: MaintenanceType[];
    stopData?: StopData;
};

export default function StopRegistrationModal({ isOpen, onClose, onSave, machineId, startTime, stopCauses, maintenanceTypes, stopData }: StopRegistrationModalProps) {
    const [actualStartTime, setActualStartTime] = React.useState(stopData?.startTime || startTime);
    const [endTime, setEndTime] = React.useState(stopData?.endTime || actualStartTime);
    const [type, setType] = React.useState<'planned' | 'unplanned'>(stopData?.type || 'planned');
    const [maintenanceType, setMaintenanceType] = React.useState<string | undefined>(stopData?.maintenanceType);
    const [reason, setReason] = React.useState(stopData?.reason || '');
    const [cause, setCause] = React.useState(stopData?.cause || '');
    const [solution, setSolution] = React.useState(stopData?.solution || '');

    React.useEffect(() => {
        if (isOpen) {
            if (stopData) {
                setActualStartTime(stopData.startTime);
                setEndTime(stopData.endTime);
                setType(stopData.type);
                setMaintenanceType(stopData.maintenanceType);
                setReason(stopData.reason || '');
                setCause(stopData.cause || '');
                setSolution(stopData.solution || '');
            } else {
                // Reset for new entry
                setActualStartTime(startTime);
                setEndTime(startTime);
                setType('planned');
                setMaintenanceType(undefined);
                setReason('');
                setCause('');
                setSolution('');
            }
        }
    }, [isOpen, stopData, startTime]);

    // When changing stop type, reset the reason if it's not compatible
    React.useEffect(() => {
        const selectedReason = stopCauses.find(c => c.name === reason);
        if (selectedReason && selectedReason.type !== type) {
            setReason('');
        }
    }, [type, reason, stopCauses]);


    const calculateDuration = (start: string, end: string): number => {
        try {
            const [startHour, startMinute] = start.split(':').map(Number);
            const [endHour, endMinute] = end.split(':').map(Number);
            
            const startDate = new Date();
            startDate.setHours(startHour, startMinute, 0, 0);

            const endDate = new Date();
            endDate.setHours(endHour, endMinute, 0, 0);

            if (endDate < startDate) {
                endDate.setDate(endDate.getDate() + 1); // Handle overnight duration
            }

            const diffMs = endDate.getTime() - startDate.getTime();
            return Math.round(diffMs / (1000 * 60));
        } catch (e) {
            return 0;
        }
    };
    
    const handleSave = () => {
        const duration = calculateDuration(actualStartTime, endTime);
        if (duration < 0) {
            // Optional: Add a toast or validation message
            console.error("End time cannot be before start time.");
            return;
        }

        onSave({
            id: stopData?.id || new Date().toISOString(), // Use existing ID or generate a new one
            startTime: actualStartTime,
            endTime,
            duration,
            type,
            maintenanceType: maintenanceType,
            reason,
            cause,
            solution,
        });
    };
    
    const duration = calculateDuration(actualStartTime, endTime);
    const filteredStopCauses = stopCauses.filter(c => c.type === type);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{stopData ? 'Editar' : 'Registrar'} Parada - Máquina {machineId.split('_')[1]}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="start-time">Hora de Inicio</Label>
                             <Input 
                                id="start-time"
                                type="time"
                                value={actualStartTime}
                                onChange={(e) => setActualStartTime(e.target.value)}
                             />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="end-time">Hora de Fin</Label>
                             <Input 
                                id="end-time"
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                min={actualStartTime} // Prevents selecting an end time before the start time on the same day
                             />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Duración (minutos)</Label>
                            <Input value={duration} disabled />
                        </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="stop-type">Tipo de Parada</Label>
                                <Select value={type} onValueChange={(val: 'planned' | 'unplanned') => setType(val)}>
                                    <SelectTrigger id="stop-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planned">Planificada</SelectItem>
                                        <SelectItem value="unplanned">No Planificada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="maint-type">Tipo de Mantenimiento</Label>
                                <Select value={maintenanceType} onValueChange={(val: any) => setMaintenanceType(val)}>
                                    <SelectTrigger id="maint-type">
                                        <SelectValue placeholder="Seleccionar tipo"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {maintenanceTypes.map(mt => (
                                          <SelectItem key={mt.id} value={mt.name}>{mt.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="stop-reason">Motivo</Label>
                             <Select value={reason} onValueChange={setReason}>
                                <SelectTrigger id="stop-reason">
                                    <SelectValue placeholder="Seleccionar motivo..."/>
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredStopCauses.map(cause => (
                                        <SelectItem key={cause.id} value={cause.name}>{cause.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="stop-cause">Causa de la Parada</Label>
                            <Input
                                id="stop-cause"
                                placeholder="Ej: Cable suelto, Sensor dañado..."
                                value={cause}
                                onChange={(e) => setCause(e.target.value)}
                            />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="stop-solution">Solución Aplicada</Label>
                            <Textarea
                                id="stop-solution"
                                placeholder="Ej: Se reemplazó el sensor, se realizó ajuste..."
                                value={solution}
                                onChange={(e) => setSolution(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={!type || !reason || duration < 0}>Guardar Parada</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

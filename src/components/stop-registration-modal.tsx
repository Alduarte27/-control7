'use client';

import React from 'react';
import type { StopData } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StopRegistrationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (stopData: StopData) => void;
    machineId: string;
    startTime: string;
    stopData?: StopData;
    availableTimeSlots: string[];
};

export default function StopRegistrationModal({ isOpen, onClose, onSave, machineId, startTime, stopData, availableTimeSlots }: StopRegistrationModalProps) {
    const [endTime, setEndTime] = React.useState(stopData?.endTime || startTime);
    const [cause, setCause] = React.useState(stopData?.cause || '');
    const [type, setType] = React.useState<'planned' | 'unplanned'>(stopData?.type || 'unplanned');
    const [solution, setSolution] = React.useState(stopData?.solution || '');

    const calculateDuration = (start: string, end: string): number => {
        try {
            const [startHour, startMinute] = start.split(':').map(Number);
            const [endHour, endMinute] = end.split(':').map(Number);
            
            const startDate = new Date();
            startDate.setHours(startHour, startMinute, 0, 0);

            const endDate = new Date();
            endDate.setHours(endHour, endMinute, 0, 0);

            // Handle overnight case
            if (endDate < startDate) {
                endDate.setDate(endDate.getDate() + 1);
            }

            const diffMs = endDate.getTime() - startDate.getTime();
            return Math.round(diffMs / (1000 * 60));

        } catch (e) {
            return 0;
        }
    };
    
    const handleSave = () => {
        const duration = calculateDuration(startTime, endTime);
        onSave({
            startTime,
            endTime,
            duration,
            cause,
            type,
            solution,
        });
    };
    
    const startIndex = availableTimeSlots.indexOf(startTime);
    const validEndTimes = startIndex !== -1 ? availableTimeSlots.slice(startIndex) : availableTimeSlots;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Parada - Máquina {machineId.split('_')[1]}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label>Hora de Inicio</Label>
                            <Input value={startTime} disabled />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="end-time">Hora de Fin</Label>
                             <Select value={endTime} onValueChange={setEndTime}>
                                <SelectTrigger id="end-time">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {validEndTimes.map(time => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="space-y-1.5">
                        <Label>Duración (minutos)</Label>
                        <Input value={calculateDuration(startTime, endTime)} disabled />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="stop-type">Tipo de Parada</Label>
                        <Select value={type} onValueChange={(val: 'planned' | 'unplanned') => setType(val)}>
                            <SelectTrigger id="stop-type">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unplanned">No Planificada</SelectItem>
                                <SelectItem value="planned">Planificada</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="stop-cause">Causa de la Parada</Label>
                        <Textarea
                            id="stop-cause"
                            placeholder="Ej: Falla en sensor, cambio de rollo, mantenimiento..."
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
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={!cause}>Guardar Parada</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

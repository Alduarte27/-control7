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
import { useToast } from '@/hooks/use-toast';

type StopRegistrationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: (stopData: StopData) => void;
    machineId: string;
    startTime: string; // This is the initial time slot clicked
    stopCauses: StopCause[];
    maintenanceTypes: MaintenanceType[];
    stopData?: StopData;
    shift: 'day' | 'night';
};

export default function StopRegistrationModal({ isOpen, onClose, onSave, machineId, startTime, stopCauses, maintenanceTypes, stopData, shift }: StopRegistrationModalProps) {
    const [actualStartTime, setActualStartTime] = React.useState(stopData?.startTime || startTime);
    const [endTime, setEndTime] = React.useState(stopData?.endTime || actualStartTime);
    const [type, setType] = React.useState<'planned' | 'unplanned' | 'observation'>(stopData?.type || 'planned');
    const [maintenanceType, setMaintenanceType] = React.useState<string | undefined>(stopData?.maintenanceType);
    const [reason, setReason] = React.useState(stopData?.reason || '');
    const [cause, setCause] = React.useState(stopData?.cause || '');
    const [solution, setSolution] = React.useState(stopData?.solution || '');
    const { toast } = useToast();

    React.useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                document.body.style.pointerEvents = '';
            }, 100);
        }
        return () => {
            document.body.style.pointerEvents = '';
        };
    }, [isOpen]);

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

    // Filter maintenance types to only show those that have causes of the selected type
    const availableMaintenanceTypes = React.useMemo(() => {
        return maintenanceTypes.filter(mt => {
            return stopCauses.some(c => c.type === type && c.maintenanceType === mt.id);
        });
    }, [maintenanceTypes, stopCauses, type]);

    const selectedMaintTypeId = React.useMemo(() => {
        return maintenanceTypes.find(mt => mt.name === maintenanceType)?.id;
    }, [maintenanceTypes, maintenanceType]);

    const filteredStopCauses = React.useMemo(() => {
        return stopCauses.filter(c => {
            if (c.type !== type) return false;
            if (selectedMaintTypeId && c.maintenanceType !== selectedMaintTypeId) return false;
            return true;
        });
    }, [stopCauses, type, selectedMaintTypeId]);

    // When changing stop type or maintenance type, reset the reason if it's not compatible
    React.useEffect(() => {
        const selectedReason = stopCauses.find(c => c.name === reason);
        if (selectedReason) {
            if (selectedReason.type !== type) {
                setReason('');
            } else if (selectedMaintTypeId && selectedReason.maintenanceType !== selectedMaintTypeId) {
                setReason('');
            }
        }
    }, [type, selectedMaintTypeId, reason, stopCauses]);

    // Also reset maintenance type if it's no longer available for the new type
    React.useEffect(() => {
        if (maintenanceType) {
            const stillAvailable = availableMaintenanceTypes.some(mt => mt.name === maintenanceType);
            if (!stillAvailable) {
                setMaintenanceType(undefined);
            }
        }
    }, [availableMaintenanceTypes, maintenanceType]);

    // Auto-select maintenance type and event type if a reason is selected
    React.useEffect(() => {
        if (reason) {
            const selectedReason = stopCauses.find(c => c.name === reason);
            if (selectedReason) {
                if (selectedReason.type && selectedReason.type !== type) {
                    setType(selectedReason.type);
                }
                if (selectedReason.maintenanceType && !maintenanceType) {
                    const mt = maintenanceTypes.find(m => m.id === selectedReason.maintenanceType);
                    if (mt) {
                        setMaintenanceType(mt.name);
                    }
                }
            }
        }
    }, [reason, stopCauses, maintenanceTypes, type]);


    const calculateDuration = (start: string, end: string): number => {
        try {
            const [startHour, startMinute] = start.split(':').map(Number);
            const [endHour, endMinute] = end.split(':').map(Number);

            let startMins = startHour * 60 + startMinute;
            let endMins = endHour * 60 + endMinute;

            if (shift === 'night') {
                if (startHour < 18) startMins += 24 * 60;
                if (endHour < 18) endMins += 24 * 60;
            }
            if (endMins < startMins) {
                endMins += 24 * 60;
            }

            return endMins - startMins;
        } catch (e) {
            return -1;
        }
    };
    
    const handleSave = () => {
        const duration = calculateDuration(actualStartTime, endTime);
        if (duration <= 0) {
            toast({
                title: 'Error de Tiempo',
                description: 'La hora de fin debe ser posterior a la hora de inicio (la duración no puede ser 0).',
                variant: 'destructive',
            });
            return;
        }
        if (duration > 840) { // More than 14 hours
            toast({
                title: 'Advertencia de Duración',
                description: 'La parada excede las 14 horas. Por favor, verifica las horas de inicio y fin.',
                variant: 'destructive',
            });
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

    const getMachineDisplayName = (mId: string) => {
        if (mId === 'machine_5') return 'Granelera #1';
        if (mId === 'machine_6') return 'Granelera #2';
        if (mId === 'machine_7') return 'Enfardadora #1';
        if (mId === 'machine_8') return 'Enfardadora #2';
        const num = mId.replace(/\D/g, '');
        return `Tecnotok #${num}`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl w-[95vw] p-6 max-h-[90vh] flex flex-col">
                <DialogHeader className="pb-2 border-b">
                    <DialogTitle className="text-lg font-bold">{stopData ? 'Editar' : 'Registrar'} Parada - {getMachineDisplayName(machineId)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-3 max-h-[65vh] overflow-y-auto px-2 pr-4 flex-1">
                    <div className="grid grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="start-time">Hora de Inicio</Label>
                             <Input 
                                id="start-time"
                                type="time"
                                value={actualStartTime}
                                onChange={(e) => setActualStartTime(e.target.value)}
                                min={startTime} // Prevents setting a time before the clicked slot
                             />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="end-time">Hora de Fin</Label>
                             <Input 
                                id="end-time"
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                             />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Duración (minutos)</Label>
                            <Input value={duration >= 0 ? duration : "Error"} disabled />
                        </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="stop-type">Tipo de Evento</Label>
                                <Select value={type} onValueChange={(val: 'planned' | 'unplanned' | 'observation') => setType(val)}>
                                    <SelectTrigger id="stop-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planned">Planificada</SelectItem>
                                        <SelectItem value="unplanned">No Planificada</SelectItem>
                                        <SelectItem value="observation">Observación</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="maint-type">Categoría (Área)</Label>
                                <Select value={maintenanceType} onValueChange={(val: any) => setMaintenanceType(val)}>
                                    <SelectTrigger id="maint-type">
                                        <SelectValue placeholder="Seleccionar tipo"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableMaintenanceTypes.map(mt => (
                                          <SelectItem key={mt.id} value={mt.name} title={mt.description}>{mt.name}</SelectItem>
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
                                        <SelectItem key={cause.id} value={cause.name} title={cause.description}>{cause.name}</SelectItem>
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
                <DialogFooter className="pt-3 border-t mt-2 flex-shrink-0">
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={!type || !reason || duration < 0}>Guardar Registro</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

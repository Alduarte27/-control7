
'use client';

import React from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, FileUp, Loader2, Sparkles, Table, CheckCircle2, Columns, Rows } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { DailyLog, Operator, StopCause, Supervisor, TimeSlot } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';

interface LogImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
    stopCauses: StopCause[];
    operators: Operator[];
    supervisors: Supervisor[];
}

const TARGET_FIELDS = [
    { value: 'date', label: 'Fecha (Requerido)', example: 'yyyy-mm-dd' },
    { value: 'time', label: 'Hora (Requerido)', example: 'HH:mm' },
    { value: 'operator', label: 'Operador' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'machine_1_weight', label: 'P/Saco (Máquina 1)', format: 'wide' },
    { value: 'machine_1_speed', label: 'Velocidad (Máquina 1)', format: 'wide' },
    { value: 'machine_1_stops', label: 'Observación (Máquina 1)', format: 'wide' },
    { value: 'machine_2_weight', label: 'P/Saco (Máquina 2)', format: 'wide' },
    { value: 'machine_2_speed', label: 'Velocidad (Máquina 2)', format: 'wide' },
    { value: 'machine_2_stops', label: 'Observación (Máquina 2)', format: 'wide' },
    { value: 'machine_3_weight', label: 'P/Saco (Máquina 3)', format: 'wide' },
    { value: 'machine_3_speed', label: 'Velocidad (Máquina 3)', format: 'wide' },
    { value: 'machine_3_stops', label: 'Observación (Máquina 3)', format: 'wide' },
    { value: 'machine_id', label: 'Columna de Identificación de Máquina', format: 'long' },
    { value: 'weight', label: 'Peso por Saco (Genérico)', format: 'long' },
    { value: 'speed', label: 'Velocidad (Genérico)', format: 'long' },
    { value: 'stops', label: 'Observación/Parada (Genérico)', format: 'long' },
    { value: 'masa', label: 'Masa' },
    { value: 'flujo', label: 'Flujo' },
    { value: 'ns_fam', label: 'NS-FAM' },
    { value: 'ns_1', label: 'NS% 1' },
    { value: 'ns_2', label: 'NS% 2' },
    { value: 'in_color', label: 'Ingreso Color' },
    { value: 'in_hum', label: 'Ingreso Humedad' },
    { value: 'in_turb', label: 'Ingreso Turbidez' },
    { value: 'in_cv', label: 'Ingreso CV' },
    { value: 'out_fam_color', label: 'Salida Fam Color' },
    { value: 'out_fam_hum', label: 'Salida Fam Humedad' },
    { value: 'out_fam_turb', label: 'Salida Fam Turbidez' },
    { value: 'out_gra_color', label: 'Salida Granel Color' },
    { value: 'out_gra_hum', label: 'Salida Granel Humedad' },
    { value: 'out_gra_turb', label: 'Salida Granel Turbidez' },
    { value: 'empaque_obs', label: 'Novedades Empaque' },
];

export default function LogImportWizard({ isOpen, onClose, onImportComplete, stopCauses, operators, supervisors }: LogImportWizardProps) {
    const [step, setStep] = React.useState(1);
    const [file, setFile] = React.useState<File | null>(null);
    const [fileHeaders, setFileHeaders] = React.useState<string[]>([]);
    const [parsedData, setParsedData] = React.useState<any[]>([]);
    const [mapping, setMapping] = React.useState<{ [key: string]: string }>({});
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [formatType, setFormatType] = React.useState<'wide' | 'long'>('wide');

    const { toast } = useToast();
    
    React.useEffect(() => {
        if (!isOpen) {
            // Reset state on close
            setStep(1);
            setFile(null);
            setFileHeaders([]);
            setParsedData([]);
            setMapping({});
            setIsProcessing(false);
            setFormatType('wide');
        }
    }, [isOpen]);

    const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            parseFile(droppedFile);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        setFile(file);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.meta.fields) {
                    setFileHeaders(results.meta.fields);
                    setParsedData(results.data);
                    setStep(2);
                } else {
                    toast({ title: "Error de Archivo", description: "No se pudieron leer las cabeceras del archivo CSV.", variant: "destructive" });
                }
            }
        });
    };

    const autoMapHeaders = () => {
        const newMapping: { [key: string]: string } = {};
        const lowerCaseHeaders = fileHeaders.map(h => h.toLowerCase().trim().replace(/\s+/g, ' '));
    
        TARGET_FIELDS.forEach(targetField => {
            const potentialMatches = [
                targetField.label.toLowerCase().split('(')[0].trim(),
                targetField.value.toLowerCase().replace(/_/g, ' ')
            ];
            
            const foundIndex = lowerCaseHeaders.findIndex(h => potentialMatches.some(pm => h.includes(pm)));
    
            if (foundIndex > -1) {
                newMapping[targetField.value] = fileHeaders[foundIndex];
            }
        });
        setMapping(newMapping);
        toast({ title: "Automapeo Inteligente", description: "Se han conectado las columnas que coincidían. Por favor, revisa y completa el mapeo.", duration: 5000 });
    };

    const handleMappingChange = (targetField: string, sourceHeader: string) => {
        setMapping(prev => {
            const newMapping = { ...prev };
            if (sourceHeader === '_ignore_') {
                delete newMapping[targetField];
            } else {
                newMapping[targetField] = sourceHeader;
            }
            return newMapping;
        });
    };
    
    const isMappingValid = () => {
        if (!mapping['date'] || !mapping['time']) return false;
        if (formatType === 'long' && !mapping['machine_id']) return false;
        return true;
    }

    const processAndSaveData = async () => {
        setIsProcessing(true);
        const logsToSave: { [logId: string]: DailyLog } = {};
        const stopCauseNames = new Set(stopCauses.map(sc => sc.name));
        const operatorNames = new Set(operators.map(o => o.name));
        const supervisorNames = new Set(supervisors.map(s => s.name));

        for (const row of parsedData) {
            const dateStr = row[mapping['date']];
            const timeStr = row[mapping['time']];

            if (!dateStr || !timeStr) continue;

            const date = new Date(dateStr);
            if (isNaN(date.getTime())) continue;

            const hour = parseInt(timeStr.split(':')[0]);
            const shift = (hour >= 7 && hour < 19) ? 'day' : 'night';
            const logId = `${format(date, 'yyyy-MM-dd')}_${shift}`;

            if (!logsToSave[logId]) {
                const docSnap = await getDoc(doc(db, 'dailyLogs', logId));
                if (docSnap.exists()) {
                    logsToSave[logId] = docSnap.data() as DailyLog;
                } else {
                    logsToSave[logId] = {
                        id: logId,
                        shift,
                        lote: String(format(date, 'D', { locale: es })),
                        operador: '', supervisor: '',
                        machines: { machine_1: {productId: ''}, machine_2: {productId: ''}, machine_3: {productId: ''} },
                        timeSlots: {}
                    };
                }
            }
            const log = logsToSave[logId];

            if (mapping['operator'] && row[mapping['operator']] && operatorNames.has(row[mapping['operator']])) {
                log.operador = row[mapping['operator']];
            }
            if (mapping['supervisor'] && row[mapping['supervisor']] && supervisorNames.has(row[mapping['supervisor']])) {
                log.supervisor = row[mapping['supervisor']];
            }

            if (!log.timeSlots[timeStr]) log.timeSlots[timeStr] = {};
            const slot = log.timeSlots[timeStr] as TimeSlot;
            
            const processField = (fieldKey: string, machineIdSuffix?: string) => {
                const mapKey = machineIdSuffix ? `${fieldKey}_${machineIdSuffix}` : fieldKey;
                const machineId = `machine_${machineIdSuffix}`;

                if (mapping[mapKey] && row[mapping[mapKey]]) {
                    const value = row[mapping[mapKey]];
                    const fieldName = fieldKey.replace(`machine_${machineIdSuffix}_`, '');

                     if (!slot[machineId]) slot[machineId] = {};
                        
                    if (fieldName === 'stops') {
                        if (value && typeof value === 'string' && value.trim() !== '') {
                            if (!slot[machineId]!.stops) slot[machineId]!.stops = [];
                            const reason = stopCauseNames.has(value.trim()) ? value.trim() : 'No Planificada';
                            const type = stopCauses.find(sc => sc.name === reason)?.type || 'unplanned';
                            slot[machineId]!.stops!.push({
                                id: new Date().toISOString() + Math.random(),
                                startTime: timeStr,
                                endTime: format(new Date(date.setMinutes(date.getMinutes() + 30)), 'HH:mm'),
                                duration: 30,
                                reason,
                                type,
                                cause: 'Importado desde Excel',
                            });
                        }
                    } else {
                        (slot[machineId] as any)[fieldName] = fieldName === 'speed' ? Number(value) : value;
                    }
                }
            }

            if (formatType === 'wide') {
                for (let i = 1; i <= 3; i++) {
                    processField(`machine_${i}_weight`);
                    processField(`machine_${i}_speed`);
                    processField(`machine_${i}_stops`);
                }
            } else { // 'long' format
                const machineIdentifier = row[mapping['machine_id']];
                if (machineIdentifier && ['1', '2', '3'].includes(String(machineIdentifier))) {
                    const machineId = `machine_${machineIdentifier}`;
                     if (!slot[machineId]) slot[machineId] = {};

                    if (mapping['weight'] && row[mapping['weight']]) {
                        (slot[machineId] as any)['weight'] = row[mapping['weight']];
                    }
                    if (mapping['speed'] && row[mapping['speed']]) {
                        (slot[machineId] as any)['speed'] = Number(row[mapping['speed']]);
                    }
                    if (mapping['stops'] && row[mapping['stops']] && String(row[mapping['stops']]).trim() !== '') {
                        if (!slot[machineId]!.stops) slot[machineId]!.stops = [];
                        const value = String(row[mapping['stops']]).trim();
                        const reason = stopCauseNames.has(value) ? value : 'No Planificada';
                        const type = stopCauses.find(sc => sc.name === reason)?.type || 'unplanned';
                        slot[machineId]!.stops!.push({
                            id: new Date().toISOString() + Math.random(),
                            startTime: timeStr,
                            endTime: format(new Date(date.setMinutes(date.getMinutes() + 30)), 'HH:mm'),
                            duration: 30,
                            reason, type,
                            cause: 'Importado desde Excel',
                        });
                    }
                }
            }

            // Process common fields
            TARGET_FIELDS.filter(f => !f.format).forEach(field => {
                 if (mapping[field.value] && row[mapping[field.value]]) {
                    const value = row[mapping[field.value]];
                     if (field.value !== 'date' && field.value !== 'time') {
                        (slot as any)[field.value] = value;
                    }
                 }
            });
        }
        
        try {
            const batch = writeBatch(db);
            Object.values(logsToSave).forEach(log => {
                const docRef = doc(db, 'dailyLogs', log.id);
                batch.set(docRef, log, { merge: true });
            });
            await batch.commit();
            toast({ title: "Importación Exitosa", description: `${Object.keys(logsToSave).length} bitácoras han sido actualizadas.` });
            onImportComplete();
        } catch (error) {
            console.error("Error saving imported logs:", error);
            toast({ title: "Error al Guardar", description: "No se pudieron guardar los datos importados.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const getPreviewData = () => {
        if (parsedData.length === 0) return [];
        return parsedData.slice(0, 5).map(row => {
            const previewRow: { [key: string]: string } = {};
            const relevantFields = TARGET_FIELDS.filter(f => !f.format || f.format === formatType);
            relevantFields.forEach(field => {
                if (mapping[field.value]) {
                    previewRow[field.label] = row[mapping[field.value]] || '';
                } else {
                    previewRow[field.label] = ''
                }
            });
            return previewRow;
        });
    };

    const previewData = step === 3 ? getPreviewData() : [];
    const visibleTargetFields = TARGET_FIELDS.filter(f => !f.format || f.format === formatType);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Asistente de Importación de Bitácora</DialogTitle>
                    <DialogDescription>
                        Sigue los pasos para importar tus datos desde un archivo CSV.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    {step === 1 && (
                        <div 
                            className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                        >
                            <FileUp className="h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-xl font-semibold">Arrastra y suelta tu archivo CSV aquí</h3>
                            <p className="text-muted-foreground mt-2">o</p>
                            <Button className="mt-4" onClick={() => document.getElementById('file-upload')?.click()}>
                                Seleccionar Archivo
                            </Button>
                            <input type="file" id="file-upload" className="hidden" accept=".csv" onChange={handleFileSelect} />
                             <p className="text-xs text-muted-foreground mt-6">
                                Asegúrate de guardar tu archivo de Excel como **CSV UTF-8 (delimitado por comas)** para una importación correcta.
                            </p>
                        </div>
                    )}
                    {step === 2 && (
                        <div>
                            <h3 className="font-semibold text-lg mb-4">Paso 2: Formato y Mapeo de Columnas</h3>
                            
                            <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                                <Label className="font-semibold text-base">Elige el formato de tu archivo</Label>
                                <RadioGroup value={formatType} onValueChange={(v: 'wide' | 'long') => setFormatType(v)} className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Label htmlFor="format-wide" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary">
                                        <RadioGroupItem value="wide" id="format-wide" className="sr-only"/>
                                        <Columns className="mb-3 h-6 w-6" />
                                        <span className="font-bold">Ancho (Columnas por Máquina)</span>
                                        <span className="text-sm text-muted-foreground text-center">Usa este si tienes columnas separadas como "Peso Máq. 1", "Parada Máq. 1", etc.</span>
                                    </Label>
                                     <Label htmlFor="format-long" className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary">
                                        <RadioGroupItem value="long" id="format-long" className="sr-only"/>
                                        <Rows className="mb-3 h-6 w-6" />
                                        <span className="font-bold">Largo (Una Columna por Máquina)</span>
                                        <span className="text-sm text-muted-foreground text-center">Usa este si tienes una columna para "Peso", otra para "Parada", y una para identificar la máquina.</span>
                                    </Label>
                                </RadioGroup>
                            </div>

                            <p className="text-sm text-muted-foreground mb-4">
                                Conecta las columnas de tu archivo CSV (izquierda) con los campos de destino en la aplicación (derecha).
                            </p>
                            <Button onClick={autoMapHeaders} variant="outline" size="sm" className="mb-4">
                                <Sparkles className="mr-2 h-4 w-4"/>
                                Intentar Mapeo Automático
                            </Button>
                            <div className="space-y-3 max-h-[45vh] overflow-y-auto">
                                {visibleTargetFields.map(field => (
                                    <div key={field.value} className="grid grid-cols-3 items-center gap-4">
                                        <div className="col-span-1">
                                            <p className={cn("font-medium text-sm", formatType === 'long' && field.value === 'machine_id' && 'text-primary font-bold')}>{field.label}</p>
                                            {field.example && <p className="text-xs text-muted-foreground">Ej: {field.example}</p>}
                                        </div>
                                        <div className="col-span-2">
                                            <Select
                                                value={mapping[field.value] || ''}
                                                onValueChange={(value) => handleMappingChange(field.value, value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona una columna de tu archivo..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="_ignore_">-- Ignorar --</SelectItem>
                                                    {fileHeaders.map(header => (
                                                        <SelectItem key={header} value={header}>{header}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                     {step === 3 && (
                        <div>
                            <h3 className="font-semibold text-lg mb-4">Paso 3: Previsualiza y Confirma</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Revisa una muestra de cómo se importarán tus datos. Si todo es correcto, procede con la importación.
                                Las paradas se crearán con una duración de 30 minutos por cada celda con texto.
                            </p>
                             <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted">
                                        <tr>
                                            {Object.keys(previewData[0] || {}).map(header => (
                                                <th key={header} className="p-2 text-left font-semibold">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {previewData.map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {Object.values(row).map((cell, cellIndex) => (
                                                    <td key={cellIndex} className="p-2 truncate max-w-[200px]">{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                    {step > 1 && (
                        <Button variant="outline" onClick={() => setStep(s => s - 1)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Atrás
                        </Button>
                    )}
                    {step === 2 && (
                        <Button onClick={() => setStep(3)} disabled={!isMappingValid()}>
                            Previsualizar <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                    {step === 3 && (
                        <Button onClick={processAndSaveData} disabled={isProcessing}>
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Confirmar e Importar Datos
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

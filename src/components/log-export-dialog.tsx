
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { DailyLog, StopData } from '@/lib/types';
import { Download, Upload, FileJson, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/components/ui/alert-dialog';

type LogExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLog: DailyLog;
  onImport: (log: DailyLog) => void;
};

type SavedLogMeta = {
  id: string; // e.g., "2024-07-30_day"
  date: string;
  shift: string;
};

export default function LogExportDialog({ open, onOpenChange, currentLog, onImport }: LogExportDialogProps) {
  const [availableLogs, setAvailableLogs] = React.useState<SavedLogMeta[]>([]);
  const [startLog, setStartLog] = React.useState<string>('');
  const [endLog, setEndLog] = React.useState<string>('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [importConfirmation, setImportConfirmation] = React.useState<DailyLog | null>(null);

  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const fetchAvailableLogs = async () => {
      try {
        const logsSnapshot = await getDocs(collection(db, 'dailyLogs'));
        const logs: SavedLogMeta[] = [];
        logsSnapshot.forEach((doc) => {
          const [date, shift] = doc.id.split('_');
          logs.push({ id: doc.id, date, shift });
        });
        logs.sort((a, b) => b.id.localeCompare(a.id)); // Newest first
        setAvailableLogs(logs);

        if (logs.length > 0) {
          const currentExists = logs.find(l => l.id === currentLog.id);
          const initialSelection = currentExists ? currentLog.id : logs[0].id;
          setStartLog(initialSelection);
          setEndLog(initialSelection);
        }
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudieron cargar las bitácoras disponibles.', variant: 'destructive' });
      }
    };

    fetchAvailableLogs();
  }, [open, toast, currentLog.id]);

  const fetchRangeData = async (): Promise<{ allLogsData: DailyLog[], selectedLogIds: string[] }> => {
    const sortedLogs = [...availableLogs].sort((a, b) => a.id.localeCompare(b.id)); // chronological
    
    const startIndex = sortedLogs.findIndex(p => p.id === startLog);
    const endIndex = sortedLogs.findIndex(p => p.id === endLog);

    if (startIndex > endIndex) {
        toast({ title: 'Error de Rango', description: 'La fecha de inicio debe ser anterior o igual a la fecha de fin.', variant: 'destructive'});
        throw new Error("Invalid range");
    }
    
    const selectedLogIds = sortedLogs.slice(startIndex, endIndex + 1).map(p => p.id);

    if (selectedLogIds.length === 0) {
        toast({ title: 'Advertencia', description: 'No hay bitácoras en el rango seleccionado.', variant: 'destructive'});
        throw new Error("No logs in range");
    }

    const BATCH_SIZE = 30; // Firestore 'in' query limit
    const logPromises = [];
    for (let i = 0; i < selectedLogIds.length; i += BATCH_SIZE) {
        const batchIds = selectedLogIds.slice(i, i + BATCH_SIZE);
        logPromises.push(getDocs(query(collection(db, 'dailyLogs'), where('__name__', 'in', batchIds))));
    }

    const querySnapshots = await Promise.all(logPromises);
    
    const allLogsData: DailyLog[] = [];
    querySnapshots.forEach(snapshot => {
        snapshot.forEach(doc => {
            allLogsData.push({ ...doc.data(), id: doc.id } as DailyLog);
        });
    });
    
    allLogsData.sort((a, b) => a.id.localeCompare(b.id));
    return { allLogsData, selectedLogIds };
  }

  const handleExportCSV = async () => {
    if (!startLog || !endLog) {
        toast({ title: 'Error', description: 'Por favor, selecciona un rango.', variant: 'destructive' });
        return;
    }
    setIsProcessing(true);

    try {
        const { allLogsData } = await fetchRangeData();
        
        const headers = [
            'Fecha', 'Turno', 'Lote', 'Operador', 'Supervisor',
            'Maquina', 'Producto',
            'Hora Inicio Parada', 'Hora Fin Parada', 'Duracion (min)', 'Tipo Parada',
            'Motivo', 'Causa Especifica', 'Solucion'
        ];

        const rows: string[] = [];
        allLogsData.forEach(log => {
            const [date, shift] = log.id.split('_');

            if (!log.timeSlots || Object.keys(log.timeSlots).length === 0) {
                const baseRow = [date, shift, log.lote, log.operador, log.supervisor].join(',');
                rows.push(baseRow);
                return;
            }

            const allStops: (StopData & { machineId: string })[] = [];
            Object.values(log.timeSlots).forEach(slot => {
                if (!slot || typeof slot !== 'object') return;
                Object.entries(slot).forEach(([machineId, machineData]) => {
                    if (machineId.startsWith('machine_') && machineData && typeof machineData === 'object' && 'stops' in machineData && Array.isArray(machineData.stops)) {
                        (machineData.stops as StopData[]).forEach(stop => {
                            allStops.push({ ...stop, machineId });
                        });
                    }
                });
            });

            if (allStops.length === 0) {
                 const baseRow = [date, shift, log.lote, log.operador, log.supervisor].join(',');
                 rows.push(baseRow);
            } else {
                 allStops.forEach(stop => {
                    const row = [
                        date,
                        shift,
                        log.lote,
                        log.operador,
                        log.supervisor,
                        stop.machineId.replace('machine_', 'Maquina '),
                        log.machines[stop.machineId]?.productId || 'N/A', // You might want to map this to product name
                        stop.startTime,
                        stop.endTime,
                        stop.duration,
                        stop.type,
                        `"${(stop.reason || '').replace(/"/g, '""')}"`,
                        `"${(stop.cause || '').replace(/"/g, '""')}"`,
                        `"${(stop.solution || '').replace(/"/g, '""')}"`,
                    ].join(',');
                    rows.push(row);
                });
            }
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `reporte-bitacora_${startLog}_a_${endLog}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({ title: 'Exportación CSV Exitosa' });
    } catch (error: any) {
        if (error.message.includes("Invalid range") || error.message.includes("No logs")) return;
        console.error("Error exporting CSV:", error);
        toast({ title: 'Error de Exportación', description: 'No se pudo generar el archivo CSV.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleExportJSON = async () => {
     if (!startLog || !endLog) {
        toast({ title: 'Error', description: 'Por favor, selecciona un rango.', variant: 'destructive' });
        return;
    }
    setIsProcessing(true);
     try {
        const { allLogsData } = await fetchRangeData();
        allLogsData.forEach(log => {
             const jsonString = JSON.stringify(log, null, 2);
             const blob = new Blob([jsonString], { type: "application/json" });
             const url = URL.createObjectURL(blob);
             const link = document.createElement("a");
             link.href = url;
             link.download = `bitacora_${log.id}.json`;
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             URL.revokeObjectURL(url);
        });
        toast({ title: 'Exportación JSON Exitosa', description: `Se han descargado ${allLogsData.length} archivos.`});
    } catch (error: any) {
        if (error.message.includes("Invalid range") || error.message.includes("No logs")) return;
        console.error("Error exporting JSON:", error);
        toast({ title: 'Error de Exportación', description: 'No se pudieron generar los archivos JSON.', variant: 'destructive' });
    } finally {
        setIsProcessing(false);
    }
  };
  
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("File is not readable.");
                const importedData = JSON.parse(text) as DailyLog;

                if (!importedData.id || !importedData.shift || !importedData.machines) {
                    throw new Error("El archivo no tiene el formato de bitácora correcto.");
                }
                setImportConfirmation(importedData);
            } catch (error: any) {
                toast({ title: "Error de Importación", description: error.message || "No se pudo leer o procesar el archivo.", variant: "destructive" });
            } finally {
                if(fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    const confirmImport = () => {
        if (!importConfirmation) return;
        onImport(importConfirmation);
        setImportConfirmation(null);
        onOpenChange(false);
    };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar y Exportar Bitácoras</DialogTitle>
          <DialogDescription>
            Realiza copias de seguridad, exporta para análisis o importa datos a la bitácora.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
            {/* Export Section */}
            <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Download className="h-5 w-5 text-primary"/> Opciones de Exportación</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="start-week">Desde</Label>
                        <Select value={startLog} onValueChange={setStartLog} disabled={availableLogs.length === 0}>
                            <SelectTrigger id="start-week"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {availableLogs.map(log => (
                                <SelectItem key={log.id} value={log.id}>
                                    {log.date} ({log.shift === 'day' ? 'Día' : 'Noche'})
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="end-week">Hasta</Label>
                        <Select value={endLog} onValueChange={setEndLog} disabled={availableLogs.length === 0}>
                            <SelectTrigger id="end-week"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {availableLogs.map(log => (
                                <SelectItem key={log.id} value={log.id}>
                                    {log.date} ({log.shift === 'day' ? 'Día' : 'Noche'})
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button onClick={handleExportCSV} disabled={isProcessing}>
                        <FileText className="mr-2 h-4 w-4" />
                        {isProcessing ? 'Exportando...' : 'Exportar Rango a CSV'}
                    </Button>
                    <Button onClick={handleExportJSON} disabled={isProcessing} variant="secondary">
                        <FileJson className="mr-2 h-4 w-4" />
                        {isProcessing ? 'Exportando...' : 'Exportar a JSON (Backup)'}
                    </Button>
                </div>
            </div>

            {/* Import Section */}
            <div className="space-y-2 p-4 border rounded-lg">
                <h3 className="font-semibold text-lg flex items-center gap-2"><Upload className="h-5 w-5 text-primary"/> Importar Bitácora</h3>
                <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
                <p className="text-sm text-muted-foreground">Sube un archivo JSON para reemplazar los datos de la bitácora actual. La bitácora actual debe estar seleccionada antes de importar.</p>
                <Button onClick={handleImportClick} className="w-full" variant="outline">
                    Seleccionar archivo JSON
                </Button>
            </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Import Confirmation Dialog */}
    {importConfirmation && (
        <AlertDialog open={!!importConfirmation} onOpenChange={() => setImportConfirmation(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-yellow-500" />Confirmar Importación</AlertDialogTitle>
                    <AlertDialogDescription>
                        Estás a punto de reemplazar los datos de la bitácora actual (<strong>{currentLog.id}</strong>) con los del archivo <strong>{`bitacora_${importConfirmation.id}.json`}</strong>. Esta acción no se puede deshacer. ¿Deseas continuar?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setImportConfirmation(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmImport}>Sí, Importar y Guardar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )}
    </>
  );
}


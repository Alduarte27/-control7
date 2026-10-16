'use client';

import React from 'react';
import { CalendarCheck, Trash2, CalendarRange, Clock, History, RefreshCw, Archive, Eye, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, doc, deleteDoc, type DocumentData, type QueryDocumentSnapshot, writeBatch, where } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

type DailyLogMeta = {
  id: string; // Document ID from Firestore, e.g., "2024-07-30_day"
  date: string;
  shift: 'day' | 'night';
};

const LOGS_PER_PAGE = 20;

function DeleteRangeDialog({ allLogs, onConfirm, isDeleting, isOpen, onOpenChange }: { allLogs: DailyLogMeta[], onConfirm: (start: string, end: string) => void, isDeleting: boolean, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const [startLog, setStartLog] = React.useState<string>('');
    const [endLog, setEndLog] = React.useState<string>('');
    const { toast } = useToast();

    const handleDelete = () => {
        if (!startLog || !endLog) {
            toast({ title: 'Error', description: 'Debes seleccionar un rango de inicio y fin.', variant: 'destructive'});
            return;
        }
        if (startLog < endLog) {
            toast({ title: 'Error de Rango', description: 'La fecha de inicio debe ser más reciente o igual a la fecha de fin.', variant: 'destructive'});
            return;
        }
        onConfirm(startLog, endLog);
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarRange className="h-5 w-5 text-destructive" />
                        Eliminar por Rango
                    </DialogTitle>
                    <DialogDescription>
                        Selecciona el rango de bitácoras que deseas eliminar. Esta acción es permanente.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 py-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="start-log">Desde (la más reciente)</Label>
                        <Select value={startLog} onValueChange={setStartLog}>
                            <SelectTrigger id="start-log"><SelectValue placeholder="Fecha de inicio"/></SelectTrigger>
                            <SelectContent>
                                {allLogs.map(log => <SelectItem key={log.id} value={log.id}>{log.date} ({log.shift === 'day' ? 'Día' : 'Noche'})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="end-log">Hasta (la más antigua)</Label>
                            <Select value={endLog} onValueChange={setEndLog}>
                            <SelectTrigger id="end-log"><SelectValue placeholder="Fecha de fin"/></SelectTrigger>
                            <SelectContent>
                                {allLogs.map(log => <SelectItem key={log.id} value={log.id}>{log.date} ({log.shift === 'day' ? 'Día' : 'Noche'})</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isDeleting || !startLog || !endLog}>
                                {isDeleting ? 'Eliminando...' : 'Eliminar Rango'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Confirmar Eliminación Masiva?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Se eliminarán todas las bitácoras desde el <strong>{startLog}</strong> hasta el <strong>{endLog}</strong>.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Sí, eliminar rango</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function LogHistoryModal({ open, onOpenChange, onLoadLog }: { open: boolean, onOpenChange: (open: boolean) => void, onLoadLog: (date: string, shift: 'day'|'night', mode: 'read' | 'edit') => void }) {
  const [allLogs, setAllLogs] = React.useState<DailyLogMeta[]>([]);
  const [paginatedLogs, setPaginatedLogs] = React.useState<DailyLogMeta[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const { toast } = useToast();

  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteRangeOpen, setDeleteRangeOpen] = React.useState(false);

  const fetchLogs = React.useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
        let logsQuery;
        if (initialLoad || !lastVisible) {
            logsQuery = query(
                collection(db, 'dailyLogs'),
                orderBy('id', 'desc'),
                limit(LOGS_PER_PAGE)
            );
        } else {
            logsQuery = query(
                collection(db, 'dailyLogs'),
                orderBy('id', 'desc'),
                startAfter(lastVisible),
                limit(LOGS_PER_PAGE)
            );
        }

        const logsSnapshot = await getDocs(logsQuery);
        const newLogs: DailyLogMeta[] = [];
        logsSnapshot.forEach((doc) => {
            const [date, shift] = doc.id.split('_');
            newLogs.push({
                id: doc.id,
                date,
                shift: shift as 'day' | 'night',
            });
        });
        
        const lastDoc = logsSnapshot.docs[logsSnapshot.docs.length - 1];
        setLastVisible(lastDoc || null);
        
        if (newLogs.length < LOGS_PER_PAGE) {
            setHasMore(false);
        }

        setPaginatedLogs(prevLogs => initialLoad ? newLogs : [...prevLogs, ...newLogs]);

        if (initialLoad) {
          let allLogsSnapshot;
          try {
            allLogsSnapshot = await getDocs(query(collection(db, 'dailyLogs'), orderBy('id', 'desc')));
          } catch {
            allLogsSnapshot = await getDocs(collection(db, 'dailyLogs'));
          }
          const allFetchedLogs = allLogsSnapshot.docs
            .map(doc => {
              const [date, shift] = doc.id.split('_');
              return { id: doc.id, date, shift: shift as 'day' | 'night' };
            })
            .sort((a, b) => b.id.localeCompare(a.id));
          setAllLogs(allFetchedLogs);
        }

    } catch (error) {
        console.error("Error fetching history from Firestore:", error);
    } finally {
        setLoading(false);
        setLoadingMore(false);
    }
  }, [lastVisible]);

  React.useEffect(() => {
    if (open) {
        fetchLogs(true);
    }
  }, [open]);
  
  const handleDeleteLog = async (logId: string) => {
    try {
        await deleteDoc(doc(db, 'dailyLogs', logId));
        setPaginatedLogs(prevLogs => prevLogs.filter(log => log.id !== logId));
        setAllLogs(prevLogs => prevLogs.filter(log => log.id !== logId));
        toast({
            title: 'Registro Eliminado',
            description: `Se ha eliminado la bitácora ${logId}.`,
        });
    } catch (error) {
        console.error("Error deleting log:", error);
        toast({
            title: 'Error',
            description: 'No se pudo eliminar el registro.',
            variant: 'destructive',
        });
    }
  };

  const handleDeleteRange = async (startLog: string, endLog: string) => {
    setIsDeleting(true);
    
    const logsToDeleteQuery = query(
        collection(db, 'dailyLogs'),
        where('__name__', '>=', endLog),
        where('__name__', '<=', startLog)
    );

    try {
        const logsSnapshot = await getDocs(logsToDeleteQuery);
        if (logsSnapshot.empty) {
            toast({ title: 'Sin Datos', description: 'No se encontraron bitácoras en el rango seleccionado para eliminar.' });
            setIsDeleting(false);
            return;
        }

        const batch = writeBatch(db);
        logsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        toast({ title: 'Rango Eliminado', description: `Se han eliminado ${logsSnapshot.size} bitácoras.`});
        setDeleteRangeOpen(false);
        fetchLogs(true);
    } catch(error) {
        console.error("Error deleting log range:", error);
        toast({ title: 'Error', description: 'No se pudo completar la eliminación del rango.', variant: 'destructive'});
    } finally {
        setIsDeleting(false);
    }
  }


  const groupedLogs = React.useMemo(() => {
    const groups: { [date: string]: { day?: DailyLogMeta, night?: DailyLogMeta } } = {};
    paginatedLogs.forEach(log => {
        if (!groups[log.date]) {
            groups[log.date] = {};
        }
        groups[log.date][log.shift] = log;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [paginatedLogs]);

  const renderLogCard = (log: DailyLogMeta | undefined, expectedShift: 'day' | 'night', shiftLabel: string) => {
      if (!log) {
          return (
              <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border/50 rounded-xl text-muted-foreground bg-muted/5 h-full">
                  <span className="text-sm">Sin registro de {shiftLabel}</span>
              </div>
          );
      }
      return (
          <div className="group p-4 border rounded-xl transition-all relative hover:border-primary/50 hover:bg-primary/5 bg-background">
              <div className="flex items-start justify-between mb-2">
                  <div className="space-y-1">
                      <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm transition-colors leading-tight text-foreground group-hover:text-primary">
                              Turno de {log.shift === 'day' ? 'Día' : 'Noche'}
                          </h4>
                          <Badge className={log.shift === 'day' ? 'bg-amber-500 hover:bg-amber-600 text-white h-4 px-1.5 text-[9px] font-black uppercase tracking-wider' : 'bg-indigo-600 hover:bg-indigo-700 text-white h-4 px-1.5 text-[9px] font-black uppercase tracking-wider'}>
                              {log.shift === 'day' ? 'Día' : 'Noche'}
                          </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                          <CalendarCheck className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                              {log.date}
                          </span>
                      </div>
                  </div>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-1">
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  Esta acción es permanente y no se puede deshacer. Se eliminará el registro de la bitácora para el día <strong>{log.date}</strong> ({log.shift === 'day' ? 'Día' : 'Noche'}).
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLog(log.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Sí, eliminar
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
              <Separator className="my-3 opacity-50" />
              <div className="flex gap-2">
                  <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                      onClick={() => {
                          onLoadLog(log.date, log.shift, 'read');
                          onOpenChange(false);
                      }}
                  >
                      <Eye className="h-4 w-4 mr-2" />
                      Solo Lectura
                  </Button>
                  <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                      onClick={() => {
                          onLoadLog(log.date, log.shift, 'edit');
                          onOpenChange(false);
                      }}
                  >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Modo Edición
                  </Button>
              </div>
          </div>
      );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[95vw] h-full sm:h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 border-b flex-shrink-0">
                <DialogTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Historial de Registros
                </DialogTitle>
                <DialogDescription>
                    Gestiona y consulta las bitácoras guardadas anteriormente.
                </DialogDescription>
                <div className="mt-4 flex gap-2">
                     <Button variant="outline" size="sm" onClick={() => setDeleteRangeOpen(true)} className="w-fit text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminación Masiva
                    </Button>
                </div>
            </DialogHeader>

            <ScrollArea className="flex-1 px-6 py-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Cargando historial...</p>
                    </div>
                ) : groupedLogs.length > 0 ? (
                <div className="space-y-6 pb-8">
                    {groupedLogs.map(([date, shifts]) => (
                        <div key={date} className="flex flex-col space-y-2 mb-6">
                             <div className="flex items-center gap-2 mb-1 pl-1">
                                 <CalendarRange className="h-4 w-4 text-primary/70" />
                                 <h3 className="font-semibold text-sm text-foreground/80">Fecha: {date}</h3>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {renderLogCard(shifts.day, 'day', 'Día')}
                                  {renderLogCard(shifts.night, 'night', 'Noche')}
                             </div>
                        </div>
                    ))}
                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <Button onClick={() => fetchLogs(false)} disabled={loadingMore} variant="outline" className="w-full rounded-xl">
                                {loadingMore ? 'Cargando...' : 'Cargar Más Registros'}
                            </Button>
                        </div>
                    )}
                    {!hasMore && (
                        <p className="text-center text-muted-foreground text-sm pt-4">Has llegado al final del historial.</p>
                    )}
                </div>
                ) : (
                <div className="text-center py-20">
                    <Archive className="h-10 w-10 mx-auto text-muted-foreground opacity-20 mb-2" />
                    <p className="text-sm text-muted-foreground">No hay bitácoras guardadas todavía.</p>
                </div>
                )}
            </ScrollArea>
            <DeleteRangeDialog allLogs={allLogs} onConfirm={handleDeleteRange} isDeleting={isDeleting} isOpen={deleteRangeOpen} onOpenChange={setDeleteRangeOpen} />
            <DialogFooter className="p-4 border-t bg-background/80 backdrop-blur shadow-sm z-10 flex-shrink-0 sm:justify-center">
                <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                        Cerrar Historial
                    </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}

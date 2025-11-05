'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarCheck, ChevronLeft, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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


type DailyLogMeta = {
  id: string; // Document ID from Firestore, e.g., "2024-07-30_day"
  date: string;
  shift: 'day' | 'night';
};

const LOGS_PER_PAGE = 20;

function DeleteRangeDialog({ allLogs, onConfirm, isDeleting }: { allLogs: DailyLogMeta[], onConfirm: (start: string, end: string) => void, isDeleting: boolean }) {
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
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Eliminar Bitácoras por Rango</DialogTitle>
                <DialogDescription>
                    Selecciona el rango de bitácoras que deseas eliminar. Esta acción es permanente y no se puede deshacer.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
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
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="secondary">Cancelar</Button>
                </DialogClose>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting || !startLog || !endLog}>
                            {isDeleting ? 'Eliminando...' : 'Eliminar Rango Seleccionado'}
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
                            <AlertDialogAction onClick={handleDelete}>Sí, eliminar rango</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogFooter>
        </DialogContent>
    )
}

export default function LogHistoryClient() {
  const [allLogs, setAllLogs] = React.useState<DailyLogMeta[]>([]);
  const [paginatedLogs, setPaginatedLogs] = React.useState<DailyLogMeta[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const { toast } = useToast();

  const [isDeleting, setIsDeleting] = React.useState(false);

  const fetchLogs = React.useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
        let logsQuery;
        // The ID is structured as YYYY-MM-DD_shift, so we can just sort by it descendingly.
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
          const allLogsSnapshot = await getDocs(query(collection(db, 'dailyLogs'), orderBy('id', 'desc')));
          const allFetchedLogs = allLogsSnapshot.docs.map(doc => {
            const [date, shift] = doc.id.split('_');
            return { id: doc.id, date, shift: shift as 'day' | 'night' };
          });
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
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
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
        fetchLogs(true);
    } catch(error) {
        console.error("Error deleting log range:", error);
        toast({ title: 'Error', description: 'No se pudo completar la eliminación del rango.', variant: 'destructive'});
    } finally {
        setIsDeleting(false);
    }
  }


  return (
    <div className="bg-background min-h-screen text-foreground">
       <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Historial de Bitácoras</h1>
        </div>
        <Link href="/stops">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver a la Bitácora
          </Button>
        </Link>
      </header>
      <main className="p-4 md:p-8">
        <Dialog>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Registros Guardados</CardTitle>
                    <CardDescription>Aquí puedes ver y gestionar todas las bitácoras de producción que has guardado.</CardDescription>
                </div>
                 <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </DialogTrigger>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <p className="text-muted-foreground text-center py-4">Cargando historial...</p>
                ) : paginatedLogs.length > 0 ? (
                <div className="space-y-4">
                    <ul className="space-y-2">
                    {paginatedLogs.map((log) => (
                        <li key={log.id} className="border p-4 rounded-md flex justify-between items-center">
                            <span className="font-medium">
                                {log.date} - <span className="capitalize">{log.shift === 'day' ? 'Día' : 'Noche'}</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <Button asChild variant="secondary">
                                    <Link href={`/stops?date=${log.date}&shift=${log.shift}`}>Ver Bitácora</Link>
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <Trash2 className="h-4 w-4 text-destructive" />
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
                                            <AlertDialogAction onClick={() => handleDeleteLog(log.id)}>
                                                Sí, eliminar
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </li>
                    ))}
                    </ul>
                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <Button onClick={() => fetchLogs(false)} disabled={loadingMore}>
                                {loadingMore ? 'Cargando...' : 'Cargar Más'}
                            </Button>
                        </div>
                    )}
                    {!hasMore && (
                        <p className="text-center text-muted-foreground text-sm pt-4">No hay más registros.</p>
                    )}
                </div>
                ) : (
                <p className="text-muted-foreground text-center py-4">No hay bitácoras guardadas todavía.</p>
                )}
            </CardContent>
            </Card>
            <DeleteRangeDialog allLogs={allLogs} onConfirm={handleDeleteRange} isDeleting={isDeleting} />
        </Dialog>
      </main>
    </div>
  );
}

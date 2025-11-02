'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarCheck, ChevronLeft, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, doc, deleteDoc, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
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


type DailyLogMeta = {
  id: string; // Document ID from Firestore, e.g., "2024-07-30_day"
  date: string;
  shift: 'day' | 'night';
};

const LOGS_PER_PAGE = 20;

export default function LogHistoryClient() {
  const [savedLogs, setSavedLogs] = React.useState<DailyLogMeta[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const { toast } = useToast();

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

        setSavedLogs(prevLogs => initialLoad ? newLogs : [...prevLogs, ...newLogs]);

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
        setSavedLogs(prevLogs => prevLogs.filter(log => log.id !== logId));
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
        <Card>
          <CardHeader>
            <CardTitle>Registros Guardados</CardTitle>
            <CardDescription>Aquí puedes ver y gestionar todas las bitácoras de producción que has guardado.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <p className="text-muted-foreground text-center py-4">Cargando historial...</p>
            ) : savedLogs.length > 0 ? (
              <div className="space-y-4">
                <ul className="space-y-2">
                  {savedLogs.map((log) => (
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
                                    <Button variant="destructive" size="icon">
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
      </main>
    </div>
  );
}

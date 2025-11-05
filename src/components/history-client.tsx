'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, type DocumentData, type QueryDocumentSnapshot, writeBatch, doc } from 'firebase/firestore';
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


type SavedPlan = {
  id: string; // Document ID from Firestore
  week: number;
  year: number;
};

const PLANS_PER_PAGE = 20;

function DeleteRangeDialog({ allPlans, onConfirm, isDeleting }: { allPlans: SavedPlan[], onConfirm: (start: string, end: string) => void, isDeleting: boolean }) {
    const [startWeek, setStartWeek] = React.useState<string>('');
    const [endWeek, setEndWeek] = React.useState<string>('');
    const { toast } = useToast();

    const handleDelete = () => {
        if (!startWeek || !endWeek) {
            toast({ title: 'Error', description: 'Debes seleccionar un rango de inicio y fin.', variant: 'destructive'});
            return;
        }
        if (allPlans.findIndex(p => p.id === startWeek) < allPlans.findIndex(p => p.id === endWeek)) {
            toast({ title: 'Error de Rango', description: 'El inicio debe ser igual o más reciente que el fin.', variant: 'destructive'});
            return;
        }
        onConfirm(startWeek, endWeek);
    }
    
    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Eliminar Planes por Rango</DialogTitle>
                <DialogDescription>
                    Selecciona el rango de planes que deseas eliminar. Esta acción es permanente y no se puede deshacer.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                 <div className="space-y-1.5">
                    <Label htmlFor="start-week">Desde (el más reciente)</Label>
                    <Select value={startWeek} onValueChange={setStartWeek}>
                        <SelectTrigger id="start-week"><SelectValue placeholder="Semana de inicio"/></SelectTrigger>
                        <SelectContent>
                            {allPlans.map(p => <SelectItem key={p.id} value={p.id}>Semana {p.week}, {p.year}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="end-week">Hasta (el más antiguo)</Label>
                        <Select value={endWeek} onValueChange={setEndWeek}>
                        <SelectTrigger id="end-week"><SelectValue placeholder="Semana de fin"/></SelectTrigger>
                        <SelectContent>
                            {allPlans.map(p => <SelectItem key={p.id} value={p.id}>Semana {p.week}, {p.year}</SelectItem>)}
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
                        <Button variant="destructive" disabled={isDeleting || !startWeek || !endWeek}>
                            {isDeleting ? 'Eliminando...' : 'Eliminar Rango Seleccionado'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Confirmar Eliminación Masiva?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Se eliminarán todos los planes y sus resúmenes asociados desde la <strong>Semana {allPlans.find(p=>p.id===startWeek)?.week}</strong> hasta la <strong>Semana {allPlans.find(p=>p.id===endWeek)?.week}</strong>.
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

export default function HistoryClient() {
  const [allPlans, setAllPlans] = React.useState<SavedPlan[]>([]);
  const [paginatedPlans, setPaginatedPlans] = React.useState<SavedPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const { toast } = useToast();

  const [isDeleting, setIsDeleting] = React.useState(false);

  const fetchPlans = React.useCallback(async (initialLoad = false) => {
    if (initialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
        let plansQuery;
        if (initialLoad || !lastVisible) {
            plansQuery = query(
                collection(db, 'productionPlans'),
                orderBy('year', 'desc'),
                orderBy('week', 'desc'),
                limit(PLANS_PER_PAGE)
            );
        } else {
            plansQuery = query(
                collection(db, 'productionPlans'),
                orderBy('year', 'desc'),
                orderBy('week', 'desc'),
                startAfter(lastVisible),
                limit(PLANS_PER_PAGE)
            );
        }

        const plansSnapshot = await getDocs(plansQuery);
        const newPlans: SavedPlan[] = [];
        plansSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.week && data.year) {
                newPlans.push({
                    id: doc.id,
                    week: data.week,
                    year: data.year,
                });
            }
        });
        
        const lastDoc = plansSnapshot.docs[plansSnapshot.docs.length - 1];
        setLastVisible(lastDoc || null);
        
        if (newPlans.length < PLANS_PER_PAGE) {
            setHasMore(false);
        }

        setPaginatedPlans(prevPlans => initialLoad ? newPlans : [...prevPlans, ...newPlans]);
        
        if (initialLoad) {
            const allPlansSnapshot = await getDocs(query(collection(db, 'productionPlans'), orderBy('year', 'desc'), orderBy('week', 'desc')));
            const allFetchedPlans = allPlansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedPlan));
            setAllPlans(allFetchedPlans);
        }

    } catch (error) {
        console.error("Error fetching history from Firestore:", error);
    } finally {
        setLoading(false);
        setLoadingMore(false);
    }
  }, [lastVisible]);

  React.useEffect(() => {
    fetchPlans(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleDelete = async (planId: string) => {
    try {
        const batch = writeBatch(db);
        const planRef = doc(db, 'productionPlans', planId);
        const summaryRef = doc(db, 'weeklySummaries', planId);

        batch.delete(planRef);
        batch.delete(summaryRef);
        
        await batch.commit();

        setPaginatedPlans(prevPlans => prevPlans.filter(plan => plan.id !== planId));
        setAllPlans(prevPlans => prevPlans.filter(plan => plan.id !== planId));
        toast({
            title: 'Registro Eliminado',
            description: `Se ha eliminado el plan ${planId} y su resumen.`,
        });
    } catch (error) {
        console.error("Error deleting plan:", error);
        toast({
            title: 'Error',
            description: 'No se pudo eliminar el registro.',
            variant: 'destructive',
        });
    }
  };

  const handleDeleteRange = async (startWeek: string, endWeek: string) => {
    setIsDeleting(true);

    const startIndex = allPlans.findIndex(p => p.id === startWeek);
    const endIndex = allPlans.findIndex(p => p.id === endWeek);
    const plansToDelete = allPlans.slice(startIndex, endIndex + 1);
    
    try {
        const batch = writeBatch(db);
        plansToDelete.forEach(plan => {
             const planRef = doc(db, 'productionPlans', plan.id);
             const summaryRef = doc(db, 'weeklySummaries', plan.id);
             batch.delete(planRef);
             batch.delete(summaryRef);
        });

        await batch.commit();

        toast({ title: 'Rango Eliminado', description: `Se han eliminado ${plansToDelete.length} planes.`});
        fetchPlans(true);
    } catch(error) {
        console.error("Error deleting range:", error);
        toast({ title: 'Error', description: 'No se pudo completar la eliminación del rango.', variant: 'destructive'});
    } finally {
        setIsDeleting(false);
    }
  }


  return (
    <div className="bg-background min-h-screen text-foreground">
       <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Historial de Planes</h1>
        </div>
        <Link href="/">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </Link>
      </header>
      <main className="p-4 md:p-8">
        <Dialog>
            <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Planes Guardados</CardTitle>
                    <CardDescription>Aquí puedes ver y gestionar todos los planes de producción que has guardado.</CardDescription>
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
                ) : paginatedPlans.length > 0 ? (
                <div className="space-y-4">
                    <ul className="space-y-2">
                    {paginatedPlans.map((plan) => (
                        <li key={plan.id} className="border p-4 rounded-md flex justify-between items-center">
                        <span className="font-medium">Semana {plan.week}, {plan.year}</span>
                        <div className="flex items-center gap-2">
                            <Button asChild variant="secondary">
                                <Link href={`/?planId=${plan.id}`}>Ver Plan</Link>
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
                                                Esta acción es permanente y no se puede deshacer. Se eliminará el plan de la <strong>Semana {plan.week}, {plan.year}</strong> y su resumen de estadísticas.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(plan.id)}>
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
                        <div className="flex justify-center">
                            <Button onClick={() => fetchPlans(false)} disabled={loadingMore}>
                                {loadingMore ? 'Cargando...' : 'Cargar Más'}
                            </Button>
                        </div>
                    )}
                </div>
                ) : (
                <p className="text-muted-foreground text-center py-4">No hay planes guardados todavía.</p>
                )}
            </CardContent>
            </Card>
            <DeleteRangeDialog allPlans={allPlans} onConfirm={handleDeleteRange} isDeleting={isDeleting} />
        </Dialog>
      </main>
    </div>
  );
}

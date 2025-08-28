'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAfter, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';

type SavedPlan = {
  id: string; // Document ID from Firestore
  week: number;
  year: number;
};

const PLANS_PER_PAGE = 20;

export default function HistoryClient() {
  const [savedPlans, setSavedPlans] = React.useState<SavedPlan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [lastVisible, setLastVisible] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = React.useState(true);

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

        setSavedPlans(prevPlans => initialLoad ? newPlans : [...prevPlans, ...newPlans]);

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
        <Card>
          <CardHeader>
            <CardTitle>Planes Guardados</CardTitle>
            <CardDescription>Aquí puedes ver todos los planes de producción que has guardado.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
                <p className="text-muted-foreground text-center py-4">Cargando historial...</p>
            ) : savedPlans.length > 0 ? (
              <div className="space-y-4">
                <ul className="space-y-2">
                  {savedPlans.map((plan) => (
                    <li key={plan.id} className="border p-4 rounded-md flex justify-between items-center">
                      <span className="font-medium">Semana {plan.week}, {plan.year}</span>
                       <Button asChild variant="secondary">
                          <Link href={`/?planId=${plan.id}`}>Ver Plan</Link>
                       </Button>
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
      </main>
    </div>
  );
}

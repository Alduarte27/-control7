'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const LOCAL_STORAGE_KEY_PREFIX = 'control7-semana-';

type SavedPlan = {
  week: number;
  year: number;
};

export default function HistoryClient() {
  const [savedPlans, setSavedPlans] = React.useState<SavedPlan[]>([]);

  React.useEffect(() => {
    const plans: SavedPlan[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
        const week = parseInt(key.replace(LOCAL_STORAGE_KEY_PREFIX, ''), 10);
        if (!isNaN(week)) {
          // Assuming current year for simplicity. A more robust solution might store the year.
          plans.push({ week, year: new Date().getFullYear() });
        }
      }
    }
    // Sort plans by week number, descending
    plans.sort((a, b) => b.week - a.week);
    setSavedPlans(plans);
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
            {savedPlans.length > 0 ? (
              <ul className="space-y-2">
                {savedPlans.map((plan) => (
                  <li key={plan.week} className="border p-4 rounded-md flex justify-between items-center">
                    <span className="font-medium">Semana {plan.week}, {plan.year}</span>
                     <Button asChild variant="secondary">
                        {/* This link isn't functional yet, as we need a way to pass the week to the main page */}
                        <span className='cursor-not-allowed'>Ver Plan</span>
                     </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No hay planes guardados todavía.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

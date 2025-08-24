'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Sparkles, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { suggestProductionPlan, type SuggestPlanOutput, type SuggestPlanInput } from '@/ai/flows/suggest-plan-flow';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ProductData } from '@/lib/types';
import SuggestionDialog from './suggestion-dialog';
import { getISOWeek } from 'date-fns';

export default function IAClient() {
  const [isSuggestingPlan, setIsSuggestingPlan] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<SuggestPlanOutput | null>(null);
  const { toast } = useToast();

  const handleSuggestPlan = async () => {
    setIsSuggestingPlan(true);
    toast({
        title: 'Generando Sugerencia',
        description: 'La IA está analizando el historial de producción. Esto puede tardar un momento...',
    });
    try {
        const plansQuery = query(collection(db, "productionPlans"), orderBy("year", "desc"), orderBy("week", "desc"), limit(8));
        const plansSnapshot = await getDocs(plansQuery);

        const historicalData = plansSnapshot.docs.map(doc => {
            const plan = doc.data();
            return {
                week: plan.week,
                year: plan.year,
                products: plan.products.map((p: ProductData) => ({
                    id: p.id,
                    productName: p.productName,
                    totalActual: Object.values(p.actual).reduce((sum, s: any) => sum + s.day + s.night, 0),
                    categoryIsPlanned: p.categoryIsPlanned ?? true,
                }))
            }
        }).reverse(); // Reverse to have oldest first

        // Fetch all products to pass to the AI
        const productsSnapshot = await getDocs(query(collection(db, "products"), orderBy("order")));
        const allProducts = productsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ProductData))
            .filter(p => p.isActive);

        const categoriesSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name')));
        const categoryMap = new Map(categoriesSnapshot.docs.map(doc => [doc.id, { isPlanned: doc.data().isPlanned ?? true }]));
        
        const allProductsWithCategoryInfo = allProducts.map(p => ({
            id: p.id,
            productName: p.productName,
            categoryIsPlanned: categoryMap.get(p.categoryId)?.isPlanned ?? true,
        }));
        
        const input: SuggestPlanInput = { 
            historicalData, 
            allProducts: allProductsWithCategoryInfo
        };

        const result = await suggestProductionPlan(input);
        setSuggestion(result);
        
    } catch (error: any) {
        console.error("Error suggesting plan:", error);
        
        let description = 'No se pudo generar una sugerencia. Por favor, inténtalo de nuevo.';
        if (error.message && (error.message.includes('API key not valid') || error.message.includes('permission denied'))) {
            description = 'La API Key de Gemini no es válida o no ha sido configurada. Revisa el archivo .env.';
        } else if (error.message && error.message.includes('requires an index')) {
            description = 'Firestore requiere un índice para esta consulta. Por favor, crea el índice desde el enlace en la consola de errores del navegador.';
        }

        toast({
            title: 'Error de la IA',
            description: description,
            variant: 'destructive',
        });
    } finally {
        setIsSuggestingPlan(false);
    }
  };

  const handleApplySuggestion = async () => {
    if (!suggestion) return;

    try {
        const currentWeek = getISOWeek(new Date());
        const currentYear = new Date().getFullYear();
        const planId = `${currentYear}-W${currentWeek}`;
        
        const planDocRef = doc(db, "productionPlans", planId);
        // We redirect the user to the main page with the planId, so they can see the applied plan
        window.location.href = `/?planId=${planId}&applySuggestion=true`;

    } catch (error) {
        toast({
            title: 'Error al aplicar sugerencia',
            description: 'No se pudo guardar el plan sugerido.',
            variant: 'destructive'
        });
        console.error("Error applying suggestion:", error);
    }
  };

  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Análisis con IA</h1>
        </div>
        <Link href="/">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver a la Planificación
          </Button>
        </Link>
      </header>
      <main className="p-4 md:p-8 space-y-6">
        <div className="grid md:grid-cols-1 gap-6">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bot className="h-6 w-6" />
                    Asistente de Planificación de Producción
                </CardTitle>
                <CardDescription>
                    Utiliza el poder de la IA para analizar el historial de producción y generar un plan semanal optimizado. 
                    El asistente identificará tendencias y patrones para ayudarte a minimizar el desperdicio y maximizar la eficiencia.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <Button onClick={handleSuggestPlan} disabled={isSuggestingPlan}>
                    <Bot className={`mr-2 h-4 w-4 ${isSuggestingPlan ? 'animate-spin' : ''}`} />
                    {isSuggestingPlan ? 'Generando Plan...' : 'Generar Sugerencia de Plan Semanal'}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Tendencias de Producción</CardTitle>
                    <CardDescription>Próximamente: Gráficos dinámicos que muestran las tendencias de producción por producto y categoría a lo largo del tiempo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">Visualizaciones en desarrollo.</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Proyecciones y Pronósticos</CardTitle>
                    <CardDescription>Próximamente: Modelos predictivos para pronosticar la demanda futura y ayudarte a anticipar las necesidades de producción.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-center py-8">Análisis predictivo en desarrollo.</p>
                </CardContent>
            </Card>
        </div>
      </main>
      {suggestion && (
        <SuggestionDialog
          suggestion={suggestion}
          onClose={() => setSuggestion(null)}
          onApply={() => {
              // Store suggestion in sessionStorage to be retrieved by the main page
              sessionStorage.setItem('aiSuggestion', JSON.stringify(suggestion.suggestions));
              handleApplySuggestion();
          }}
        />
      )}
    </div>
  );
}

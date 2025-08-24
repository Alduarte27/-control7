'use client';

import React from 'react';
import type { ProductData, ProductDefinition, CategoryDefinition, DailyProduction, ShiftProduction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, setISOWeek, startOfISOWeek, subWeeks } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { suggestProductionPlan } from '@/ai/flows/suggest-plan-flow';

import Header from './header';
import FilterBar from './filter-bar';
import KpiDashboard from './kpi-dashboard';
import ProductionTable from './production-table';
import WeeklySummary from './weekly-summary';
import InfoDialog from './info-dialog';

const emptyProductionDay: ShiftProduction = { day: 0, night: 0 };
const emptyActual: DailyProduction = {
  mon: { ...emptyProductionDay },
  tue: { ...emptyProductionDay },
  wed: { ...emptyProductionDay },
  thu: { ...emptyProductionDay },
  fri: { ...emptyProductionDay },
  sat: { ...emptyProductionDay },
  sun: { ...emptyProductionDay },
};

const getDateFromPlanId = (planId: string): Date => {
    const [year, week] = planId.split('-W');
    const date = setISOWeek(new Date(parseInt(year), 0, 4), parseInt(week));
    return startOfISOWeek(date);
}

export default function Control7Client({ initialPlanId }: { initialPlanId?: string }) {
  const [data, setData] = React.useState<ProductData[]>([]);
  const [productSearch, setProductSearch] = React.useState('');
  const [date, setDate] = React.useState<Date | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [isDirty, setIsDirty] = React.useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = React.useState(false);
  const [isSuggestingPlan, setIsSuggestingPlan] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    const showDialogPreference = localStorage.getItem('showInfoDialogOnStartup');
    const hasBeenShownThisSession = sessionStorage.getItem('infoDialogShownThisSession');

    if ((showDialogPreference === null || showDialogPreference === 'true') && !hasBeenShownThisSession) {
        setIsInfoDialogOpen(true);
        sessionStorage.setItem('infoDialogShownThisSession', 'true');
    }
  }, []);
  
  React.useEffect(() => {
    if (!initialPlanId) {
      setDate(new Date());
    } else {
      setDate(getDateFromPlanId(initialPlanId));
    }
  }, [initialPlanId]);


  const currentYear = (date || new Date()).getFullYear();
  const currentWeek = getISOWeek(date || new Date());
  
  const planId = `${currentYear}-W${currentWeek}`;
  const savePlanId = `${currentYear}-W${currentWeek}`;


  const generateInitialData = (products: ProductDefinition[], categories: CategoryDefinition[]): ProductData[] => {
    const categoryMap = new Map(categories.map(c => [c.id, { name: c.name, isPlanned: c.isPlanned }]));
    return products
      .filter(p => p.isActive)
      .map(p => ({
        ...p,
        categoryName: categoryMap.get(p.categoryId)?.name || 'Sin Categoría',
        categoryIsPlanned: categoryMap.get(p.categoryId)?.isPlanned ?? true,
        planned: 0,
        actual: JSON.parse(JSON.stringify(emptyActual)),
      }));
  };

  React.useEffect(() => {
    const fetchData = async () => {
        if (!date) return;
        setLoading(true);
        setIsDirty(false);
        try {
            const categoriesSnapshot = await getDocs(query(collection(db, "categories"), orderBy("name")));
            const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPlanned: doc.data().isPlanned ?? true } as CategoryDefinition));
            const categoryMap = new Map(categories.map(c => [c.id, { name: c.name, isPlanned: c.isPlanned }]));

            const productsQuery = query(collection(db, "products"), orderBy("order"));
            const productsSnapshot = await getDocs(productsQuery);
            const productDefinitions = productsSnapshot.docs.map(doc => ({ id: doc.id, isActive: doc.data().isActive ?? true, ...doc.data() } as ProductDefinition));

            if (productDefinitions.length === 0) {
                setData([]);
                setLoading(false);
                return;
            }
            
            const planDocRef = doc(db, "productionPlans", planId);
            const planDocSnap = await getDoc(planDocRef);

            if (planDocSnap.exists()) {
                const planData = planDocSnap.data();
                const weeklyData: ProductData[] = planData.products;
                const weeklyDataProductIds = new Set(weeklyData.map(p => p.id));

                const activeAndRelevantProducts = productDefinitions.filter(
                    def => def.isActive || weeklyDataProductIds.has(def.id)
                );

                const syncedData = activeAndRelevantProducts.map(def => {
                    const savedProductData = weeklyData.find(d => d.id === def.id);
                    const categoryInfo = categoryMap.get(def.categoryId);
                    
                    if (savedProductData) {
                        return {
                            ...savedProductData,
                            ...def,
                            categoryName: categoryInfo?.name || 'Sin Categoría',
                            categoryIsPlanned: categoryInfo?.isPlanned ?? true,
                        };
                    } else {
                        return {
                            ...def,
                            categoryName: categoryInfo?.name || 'Sin Categoría',
                            categoryIsPlanned: categoryInfo?.isPlanned ?? true,
                            planned: 0,
                            actual: JSON.parse(JSON.stringify(emptyActual)),
                        };
                    }
                });
                setData(syncedData);
            } else {
                setData(generateInitialData(productDefinitions, categories));
            }
        } catch (error) {
            console.error("Error fetching data from Firestore:", error);
            toast({
                title: 'Error de Carga',
                description: 'No se pudieron cargar los datos desde Firestore.',
                variant: 'destructive',
            });
            setData([]);
        }
        setLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, date, toast]);

  const handleSave = async () => {
    try {
      // Clean isSuggested flag before saving
      const dataToSave = data.map(({ isSuggested, ...rest }) => rest);
      const planDocRef = doc(db, "productionPlans", savePlanId);
      await setDoc(planDocRef, { products: dataToSave, week: currentWeek, year: currentYear });
      setIsDirty(false);
      toast({
        title: 'Plan Guardado',
        description: `Los datos para la semana ${currentWeek} han sido guardados.`,
      });
    } catch (error) {
      console.error("Error saving data to Firestore", error);
      toast({
        title: 'Error al Guardar',
        description: 'Ocurrió un error al guardar tus datos.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLastWeek = async () => {
    if (!date) return;

    const lastWeekDate = subWeeks(date, 1);
    const lastWeekYear = lastWeekDate.getFullYear();
    const lastWeekNumber = getISOWeek(lastWeekDate);
    const lastWeekPlanId = `${lastWeekYear}-W${lastWeekNumber}`;

    try {
      const planDocRef = doc(db, "productionPlans", lastWeekPlanId);
      const planDocSnap = await getDoc(planDocRef);

      if (planDocSnap.exists()) {
        const lastWeekData = planDocSnap.data().products as ProductData[];
        setData(currentData => 
            currentData.map(currentItem => {
                const correspondingLastWeekItem = lastWeekData.find(lw => lw.id === currentItem.id);
                return {
                    ...currentItem,
                    planned: correspondingLastWeekItem ? correspondingLastWeekItem.planned : currentItem.planned,
                    isSuggested: false, // Reset suggestion flag
                };
            })
        );
        setIsDirty(true);
        toast({
            title: 'Plan Copiado',
            description: `Se han copiado los valores planificados de la semana ${lastWeekNumber}.`,
        });
      } else {
        toast({
            title: 'No se encontró el plan',
            description: `No hay datos guardados para la semana ${lastWeekNumber}.`,
            variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Error copying last week's plan", error);
      toast({
        title: 'Error al Copiar',
        description: 'No se pudo cargar el plan de la semana anterior.',
        variant: 'destructive',
      });
    }
  };

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
                }))
            }
        }).reverse(); // Reverse to have oldest first

        const allProducts = data.map(p => ({ id: p.id, productName: p.productName }));

        const result = await suggestProductionPlan({ historicalData, allProducts });
        
        const suggestionsMap = new Map(result.suggestions.map(s => [s.productId, s.suggestedPlan]));

        setData(currentData => 
            currentData.map(item => ({
                ...item,
                planned: suggestionsMap.get(item.id) ?? item.planned,
                isSuggested: suggestionsMap.has(item.id),
            }))
        );
        
        setIsDirty(true);
        toast({
            title: 'Sugerencia Aplicada',
            description: 'Se ha generado un nuevo plan. Revisa los valores y ajústalos si es necesario.',
        });
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


  const handleExport = () => {
    if (data.length === 0) {
      toast({
        title: 'No hay datos para exportar',
        description: 'Añade algunos datos de producción antes de exportar.',
        variant: 'destructive',
      });
      return;
    }

    const headers = [
      'Producto',
      'Categoría',
      'Plan Semanal',
      'Real Lun',
      'Real Mar',
      'Real Mié',
      'Real Jue',
      'Real Vie',
      'Real Sáb',
      'Real Dom',
      'Total Real',
      'Varianza',
      'Cumplimiento (%)',
    ];

    const rows = data.map(item => {
      const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
      const variance = totalActual - item.planned;
      const compliance = item.planned > 0 ? ((totalActual / item.planned) * 100).toFixed(1) : '0.0';

      const dailyTotals = {
        mon: (item.actual.mon?.day || 0) + (item.actual.mon?.night || 0),
        tue: (item.actual.tue?.day || 0) + (item.actual.tue?.night || 0),
        wed: (item.actual.wed?.day || 0) + (item.actual.wed?.night || 0),
        thu: (item.actual.thu?.day || 0) + (item.actual.thu?.night || 0),
        fri: (item.actual.fri?.day || 0) + (item.actual.fri?.night || 0),
        sat: (item.actual.sat?.day || 0) + (item.actual.sat?.night || 0),
        sun: (item.actual.sun?.day || 0) + (item.actual.sun?.night || 0),
      };

      return [
        `"${item.productName.replace(/"/g, '""')}"`,
        item.categoryName,
        item.planned,
        dailyTotals.mon,
        dailyTotals.tue,
        dailyTotals.wed,
        dailyTotals.thu,
        dailyTotals.fri,
        dailyTotals.sat,
        dailyTotals.sun,
        totalActual,
        variance,
        compliance,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `plan-semana-${currentWeek}-${currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePlannedDataChange = (id: string, value: number) => {
    setData(currentData =>
      currentData.map(item => item.id === id ? { ...item, planned: value, isSuggested: false } : item)
    );
    setIsDirty(true);
  };

  const handleActualDataChange = (id: string, day: keyof DailyProduction, shift: keyof ShiftProduction, value: number) => {
    setData(currentData =>
      currentData.map(item => {
        if (item.id === id) {
          const newActual = { ...item.actual };
          newActual[day] = { ...newActual[day], [shift]: value };
          return { ...item, actual: newActual };
        }
        return item;
      })
    );
    setIsDirty(true);
  };

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
        const newPlanId = `${newDate.getFullYear()}-W${getISOWeek(newDate)}`;
        if (isDirty) {
            if (confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres cambiar de semana? Se perderán los cambios.')) {
                 window.location.href = `/?planId=${newPlanId}`;
            }
        } else {
            window.location.href = `/?planId=${newPlanId}`;
        }
    }
  };

  const filteredData = data.filter(item =>
    item.productName.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="bg-background min-h-screen text-foreground">
      <Header 
        onSave={handleSave} 
        onExport={handleExport} 
        hasUnsavedChanges={isDirty}
        setIsInfoDialogOpen={setIsInfoDialogOpen}
      />
      <div className="p-4 md:p-8 space-y-6">
        <FilterBar 
            productSearch={productSearch} 
            onProductSearchChange={setProductSearch}
            date={date}
            onDateChange={handleDateChange}
            onCopyLastWeek={handleCopyLastWeek}
            onSuggestPlan={handleSuggestPlan}
            isSuggestingPlan={isSuggestingPlan}
        />
        {loading || !date ? (
            <p>Cargando datos...</p>
        ) : (
            <>
                <KpiDashboard data={data} />
                <div className="space-y-6">
                  <ProductionTable 
                    data={filteredData} 
                    onPlannedChange={handlePlannedDataChange} 
                    onActualChange={handleActualDataChange} 
                  />
                  <WeeklySummary data={data} />
                </div>
            </>
        )}
      </div>
      <InfoDialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen} />
    </div>
  );
}

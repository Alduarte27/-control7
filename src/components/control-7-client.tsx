'use client';

import React from 'react';
import type { ProductData, ProductDefinition, CategoryDefinition, DailyProduction, ShiftProduction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, setISOWeek, startOfISOWeek, subWeeks, startOfWeek, getDayOfYear, addDays } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

import Header from './header';
import FilterBar from './filter-bar';
import KpiDashboard from './kpi-dashboard';
import ProductionTable from './production-table';
import WeeklySummary from './weekly-summary';
import InfoDialog from './info-dialog';
import ReportPreviewDialog from './report-preview-dialog';
import { usePageVisibility } from '@/hooks/use-page-visibility';
import { Button } from './ui/button';

const emptyProductionDay: ShiftProduction = { day: 0, night: 0, lotNumber: '', dayNote: '', nightNote: '' };
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
    // Using startOfWeek ensures we get the Monday of that week, which is consistent.
    const date = setISOWeek(new Date(parseInt(year), 0, 4), parseInt(week));
    return startOfWeek(date, { weekStartsOn: 1 });
}

const getDayOfYearForWeek = (weekDate: Date) => {
    const start = startOfISOWeek(weekDate);
    const dayOfYearMap: { [key in keyof DailyProduction]: string } = {} as any;
    (Object.keys(emptyActual) as (keyof DailyProduction)[]).forEach((day, index) => {
        const dateOfDay = addDays(start, index);
        dayOfYearMap[day] = `${getDayOfYear(dateOfDay)}`;
    });
    return dayOfYearMap;
};

const INACTIVITY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes


// We pass the prefetched data as props to avoid hydration issues and waterfalls.
export default function Control7Client({ 
    initialPlanId: serverInitialPlanId,
    prefetchedCategories,
    prefetchedProducts
}: { 
    initialPlanId?: string,
    prefetchedCategories: CategoryDefinition[],
    prefetchedProducts: ProductDefinition[]
}) {
  const [data, setData] = React.useState<ProductData[]>([]);
  const [productSearch, setProductSearch] = React.useState('');
  
  // Client-side search params are the source of truth for navigation
  const searchParams = useSearchParams();
  const planIdFromUrl = searchParams.get('planId');

  const [date, setDate] = React.useState<Date | undefined>(
    planIdFromUrl ? getDateFromPlanId(planIdFromUrl) : undefined
  );
  
  const [loading, setLoading] = React.useState(true);
  const [isDirty, setIsDirty] = React.useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = React.useState(false);
  const [showReloadNotification, setShowReloadNotification] = React.useState(false);
  const { toast } = useToast();

  usePageVisibility((isInitial, timeInactive) => {
    if (!isInitial && timeInactive > INACTIVITY_THRESHOLD_MS) {
      setShowReloadNotification(true);
    }
  });

  React.useEffect(() => {
    // This effect runs only on the client and ensures the date is set to the current
    // week if no planId is in the URL. This is the definitive fix for the hydration
    // and wrong-week-on-load issue.
    if (!planIdFromUrl) {
      setDate(new Date());
    }
  }, [planIdFromUrl]);

  React.useEffect(() => {
    const showDialogPreference = localStorage.getItem('showInfoDialogOnStartup');
    const hasBeenShownThisSession = sessionStorage.getItem('infoDialogShownThisSession');

    if ((showDialogPreference === null || showDialogPreference === 'true') && !hasBeenShownThisSession) {
        setIsInfoDialogOpen(true);
        sessionStorage.setItem('infoDialogShownThisSession', 'true');
    }
  }, []);

  // Effect to handle unsaved changes warning
  React.useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        // Modern browsers show a generic message, but this is required for legacy browsers.
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);


  const currentYear = (date || new Date()).getFullYear();
  const currentWeek = getISOWeek(date || new Date());
  
  const planId = `${currentYear}-W${currentWeek}`;


  const generateInitialData = (products: ProductDefinition[], categories: CategoryDefinition[], currentDate: Date): ProductData[] => {
    const categoryMap = new Map(categories.map(c => [c.id, { name: c.name, isPlanned: c.isPlanned }]));
    const dayOfYearMap = getDayOfYearForWeek(currentDate);

    return products
      .filter(p => p.isActive)
      .map(p => {
        const newActual = JSON.parse(JSON.stringify(emptyActual));
        (Object.keys(newActual) as (keyof DailyProduction)[]).forEach(day => {
            newActual[day].lotNumber = dayOfYearMap[day];
        });

        return {
            ...p,
            categoryName: categoryMap.get(p.categoryId)?.name || 'Sin Categoría',
            categoryIsPlanned: categoryMap.get(p.categoryId)?.isPlanned ?? true,
            planned: 0,
            actual: newActual,
        };
      });
  };

  const applyAISuggestion = React.useCallback((currentData: ProductData[]): ProductData[] => {
    const suggestionRaw = sessionStorage.getItem('aiSuggestion');
    if (!suggestionRaw) return currentData;
    
    try {
        const suggestions = JSON.parse(suggestionRaw);
        const suggestionsMap = new Map(suggestions.map((s: any) => [s.productId, s.suggestedPlan]));
        
        const newData = currentData.map(item => {
            const suggestedPlan = suggestionsMap.get(item.id);
            if (suggestedPlan !== undefined) {
                return {
                    ...item,
                    planned: suggestedPlan,
                    isSuggested: true,
                };
            }
            return { ...item, isSuggested: false };
        });
        
        setIsDirty(true);
        toast({
            title: 'Sugerencia Aplicada',
            description: 'Se ha generado un nuevo plan desde la página de IA. Revisa los valores y guárdalos.',
        });
        return newData;
    } catch (error) {
        console.error("Failed to parse or apply AI suggestion:", error);
        toast({ title: 'Error al aplicar sugerencia', variant: 'destructive'});
        return currentData;
    } finally {
        sessionStorage.removeItem('aiSuggestion');
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('applySuggestion')) {
            urlParams.delete('applySuggestion');
            const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
            window.history.replaceState({}, document.title, newUrl);
        }
    }
  }, [toast]);

  React.useEffect(() => {
    const fetchData = async () => {
        if (!date) return;
        setLoading(true);
        setIsDirty(false);
        try {
            const categories = prefetchedCategories;
            const productDefinitions = prefetchedProducts;
            const categoryMap = new Map(categories.map(c => [c.id, { name: c.name, isPlanned: c.isPlanned }]));
            const dayOfYearMap = getDayOfYearForWeek(date);

            if (productDefinitions.length === 0) {
                setData([]);
                setLoading(false);
                return;
            }
            
            const planDocRef = doc(db, "productionPlans", planId);
            const planDocSnap = await getDoc(planDocRef);

            let loadedData: ProductData[];
            if (planDocSnap.exists()) {
                const planData = planDocSnap.data();
                const weeklyData: ProductData[] = planData.products;
                const weeklyDataProductIds = new Set(weeklyData.map(p => p.id));

                const activeAndRelevantProducts = productDefinitions.filter(
                    def => def.isActive || weeklyDataProductIds.has(def.id)
                );

                loadedData = activeAndRelevantProducts.map(def => {
                    const savedProductData = weeklyData.find(d => d.id === def.id);
                    const categoryInfo = categoryMap.get(def.categoryId);
                    
                    if (savedProductData) {
                         const mergedActual: DailyProduction = { ...emptyActual };
                        for (const day of Object.keys(mergedActual) as (keyof DailyProduction)[]) {
                            if (savedProductData.actual && savedProductData.actual[day]) {
                                mergedActual[day] = {
                                    day: savedProductData.actual[day].day || 0,
                                    night: savedProductData.actual[day].night || 0,
                                    lotNumber: savedProductData.actual[day].lotNumber || dayOfYearMap[day],
                                    dayNote: savedProductData.actual[day].dayNote || '',
                                    nightNote: savedProductData.actual[day].nightNote || '',
                                };
                            } else {
                                mergedActual[day] = { ...emptyProductionDay, lotNumber: dayOfYearMap[day] };
                            }
                        }

                        return {
                            ...savedProductData,
                            ...def,
                            actual: mergedActual,
                            categoryName: categoryInfo?.name || 'Sin Categoría',
                            categoryIsPlanned: categoryInfo?.isPlanned ?? true,
                        };
                    } else {
                        // New product not present in the saved plan
                        const newActual = JSON.parse(JSON.stringify(emptyActual));
                        (Object.keys(newActual) as (keyof DailyProduction)[]).forEach(day => {
                            newActual[day].lotNumber = dayOfYearMap[day];
                        });
                        return {
                            ...def,
                            categoryName: categoryInfo?.name || 'Sin Categoría',
                            categoryIsPlanned: categoryInfo?.isPlanned ?? true,
                            planned: 0,
                            actual: newActual,
                        };
                    }
                });
            } else {
                loadedData = generateInitialData(productDefinitions.filter(p => p.isActive), categories, date);
            }

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('applySuggestion') === 'true') {
                const finalData = applyAISuggestion(loadedData);
                setData(finalData);
            } else {
                setData(loadedData);
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
  }, [planId, date, prefetchedCategories, prefetchedProducts, applyAISuggestion, toast]);

  const handleSave = async () => {
    try {
      const dataToSave = data.map(({ isSuggested, ...rest }) => rest);
      
      // --- Create Summary Data for Denormalization ---
      
      // Overall Totals
      const productsForCompliance = data.filter(item => item.categoryIsPlanned && item.planned > 0);
      const totalPlannedForCompliance = productsForCompliance.reduce((sum, item) => sum + (item.planned || 0), 0);
      const totalActualForCompliance = productsForCompliance.reduce((sum, item) => 
        sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
      );
      
      const unplannedProductionProducts = data.filter(item => item.categoryIsPlanned && (item.planned || 0) === 0);
      const totalUnplannedProduction = unplannedProductionProducts.reduce((sum, item) =>
        sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
      );
      
      const totalActual = data.reduce((sum, item) => 
        sum + Object.values(item.actual).reduce((daySum, dayVal) => daySum + (dayVal.day || 0) + (dayVal.night || 0), 0), 0
      );
       
      const dailyTotals = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 };
      const dailyShiftTotals = {
        mon: { day: 0, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 0, night: 0 },
        thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 },
        sun: { day: 0, night: 0 }
      };

      // Category-specific Totals
      const categoryTotals: { [categoryId: string]: any } = {};

      data.forEach(product => {
        // Daily totals (overall)
        for (const day of Object.keys(dailyTotals) as (keyof typeof dailyTotals)[]) {
            const dayActual = product.actual[day];
            if (dayActual) {
                dailyTotals[day] += (dayActual.day || 0) + (dayActual.night || 0);
                dailyShiftTotals[day].day += dayActual.day || 0;
                dailyShiftTotals[day].night += dayActual.night || 0;
            }
        }

        // Category totals
        const { categoryId } = product;
        if (!categoryTotals[categoryId]) {
            categoryTotals[categoryId] = {
                planned: 0,
                actualForPlanned: 0,
                unplannedProduction: 0,
                totalActual: 0
            };
        }
        
        const productTotalActual = Object.values(product.actual).reduce((sum, dayVal) => sum + (dayVal.day || 0) + (dayVal.night || 0), 0);
        categoryTotals[categoryId].totalActual += productTotalActual;

        if (product.categoryIsPlanned) {
            if (product.planned > 0) {
                categoryTotals[categoryId].planned += product.planned;
                categoryTotals[categoryId].actualForPlanned += productTotalActual;
            } else {
                categoryTotals[categoryId].unplannedProduction += productTotalActual;
            }
        }
      });
      
      const summaryData = {
        week: currentWeek,
        year: currentYear,
        totalPlanned: totalPlannedForCompliance,
        totalActualForPlanned: totalActualForCompliance,
        totalUnplannedProduction: totalUnplannedProduction,
        totalActual: totalActual,
        dailyTotals,
        dailyShiftTotals,
        categoryTotals, // Add the new per-category data
      };
      
      // Use a batched write to save both plan and summary atomically
      const batch = writeBatch(db);
      
      const planDocRef = doc(db, "productionPlans", planId);
      batch.set(planDocRef, { products: dataToSave, week: currentWeek, year: currentYear });
      
      const summaryDocRef = doc(db, "weeklySummaries", planId);
      batch.set(summaryDocRef, summaryData);
      
      await batch.commit();
      // --- End of Summary Creation ---

      setData(currentData => currentData.map(item => ({ ...item, isSuggested: false })));
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
                    isSuggested: false, 
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

  const handlePlannedDataChange = (id: string, value: number) => {
    setData(currentData =>
      currentData.map(item => item.id === id ? { ...item, planned: value, isSuggested: false } : item)
    );
    setIsDirty(true);
  };

  const handleActualDataChange = (id: string, day: keyof DailyProduction, shift: 'day' | 'night' | 'lotNumber' | 'dayNote' | 'nightNote', value: any) => {
    setData(currentData =>
      currentData.map(item => {
        if (item.id === id) {
          const newActual = { ...item.actual };
          if (typeof newActual[day] !== 'object' || newActual[day] === null) {
              newActual[day] = { ...emptyProductionDay };
          }
          
          if (shift === 'lotNumber' || shift === 'dayNote' || shift === 'nightNote') {
              newActual[day] = { ...newActual[day], [shift]: String(value) };
          } else {
              newActual[day] = { ...newActual[day], [shift]: value };
          }
          return { ...item, actual: newActual };
        }
        return item;
      })
    );
    setIsDirty(true);
  };

  const handleDateChange = (newDate: Date | undefined) => {
    if (isDirty) {
        if (confirm('Tienes cambios sin guardar. ¿Estás seguro de que quieres cambiar de semana? Se perderán los cambios.')) {
            setDate(newDate);
            // Update URL to reflect the new date
            if (newDate) {
              const newPlanId = `${newDate.getFullYear()}-W${getISOWeek(newDate)}`;
              window.history.pushState({}, '', `?planId=${newPlanId}`);
            } else {
              window.history.pushState({}, '', `/`);
            }
        }
    } else {
        setDate(newDate);
        if (newDate) {
          const newPlanId = `${newDate.getFullYear()}-W${getISOWeek(newDate)}`;
          window.history.pushState({}, '', `?planId=${newPlanId}`);
        } else {
          window.history.pushState({}, '', `/`);
        }
    }
  };

  const handleReload = () => {
    if (isDirty) {
        if (confirm('Tienes cambios sin guardar. Si recargas, perderás los cambios. ¿Estás seguro?')) {
            window.location.reload();
        }
    } else {
        window.location.reload();
    }
  };

  const filteredData = data.filter(item =>
    item.productName.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="bg-background min-h-screen text-foreground no-print">
      <Header 
        onSave={handleSave} 
        hasUnsavedChanges={isDirty}
        setIsInfoDialogOpen={setIsInfoDialogOpen}
      />
      <div className="p-4 md:p-8 space-y-6">
        {showReloadNotification && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md flex justify-between items-center shadow-md">
                <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-3" />
                    <div>
                        <p className="font-bold">¡Bienvenido de vuelta!</p>
                        <p className="text-sm">La sesión ha estado inactiva. Para asegurar que tienes los últimos datos, te recomendamos recargar la página.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReload}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Recargar Ahora
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowReloadNotification(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}
        <FilterBar 
            productSearch={productSearch} 
            onProductSearchChange={setProductSearch}
            date={date}
            onDateChange={handleDateChange}
            onCopyLastWeek={handleCopyLastWeek}
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
                    currentDate={date}
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

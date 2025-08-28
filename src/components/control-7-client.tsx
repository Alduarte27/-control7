'use client';

import React from 'react';
import type { ProductData, ProductDefinition, CategoryDefinition, DailyProduction, ShiftProduction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, setISOWeek, startOfISOWeek, subWeeks } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';

import Header from './header';
import FilterBar from './filter-bar';
import KpiDashboard from './kpi-dashboard';
import ProductionTable from './production-table';
import WeeklySummary from './weekly-summary';
import InfoDialog from './info-dialog';

const emptyProductionDay: ShiftProduction = { day: 0, night: 0, lotNumber: '' };
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
  const { toast } = useToast();

  React.useEffect(() => {
    const showDialogPreference = localStorage.getItem('showInfoDialogOnStartup');
    const hasBeenShownThisSession = sessionStorage.getItem('infoDialogShownThisSession');

    if ((showDialogPreference === null || showDialogPreference === 'true') && !hasBeenShownThisSession) {
        setIsInfoDialogOpen(true);
        sessionStorage.setItem('infoDialogShownThisSession', 'true');
    }
  }, []);
  
  // This effect should run only once when the component mounts and initialPlanId is available.
  React.useEffect(() => {
    if (!initialPlanId) {
      setDate(new Date());
    } else {
      setDate(getDateFromPlanId(initialPlanId));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlanId]);


  const currentYear = (date || new Date()).getFullYear();
  const currentWeek = getISOWeek(date || new Date());
  
  const planId = `${currentYear}-W${currentWeek}`;


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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                         // Ensure 'actual' has all days and lotNumber property
                        const mergedActual: DailyProduction = { ...emptyActual };
                        for (const day of Object.keys(mergedActual) as (keyof DailyProduction)[]) {
                            if (savedProductData.actual && savedProductData.actual[day]) {
                                mergedActual[day] = {
                                    day: savedProductData.actual[day].day || 0,
                                    night: savedProductData.actual[day].night || 0,
                                    lotNumber: savedProductData.actual[day].lotNumber || '',
                                };
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
                        return {
                            ...def,
                            categoryName: categoryInfo?.name || 'Sin Categoría',
                            categoryIsPlanned: categoryInfo?.isPlanned ?? true,
                            planned: 0,
                            actual: JSON.parse(JSON.stringify(emptyActual)),
                        };
                    }
                });
            } else {
                loadedData = generateInitialData(productDefinitions.filter(p => p.isActive), categories);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, date]);

  const handleSave = async () => {
    try {
      const dataToSave = data.map(({ isSuggested, ...rest }) => rest);
      const planDocRef = doc(db, "productionPlans", planId);
      await setDoc(planDocRef, { products: dataToSave, week: currentWeek, year: currentYear });
      
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
      'Lote Lun', 'Real Lun',
      'Lote Mar', 'Real Mar',
      'Lote Mié', 'Real Mié',
      'Lote Jue', 'Real Jue',
      'Lote Vie', 'Real Vie',
      'Lote Sáb', 'Real Sáb',
      'Lote Dom', 'Real Dom',
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

      const lotNumbers = {
        mon: item.actual.mon?.lotNumber || '',
        tue: item.actual.tue?.lotNumber || '',
        wed: item.actual.wed?.lotNumber || '',
        thu: item.actual.thu?.lotNumber || '',
        fri: item.actual.fri?.lotNumber || '',
        sat: item.actual.sat?.lotNumber || '',
        sun: item.actual.sun?.lotNumber || '',
      };

      return [
        `"${item.productName.replace(/"/g, '""')}"`,
        item.categoryName,
        item.planned,
        lotNumbers.mon, dailyTotals.mon,
        lotNumbers.tue, dailyTotals.tue,
        lotNumbers.wed, dailyTotals.wed,
        lotNumbers.thu, dailyTotals.thu,
        lotNumbers.fri, dailyTotals.fri,
        lotNumbers.sat, dailyTotals.sat,
        lotNumbers.sun, dailyTotals.sun,
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

  const handleActualDataChange = (id: string, day: keyof DailyProduction, shift: 'day' | 'night' | 'lotNumber', value: number | string) => {
    setData(currentData =>
      currentData.map(item => {
        if (item.id === id) {
          const newActual = { ...item.actual };
          if (shift === 'lotNumber') {
              newActual[day] = { ...newActual[day], lotNumber: String(value) };
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

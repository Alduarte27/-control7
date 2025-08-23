'use client';

import React from 'react';
import type { ProductData, ProductDefinition } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, setISOWeek, startOfISOWeek, subWeeks } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';

import Header from './header';
import FilterBar from './filter-bar';
import KpiDashboard from './kpi-dashboard';
import ProductionTable from './production-table';
import WeeklySummary from './weekly-summary';

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
    // We parse the date and then get the start of the ISO week to be consistent
    const date = setISOWeek(new Date(parseInt(year), 0, 4), parseInt(week));
    return startOfISOWeek(date);
}

export default function Control7Client({ initialPlanId }: { initialPlanId?: string }) {
  const [data, setData] = React.useState<ProductData[]>([]);
  const [productSearch, setProductSearch] = React.useState('');
  const [date, setDate] = React.useState<Date | undefined>(
    initialPlanId ? getDateFromPlanId(initialPlanId) : new Date()
  );
  const [loading, setLoading] = React.useState(true);
  const [isDirty, setIsDirty] = React.useState(false);
  const { toast } = useToast();

  const currentYear = (date || new Date()).getFullYear();
  const currentWeek = getISOWeek(date || new Date());
  
  // Use the initialPlanId if provided, otherwise generate it from the current date.
  const planId = initialPlanId || `${currentYear}-W${currentWeek}`;
  
  // A separate ID for saving, which always uses the current date picker's state.
  const savePlanId = `${currentYear}-W${currentWeek}`;


  const generateInitialData = (products: ProductDefinition[]): ProductData[] => {
    return products.map(p => ({
      ...p,
      planned: 0,
      actual: JSON.parse(JSON.stringify(emptyActual)),
    }));
  };

  React.useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        setIsDirty(false); // Reset dirty state on new data load
        try {
            // Fetch product definitions from Firestore, ordered by 'order' field
            const productsQuery = query(collection(db, "products"), orderBy("order"));
            const productsSnapshot = await getDocs(productsQuery);
            const productDefinitions = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDefinition));

            if (productDefinitions.length === 0) {
                setData([]);
                setLoading(false);
                return;
            }
            
            // Fetch the production plan for the current week
            const planDocRef = doc(db, "productionPlans", planId);
            const planDocSnap = await getDoc(planDocRef);

            if (planDocSnap.exists()) {
                const planData = planDocSnap.data();
                const weeklyData: ProductData[] = planData.products;

                // Sync with latest product definitions and maintain order
                const syncedData = productDefinitions.map(def => {
                    const found = weeklyData.find(d => d.id === def.id);
                    // Ensure new products get a default category if not present
                    const definitionWithDefaults = { category: 'Familiar' as const, ...def };
                    return found || { ...definitionWithDefaults, planned: 0, actual: JSON.parse(JSON.stringify(emptyActual)) };
                });
                setData(syncedData);
            } else {
                // If no plan exists, create an initial one based on ordered products
                setData(generateInitialData(productDefinitions));
            }
        } catch (error) {
            console.error("Error fetching data from Firestore:", error);
            toast({
                title: 'Error de Carga',
                description: 'No se pudieron cargar los datos desde Firestore.',
                variant: 'destructive',
            });
            // Fallback to empty state
            setData([]);
        }
        setLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, toast]);

  const handleSave = async () => {
    try {
      const planDocRef = doc(db, "productionPlans", savePlanId);
      await setDoc(planDocRef, { products: data, week: currentWeek, year: currentYear });
      setIsDirty(false); // Reset dirty state after successful save
      toast({
        title: 'Plan Guardado',
        description: `Los datos para la semana ${currentWeek} han sido guardados en Firestore.`,
      });
    } catch (error) {
      console.error("Error saving data to Firestore", error);
      toast({
        title: 'Error al Guardar',
        description: 'Ocurrió un error al guardar tus datos en Firestore.',
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
                    // Copy planned value, keep actuals for the new week
                    planned: correspondingLastWeekItem ? correspondingLastWeekItem.planned : currentItem.planned,
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
        `"${item.productName.replace(/"/g, '""')}"`, // Escape double quotes
        item.category,
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
      currentData.map(item => item.id === id ? { ...item, planned: value } : item)
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
        // We use window.location to force a full component reload with the new planId
        window.location.href = `/?planId=${newPlanId}`;
    }
  };

  const filteredData = data.filter(item =>
    item.productName.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="bg-background min-h-screen text-foreground">
      <Header onSave={handleSave} onExport={handleExport} hasUnsavedChanges={isDirty} />
      <div className="p-4 md:p-8 space-y-6">
        <FilterBar 
            productSearch={productSearch} 
            onProductSearchChange={setProductSearch}
            date={date}
            onDateChange={handleDateChange}
            onCopyLastWeek={handleCopyLastWeek}
        />
        {loading ? (
            <p>Cargando datos...</p>
        ) : (
            <>
                <KpiDashboard data={filteredData} />
                <div className="space-y-6">
                  <ProductionTable 
                    data={filteredData} 
                    onPlannedChange={handlePlannedDataChange} 
                    onActualChange={handleActualDataChange} 
                  />
                  <WeeklySummary data={filteredData} />
                </div>
            </>
        )}
      </div>
    </div>
  );
}

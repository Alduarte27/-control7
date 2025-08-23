'use client';

import React from 'react';
import type { ProductData, DailyProduction, ShiftProduction, ProductDefinition } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek } from 'date-fns';

import Header from './header';
import FilterBar from './filter-bar';
import KpiDashboard from './kpi-dashboard';
import ProductionTable from './production-table';
import WeeklySummary from './weekly-summary';

const initialProductDefinitions: ProductDefinition[] = [
    { id: 'prod-1', productName: 'Azúcar 500g (25 kg) San Juan' },
    { id: 'prod-2', productName: 'Azúcar 1 kg - Blanca (50 kg) San Juan' },
    { id: 'prod-3', productName: 'Azúcar 2 kg - Blanca (50 kg) San Juan' },
    { id: 'prod-4', productName: 'Azúcar 5 kg - Blanca (50 kg) San Juan' },
    { id: 'prod-5', productName: 'Azúcar 1 kg - Blanca (50 kg) Don Ariel' },
    { id: 'prod-6', productName: 'Azúcar Granel 50Kg - Blanca' },
    { id: 'prod-7', productName: 'Azúcar 1 kg - Morena (50 kg) San Juan' },
    { id: 'prod-8', productName: 'Azúcar 2 kg - Morena (50 kg) San Juan' },
    { id: 'prod-9', productName: 'Azúcar 1 kg - Morena (50 kg) Don Ariel' },
    { id: 'prod-10', productName: 'Azúcar Granel 50Kg - Morena' },
];

const LOCAL_STORAGE_KEY_PREFIX = 'control7-semana-';
const PRODUCTS_STORAGE_KEY = 'control7-products-list';

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

export default function Control7Client() {
  const [data, setData] = React.useState<ProductData[]>([]);
  const [productSearch, setProductSearch] = React.useState('');
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const { toast } = useToast();

  const currentWeek = getISOWeek(date || new Date());
  const LOCAL_STORAGE_KEY = `${LOCAL_STORAGE_KEY_PREFIX}${currentWeek}`;

  const generateInitialData = (products: ProductDefinition[]): ProductData[] => {
    return products.map(p => ({
      ...p,
      planned: 0,
      actual: JSON.parse(JSON.stringify(emptyActual)),
    }));
  };

  React.useEffect(() => {
    let productDefinitions: ProductDefinition[] = [];
    try {
      const savedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (savedProducts) {
        productDefinitions = JSON.parse(savedProducts);
      } else {
        productDefinitions = initialProductDefinitions;
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(initialProductDefinitions));
      }
    } catch (error) {
      console.error("Failed to load products from local storage", error);
      productDefinitions = initialProductDefinitions;
    }
    
    const initialData = generateInitialData(productDefinitions);

    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        const parsedData: ProductData[] = JSON.parse(savedData);
        // Sync saved data with current product definitions
        const syncedData = productDefinitions.map(def => {
          const found = parsedData.find(d => d.id === def.id);
          return found || { ...def, planned: 0, actual: JSON.parse(JSON.stringify(emptyActual)) };
        });
        setData(syncedData);
      } else {
        setData(initialData);
      }
    } catch (error) {
      console.error("Failed to load week data from local storage", error);
      setData(initialData);
    }
  }, [currentWeek, LOCAL_STORAGE_KEY]);

  const handleSave = () => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      toast({
        title: 'Plan Guardado',
        description: `Los datos para la semana ${currentWeek} han sido guardados.`,
      });
    } catch (error) {
      console.error("Failed to save data to local storage", error);
      toast({
        title: 'Error al Guardar',
        description: 'Ocurrió un error al guardar tus datos.',
        variant: 'destructive',
      });
    }
  };

  const handlePlannedDataChange = (id: string, value: number) => {
    setData(currentData =>
      currentData.map(item => item.id === id ? { ...item, planned: value } : item)
    );
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
  };

  const filteredData = data.filter(item =>
    item.productName.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="bg-background min-h-screen text-foreground">
      <Header onSave={handleSave} />
      <div className="p-4 md:p-8 space-y-6">
        <FilterBar 
            productSearch={productSearch} 
            onProductSearchChange={setProductSearch}
            date={date}
            onDateChange={setDate}
        />
        <KpiDashboard data={filteredData} />
        <div className="space-y-6">
          <ProductionTable 
            data={filteredData} 
            onPlannedChange={handlePlannedDataChange} 
            onActualChange={handleActualDataChange} 
          />
          <WeeklySummary data={filteredData} />
        </div>
      </div>
    </div>
  );
}

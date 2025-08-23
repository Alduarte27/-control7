'use client';

import React from 'react';
import type { ProductData, DailyProduction, ShiftProduction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, startOfISOWeek, endOfISOWeek, format } from 'date-fns';
import { es } from 'date-fns/locale';

import Header from './header';
import FilterBar from './filter-bar';
import KpiDashboard from './kpi-dashboard';
import ProductionTable from './production-table';
import WeeklySummary from './weekly-summary';

const initialData: ProductData[] = [
  { id: 'prod-1', productName: 'Azúcar 2kg (50kg)', planned: 5322, actual: { mon: { day: 1521, night: 0 }, tue: { day: 760, night: 0 }, wed: { day: 0, night: 0 }, thu: { day: 1521, night: 0 }, fri: { day: 1521, night: 0 }, sat: { day: 0, night: 0 }, sun: { day: 0, night: 0 } } },
  { id: 'prod-2', productName: 'Azúcar 1kg (50kg)', planned: 2661, actual: { mon: { day: 760, night: 0 }, tue: { day: 380, night: 0 }, wed: { day: 760, night: 0 }, thu: { day: 760, night: 0 }, fri: { day: 760, night: 0 }, sat: { day: 0, night: 0 }, sun: { day: 0, night: 0 } } },
  { id: 'prod-3', productName: 'Azúcar 1kg Tuti (50kg)', planned: 2661, actual: { mon: { day: 760, night: 0 }, tue: { day: 760, night: 0 }, wed: { day: 760, night: 0 }, thu: { day: 760, night: 0 }, fri: { day: 760, night: 0 }, sat: { day: 0, night: 0 }, sun: { day: 0, night: 0 } } },
  { id: 'prod-4', productName: 'Azúcar 0.5kg (25kg)', planned: 1140, actual: { mon: { day: 0, night: 0 }, tue: { day: 380, night: 0 }, wed: { day: 380, night: 0 }, thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 }, sun: { day: 0, night: 0 } } },
  { id: 'prod-5', productName: 'Azúcar 5kg (50kg)', planned: 2218, actual: { mon: { day: 739, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 1478, night: 0 }, thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 }, sun: { day: 0, night: 0 } } },
  { id: 'prod-6', productName: 'Azúcar Granel A (50kg)', planned: 6000, actual: { mon: { day: 0, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 0, night: 0 }, thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 3000, night: 0 }, sun: { day: 3000, night: 0 } } },
  { id: 'prod-7', productName: 'Azúcar Morena 1kg (50kg)', planned: 0, actual: { mon: { day: 0, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 0, night: 0 }, thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 }, sun: { day: 0, night: 0 } } },
  { id: 'prod-8', productName: 'Azúcar Morena 1kg Tuti (50kg)', planned: 0, actual: { mon: { day: 0, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 0, night: 0 }, thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 }, sun: { day: 0, night: 0 } } },
  { id: 'prod-9', productName: 'Azúcar Morena Granel', planned: 0, actual: { mon: { day: 0, night: 0 }, tue: { day: 0, night: 0 }, wed: { day: 0, night: 0 }, thu: { day: 0, night: 0 }, fri: { day: 0, night: 0 }, sat: { day: 0, night: 0 }, sun: { day: 0, night: 0 } } },
];

const LOCAL_STORAGE_KEY_PREFIX = 'control7-semana-';

export default function Control7Client() {
  const [data, setData] = React.useState<ProductData[]>([]);
  const [productSearch, setProductSearch] = React.useState('');
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const { toast } = useToast();

  const currentWeek = getISOWeek(date || new Date());
  const LOCAL_STORAGE_KEY = `${LOCAL_STORAGE_KEY_PREFIX}${currentWeek}`;

  React.useEffect(() => {
    try {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.length > 0) {
          setData(parsedData);
        } else {
          setData(initialData);
        }
      } else {
        setData(initialData);
      }
    } catch (error) {
      console.error("Failed to load data from local storage", error);
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

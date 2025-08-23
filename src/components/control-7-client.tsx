'use client';

import React from 'react';
import type { ProductData, DailyProduction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, startOfISOWeek, endOfISOWeek, format } from 'date-fns';
import { es } from 'date-fns/locale';

import Header from './header';
import FilterBar from './filter-bar';
import KpiDashboard from './kpi-dashboard';
import ProductionTable from './production-table';
import WeeklySummary from './weekly-summary';

const initialData: ProductData[] = [
  { id: 'prod-1', productName: 'Azúcar 2kg (50kg)', planned: 5322, actual: { mon: 1521, tue: 760, wed: 0, thu: 1521, fri: 1521, sat: 0, sun: 0 } },
  { id: 'prod-2', productName: 'Azúcar 1kg (50kg)', planned: 2661, actual: { mon: 760, tue: 380, wed: 760, thu: 760, fri: 760, sat: 0, sun: 0 } },
  { id: 'prod-3', productName: 'Azúcar 1kg Tuti (50kg)', planned: 2661, actual: { mon: 760, tue: 760, wed: 760, thu: 760, fri: 760, sat: 0, sun: 0 } },
  { id: 'prod-4', productName: 'Azúcar 0.5kg (25kg)', planned: 1140, actual: { mon: 0, tue: 380, wed: 380, thu: 0, fri: 0, sat: 0, sun: 0 } },
  { id: 'prod-5', productName: 'Azúcar 5kg (50kg)', planned: 2218, actual: { mon: 739, tue: 0, wed: 1478, thu: 0, fri: 0, sat: 0, sun: 0 } },
  { id: 'prod-6', productName: 'Azúcar Granel A (50kg)', planned: 6000, actual: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 3000, sun: 3000 } },
  { id: 'prod-7', productName: 'Azúcar Morena 1kg (50kg)', planned: 0, actual: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
  { id: 'prod-8', productName: 'Azúcar Morena 1kg Tuti (50kg)', planned: 0, actual: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
  { id: 'prod-9', productName: 'Azúcar Morena Granel', planned: 0, actual: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
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

  const handleDataChange = (id: string, field: keyof ProductData | 'actual', day: keyof DailyProduction | null, value: number) => {
    setData(currentData =>
      currentData.map(item => {
        if (item.id === id) {
          if (field === 'actual' && day) {
            return { ...item, actual: { ...item.actual, [day]: value } };
          }
          if (field === 'planned') {
            return { ...item, [field]: value };
          }
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
          <ProductionTable data={filteredData} onDataChange={handleDataChange} />
          <WeeklySummary data={filteredData} />
        </div>
      </div>
    </div>
  );
}

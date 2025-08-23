'use client';

import React from 'react';
import type { ProductData, DailyProduction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import Header from './header';
import FilterBar from './filter-bar';
import KpiDashboard from './kpi-dashboard';
import ProductionTable from './production-table';
import WeeklySummary from './weekly-summary';

const initialData: ProductData[] = [
  { id: 'prod-1', productName: 'Azúcar 2kg (50kg)', planned: 500, actual: { mon: 95, tue: 105, wed: 100, thu: 98, fri: 102, sat: 0, sun: 0 } },
  { id: 'prod-2', productName: 'Azúcar 1kg (50kg)', planned: 350, actual: { mon: 70, tue: 65, wed: 72, thu: 75, fri: 68, sat: 0, sun: 0 } },
  { id: 'prod-3', productName: 'Azúcar 1kg Tuti (50kg)', planned: 700, actual: { mon: 120, tue: 130, wed: 145, thu: 140, fri: 150, sat: 50, sun: 20 } },
  { id: 'prod-4', productName: 'Azúcar 0.5kg (25kg)', planned: 200, actual: { mon: 40, tue: 45, wed: 38, thu: 42, fri: 41, sat: 0, sun: 0 } },
  { id: 'prod-5', productName: 'Azúcar 5kg (50kg)', planned: 400, actual: { mon: 80, tue: 85, wed: 78, thu: 82, fri: 81, sat: 0, sun: 0 } },
  { id: 'prod-6', productName: 'Azúcar Granel A (50kg)', planned: 1000, actual: { mon: 200, tue: 210, wed: 190, thu: 205, fri: 195, sat: 100, sun: 50 } },
  { id: 'prod-7', productName: 'Azúcar Morena 1kg (50kg)', planned: 250, actual: { mon: 50, tue: 55, wed: 48, thu: 52, fri: 51, sat: 0, sun: 0 } },
  { id: 'prod-8', productName: 'Azúcar Morena 1kg Tuti (50kg)', planned: 300, actual: { mon: 60, tue: 65, wed: 58, thu: 62, fri: 61, sat: 0, sun: 0 } },
  { id: 'prod-9', productName: 'Azúcar Morena Granel', planned: 800, actual: { mon: 150, tue: 160, wed: 155, thu: 165, fri: 170, sat: 70, sun: 30 } },
];

const LOCAL_STORAGE_KEY = 'control7-data';

export default function Control7Client() {
  const [data, setData] = React.useState<ProductData[]>([]);
  const [productSearch, setProductSearch] = React.useState('');
  const { toast } = useToast();

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
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      toast({
        title: 'Plan Guardado',
        description: 'Tus datos de producción han sido guardados exitosamente.',
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
        <KpiDashboard data={filteredData} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <FilterBar productSearch={productSearch} onProductSearchChange={setProductSearch} />
            <ProductionTable data={filteredData} onDataChange={handleDataChange} />
          </div>
          <div className="lg:col-span-1">
            <WeeklySummary data={filteredData} />
          </div>
        </div>
      </div>
    </div>
  );
}

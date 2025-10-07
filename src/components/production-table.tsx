'use client';

import React from 'react';
import type { ProductData, DailyProduction } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from './ui/button';
import { Edit, ChevronUp, NotebookPen } from 'lucide-react';
import ProductionShiftTable from './production-shift-table';
import ProductionIncidentsTable from './production-incidents-table'; // NUEVA IMPORTACIÓN
import { cn } from '@/lib/utils';

type ProductionTableProps = {
  data: ProductData[];
  onPlannedChange: (id: string, value: number) => void;
  onActualChange: (id: string, day: keyof DailyProduction, shift: 'day' | 'night' | 'lotNumber' | 'dayNote' | 'nightNote', value: any) => void;
  currentDate: Date;
};

const days: (keyof DailyProduction)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const dayNames: { [key in keyof DailyProduction]: string } = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom'
};

const getVarianceColorClass = (variance: number, compliance: number): string => {
    if (variance > 0) return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
    if (compliance >= 95) return 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400';
    if (compliance >= 90) return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300';
    if (variance < 0) return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300';
    return '';
};

const getComplianceColorClass = (compliance: number): string => {
    if (compliance >= 95) return 'bg-green-600';
    if (compliance >= 90) return 'bg-yellow-500';
    return 'bg-red-600';
};

const KG_PER_QUINTAL = 50;

const renderProductRow = (
    item: ProductData, 
    handlePlannedInputChange: (id: string, value: string) => void, 
    setSelectedProductForShifts: (product: ProductData) => void,
    setSelectedProductForIncidents: (product: ProductData) => void // NUEVO
) => {
    const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
    const totalQuintales = (totalActual * (item.sackWeight || 50)) / KG_PER_QUINTAL;
    const variance = totalActual - item.planned;
    const compliance = item.planned > 0 ? (totalActual / item.planned) * 100 : 0;
    const varianceColorClass = getVarianceColorClass(variance, compliance);
    const complianceColorClass = getComplianceColorClass(compliance);

    const hasIncidents = Object.values(item.actual).some(val => val.dayNote || val.nightNote);

    return (
      <TableRow key={item.id} className="bg-card hover:bg-muted/50">
        <TableCell className="font-medium sticky left-0 bg-card z-10 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color || '#ccc' }}></span>
            <span>{item.productName}</span>
          </div>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            value={item.planned}
            onChange={(e) => handlePlannedInputChange(item.id, e.target.value)}
            className={cn("text-right", item.isSuggested && "bg-blue-100 dark:bg-blue-900/50 border-blue-500")}
            min="0"
          />
        </TableCell>
        {days.map(day => {
          const dayTotal = (item.actual[day]?.day || 0) + (item.actual[day]?.night || 0);
          return (
            <TableCell key={day} className="text-right">
             {dayTotal.toLocaleString()}
            </TableCell>
          )
        })}
        <TableCell className="text-right font-medium">{totalActual.toLocaleString()}</TableCell>
        <TableCell className="text-right font-medium text-muted-foreground">{totalQuintales.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1})}</TableCell>
        <TableCell className="text-right">
            <span className={cn("font-medium rounded-md px-2 py-1", varianceColorClass)}>
                {variance.toLocaleString()}
            </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Progress 
                value={compliance > 100 ? 100 : compliance} 
                className="w-[60%]" 
                indicatorClassName={complianceColorClass}
            />
            <span className="text-xs font-medium w-[45px] text-right">{compliance.toFixed(1)}%</span>
          </div>
        </TableCell>
        <TableCell>
          <Button variant="outline" size="icon" onClick={() => setSelectedProductForShifts(item)}>
            <Edit className="h-4 w-4" />
          </Button>
        </TableCell>
        <TableCell>
            <Button 
                variant={hasIncidents ? 'default' : 'outline'} 
                size="icon" 
                onClick={() => setSelectedProductForIncidents(item)}
                className={cn(hasIncidents && "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800")}
            >
                <NotebookPen className="h-4 w-4" />
            </Button>
        </TableCell>
      </TableRow>
    );
};


export default function ProductionTable({ data, onPlannedChange, onActualChange, currentDate }: ProductionTableProps) {
  const [selectedProductForShifts, setSelectedProductForShifts] = React.useState<ProductData | null>(null);
  const [selectedProductForIncidents, setSelectedProductForIncidents] = React.useState<ProductData | null>(null);
  const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>({});
  
  const groupedData = data.reduce((acc, product) => {
    const category = product.categoryName || 'Sin Categoría';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, ProductData[]>);

  const categories = Object.keys(groupedData).sort();

  // Load state from localStorage on initial render
  React.useEffect(() => {
    try {
      const savedState = localStorage.getItem('categoryOpenState');
      if (savedState) {
        setOpenCategories(JSON.parse(savedState));
      } else {
        // If no saved state, default all to open
        const initialState = categories.reduce((acc, category) => {
          acc[category] = true;
          return acc;
        }, {} as Record<string, boolean>);
        setOpenCategories(initialState);
      }
    } catch (error) {
        // In case of any error (e.g. parsing), default to open
        const initialState = categories.reduce((acc, category) => {
          acc[category] = true;
          return acc;
        }, {} as Record<string, boolean>);
        setOpenCategories(initialState);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(categories)]); // Rerun if categories change

  // Save state to localStorage whenever it changes
  React.useEffect(() => {
    // We don't save the initial empty state
    if (Object.keys(openCategories).length > 0) {
      try {
        localStorage.setItem('categoryOpenState', JSON.stringify(openCategories));
      } catch (error) {
        console.error("Failed to save category state to localStorage", error);
      }
    }
  }, [openCategories]);

  const handlePlannedInputChange = (id: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) || value === '') {
      onPlannedChange(id, isNaN(numValue) ? 0 : numValue);
    }
  };
  
  const handleShiftDataSave = (updatedProduct: ProductData) => {
    days.forEach(day => {
      onActualChange(updatedProduct.id, day, 'lotNumber', updatedProduct.actual[day].lotNumber || '');
      onActualChange(updatedProduct.id, day, 'day', updatedProduct.actual[day].day);
      onActualChange(updatedProduct.id, day, 'night', updatedProduct.actual[day].night);
    });
    setSelectedProductForShifts(null);
  };

  const handleIncidentsSave = (updatedProduct: ProductData) => {
    days.forEach(day => {
        onActualChange(updatedProduct.id, day, 'dayNote', updatedProduct.actual[day].dayNote || '');
        onActualChange(updatedProduct.id, day, 'nightNote', updatedProduct.actual[day].nightNote || '');
    });
    setSelectedProductForIncidents(null);
  };

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <>
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] sticky left-0 bg-card z-10">Producto</TableHead>
                <TableHead className="text-right min-w-[110px]">Plan (Sacos)</TableHead>
                {days.map(day => <TableHead key={day} className="text-right min-w-[90px] capitalize">{dayNames[day]}</TableHead>)}
                <TableHead className="text-right min-w-[110px]">Total Real (Sacos)</TableHead>
                <TableHead className="text-right min-w-[90px]">QQ</TableHead>
                <TableHead className="text-right min-w-[110px]">Varianza</TableHead>
                <TableHead className="min-w-[120px]">Cumplimiento</TableHead>
                <TableHead className="min-w-[70px]">Turnos</TableHead>
                <TableHead className="min-w-[70px]">Incidencias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="h-24 text-center">
                      Ningún producto coincide con tu búsqueda.
                    </TableCell>
                  </TableRow>
              ) : (
                categories.map(category => (
                    <React.Fragment key={category}>
                      <TableRow className="bg-muted/50 hover:bg-muted cursor-pointer" onClick={() => toggleCategory(category)}>
                          <TableCell colSpan={14} className="font-bold text-primary sticky left-0 bg-muted/50 z-10">
                              <div className="flex items-center gap-2">
                                  <ChevronUp className={cn("h-4 w-4 transition-transform", !openCategories[category] && "rotate-180")} />
                                  {category}
                              </div>
                          </TableCell>
                      </TableRow>
                      {openCategories[category] && groupedData[category].map(item => renderProductRow(item, handlePlannedInputChange, setSelectedProductForShifts, setSelectedProductForIncidents))}
                    </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {selectedProductForShifts && (
        <ProductionShiftTable 
          product={selectedProductForShifts} 
          onClose={() => setSelectedProductForShifts(null)}
          onSave={handleShiftDataSave}
          currentDate={currentDate}
        />
      )}
      {selectedProductForIncidents && (
        <ProductionIncidentsTable
            product={selectedProductForIncidents}
            onClose={() => setSelectedProductForIncidents(null)}
            onSave={handleIncidentsSave}
        />
      )}
    </>
  );
}

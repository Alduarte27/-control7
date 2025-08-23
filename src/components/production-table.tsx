import React from 'react';
import type { ProductData, DailyProduction, ShiftProduction } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from './ui/button';
import { Edit } from 'lucide-react';
import ProductionShiftTable from './production-shift-table';

type ProductionTableProps = {
  data: ProductData[];
  onPlannedChange: (id: string, value: number) => void;
  onActualChange: (id: string, day: keyof DailyProduction, shift: keyof ShiftProduction, value: number) => void;
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

export default function ProductionTable({ data, onPlannedChange, onActualChange }: ProductionTableProps) {
  const [selectedProduct, setSelectedProduct] = React.useState<ProductData | null>(null);

  const handlePlannedInputChange = (id: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) || value === '') {
      onPlannedChange(id, isNaN(numValue) ? 0 : numValue);
    }
  };
  
  const handleShiftDataSave = (updatedProduct: ProductData) => {
    days.forEach(day => {
      onActualChange(updatedProduct.id, day, 'day', updatedProduct.actual[day].day);
      onActualChange(updatedProduct.id, day, 'night', updatedProduct.actual[day].night);
    });
    setSelectedProduct(null);
  };

  return (
    <>
      <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] sticky left-0 bg-card z-10">Producto</TableHead>
                <TableHead className="text-right min-w-[110px]">Plan Semanal</TableHead>
                {days.map(day => <TableHead key={day} className="text-right min-w-[90px] capitalize">{dayNames[day]}</TableHead>)}
                <TableHead className="text-right min-w-[110px]">Total Real</TableHead>
                <TableHead className="text-right min-w-[110px]">Varianza</TableHead>
                <TableHead className="min-w-[120px]">Cumplimiento</TableHead>
                <TableHead className="min-w-[70px]">Turnos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-24 text-center">
                    Ningún producto coincide con tu búsqueda.
                  </TableCell>
                </TableRow>
              ) : (
                data.map(item => {
                  const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val.day || 0) + (val.night || 0), 0);
                  const variance = totalActual - item.planned;
                  const compliance = item.planned > 0 ? (totalActual / item.planned) * 100 : 0;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium sticky left-0 bg-card z-10 text-xs">{item.productName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.planned}
                          onChange={(e) => handlePlannedInputChange(item.id, e.target.value)}
                          className="text-right"
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
                      <TableCell className={`text-right font-medium ${variance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                        {variance.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={compliance > 100 ? 100 : compliance} className="w-[60%]" />
                          <span className="text-xs font-medium w-[45px] text-right">{compliance.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="icon" onClick={() => setSelectedProduct(item)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {selectedProduct && (
        <ProductionShiftTable 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)}
          onSave={handleShiftDataSave}
        />
      )}
    </>
  );
}

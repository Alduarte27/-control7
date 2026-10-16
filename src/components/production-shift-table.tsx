import React from 'react';
import type { ProductData, DailyProduction, ShiftProduction } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getDayOfYear, addDays, startOfISOWeek } from 'date-fns';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

type ProductionShiftTableProps = {
  product: ProductData;
  onClose: () => void;
  onSave: (product: ProductData) => void;
  currentDate: Date;
  activeMode: 'interzafra' | 'zafra' | 'reempaque' | 'reenvase';
};

const days: (keyof DailyProduction)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const dayNames: { [key in keyof DailyProduction]: string } = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo'
};

const getDayOfYearForWeek = (weekDate: Date) => {
    const startOfWeek = startOfISOWeek(weekDate);
    const dayOfYearMap: { [key in keyof DailyProduction]: number } = {} as any;
    days.forEach((day, index) => {
        const dateOfDay = addDays(startOfWeek, index);
        dayOfYearMap[day] = getDayOfYear(dateOfDay);
    });
    return dayOfYearMap;
};


export default function ProductionShiftTable({ product, onClose, onSave, currentDate, activeMode }: ProductionShiftTableProps) {
  const [editedProduct, setEditedProduct] = React.useState<ProductData>(() => {
    const productCopy = JSON.parse(JSON.stringify(product));
    const dayOfYearMap = getDayOfYearForWeek(currentDate);

    const initActual = (obj: any) => {
        days.forEach(day => {
            if (!obj[day]) {
                obj[day] = { day: 0, night: 0, lotNumber: '' };
            }
            if (!obj[day].lotNumber) {
                obj[day].lotNumber = `${dayOfYearMap[day]}`;
            }
        });
    };

    if (!productCopy.actual) productCopy.actual = {} as DailyProduction;
    if (!productCopy.actualZafra) productCopy.actualZafra = {} as DailyProduction;
    if (!productCopy.actualReempaque) productCopy.actualReempaque = {} as DailyProduction;
    if (!productCopy.actualReenvase) productCopy.actualReenvase = {} as DailyProduction;

    initActual(productCopy.actual);
    initActual(productCopy.actualZafra);
    initActual(productCopy.actualReempaque);
    initActual(productCopy.actualReenvase);

    if (productCopy.isZafra === undefined) {
        productCopy.isZafra = false;
    }

    return productCopy;
  });

  // activeMode controls which field we update inside handleInputChange

  const handleInputChange = (day: keyof DailyProduction, field: 'day' | 'night' | 'lotNumber', value: string) => {
    setEditedProduct(prev => {
        const targetField = activeMode === 'zafra' ? 'actualZafra' : activeMode === 'reempaque' ? 'actualReempaque' : activeMode === 'reenvase' ? 'actualReenvase' : 'actual';
        const newActual = { ...(prev[targetField] || {}) } as DailyProduction;
        const dayData: ShiftProduction = newActual[day] ? { ...newActual[day] } : { day: 0, night: 0, lotNumber: '' };

        if (field === 'lotNumber') {
            dayData.lotNumber = value;
        } else {
            const numValue = parseInt(value, 10);
            dayData[field as 'day' | 'night'] = isNaN(numValue) ? 0 : numValue;
        }

        newActual[day] = dayData;
        return { ...prev, [targetField]: newActual };
    });
  };
  
  const handleSave = () => {
    onSave(editedProduct);
  };

  const currentActual = activeMode === 'zafra' ? editedProduct.actualZafra : activeMode === 'reempaque' ? editedProduct.actualReempaque : activeMode === 'reenvase' ? editedProduct.actualReenvase : editedProduct.actual;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="flex flex-row items-start justify-between pr-8">
          <div>
            <DialogTitle>Registrar Producción por Turno</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {product.productName} 
              <span className="ml-2 font-semibold text-primary capitalize">({activeMode})</span>
            </p>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Día</TableHead>
                <TableHead className="w-[150px]">Nro. de Lote</TableHead>
                <TableHead className="text-right">Turno Día</TableHead>
                <TableHead className="text-right">Turno Noche</TableHead>
                <TableHead className="text-right font-bold">Total Día</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map(day => {
                const dayData = currentActual?.[day] || { day: 0, night: 0, lotNumber: '' };
                const dayTotal = (dayData.day || 0) + (dayData.night || 0);
                return (
                  <TableRow key={day}>
                    <TableCell className="font-medium">{dayNames[day]}</TableCell>
                    <TableCell>
                        <Input
                            type="text"
                            value={dayData.lotNumber || ''}
                            onChange={(e) => handleInputChange(day, 'lotNumber', e.target.value)}
                        />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="text-right"
                        value={dayData.day || ''}
                        onChange={(e) => handleInputChange(day, 'day', e.target.value)}
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="text-right"
                        value={dayData.night || ''}
                        onChange={(e) => handleInputChange(day, 'night', e.target.value)}
                        min="0"
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold">
                        {dayTotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

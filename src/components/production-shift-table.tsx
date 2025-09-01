import React from 'react';
import type { ProductData, DailyProduction } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { getDayOfYear, addDays, startOfISOWeek } from 'date-fns';

type ProductionShiftTableProps = {
  product: ProductData;
  onClose: () => void;
  onSave: (product: ProductData) => void;
  currentDate: Date;
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


export default function ProductionShiftTable({ product, onClose, onSave, currentDate }: ProductionShiftTableProps) {
  const [editedProduct, setEditedProduct] = React.useState<ProductData>(() => {
    const productCopy = JSON.parse(JSON.stringify(product));
    const dayOfYearMap = getDayOfYearForWeek(currentDate);

    days.forEach(day => {
        if (!productCopy.actual[day]) {
            productCopy.actual[day] = { day: 0, night: 0, lotNumber: '' };
        }
        // Set default lot number if it's missing or empty
        if (!productCopy.actual[day].lotNumber) {
            productCopy.actual[day].lotNumber = `${dayOfYearMap[day]}`;
        }
    });
    return productCopy;
  });

  const handleInputChange = (day: keyof DailyProduction, field: 'day' | 'night' | 'lotNumber', value: string) => {
    setEditedProduct(prev => {
        const newActual = { ...prev.actual };
        const dayData = { ...newActual[day] };

        if (field === 'lotNumber') {
            dayData.lotNumber = value;
        } else {
            const numValue = parseInt(value, 10);
            dayData[field as 'day' | 'night'] = isNaN(numValue) ? 0 : numValue;
        }

        newActual[day] = dayData;
        return { ...prev, actual: newActual };
    });
  };
  
  const handleSave = () => {
    onSave(editedProduct);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Registrar Producción por Turno</DialogTitle>
          <p className="text-sm text-muted-foreground">{product.productName}</p>
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
                const dayData = editedProduct.actual[day] || { day: 0, night: 0, lotNumber: '' };
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
                        value={dayData.day || 0}
                        onChange={(e) => handleInputChange(day, 'day', e.target.value)}
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="text-right"
                        value={dayData.night || 0}
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

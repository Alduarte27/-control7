import React from 'react';
import type { ProductData, DailyProduction, ShiftProduction } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from './ui/separator';

type ProductionShiftTableProps = {
  product: ProductData;
  onClose: () => void;
  onSave: (product: ProductData) => void;
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

export default function ProductionShiftTable({ product, onClose, onSave }: ProductionShiftTableProps) {
  const [editedProduct, setEditedProduct] = React.useState<ProductData>(JSON.parse(JSON.stringify(product)));

  const handleInputChange = (day: keyof DailyProduction, shift: keyof ShiftProduction, value: string) => {
    const numValue = parseInt(value, 10);
    const val = isNaN(numValue) ? 0 : numValue;

    setEditedProduct(prev => {
        const newActual = { ...prev.actual };
        newActual[day] = { ...newActual[day], [shift]: val };
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
                <TableHead className="w-[150px]">Día</TableHead>
                <TableHead className="text-right">Turno Día</TableHead>
                <TableHead className="text-right">Turno Noche</TableHead>
                <TableHead className="text-right font-bold">Total Día</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map(day => {
                const dayTotal = (editedProduct.actual[day]?.day || 0) + (editedProduct.actual[day]?.night || 0);
                return (
                  <TableRow key={day}>
                    <TableCell className="font-medium">{dayNames[day]}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="text-right"
                        value={editedProduct.actual[day]?.day || 0}
                        onChange={(e) => handleInputChange(day, 'day', e.target.value)}
                        min="0"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        className="text-right"
                        value={editedProduct.actual[day]?.night || 0}
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

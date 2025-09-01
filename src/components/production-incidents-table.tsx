'use client';

import React from 'react';
import type { ProductData, DailyProduction } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type ProductionIncidentsTableProps = {
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

export default function ProductionIncidentsTable({ product, onClose, onSave }: ProductionIncidentsTableProps) {
  const [editedProduct, setEditedProduct] = React.useState<ProductData>(() => JSON.parse(JSON.stringify(product)));

  const handleNoteChange = (day: keyof DailyProduction, field: 'dayNote' | 'nightNote', value: string) => {
    setEditedProduct(prev => {
        const newActual = { ...prev.actual };
        const dayData = { ...newActual[day] };
        dayData[field] = value;
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
          <DialogTitle>Registrar Incidencias de la Semana</DialogTitle>
          <p className="text-sm text-muted-foreground">{product.productName}</p>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Día</TableHead>
                <TableHead>Incidencia Turno Día</TableHead>
                <TableHead>Incidencia Turno Noche</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map(day => {
                const dayData = editedProduct.actual[day] || { dayNote: '', nightNote: '' };
                return (
                  <TableRow key={day}>
                    <TableCell className="font-medium align-top pt-4">{dayNames[day]}</TableCell>
                    <TableCell>
                      <Textarea
                        placeholder="Añadir nota para el turno de día..."
                        value={dayData.dayNote || ''}
                        onChange={(e) => handleNoteChange(day, 'dayNote', e.target.value)}
                        className="h-20"
                      />
                    </TableCell>
                    <TableCell>
                       <Textarea
                        placeholder="Añadir nota para el turno de noche..."
                        value={dayData.nightNote || ''}
                        onChange={(e) => handleNoteChange(day, 'nightNote', e.target.value)}
                        className="h-20"
                      />
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
          <Button type="button" onClick={handleSave}>Guardar Incidencias</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React from 'react';
import type { ProductData, DailyProduction } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type ProductionIncidentsTableProps = {
  product: ProductData;
  onSave: (product: ProductData) => void;
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

export default function ProductionIncidentsTable({ product, onClose, onSave, activeMode }: ProductionIncidentsTableProps) {
  const [editedProduct, setEditedProduct] = React.useState<ProductData>(() => JSON.parse(JSON.stringify(product)));

  const handleNoteChange = (day: keyof DailyProduction, field: 'dayNote' | 'nightNote', value: string) => {
    setEditedProduct(prev => {
        const targetField = activeMode === 'zafra' ? 'actualZafra' : activeMode === 'reempaque' ? 'actualReempaque' : activeMode === 'reenvase' ? 'actualReenvase' : 'actual';
        const newActual = { ...(prev[targetField] || {}) } as DailyProduction;
        const dayData = newActual[day] ? { ...newActual[day] } : { day: 0, night: 0, lotNumber: '' };
        dayData[field] = value;
        newActual[day] = dayData;
        return { ...prev, [targetField]: newActual };
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
          <p className="text-sm text-muted-foreground mt-1">
            {product.productName}
            <span className="ml-2 font-semibold text-primary capitalize">({activeMode})</span>
          </p>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Día</TableHead>
                <TableHead className="w-[120px]">Nro. de Lote</TableHead>
                <TableHead>Incidencia Turno Día</TableHead>
                <TableHead>Incidencia Turno Noche</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map(day => {
                const currentActual = activeMode === 'zafra' ? editedProduct.actualZafra : activeMode === 'reempaque' ? editedProduct.actualReempaque : activeMode === 'reenvase' ? editedProduct.actualReenvase : editedProduct.actual;
                const sourceActual = currentActual || editedProduct.actual;
                const dayData = sourceActual[day] || { dayNote: '', nightNote: '', lotNumber: '' };
                return (
                  <TableRow key={day}>
                    <TableCell className="font-medium align-top pt-4">{dayNames[day]}</TableCell>
                    <TableCell className="align-top pt-4 text-sm text-muted-foreground">{dayData.lotNumber || '-'}</TableCell>
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

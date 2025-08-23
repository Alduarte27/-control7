'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarDays, Search } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getISOWeek, startOfISOWeek, endOfISOWeek, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Label } from '@/components/ui/label';

type FilterBarProps = {
  productSearch: string;
  onProductSearchChange: (value: string) => void;
};

export default function FilterBar({ productSearch, onProductSearchChange }: FilterBarProps) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const currentWeek = getISOWeek(date || new Date());

  const weekStartDate = startOfISOWeek(date || new Date());
  const weekEndDate = endOfISOWeek(date || new Date());

  return (
    <div className="p-4 bg-card rounded-lg shadow-sm border">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="productSearch">Búsqueda de Producto</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="productSearch"
                placeholder="Filtrar productos..."
                value={productSearch}
                onChange={(e) => onProductSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Fecha</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-full justify-start text-left font-normal"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP", { locale: es }) : <span>Elige una fecha</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Semana ISO</Label>
          <Select defaultValue={String(currentWeek)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar semana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(currentWeek)}>
                Semana {currentWeek} ({format(weekStartDate, 'MMM d', { locale: es })} - {format(weekEndDate, 'MMM d', { locale: es })})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

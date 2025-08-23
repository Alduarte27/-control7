'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarDays, Search } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getISOWeek, startOfISOWeek, endOfISOWeek, format, setISOWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Label } from '@/components/ui/label';

type FilterBarProps = {
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
};

export default function FilterBar({ productSearch, onProductSearchChange, date, onDateChange }: FilterBarProps) {
  const currentWeek = getISOWeek(date || new Date());
  const currentYear = (date || new Date()).getFullYear();

  const weekStartDate = startOfISOWeek(date || new Date());
  const weekEndDate = endOfISOWeek(date || new Date());

  const handleWeekChange = (weekNumber: string) => {
    const newDate = setISOWeek(new Date(currentYear, 0, 1), parseInt(weekNumber, 10));
    onDateChange(newDate);
  };

  const getWeekOptions = () => {
    const weeks = [];
    for (let i = 1; i <= 53; i++) {
        const firstDayOfWeek = startOfISOWeek(setISOWeek(new Date(currentYear, 0, 4), i));
        if (firstDayOfWeek.getFullYear() === currentYear) {
            const lastDayOfWeek = endOfISOWeek(firstDayOfWeek);
            weeks.push({
                value: i,
                label: `Semana ${i} (${format(firstDayOfWeek, 'MMM d', { locale: es })} - ${format(lastDayOfWeek, 'MMM d', { locale: es })})`
            });
        }
    }
    return weeks;
  };

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
                onSelect={onDateChange}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Semana ISO</Label>
          <Select value={String(currentWeek)} onValueChange={handleWeekChange}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar semana" />
            </SelectTrigger>
            <SelectContent>
              {getWeekOptions().map(week => (
                <SelectItem key={week.value} value={String(week.value)}>
                  {week.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

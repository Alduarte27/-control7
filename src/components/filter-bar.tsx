
'use client';

import React from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CalendarDays, Search, Copy, History, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getISOWeek, startOfISOWeek, endOfISOWeek, format, setISOWeek, isValid, parse, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import ExportDialog from './export-dialog';
import { useUnsavedChanges } from '@/components/unsaved-changes-provider';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

type FilterBarProps = {
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  onCopyLastWeek: () => void;
  isExportDialogOpen: boolean;
  setIsExportDialogOpen: (open: boolean) => void;
  activeMode: 'interzafra' | 'zafra' | 'reempaque' | 'reenvase';
  onModeChange: (mode: 'interzafra' | 'zafra' | 'reempaque' | 'reenvase') => void;
};

export default function FilterBar({ 
    productSearch, 
    onProductSearchChange, 
    date, 
    onDateChange, 
    onCopyLastWeek,
    isExportDialogOpen,
    setIsExportDialogOpen,
    activeMode,
    onModeChange,
}: FilterBarProps) {
  const { proceedTo } = useUnsavedChanges();
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const currentWeek = date ? getISOWeek(date) : getISOWeek(new Date());
  const currentYear = date ? date.getFullYear() : new Date().getFullYear();

  const weekRangeStr = React.useMemo(() => {
    if (!date) return '';
    const start = startOfISOWeek(date);
    const end = endOfISOWeek(date);
    return `Semana ${getISOWeek(date)} (${format(start, 'MMM d', { locale: es })} - ${format(end, 'MMM d', { locale: es })})`;
  }, [date]);

  const handlePrevWeekDate = () => {
    if (date) {
      onDateChange(addDays(date, -7));
    }
  };

  const handleNextWeekDate = () => {
    if (date) {
      onDateChange(addDays(date, 7));
    }
  };

  const handleWeekChange = (weekNumber: string) => {
    const newDate = setISOWeek(new Date(currentYear, 0, 1), parseInt(weekNumber, 10));
    onDateChange(newDate);
  };
  
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    const parsedDate = parse(dateValue, 'yyyy-MM-dd', new Date());
    if (isValid(parsedDate)) {
        onDateChange(parsedDate);
    }
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
    <>
    <div className="p-4 bg-card rounded-lg shadow-sm border">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 gap-4 items-end">
        <div className="flex flex-col gap-1.5 xl:col-span-3">
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
        <div className="flex flex-col gap-1.5 xl:col-span-3">
          <Label>Fecha</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" className="h-9 w-9 shrink-0 p-0" onClick={handlePrevWeekDate} title="Semana anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="relative flex-1 min-w-[150px] w-full">
              <input
                type="date"
                ref={dateInputRef}
                value={date ? format(date, 'yyyy-MM-dd') : ''}
                onChange={handleDateInputChange}
                className="sr-only"
              />
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9 px-3",
                  !date && "text-muted-foreground"
                )}
                type="button"
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker();
                  } catch (e) {
                    // Fallback click if showPicker fails (older browsers)
                    dateInputRef.current?.click();
                  }
                }}
              >
                <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                {date ? (
                  <span className="truncate text-sm">
                    {format(date, 'dd/MM/yyyy')} - {weekRangeStr}
                  </span>
                ) : (
                  <span className="text-sm">Seleccionar fecha</span>
                )}
              </Button>
            </div>
            <Button variant="outline" className="h-9 w-9 shrink-0 p-0" onClick={handleNextWeekDate} title="Semana siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 xl:col-span-4">
          <Label>Semana ISO</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" className="h-9 w-9 shrink-0 p-0" onClick={() => handleWeekChange(String(currentWeek - 1))} title="Semana anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(currentWeek)} onValueChange={handleWeekChange}>
              <SelectTrigger className="flex-1 min-w-[150px] h-9">
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
            <Button variant="outline" className="h-9 w-9 shrink-0 p-0" onClick={() => handleWeekChange(String(currentWeek + 1))} title="Siguiente semana">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg border h-9 ml-2 shrink-0">
              <Button
                type="button"
                variant={activeMode === 'interzafra' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onModeChange('interzafra')}
                className="h-7 px-2 text-xs"
              >
                Interzafra
              </Button>
              <Button
                type="button"
                variant={activeMode === 'zafra' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onModeChange('zafra')}
                className="h-7 px-2 text-xs"
              >
                Zafra
              </Button>
              <Button
                type="button"
                variant={activeMode === 'reempaque' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onModeChange('reempaque')}
                className="h-7 px-2 text-xs"
              >
                Reempaque
              </Button>
              <Button
                type="button"
                variant={activeMode === 'reenvase' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onModeChange('reenvase')}
                className="h-7 px-2 text-xs"
              >
                Reenvase
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-end justify-end md:col-span-2 lg:col-span-2 xl:col-span-2 h-full pb-[1px]">
            <Button onClick={onCopyLastWeek} variant="outline" size="icon" title="Copiar Anterior">
                <Copy className="h-4 w-4 shrink-0" />
            </Button>
            <Button asChild variant="outline" size="icon" title="Historial">
              <Link 
                href="/history"
                onClick={(e) => {
                  e.preventDefault();
                  proceedTo('/history');
                }}
              >
                <History className="h-4 w-4 shrink-0" />
              </Link>
            </Button>
            <Button onClick={() => setIsExportDialogOpen(true)} variant="outline" size="icon" title="Exportar o PDF">
                <Download className="h-4 w-4 shrink-0" />
            </Button>
        </div>
      </div>
    </div>
    <ExportDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen} />
    </>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TableProperties, Download, RefreshCw, Search, Calendar, FileSpreadsheet } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { DailyLog, TimeSlot } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { generateDisplayTimeSlots } from './stops-client';

interface LogTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ConsolidatedRow {
  logId: string;
  date: string;
  shift: 'day' | 'night';
  operador: string;
  supervisor: string;
  lote: string;
  time: string;
  // Machine values
  m1_obs?: string;
  m1_val?: string;
  m2_obs?: string;
  m2_val?: string;
  m3_obs?: string;
  m3_val?: string;
  // Quality Input
  masa?: string;
  flujo?: string;
  ns_fam?: string;
  ns_1?: string;
  ns_2?: string;
  in_color?: string;
  in_hum?: string;
  in_turb?: string;
  in_cv?: string;
  // Quality Output
  out_fam_color?: string;
  out_fam_hum?: string;
  out_fam_turb?: string;
  out_gra_color?: string;
  out_gra_hum?: string;
  out_gra_turb?: string;
  // Packaging
  empaque_obs?: string;
}

export default function LogTableModal({ open, onOpenChange }: LogTableModalProps) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'detailed' | 'summary'>('detailed');
  const { toast } = useToast();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'dailyLogs'));
      const fetchedLogs: DailyLog[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          const idParts = docSnap.id.split('_');
          const dateStr = idParts[0] || '';
          const shiftStr = (idParts[1] || data.shift || 'day') as 'day' | 'night';
          return {
            id: docSnap.id,
            operador: data.operador || '',
            supervisor: data.supervisor || '',
            lote: data.lote || '',
            shift: shiftStr,
            shiftConfig: data.shiftConfig,
            machines: data.machines || {},
            timeSlots: data.timeSlots || {},
            date: dateStr,
          } as DailyLog & { date: string };
        })
        .sort((a, b) => b.id.localeCompare(a.id));
      setLogs(fetchedLogs);
    } catch (err) {
      console.error('Error fetching logs for consolidated table:', err);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los registros de las bitácoras.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open]);

  // Flatten time slot records across all daily logs
  const detailedRows: ConsolidatedRow[] = useMemo(() => {
    const rows: ConsolidatedRow[] = [];
    logs.forEach((log) => {
      const logDate = (log as any).date || log.id.split('_')[0];
      const timeSlots = generateDisplayTimeSlots(log.shift, log.shiftConfig);

      timeSlots.forEach((time) => {
        const slotData: Partial<TimeSlot> = log.timeSlots?.[time] || {};
        
        // Pick machine observations and weights if available
        const m1_obs = slotData['machine_1_obs'] || slotData['machine_1_observation'] || '';
        const m1_val = slotData['machine_1_weight'] || slotData['machine_1_bundle_weight'] || slotData['machine_1_bundle_weight'] || '';
        const m2_obs = slotData['machine_2_obs'] || slotData['machine_2_observation'] || '';
        const m2_val = slotData['machine_2_weight'] || slotData['machine_2_bundle_weight'] || slotData['machine_2_bundle_weight'] || '';
        const m3_obs = slotData['machine_3_obs'] || slotData['machine_3_observation'] || '';
        const m3_val = slotData['machine_3_weight'] || slotData['machine_3_bundle_weight'] || slotData['machine_3_bundle_weight'] || '';

        // Check if row has any data filled
        const hasData =
          slotData.masa ||
          slotData.flujo ||
          slotData.ns_fam ||
          slotData.ns_1 ||
          slotData.ns_2 ||
          slotData.in_color ||
          slotData.in_hum ||
          slotData.in_turb ||
          slotData.in_cv ||
          slotData.out_fam_color ||
          slotData.out_fam_hum ||
          slotData.out_fam_turb ||
          slotData.out_gra_color ||
          slotData.out_gra_hum ||
          slotData.out_gra_turb ||
          slotData.empaque_obs ||
          m1_obs ||
          m1_val ||
          m2_obs ||
          m2_val ||
          m3_obs ||
          m3_val;

        if (hasData) {
          rows.push({
            logId: log.id,
            date: logDate,
            shift: log.shift,
            operador: log.operador,
            supervisor: log.supervisor,
            lote: log.lote,
            time,
            m1_obs,
            m1_val: String(m1_val || ''),
            m2_obs,
            m2_val: String(m2_val || ''),
            m3_obs,
            m3_val: String(m3_val || ''),
            masa: slotData.masa || '',
            flujo: slotData.flujo || '',
            ns_fam: slotData.ns_fam || '',
            ns_1: slotData.ns_1 || '',
            ns_2: slotData.ns_2 || '',
            in_color: slotData.in_color || '',
            in_hum: slotData.in_hum || '',
            in_turb: slotData.in_turb || '',
            in_cv: slotData.in_cv || '',
            out_fam_color: slotData.out_fam_color || '',
            out_fam_hum: slotData.out_fam_hum || '',
            out_fam_turb: slotData.out_fam_turb || '',
            out_gra_color: slotData.out_gra_color || '',
            out_gra_hum: slotData.out_gra_hum || '',
            out_gra_turb: slotData.out_gra_turb || '',
            empaque_obs: slotData.empaque_obs || '',
          });
        }
      });
    });
    return rows;
  }, [logs]);

  // Filtered rows for detailed view
  const filteredDetailedRows = useMemo(() => {
    return detailedRows.filter((row) => {
      if (shiftFilter !== 'all' && row.shift !== shiftFilter) return false;
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          row.date.toLowerCase().includes(term) ||
          row.operador.toLowerCase().includes(term) ||
          row.supervisor.toLowerCase().includes(term) ||
          row.lote.toLowerCase().includes(term) ||
          row.time.includes(term) ||
          (row.empaque_obs && row.empaque_obs.toLowerCase().includes(term)) ||
          (row.m1_obs && row.m1_obs.toLowerCase().includes(term)) ||
          (row.m2_obs && row.m2_obs.toLowerCase().includes(term)) ||
          (row.m3_obs && row.m3_obs.toLowerCase().includes(term));
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [detailedRows, shiftFilter, startDate, endDate, searchTerm]);

  // Filtered logs for summary view
  const filteredLogsSummary = useMemo(() => {
    return logs.filter((log) => {
      const logDate = (log as any).date || log.id.split('_')[0];
      if (shiftFilter !== 'all' && log.shift !== shiftFilter) return false;
      if (startDate && logDate < startDate) return false;
      if (endDate && logDate > endDate) return false;
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          logDate.toLowerCase().includes(term) ||
          log.operador.toLowerCase().includes(term) ||
          log.supervisor.toLowerCase().includes(term) ||
          log.lote.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      return true;
    });
  }, [logs, shiftFilter, startDate, endDate, searchTerm]);

  // Export data to CSV file with UTF-8 BOM
  const handleExportCSV = () => {
    if (activeTab === 'detailed') {
      if (filteredDetailedRows.length === 0) {
        toast({ title: 'Sin datos', description: 'No hay datos en la tabla para exportar.', variant: 'destructive' });
        return;
      }
      const headers = [
        'Fecha',
        'Turno',
        'Hora',
        'Operador',
        'Supervisor',
        'Lote',
        'Máq 1 (Obs)',
        'Máq 1 (Valor)',
        'Máq 2 (Obs)',
        'Máq 2 (Valor)',
        'Máq 3 (Obs)',
        'Máq 3 (Valor)',
        'Masa',
        'Flujo',
        'NS-FA',
        'NS% 1',
        'NS% 2',
        'Ingreso Color',
        'Ingreso Hum',
        'Ingreso Turb',
        'Ingreso CV',
        'Salida Fam Color',
        'Salida Fam Hum',
        'Salida Fam Turb',
        'Salida Gra Color',
        'Salida Gra Hum',
        'Salida Gra Turb',
        'Novedades Empaque',
      ];

      const csvRows = filteredDetailedRows.map((r) => [
        `"${r.date}"`,
        `"${r.shift === 'day' ? 'Día' : 'Noche'}"`,
        `"${r.time}"`,
        `"${r.operador.replace(/"/g, '""')}"`,
        `"${r.supervisor.replace(/"/g, '""')}"`,
        `"${r.lote.replace(/"/g, '""')}"`,
        `"${(r.m1_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m1_val || '').replace(/"/g, '""')}"`,
        `"${(r.m2_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m2_val || '').replace(/"/g, '""')}"`,
        `"${(r.m3_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m3_val || '').replace(/"/g, '""')}"`,
        `"${r.masa}"`,
        `"${r.flujo}"`,
        `"${r.ns_fam}"`,
        `"${r.ns_1}"`,
        `"${r.ns_2}"`,
        `"${r.in_color}"`,
        `"${r.in_hum}"`,
        `"${r.in_turb}"`,
        `"${r.in_cv}"`,
        `"${r.out_fam_color}"`,
        `"${r.out_fam_hum}"`,
        `"${r.out_fam_turb}"`,
        `"${r.out_gra_color}"`,
        `"${r.out_gra_hum}"`,
        `"${r.out_gra_turb}"`,
        `"${(r.empaque_obs || '').replace(/"/g, '""')}"`,
      ]);

      const csvString = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
      const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `tabla_consolidada_bitacora_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Exportación completada', description: 'Se ha descargado la tabla de bitácora en CSV.' });
    } else {
      // Export Summary CSV
      if (filteredLogsSummary.length === 0) {
        toast({ title: 'Sin datos', description: 'No hay bitácoras para exportar.', variant: 'destructive' });
        return;
      }
      const headers = ['ID Bitácora', 'Fecha', 'Turno', 'Operador', 'Supervisor', 'Lote', 'Total Franjas Registradas'];
      const csvRows = filteredLogsSummary.map((log) => {
        const logDate = (log as any).date || log.id.split('_')[0];
        const registeredSlotsCount = Object.keys(log.timeSlots || {}).length;
        return [
          `"${log.id}"`,
          `"${logDate}"`,
          `"${log.shift === 'day' ? 'Día' : 'Noche'}"`,
          `"${log.operador.replace(/"/g, '""')}"`,
          `"${log.supervisor.replace(/"/g, '""')}"`,
          `"${log.lote.replace(/"/g, '""')}"`,
          `"${registeredSlotsCount}"`,
        ];
      });

      const csvString = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
      const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `resumen_bitacoras_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: 'Exportación completada', description: 'Se ha descargado el resumen de bitácoras en CSV.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[96vw] h-[92vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 md:p-6 border-b flex-shrink-0 bg-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <TableProperties className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  Tabla Consolidada de Registros de Bitácora
                </DialogTitle>
                <DialogDescription className="text-xs md:text-sm text-muted-foreground">
                  Consulta, filtra y exporta los datos acumulados de todos los días de la bitácora de producción.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={loading}
                className="gap-2 border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-3 border-t">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar (Operador, Lote, Obs)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Shift Filter */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Turno:</Label>
              <Select value={shiftFilter} onValueChange={(val) => setShiftFilter(val as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos los turnos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Turnos</SelectItem>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="night">Noche</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Desde:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Hasta:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </DialogHeader>

        {/* Body Tabs and Table */}
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/10">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="flex-1 flex flex-col overflow-hidden p-4 gap-3"
          >
            <div className="flex items-center justify-between flex-shrink-0">
              <TabsList className="bg-muted p-1">
                <TabsTrigger value="detailed" className="text-xs gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Franjas Horarias ({filteredDetailedRows.length})
                </TabsTrigger>
                <TabsTrigger value="summary" className="text-xs gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Resumen por Bitácora ({filteredLogsSummary.length})
                </TabsTrigger>
              </TabsList>
              <span className="text-xs text-muted-foreground">
                {activeTab === 'detailed'
                  ? `Mostrando ${filteredDetailedRows.length} franjas registradas`
                  : `Mostrando ${filteredLogsSummary.length} bitácoras`}
              </span>
            </div>

            {/* Detailed Table */}
            <TabsContent value="detailed" className="flex-1 overflow-auto border rounded-lg bg-card shadow-inner m-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-sm">Cargando registros de bitácora...</p>
                </div>
              ) : filteredDetailedRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <TableProperties className="h-10 w-10 opacity-20 mb-2" />
                  <p className="text-sm font-medium">No se encontraron registros de franjas horarias.</p>
                  <p className="text-xs opacity-75">Intenta ajustar los filtros de búsqueda o fechas.</p>
                </div>
              ) : (
                <div className="relative overflow-x-auto min-w-full">
                  <table className="w-full text-xs text-left border-collapse" style={{ zoom: 0.9 }}>
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur z-20 shadow-sm border-b font-medium text-muted-foreground">
                      <tr className="divide-x divide-border">
                        <th className="p-2 sticky left-0 z-30 bg-muted min-w-[5.5rem]">Fecha</th>
                        <th className="p-2 min-w-[4rem]">Turno</th>
                        <th className="p-2 min-w-[4rem]">Hora</th>
                        <th className="p-2 min-w-[7rem]">Operador</th>
                        <th className="p-2 min-w-[7rem]">Supervisor</th>
                        <th className="p-2 min-w-[5rem]">Lote</th>
                        <th className="p-2 min-w-[8rem] bg-purple-50 dark:bg-purple-950/40">Máq 1 (Obs)</th>
                        <th className="p-2 min-w-[5rem] bg-purple-50 dark:bg-purple-950/40">Máq 1 (Val)</th>
                        <th className="p-2 min-w-[8rem] bg-purple-50 dark:bg-purple-950/40">Máq 2 (Obs)</th>
                        <th className="p-2 min-w-[5rem] bg-purple-50 dark:bg-purple-950/40">Máq 2 (Val)</th>
                        <th className="p-2 min-w-[8rem] bg-purple-50 dark:bg-purple-950/40">Máq 3 (Obs)</th>
                        <th className="p-2 min-w-[5rem] bg-purple-50 dark:bg-purple-950/40">Máq 3 (Val)</th>
                        <th className="p-2 min-w-[4rem] bg-green-50 dark:bg-green-950/40">Masa</th>
                        <th className="p-2 min-w-[5rem] bg-green-50 dark:bg-green-950/40">Flujo</th>
                        <th className="p-2 min-w-[4rem] bg-green-50 dark:bg-green-950/40">NS-FA</th>
                        <th className="p-2 min-w-[4rem] bg-green-50 dark:bg-green-950/40">NS 1</th>
                        <th className="p-2 min-w-[4rem] bg-green-50 dark:bg-green-950/40">NS 2</th>
                        <th className="p-2 min-w-[4rem] bg-yellow-50 dark:bg-yellow-950/40">In Color</th>
                        <th className="p-2 min-w-[4rem] bg-yellow-50 dark:bg-yellow-950/40">In Hum</th>
                        <th className="p-2 min-w-[4rem] bg-yellow-50 dark:bg-yellow-950/40">In Turb</th>
                        <th className="p-2 min-w-[4rem] bg-yellow-50 dark:bg-yellow-950/40">In CV</th>
                        <th className="p-2 min-w-[4rem] bg-blue-50 dark:bg-blue-950/40">Out Fam Col</th>
                        <th className="p-2 min-w-[4rem] bg-blue-50 dark:bg-blue-950/40">Out Fam Hum</th>
                        <th className="p-2 min-w-[4rem] bg-blue-50 dark:bg-blue-950/40">Out Fam Turb</th>
                        <th className="p-2 min-w-[4rem] bg-blue-50 dark:bg-blue-950/40">Out Gra Col</th>
                        <th className="p-2 min-w-[4rem] bg-blue-50 dark:bg-blue-950/40">Out Gra Hum</th>
                        <th className="p-2 min-w-[4rem] bg-blue-50 dark:bg-blue-950/40">Out Gra Turb</th>
                        <th className="p-2 min-w-[12rem] bg-slate-50 dark:bg-slate-900/40">Novedades Empaque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-[11px]">
                      {filteredDetailedRows.map((row, idx) => (
                        <tr key={`${row.logId}_${row.time}_${idx}`} className="hover:bg-muted/50 transition-colors divide-x divide-border">
                          <td className="p-2 font-semibold sticky left-0 z-10 bg-card font-sans border-r">{row.date}</td>
                          <td className="p-2">
                            <Badge variant={row.shift === 'day' ? 'outline' : 'secondary'} className="text-[10px] px-1 py-0">
                              {row.shift === 'day' ? 'Día' : 'Noche'}
                            </Badge>
                          </td>
                          <td className="p-2 font-bold text-indigo-600 dark:text-indigo-400">{row.time}</td>
                          <td className="p-2 font-sans truncate max-w-[110px]" title={row.operador}>{row.operador}</td>
                          <td className="p-2 font-sans truncate max-w-[110px]" title={row.supervisor}>{row.supervisor}</td>
                          <td className="p-2 font-sans">{row.lote}</td>
                          <td className="p-2 font-sans truncate max-w-[140px]" title={row.m1_obs}>{row.m1_obs}</td>
                          <td className="p-2">{row.m1_val}</td>
                          <td className="p-2 font-sans truncate max-w-[140px]" title={row.m2_obs}>{row.m2_obs}</td>
                          <td className="p-2">{row.m2_val}</td>
                          <td className="p-2 font-sans truncate max-w-[140px]" title={row.m3_obs}>{row.m3_obs}</td>
                          <td className="p-2">{row.m3_val}</td>
                          <td className="p-2">{row.masa}</td>
                          <td className="p-2">{row.flujo}</td>
                          <td className="p-2">{row.ns_fam ? `${row.ns_fam.replace(/%/g, '')}%` : ''}</td>
                          <td className="p-2">{row.ns_1 ? `${row.ns_1.replace(/%/g, '')}%` : ''}</td>
                          <td className="p-2">{row.ns_2 ? `${row.ns_2.replace(/%/g, '')}%` : ''}</td>
                          <td className="p-2">{row.in_color}</td>
                          <td className="p-2">{row.in_hum}</td>
                          <td className="p-2">{row.in_turb}</td>
                          <td className="p-2">{row.in_cv}</td>
                          <td className="p-2">{row.out_fam_color}</td>
                          <td className="p-2">{row.out_fam_hum}</td>
                          <td className="p-2">{row.out_fam_turb}</td>
                          <td className="p-2">{row.out_gra_color}</td>
                          <td className="p-2">{row.out_gra_hum}</td>
                          <td className="p-2">{row.out_gra_turb}</td>
                          <td className="p-2 font-sans truncate max-w-[200px]" title={row.empaque_obs}>{row.empaque_obs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Summary Table */}
            <TabsContent value="summary" className="flex-1 overflow-auto border rounded-lg bg-card shadow-inner m-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                  <p className="text-sm">Cargando bitácoras...</p>
                </div>
              ) : filteredLogsSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Calendar className="h-10 w-10 opacity-20 mb-2" />
                  <p className="text-sm font-medium font-sans">No se encontraron bitácoras para mostrar.</p>
                </div>
              ) : (
                <div className="relative overflow-x-auto min-w-full">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur z-20 border-b font-medium text-muted-foreground">
                      <tr className="divide-x divide-border">
                        <th className="p-3">ID Documento</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Turno</th>
                        <th className="p-3">Operador</th>
                        <th className="p-3">Supervisor</th>
                        <th className="p-3">Lote</th>
                        <th className="p-3 text-center">Franjas Registradas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredLogsSummary.map((log) => {
                        const logDate = (log as any).date || log.id.split('_')[0];
                        const slotCount = Object.keys(log.timeSlots || {}).length;
                        return (
                          <tr key={log.id} className="hover:bg-muted/50 transition-colors divide-x divide-border">
                            <td className="p-3 font-mono font-medium">{log.id}</td>
                            <td className="p-3 font-semibold">{logDate}</td>
                            <td className="p-3">
                              <Badge variant={log.shift === 'day' ? 'outline' : 'secondary'}>
                                {log.shift === 'day' ? 'Día' : 'Noche'}
                              </Badge>
                            </td>
                            <td className="p-3 font-medium">{log.operador || '-'}</td>
                            <td className="p-3">{log.supervisor || '-'}</td>
                            <td className="p-3">{log.lote || '-'}</td>
                            <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              {slotCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-card flex-shrink-0 sm:justify-between items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Total de bitácoras almacenadas: <strong className="text-foreground">{logs.length}</strong>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  TableProperties,
  Download,
  RefreshCw,
  Search,
  Calendar,
  FileSpreadsheet,
  ChevronLeft,
  HardHat,
  Filter,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import type { DailyLog, TimeSlot, StopData, BitacoraSettings, QualityParams, QualityRange, MachineLog, ProductChangeEvent } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { generateDisplayTimeSlots } from './stops-client';

export interface ConsolidatedRow {
  logId: string;
  date: string;
  shift: 'day' | 'night';
  operador: string;
  operadorGranel?: string;
  supervisor: string;
  lote: string;
  time: string;
  // Machine values
  m1_presentacion?: string;
  m1_obs?: string;
  m1_val?: string;
  m1_bundle_weight?: string;
  m2_presentacion?: string;
  m2_obs?: string;
  m2_val?: string;
  m2_bundle_weight?: string;
  m3_presentacion?: string;
  m3_obs?: string;
  m3_val?: string;
  m3_bundle_weight?: string;
  m4_presentacion?: string;
  m4_obs?: string;
  m4_val?: string;
  m4_bundle_weight?: string;
  m5_presentacion?: string;
  m5_obs?: string;
  m5_val?: string;
  m6_presentacion?: string;
  m6_obs?: string;
  m6_val?: string;
  m7_presentacion?: string;
  m7_obs?: string;
  m7_val?: string;
  m7_peso_funda?: string;
  m8_presentacion?: string;
  m8_obs?: string;
  m8_val?: string;
  m8_peso_funda?: string;
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

const getProductName = (id: string | undefined, products: { id: string; productName: string }[]): string => {
  if (!id) return '';
  const found = products.find(p => p.id === id);
  if (found) return found.productName;
  if (id === 'granel_50kg_blanca') return 'Granel 50Kg - Blanca';
  if (id === 'granel_50kg_morena') return 'Granel 50Kg - Morena';
  if (id === 'granel_50kg_observacion') return 'Granel 50Kg - Observacion';
  return id;
};

export default function LogTableClient() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'day' | 'night'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'detailed' | 'summary'>('detailed');
  const { toast } = useToast();
  const [qualityParams, setQualityParams] = useState<QualityParams>({});
  const [products, setProducts] = useState<{ id: string; productName: string; color?: string }[]>([]);

  const getColorForValue = (categoryKey: string, value: string | undefined) => {
    if (!value || !qualityParams[categoryKey]) return undefined;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return undefined;
    
    const ranges = qualityParams[categoryKey];
    for (const range of ranges) {
      if (numValue >= range.min && numValue <= range.max) {
        return range.color; // e.g., 'bg-green-100'
      }
    }
    return undefined;
  };

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
            operadorGranel: data.operadorGranel || '',
            supervisor: data.supervisor || '',
            lote: data.lote || '',
            shift: shiftStr,
            machines: data.machines || {},
            timeSlots: data.timeSlots || {},
            date: dateStr,
          } as DailyLog & { date: string };
        })
        .sort((a, b) => b.id.localeCompare(a.id));
      setLogs(fetchedLogs);
    } catch (err) {
      console.error('Error fetching logs for consolidated table view:', err);
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
    fetchLogs();
    
    const fetchSettings = async () => {
      try {
        const settingsDocRef = doc(db, 'appConfiguration', 'bitacora_settings');
        const snap = await getDoc(settingsDocRef);
        if (snap.exists()) {
          const settings = snap.data() as BitacoraSettings;
          if (settings.qualityParams) {
            setQualityParams(settings.qualityParams);
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();

    const fetchProducts = async () => {
      try {
        const prodsSnap = await getDocs(collection(db, 'products'));
        setProducts(prodsSnap.docs.map(doc => ({
          id: doc.id,
          productName: doc.data().productName || doc.id,
          color: doc.data().color,
        })));
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    };
    fetchProducts();
  }, []);

  // Flatten time slot records across all daily logs
  const detailedRows: ConsolidatedRow[] = useMemo(() => {
    const rows: ConsolidatedRow[] = [];
const getSlotData = (timeSlots: any, timeKey: string) => {
  if (!timeSlots) return {};
  if (timeSlots[timeKey]) return timeSlots[timeKey];
  const parts = timeKey.split(':');
  if (parts.length === 2) {
    const hour = parseInt(parts[0], 10);
    const min = parts[1];
    const alt1 = `${hour}:${min}`;
    const alt2 = `${String(hour).padStart(2, '0')}:${min}`;
    if (timeSlots[alt1]) return timeSlots[alt1];
    if (timeSlots[alt2]) return timeSlots[alt2];
  }
  return {};
};

const getMachineWeightVal = (slotData: any, mId: string) => {
  if (slotData === undefined || slotData === null) return '';
  const numId = mId.replace('machine_', '');

  // 1. Check direct machine property (e.g. slotData.machine_1, slotData.m1, slotData.machine1, slotData["1"])
  const mObj = slotData[mId] ?? slotData[`m${numId}`] ?? slotData[`machine${numId}`] ?? slotData[numId];
  
  if (mObj !== undefined && mObj !== null && mObj !== '') {
    // If it's a primitive string or number (e.g. slotData.machine_1 = 50 or "50")
    if (typeof mObj !== 'object') {
      return String(mObj);
    }

    // If it's an object (e.g. { weight: 50, bundle_weight: 12, speed: 40 })
    if (typeof mObj === 'object') {
      // Check specific weight keys first
      const weightKeys = ['weight', 'sackWeight', 'peso', 'pesaje', 'p_saco', 'val', 'value'];
      for (const k of weightKeys) {
        if (mObj[k] !== undefined && mObj[k] !== null && String(mObj[k]).trim() !== '') {
          return String(mObj[k]);
        }
      }
      // If no explicit weight key, check any non-metadata key
      for (const [k, v] of Object.entries(mObj)) {
        if (['obs', 'observation', 'novedades', 'speed', 'bundle_weight', 'bundleWeight', 'p_fardo', 'peso_funda', 'stops', 'productId'].includes(k)) continue;
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          return String(v);
        }
      }
    }
  }

  // 2. Check flat key formats on slotData (e.g. slotData.machine_1_weight, slotData.machine_1_val, slotData.m1_weight)
  if (typeof slotData === 'object') {
    for (const [k, v] of Object.entries(slotData)) {
      if (v === undefined || v === null || String(v).trim() === '') continue;
      const kLower = k.toLowerCase();
      const matchesMachine = kLower.includes(`machine_${numId}`) || kLower.includes(`machine${numId}`) || kLower.includes(`m${numId}_`) || kLower.startsWith(`m${numId}`);
      if (matchesMachine) {
        if (kLower.includes('weight') || kLower.includes('peso') || kLower.includes('val') || kLower.includes('saco')) {
          if (typeof v === 'object') {
            const nestedStr = (v as any).weight || (v as any).val || (v as any).value || '';
            if (nestedStr) return String(nestedStr);
          } else {
            return String(v);
          }
        }
      }
    }
  }

  return '';
};

const getMachineBundleWeightVal = (slotData: any, mId: string) => {
  if (slotData === undefined || slotData === null) return '';
  const numId = mId.replace('machine_', '');
  const mObj = slotData[mId] ?? slotData[`m${numId}`] ?? slotData[`machine${numId}`] ?? slotData[numId];
  if (mObj !== undefined && mObj !== null && mObj !== '') {
    if (typeof mObj === 'object') {
      const bundleKeys = ['speed', 'bundle_weight', 'bundleWeight', 'p_fardo'];
      for (const k of bundleKeys) {
        if (mObj[k] !== undefined && mObj[k] !== null && String(mObj[k]).trim() !== '') {
          return String(mObj[k]);
        }
      }
    }
  }

  if (typeof slotData === 'object') {
    for (const [k, v] of Object.entries(slotData)) {
      if (v === undefined || v === null || String(v).trim() === '') continue;
      const kLower = k.toLowerCase();
      const matchesMachine = kLower.includes(`machine_${numId}`) || kLower.includes(`machine${numId}`) || kLower.includes(`m${numId}_`) || kLower.startsWith(`m${numId}`);
      if (matchesMachine) {
        if (kLower.includes('speed') || kLower.includes('bundle') || kLower.includes('fardo')) {
          if (typeof v === 'object') {
            const nestedStr = (v as any).bundle_weight || (v as any).speed || (v as any).bundleWeight || (v as any).weight || '';
            if (nestedStr) return String(nestedStr);
          } else {
            return String(v);
          }
        }
      }
    }
  }

  return '';
};

const getMachinePesoFundaVal = (slotData: any, mId: string) => {
  if (slotData === undefined || slotData === null) return '';
  const numId = mId.replace('machine_', '');
  const mObj = slotData[mId] ?? slotData[`m${numId}`] ?? slotData[`machine${numId}`] ?? slotData[numId];
  if (mObj !== undefined && mObj !== null && mObj !== '') {
    if (typeof mObj === 'object') {
      for (const k of ['peso_funda', 'funda']) {
        if (mObj[k] !== undefined && mObj[k] !== null && String(mObj[k]).trim() !== '') {
          return String(mObj[k]);
        }
      }
    }
  }

  if (typeof slotData === 'object') {
    for (const [k, v] of Object.entries(slotData)) {
      if (v === undefined || v === null || String(v).trim() === '') continue;
      const kLower = k.toLowerCase();
      const matchesMachine = kLower.includes(`machine_${numId}`) || kLower.includes(`machine${numId}`) || kLower.includes(`m${numId}_`) || kLower.startsWith(`m${numId}`);
      if (matchesMachine && kLower.includes('funda')) {
        if (typeof v !== 'object') {
          return String(v);
        }
      }
    }
  }

  return '';
};

// Reconstruye la presentación activa en cada franja horaria a partir del
// historial de cambios de producto (productChanges) y el producto actual.
const getActiveProductId = (machine: MachineLog | undefined, slotTime: string, shift: 'day' | 'night') => {
  if (!machine) return '';
  const changes: ProductChangeEvent[] = (machine.productChanges || [])
    .slice()
    .sort((a, b) => timeToMinsInTable(a.at, shift) - timeToMinsInTable(b.at, shift));
  if (changes.length === 0) return machine.productId || '';
  const slotMins = timeToMinsInTable(slotTime, shift);
  let active = changes[0].from || '';
  for (const c of changes) {
    if (timeToMinsInTable(c.at, shift) <= slotMins) active = c.to || '';
    else break;
  }
  return active;
};

const timeToMinsInTable = (tStr: string, shift: 'day' | 'night') => {
  const [h, m] = tStr.split(':').map(Number);
  let total = h * 60 + m;
  if (shift === 'night' && h < 18) {
    total += 24 * 60;
  }
  return total;
};

const getMachineObsValForSlot = (
  slotData: any,
  mId: string,
  timeKey: string,
  shift: 'day' | 'night',
  allStopsInLog: (StopData & { machineId: string })[]
) => {
  const numId = mId.replace('machine_', '');
  const parts: string[] = [];

  // 1. Check overlapping stops from allStopsInLog
  const cellStartMins = timeToMinsInTable(timeKey, shift);
  const cellEndMins = cellStartMins + 30;

  const overlappingStops = allStopsInLog.filter((s) => {
    if (s.machineId !== mId) return false;
    try {
      const sStart = timeToMinsInTable(s.startTime, shift);
      let sEnd = timeToMinsInTable(s.endTime, shift);
      if (sEnd <= sStart) sEnd += 24 * 60;
      return sStart < cellEndMins && sEnd > cellStartMins;
    } catch (e) {
      return false;
    }
  });

  if (overlappingStops.length > 0) {
    const stopsStr = overlappingStops
      .map((s) => {
        const label = s.reason || s.cause || s.type || 'Parada';
        const dur = s.duration ? ` (${s.duration}m)` : '';
        return `${label}${dur}`;
      })
      .join('; ');
    parts.push(stopsStr);
  }

  // 2. Check explicit text observation / notes in slotData
  if (slotData && typeof slotData === 'object') {
    const mObj = slotData[mId] ?? slotData[`m${numId}`] ?? slotData[`machine${numId}`] ?? slotData[numId];
    if (mObj && typeof mObj === 'object') {
      const obsKeys = ['obs', 'observation', 'novedades', 'nota', 'comentario'];
      for (const k of obsKeys) {
        if (mObj[k] !== undefined && mObj[k] !== null && String(mObj[k]).trim() !== '') {
          parts.push(String(mObj[k]).trim());
          break;
        }
      }
    }

    // Flat key fallback
    for (const [k, v] of Object.entries(slotData)) {
      if (v === undefined || v === null || String(v).trim() === '') continue;
      const kLower = k.toLowerCase();
      const matchesMachine = kLower.includes(`machine_${numId}`) || kLower.includes(`machine${numId}`) || kLower.includes(`m${numId}_`);
      if (matchesMachine && (kLower.includes('obs') || kLower.includes('observation') || kLower.includes('novedades'))) {
        if (typeof v !== 'object') {
          parts.push(String(v).trim());
        }
      }
    }
  }

  return parts.join(' | ');
};

    logs.forEach((log) => {
      const logDate = (log as any).date || log.id.split('_')[0];
      const standardSlots = generateDisplayTimeSlots(log.shift);
      const docSlots = Object.keys(log.timeSlots || {});
      const timeSlots = Array.from(new Set([...standardSlots, ...docSlots])).sort((a, b) => {
        return timeToMinsInTable(a, log.shift) - timeToMinsInTable(b, log.shift);
      });

      // Collect all stops in this log
      const allStopsInLog: (StopData & { machineId: string })[] = [];
      if (log.timeSlots && typeof log.timeSlots === 'object') {
        Object.values(log.timeSlots).forEach((slot: any) => {
          if (!slot || typeof slot !== 'object') return;
          Object.entries(slot).forEach(([mId, machineData]: [string, any]) => {
            if (machineData && typeof machineData === 'object' && 'stops' in machineData && Array.isArray(machineData.stops)) {
              let normId = mId;
              if (!normId.startsWith('machine_')) {
                const num = normId.replace(/\D/g, '');
                if (num) normId = `machine_${num}`;
              }
              machineData.stops.forEach((stop: any) => {
                allStopsInLog.push({ ...stop, machineId: normId });
              });
            }
          });
        });
      }

      timeSlots.forEach((time) => {
        const slotData: Partial<TimeSlot> = getSlotData(log.timeSlots, time);

        const m1_presentacion = getProductName(getActiveProductId(log.machines?.['machine_1'], time, log.shift), products);
        const m1_obs = getMachineObsValForSlot(slotData, 'machine_1', time, log.shift, allStopsInLog);
        const m1_val = getMachineWeightVal(slotData, 'machine_1');
        const m1_bundle_weight = getMachineBundleWeightVal(slotData, 'machine_1');
        const m2_presentacion = getProductName(getActiveProductId(log.machines?.['machine_2'], time, log.shift), products);
        const m2_obs = getMachineObsValForSlot(slotData, 'machine_2', time, log.shift, allStopsInLog);
        const m2_val = getMachineWeightVal(slotData, 'machine_2');
        const m2_bundle_weight = getMachineBundleWeightVal(slotData, 'machine_2');
        const m3_presentacion = getProductName(getActiveProductId(log.machines?.['machine_3'], time, log.shift), products);
        const m3_obs = getMachineObsValForSlot(slotData, 'machine_3', time, log.shift, allStopsInLog);
        const m3_val = getMachineWeightVal(slotData, 'machine_3');
        const m3_bundle_weight = getMachineBundleWeightVal(slotData, 'machine_3');
        const m4_presentacion = getProductName(getActiveProductId(log.machines?.['machine_4'], time, log.shift), products);
        const m4_obs = getMachineObsValForSlot(slotData, 'machine_4', time, log.shift, allStopsInLog);
        const m4_val = getMachineWeightVal(slotData, 'machine_4');
        const m4_bundle_weight = getMachineBundleWeightVal(slotData, 'machine_4');
        const m5_presentacion = getProductName(getActiveProductId(log.machines?.['machine_5'], time, log.shift), products);
        const m5_obs = getMachineObsValForSlot(slotData, 'machine_5', time, log.shift, allStopsInLog);
        const m5_val = getMachineWeightVal(slotData, 'machine_5');
        const m6_presentacion = getProductName(getActiveProductId(log.machines?.['machine_6'], time, log.shift), products);
        const m6_obs = getMachineObsValForSlot(slotData, 'machine_6', time, log.shift, allStopsInLog);
        const m6_val = getMachineWeightVal(slotData, 'machine_6');
        const m7_presentacion = getProductName(getActiveProductId(log.machines?.['machine_7'], time, log.shift), products);
        const m7_obs = getMachineObsValForSlot(slotData, 'machine_7', time, log.shift, allStopsInLog);
        const m7_val = getMachineBundleWeightVal(slotData, 'machine_7') || getMachineWeightVal(slotData, 'machine_7');
        const m7_peso_funda = getMachinePesoFundaVal(slotData, 'machine_7');
        const m8_presentacion = getProductName(getActiveProductId(log.machines?.['machine_8'], time, log.shift), products);
        const m8_obs = getMachineObsValForSlot(slotData, 'machine_8', time, log.shift, allStopsInLog);
        const m8_val = getMachineBundleWeightVal(slotData, 'machine_8') || getMachineWeightVal(slotData, 'machine_8');
        const m8_peso_funda = getMachinePesoFundaVal(slotData, 'machine_8');

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
          m1_bundle_weight ||
          m2_obs ||
          m2_val ||
          m2_bundle_weight ||
          m3_obs ||
          m3_val ||
          m3_bundle_weight ||
          m4_obs ||
          m4_val ||
          m4_bundle_weight ||
          m5_obs ||
          m5_val ||
          m6_obs ||
          m6_val ||
          m7_obs ||
          m7_val ||
          m7_peso_funda ||
          m8_obs ||
          m8_val ||
          m8_peso_funda;

        if (hasData) {
          rows.push({
            logId: log.id,
            date: logDate,
            shift: log.shift,
            operador: log.operador,
            operadorGranel: log.operadorGranel,
            supervisor: log.supervisor,
            lote: log.lote,
            time,
            m1_presentacion: m1_presentacion,
            m1_obs,
            m1_val: String(m1_val || ''),
            m1_bundle_weight: String(m1_bundle_weight || ''),
            m2_presentacion: m2_presentacion,
            m2_obs,
            m2_val: String(m2_val || ''),
            m2_bundle_weight: String(m2_bundle_weight || ''),
            m3_presentacion: m3_presentacion,
            m3_obs,
            m3_val: String(m3_val || ''),
            m3_bundle_weight: String(m3_bundle_weight || ''),
            m4_presentacion: m4_presentacion,
            m4_obs,
            m4_val: String(m4_val || ''),
            m4_bundle_weight: String(m4_bundle_weight || ''),
            m5_presentacion: m5_presentacion,
            m5_obs,
            m5_val: String(m5_val || ''),
            m6_presentacion: m6_presentacion,
            m6_obs,
            m6_val: String(m6_val || ''),
            m7_presentacion: m7_presentacion,
            m7_obs,
            m7_val: String(m7_val || ''),
            m7_peso_funda: String(m7_peso_funda || ''),
            m8_presentacion: m8_presentacion,
            m8_obs,
            m8_val: String(m8_val || ''),
            m8_peso_funda: String(m8_peso_funda || ''),
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
  }, [logs, products]);

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
          (row.operadorGranel && row.operadorGranel.toLowerCase().includes(term)) ||
          row.supervisor.toLowerCase().includes(term) ||
          row.lote.toLowerCase().includes(term) ||
          row.time.includes(term) ||
          (row.empaque_obs && row.empaque_obs.toLowerCase().includes(term)) ||
          (row.m1_obs && row.m1_obs.toLowerCase().includes(term)) ||
          (row.m2_obs && row.m2_obs.toLowerCase().includes(term)) ||
          (row.m3_obs && row.m3_obs.toLowerCase().includes(term)) ||
          (row.m4_obs && row.m4_obs.toLowerCase().includes(term)) ||
          (row.m5_obs && row.m5_obs.toLowerCase().includes(term)) ||
          (row.m6_obs && row.m6_obs.toLowerCase().includes(term));
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
        'Tecnotok #1 (Presentación)',
        'Tecnotok #1 (Obs)',
        'Tecnotok #1 (Valor)',
        'Tecnotok #1 (Peso Funda)',
        'Tecnotok #2 (Presentación)',
        'Tecnotok #2 (Obs)',
        'Tecnotok #2 (Valor)',
        'Tecnotok #2 (Peso Funda)',
        'Tecnotok #3 (Presentación)',
        'Tecnotok #3 (Obs)',
        'Tecnotok #3 (Valor)',
        'Tecnotok #3 (Peso Funda)',
        'Tecnotok #4 (Presentación)',
        'Tecnotok #4 (Obs)',
        'Tecnotok #4 (Valor)',
        'Tecnotok #4 (Peso Funda)',
        'Granelera #1 (Presentación)',
        'Granelera #1 (Obs)',
        'Granelera #1 (Valor)',
        'Granelera #2 (Presentación)',
        'Granelera #2 (Obs)',
        'Granelera #2 (Valor)',
        'Enfardadora #1 (Presentación)',
        'Enfardadora #1 (Obs)',
        'Enfardadora #1 (Valor)',
        'Enfardadora #1 (Peso Funda)',
        'Enfardadora #2 (Presentación)',
        'Enfardadora #2 (Obs)',
        'Enfardadora #2 (Valor)',
        'Enfardadora #2 (Peso Funda)',
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
        `"${(r.m1_presentacion || '').replace(/"/g, '""')}"`,
        `"${(r.m1_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m1_val || '').replace(/"/g, '""')}"`,
        `"${(r.m1_bundle_weight || '').replace(/"/g, '""')}"`,
        `"${(r.m2_presentacion || '').replace(/"/g, '""')}"`,
        `"${(r.m2_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m2_val || '').replace(/"/g, '""')}"`,
        `"${(r.m2_bundle_weight || '').replace(/"/g, '""')}"`,
        `"${(r.m3_presentacion || '').replace(/"/g, '""')}"`,
        `"${(r.m3_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m3_val || '').replace(/"/g, '""')}"`,
        `"${(r.m3_bundle_weight || '').replace(/"/g, '""')}"`,
        `"${(r.m4_presentacion || '').replace(/"/g, '""')}"`,
        `"${(r.m4_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m4_val || '').replace(/"/g, '""')}"`,
        `"${(r.m4_bundle_weight || '').replace(/"/g, '""')}"`,
        `"${(r.m5_presentacion || '').replace(/"/g, '""')}"`,
        `"${(r.m5_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m5_val || '').replace(/"/g, '""')}"`,
        `"${(r.m6_presentacion || '').replace(/"/g, '""')}"`,
        `"${(r.m6_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m6_val || '').replace(/"/g, '""')}"`,
        `"${(r.m7_presentacion || '').replace(/"/g, '""')}"`,
        `"${(r.m7_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m7_val || '').replace(/"/g, '""')}"`,
        `"${(r.m7_peso_funda || '').replace(/"/g, '""')}"`,
        `"${(r.m8_presentacion || '').replace(/"/g, '""')}"`,
        `"${(r.m8_obs || '').replace(/"/g, '""')}"`,
        `"${(r.m8_val || '').replace(/"/g, '""')}"`,
        `"${(r.m8_peso_funda || '').replace(/"/g, '""')}"`,
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
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background max-w-full min-w-0 min-h-0">
      {/* Content Container */}
      <div className="flex-1 flex flex-col overflow-hidden p-3 md:p-5 gap-3 bg-muted/10 max-w-full min-w-0 min-h-0">
        {/* Filter Controls Card */}
        <Card className="shadow-sm border border-border flex-shrink-0 bg-card">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              {/* Left side: Back button & Title */}
              <div className="flex items-center gap-2 flex-shrink-0 pb-1">
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Link href="/stops" title="Volver a la Bitácora">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">Filtros</span>
              </div>

              {/* Middle: Filters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 flex-grow">
                {/* Search */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Buscar por texto</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Operador, Lote, Novedad..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Shift */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Turno</Label>
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
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-xs [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-xs [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
            </div>

            {/* Right side: Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 pb-1 mt-3 lg:mt-0 lg:ml-4 lg:self-end">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLogs}
                disabled={loading}
                className="gap-2 border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800 h-9 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualizar</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </Button>
            </div>
          </div>
        </CardContent>
        </Card>

        {/* Tables Section */}
        <div className="flex-1 flex flex-col overflow-hidden max-w-full min-w-0 min-h-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="flex-1 flex flex-col overflow-hidden max-w-full min-w-0 min-h-0 gap-3"
          >
            <div className="flex items-center justify-between flex-shrink-0 px-1">
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

              <div className="text-xs text-muted-foreground">
                Total Bitácoras: <strong className="text-foreground">{logs.length}</strong>
              </div>
            </div>

            {/* Detailed Table View */}
            <TabsContent value="detailed" className="data-[state=active]:flex-1 data-[state=active]:flex data-[state=inactive]:hidden flex-col overflow-hidden border rounded-xl bg-card shadow-sm m-0 max-w-full min-w-0 min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-80 gap-3 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-medium">Cargando registros de bitácora...</p>
                </div>
              ) : filteredDetailedRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 text-muted-foreground gap-2">
                  <TableProperties className="h-12 w-12 opacity-20" />
                  <p className="text-sm font-medium">No se encontraron registros que coincidan con los filtros.</p>
                  <p className="text-xs opacity-75">Intenta modificar las fechas o el texto de búsqueda.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto relative max-w-full min-w-0 min-h-0">
                  <table className="w-max min-w-full text-xs text-left border-collapse" style={{ zoom: 0.9 }}>
                    <thead className="sticky top-0 bg-card shadow-sm border-b font-medium text-muted-foreground z-20">
                      <tr className="divide-x divide-border">
                        <th className="p-2.5 sticky left-0 z-30 bg-muted min-w-[5.5rem]">Fecha</th>
                        <th className="p-2.5 min-w-[4rem]">Turno</th>
                        <th className="p-2.5 min-w-[4rem]">Hora</th>
                        <th className="p-2.5 min-w-[7.5rem]">Operador</th>
                        <th className="p-2.5 min-w-[7.5rem]">Op. Granel</th>
                        <th className="p-2.5 min-w-[7.5rem]">Supervisor</th>
                        <th className="p-2.5 min-w-[5rem]">Lote</th>
                        <th className="p-2.5 min-w-[7.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #1 (Pres)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #1 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #1 (Val)</th>
                        <th className="p-2.5 min-w-[6.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #1 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[7.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Pres)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Val)</th>
                        <th className="p-2.5 min-w-[6.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #2 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[7.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Pres)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Val)</th>
                        <th className="p-2.5 min-w-[6.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #3 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[7.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Pres)</th>
                        <th className="p-2.5 min-w-[8.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Val)</th>
                        <th className="p-2.5 min-w-[6.5rem] bg-purple-200 dark:bg-purple-900/70 text-purple-900 dark:text-purple-100">Tecnotok #4 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[7.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #1 (Pres)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #1 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #1 (Val)</th>
                        <th className="p-2.5 min-w-[7.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #2 (Pres)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #2 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Granelera #2 (Val)</th>
                        <th className="p-2.5 min-w-[7.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #1 (Pres)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #1 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #1 (Val)</th>
                        <th className="p-2.5 min-w-[6.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #1 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[7.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #2 (Pres)</th>
                        <th className="p-2.5 min-w-[9rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #2 (Obs)</th>
                        <th className="p-2.5 min-w-[5.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #2 (Val)</th>
                        <th className="p-2.5 min-w-[6.5rem] bg-amber-200 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100">Enfardadora #2 (Peso Funda)</th>
                        <th className="p-2.5 min-w-[4rem] bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100">Masa</th>
                        <th className="p-2.5 min-w-[5rem] bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100">Flujo</th>
                        <th className="p-2.5 min-w-[4rem] bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100">NS-FA</th>
                        <th className="p-2.5 min-w-[4rem] bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100">NS 1</th>
                        <th className="p-2.5 min-w-[4rem] bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100">NS 2</th>
                        <th className="p-2.5 min-w-[4rem] bg-lime-100/80 dark:bg-lime-950/40 text-lime-950 dark:text-lime-100">In Color</th>
                        <th className="p-2.5 min-w-[4rem] bg-lime-100/80 dark:bg-lime-950/40 text-lime-950 dark:text-lime-100">In Hum</th>
                        <th className="p-2.5 min-w-[4rem] bg-lime-100/80 dark:bg-lime-950/40 text-lime-950 dark:text-lime-100">In Turb</th>
                        <th className="p-2.5 min-w-[4rem] bg-lime-100/80 dark:bg-lime-950/40 text-lime-950 dark:text-lime-100">In CV</th>
                        <th className="p-2.5 min-w-[4rem] bg-sky-100/80 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100">Out Fam Col</th>
                        <th className="p-2.5 min-w-[4rem] bg-sky-100/80 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100">Out Fam Hum</th>
                        <th className="p-2.5 min-w-[4rem] bg-sky-100/80 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100">Out Fam Turb</th>
                        <th className="p-2.5 min-w-[4rem] bg-teal-100/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100">Out Gra Col</th>
                        <th className="p-2.5 min-w-[4rem] bg-teal-100/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100">Out Gra Hum</th>
                        <th className="p-2.5 min-w-[4rem] bg-teal-100/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100">Out Gra Turb</th>
                        <th className="p-2.5 min-w-[14rem] bg-purple-100/80 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100">Novedades Empaque</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono text-[11px]">
                      {filteredDetailedRows.map((row, idx) => (
                        <tr key={`${row.logId}_${row.time}_${idx}`} className="hover:bg-muted/60 transition-colors divide-x divide-border">
                          <td className="p-2 font-semibold sticky left-0 z-10 bg-card font-sans border-r">{row.date}</td>
                          <td className="p-2 font-sans">
                            <Badge variant={row.shift === 'day' ? 'outline' : 'secondary'} className="text-[10px] px-1 py-0">
                              {row.shift === 'day' ? 'Día' : 'Noche'}
                            </Badge>
                          </td>
                          <td className="p-2 font-bold text-indigo-600 dark:text-indigo-400">{row.time}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[120px]" title={row.operador}>{row.operador}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[120px]" title={row.operadorGranel}>{row.operadorGranel || '-'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[120px]" title={row.supervisor}>{row.supervisor}</td>
                          <td className="p-2 font-sans">{row.lote}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[150px] min-w-[7.5rem]" title={row.m1_presentacion}>{row.m1_presentacion || '—'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m1_obs}>{row.m1_obs}</td>
                          <td className="p-2">{row.m1_val}</td>
                          <td className="p-2">{row.m1_bundle_weight}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[150px] min-w-[7.5rem]" title={row.m2_presentacion}>{row.m2_presentacion || '—'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m2_obs}>{row.m2_obs}</td>
                          <td className="p-2">{row.m2_val}</td>
                          <td className="p-2">{row.m2_bundle_weight}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[150px] min-w-[7.5rem]" title={row.m3_presentacion}>{row.m3_presentacion || '—'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m3_obs}>{row.m3_obs}</td>
                          <td className="p-2">{row.m3_val}</td>
                          <td className="p-2">{row.m3_bundle_weight}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[150px] min-w-[7.5rem]" title={row.m4_presentacion}>{row.m4_presentacion || '—'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m4_obs}>{row.m4_obs}</td>
                          <td className="p-2">{row.m4_val}</td>
                          <td className="p-2">{row.m4_bundle_weight}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[150px] min-w-[7.5rem]" title={row.m5_presentacion}>{row.m5_presentacion || '—'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m5_obs}>{row.m5_obs}</td>
                          <td className="p-2">{row.m5_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[150px] min-w-[7.5rem]" title={row.m6_presentacion}>{row.m6_presentacion || '—'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m6_obs}>{row.m6_obs}</td>
                          <td className="p-2">{row.m6_val}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[150px] min-w-[7.5rem]" title={row.m7_presentacion}>{row.m7_presentacion || '—'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m7_obs}>{row.m7_obs}</td>
                          <td className="p-2">{row.m7_val}</td>
                          <td className="p-2">{row.m7_peso_funda}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[150px] min-w-[7.5rem]" title={row.m8_presentacion}>{row.m8_presentacion || '—'}</td>
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[180px] min-w-[10rem]" title={row.m8_obs}>{row.m8_obs}</td>
                          <td className="p-2">{row.m8_val}</td>
                          <td className="p-2">{row.m8_peso_funda}</td>
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
                          <td className="p-2 font-sans whitespace-normal break-words max-w-[240px] min-w-[14rem]" title={row.empaque_obs}>{row.empaque_obs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Summary Table View */}
            <TabsContent value="summary" className="data-[state=active]:flex-1 data-[state=active]:flex data-[state=inactive]:hidden flex-col overflow-hidden border rounded-xl bg-card shadow-sm m-0 max-w-full min-w-0 min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-80 gap-3 text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-medium">Cargando bitácoras...</p>
                </div>
              ) : filteredLogsSummary.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 text-muted-foreground gap-2">
                  <Calendar className="h-12 w-12 opacity-20" />
                  <p className="text-sm font-medium">No se encontraron bitácoras.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto relative max-w-full min-w-0 min-h-0">
                  <table className="w-full min-w-max text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-card shadow-sm border-b font-medium text-muted-foreground z-20">
                      <tr className="divide-x divide-border">
                        <th className="p-3">ID Documento</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Turno</th>
                        <th className="p-3">Operador</th>
                        <th className="p-3">Supervisor</th>
                        <th className="p-3">Lote</th>
                        <th className="p-3 text-center">Franjas Registradas</th>
                        <th className="p-3 text-right">Acción</th>
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
                            <td className="p-3 text-right">
                              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                                <Link href={`/stops?date=${logDate}&shift=${log.shift}`}>Ver Bitácora</Link>
                              </Button>
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
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import type { DailyLog, TimeSlot, ProductDefinition, BitacoraSettings, QualityParams } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Mail, Loader2, AlertCircle, Activity, Sun, Moon, Download, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';

// ─── Constants ──────────────────────────────────────────────────────────────────
const MACHINE_LABELS: Record<string, string> = {
  machine_1: 'Tecnotok #1', machine_2: 'Tecnotok #2', machine_3: 'Tecnotok #3', machine_4: 'Tecnotok #4',
  machine_5: 'Granelera #1', machine_6: 'Granelera #2',
  machine_7: 'Enfardadora #1', machine_8: 'Enfardadora #2',
};
const MACHINE_IDS = ['machine_1', 'machine_2', 'machine_3', 'machine_4', 'machine_5', 'machine_6', 'machine_7', 'machine_8'];
const GRANEL_IDS = new Set(['machine_5', 'machine_6', 'machine_7', 'machine_8']);

function shiftLabel(shift: 'day' | 'night') { return shift === 'day' ? 'Día' : 'Noche'; }
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

// ─── Types ──────────────────────────────────────────────────────────────────────
export interface PresentationStats {
  productId: string;
  producto: string;
  productoColor: string | null;
  textColor: string;
  isFardoProduct?: boolean;
  values: number[];
  avg: number | null; min: number | null; max: number | null; count: number;
  bundleWeightValues: number[];
  avgBundleWeight: number | null; minBundleWeight: number | null; maxBundleWeight: number | null; countBundleWeight: number;
}

interface MachineStats {
  machineId: string; label: string; operador: string; producto: string;
  productoColor: string | null; textColor: string;
  weightLabel: string; values: number[];
  avg: number | null; min: number | null; max: number | null; count: number;
  bundleWeightValues: number[];
  avgBundleWeight: number | null; minBundleWeight: number | null; maxBundleWeight: number | null; countBundleWeight: number;
  presentations: PresentationStats[];
}
type QualityRow = {
  time: string; masa: string; flujo: string; ns_fam: string; ns_1: string; ns_2: string;
  in_color: string; in_hum: string; in_turb: string; in_cv: string;
  out_fam_color: string; out_fam_hum: string; out_fam_turb: string;
  out_gra_color: string; out_gra_hum: string; out_gra_turb: string; empaque_obs: string;
};
type ShiftSection = {
  shift: 'day' | 'night';
  supervisor: string;
  operador: string;
  operadorGranel: string;
  machines: MachineStats[];
  qualityRows: QualityRow[];
  lote: string;
  rawTimeSlots?: Record<string, any>; // For debugging
};
interface ReportData {
  date: string;
  sections: ShiftSection[];
  hiddenMachines: string[];
}

// ─── Component ──────────────────────────────────────────────────────────────────
export default function ReportClient({
  initialDate, initialShift,
}: { initialDate?: string; initialShift?: 'day' | 'night' }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = React.useState(initialDate || todayStr);
  const [shifts, setShifts] = React.useState<('day' | 'night')[]>(
    initialShift ? [initialShift] : ['day', 'night']
  );
  const [loading, setLoading] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [generatingType, setGeneratingType] = React.useState<'pdf' | 'email' | 'sync' | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reportData, setReportData] = React.useState<ReportData | null>(null);
  const [qualityParams, setQualityParams] = React.useState<QualityParams>({});

  const getColorForValue = React.useCallback((categoryKey: string, value: string | undefined) => {
    if (!value || !qualityParams[categoryKey]) return undefined;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return undefined;
    
    const ranges = qualityParams[categoryKey];
    for (const range of ranges) {
      if (numValue >= range.min && numValue <= range.max) {
        return range.color;
      }
    }
    return undefined;
  }, [qualityParams]);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchReport = React.useCallback(async () => {
    if (shifts.length === 0) { setError('Selecciona al menos un turno.'); return; }
    setLoading(true); setError(null); setReportData(null);

    try {
      // Load products
      const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('order')));
      const products: ProductDefinition[] = prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDefinition));
      const getProduct = (id: string) => products.find(p => p.id === id);
      const getProductName = (id: string) => getProduct(id)?.productName ?? '—';
      const getProductColor = (id: string) => getProduct(id)?.color ?? null;

      // Helper to calculate text color based on background luma
      const isLight = (hex: string) => {
        if (!hex) return true;
        const rgb = parseInt(hex.replace('#', ''), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = (rgb >> 0) & 0xff;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luma > 128;
      };

      // Settings
      const settingsSnap = await getDoc(doc(db, 'appConfiguration', 'bitacora_settings'));
      const settings = settingsSnap.exists() ? settingsSnap.data() as BitacoraSettings : {} as BitacoraSettings;
      if (settings.qualityParams) {
        setQualityParams(settings.qualityParams);
      }
      const weightHeaderType: Record<string, string> = settings.weightHeaderType ?? {};
      const hiddenMachines: string[] = settings.hiddenMachines ?? [];

      const shiftsToFetch: ('day' | 'night')[] = shifts;

      const sections: ShiftSection[] = [];

      for (const shift of shiftsToFetch) {
        const logSnap = await getDoc(doc(db, 'dailyLogs', `${date}_${shift}`));
        let shiftHiddenMachines = hiddenMachines;
        if (!logSnap.exists()) {
          continue; // Skip if no log exists for this shift
        }

        let log: DailyLog = { id: logSnap.id, ...logSnap.data() } as DailyLog;
        if (log.hiddenMachines) {
          shiftHiddenMachines = log.hiddenMachines;
        }

        // Build empty stats for all visible machines
        const machineMap: Record<string, MachineStats> = {};
        MACHINE_IDS.filter(id => !shiftHiddenMachines.includes(id)).forEach(id => {
          machineMap[id] = {
            machineId: id, label: MACHINE_LABELS[id], operador: '—', producto: '—',
            productoColor: null, textColor: shift === 'day' ? '#ffffff' : '#ffffff',
            weightLabel: (weightHeaderType[id] ?? 'weight') === 'bundle_weight' ? 'P/Fardo' : 'P/Saco',
            values: [], avg: null, min: null, max: null, count: 0,
            bundleWeightValues: [], avgBundleWeight: null, minBundleWeight: null, maxBundleWeight: null, countBundleWeight: 0,
            presentations: [],
          };
        });

        let supervisor = log.supervisor || '—';
        let operador = log.operador || '—';
        let operadorGranel = log.operadorGranel || '—';

        const timeSlots = log.timeSlots ?? {};

        MACHINE_IDS.filter(id => !shiftHiddenMachines.includes(id)).forEach(machineId => {
          const weightField = weightHeaderType[machineId] ?? 'weight';
          const isGranel = GRANEL_IDS.has(machineId);

          // Operador
          machineMap[machineId].operador = isGranel
            ? (log.operadorGranel || log.operador || '—')
            : (log.operador || '—');

          // Producto
          const machineData = log.machines?.[machineId];
          const productId = machineData?.productId ?? '';
          
          const uniqueProductIds = new Set<string>();
          if (productId) uniqueProductIds.add(productId);
          if (machineData?.productChanges) {
            machineData.productChanges.forEach((c: any) => {
              if (c.from) uniqueProductIds.add(c.from);
              if (c.to) uniqueProductIds.add(c.to);
            });
          }

          if (uniqueProductIds.size > 0) {
            const productNames = Array.from(uniqueProductIds).map(id => getProductName(id)).filter(Boolean);
            machineMap[machineId].producto = productNames.join(', ');
          } else {
            machineMap[machineId].producto = '—';
          }

          const pColor = productId ? getProductColor(productId) : null;
          machineMap[machineId].productoColor = pColor;
          machineMap[machineId].textColor = pColor ? (isLight(pColor) ? '#1e293b' : '#ffffff') : '#ffffff';

          const timeToMins = (tStr: string) => {
            if (!tStr) return 0;
            const parts = tStr.split(':').map(Number);
            let total = (parts[0] || 0) * 60 + (parts[1] || 0);
            if (shift === 'night' && (parts[0] || 0) < 18) total += 24 * 60;
            return total;
          };
          const changes = (machineData?.productChanges || []).slice().sort((a: any, b: any) => timeToMins(a.at) - timeToMins(b.at));
          
          const presMap: Record<string, PresentationStats> = {};
          uniqueProductIds.forEach(id => {
             const cColor = getProductColor(id);
             const pDef = getProduct(id);
             const pName = getProductName(id);
             const isFardoProduct = pDef?.primaryPackaging === 'fardo' || pName.toLowerCase().includes('fardo') || pName.toLowerCase().includes('(12 kg)');
             presMap[id] = {
                productId: id,
                producto: pName,
                productoColor: cColor,
                textColor: cColor ? (isLight(cColor) ? '#1e293b' : '#ffffff') : '#ffffff',
                isFardoProduct,
                values: [], avg: null, min: null, max: null, count: 0,
                bundleWeightValues: [], avgBundleWeight: null, minBundleWeight: null, maxBundleWeight: null, countBundleWeight: 0,
             };
          });
          
          const getActiveProductAt = (time: string) => {
             if (changes.length === 0) return productId;
             const slotMins = timeToMins(time);
             let active = changes[0].from || productId;
             for (const c of changes) {
               if (timeToMins(c.at) <= slotMins) active = c.to || '';
             }
             return active;
          };

          // Weights — stored at timeSlots[time][machineId][weightField]
          Object.entries(timeSlots).forEach(([time, slot]: [string, any]) => {
            const machineSlot = slot[machineId as keyof TimeSlot] as Record<string, any> | undefined;
            if (!machineSlot || typeof machineSlot !== 'object') return;

            const possibleKeys = [weightField, 'weight', 'peso', 'p_saco', 'undefined'];
            let valStr = '';
            for (const k of possibleKeys) {
              if (machineSlot[k] !== undefined && machineSlot[k] !== '') {
                valStr = String(machineSlot[k]);
                break;
              }
            }

            const rawStr = valStr.replace(',', '.');
            const val = parseFloat(rawStr);
            const activeProd = getActiveProductAt(time);
            
            if (!isNaN(val) && val > 0) {
              machineMap[machineId].values.push(val);
              if (activeProd && presMap[activeProd]) presMap[activeProd].values.push(val);
            }

            const isEnfardadora = machineId === 'machine_7' || machineId === 'machine_8';
            const fundaVal = isEnfardadora
              ? (machineSlot.peso_funda ?? machineSlot.speed)
              : (machineSlot.bundle_weight ?? machineSlot.speed);
            if (fundaVal !== undefined && fundaVal !== '') {
              const fundaRawStr = String(fundaVal).replace(',', '.');
              const fundaNum = parseFloat(fundaRawStr);
              if (!isNaN(fundaNum) && fundaNum > 0) {
                machineMap[machineId].bundleWeightValues.push(fundaNum);
                if (activeProd && presMap[activeProd]) presMap[activeProd].bundleWeightValues.push(fundaNum);
              }
            }
          });
          
          machineMap[machineId].presentations = Object.values(presMap);
        });
        // Compute stats
        Object.values(machineMap).forEach(m => {
          if (m.values.length) {
            m.avg = parseFloat((m.values.reduce((a, b) => a + b, 0) / m.values.length).toFixed(2));
            m.min = parseFloat(Math.min(...m.values).toFixed(2));
            m.max = parseFloat(Math.max(...m.values).toFixed(2));
            m.count = m.values.length;
          }
          if (m.bundleWeightValues.length) {
            m.avgBundleWeight = parseFloat((m.bundleWeightValues.reduce((a, b) => a + b, 0) / m.bundleWeightValues.length).toFixed(2));
            m.minBundleWeight = parseFloat(Math.min(...m.bundleWeightValues).toFixed(2));
            m.maxBundleWeight = parseFloat(Math.max(...m.bundleWeightValues).toFixed(2));
            m.countBundleWeight = m.bundleWeightValues.length;
          }
          
          m.presentations.forEach(p => {
             if (p.values.length) {
                p.avg = parseFloat((p.values.reduce((a, b) => a + b, 0) / p.values.length).toFixed(2));
                p.min = parseFloat(Math.min(...p.values).toFixed(2));
                p.max = parseFloat(Math.max(...p.values).toFixed(2));
                p.count = p.values.length;
             }
             if (p.bundleWeightValues.length) {
                p.avgBundleWeight = parseFloat((p.bundleWeightValues.reduce((a, b) => a + b, 0) / p.bundleWeightValues.length).toFixed(2));
                p.minBundleWeight = parseFloat(Math.min(...p.bundleWeightValues).toFixed(2));
                p.maxBundleWeight = parseFloat(Math.max(...p.bundleWeightValues).toFixed(2));
                p.countBundleWeight = p.bundleWeightValues.length;
             }
          });
        });

        const qualityRows: QualityRow[] = [];
        if (log && log.timeSlots) {
          Object.entries(log.timeSlots).forEach(([time, slotData]: [string, any]) => {
            const qFields = ['masa', 'flujo', 'ns_fam', 'ns_1', 'ns_2', 'in_color', 'in_hum', 'in_turb', 'in_cv', 'out_fam_color', 'out_fam_hum', 'out_fam_turb', 'out_gra_color', 'out_gra_hum', 'out_gra_turb', 'empaque_obs'];
            let hasData = false;
            for (const f of qFields) {
              if (slotData[f] && String(slotData[f]).trim() !== '') {
                hasData = true; break;
              }
            }
            if (hasData) {
              qualityRows.push({
                time,
                masa: slotData.masa || '', flujo: slotData.flujo || '',
                ns_fam: slotData.ns_fam || '', ns_1: slotData.ns_1 || '', ns_2: slotData.ns_2 || '',
                in_color: slotData.in_color || '', in_hum: slotData.in_hum || '', in_turb: slotData.in_turb || '', in_cv: slotData.in_cv || '',
                out_fam_color: slotData.out_fam_color || '', out_fam_hum: slotData.out_fam_hum || '', out_fam_turb: slotData.out_fam_turb || '',
                out_gra_color: slotData.out_gra_color || '', out_gra_hum: slotData.out_gra_hum || '', out_gra_turb: slotData.out_gra_turb || '',
                empaque_obs: slotData.empaque_obs || ''
              });
            }
          });
        }
        qualityRows.sort((a, b) => {
          const timeToMins = (tStr: string) => {
            const [h, m] = tStr.split(':').map(Number);
            let total = h * 60 + m;
            if (shift === 'night' && h < 18) total += 24 * 60;
            return total;
          };
          return timeToMins(a.time) - timeToMins(b.time);
        });

        sections.push({
          shift,
          supervisor,
          operador,
          operadorGranel,
          lote: log.lote || '—',
          machines: Object.values(machineMap),
          qualityRows,
          rawTimeSlots: log.timeSlots
        });
      }

      setReportData({ date, sections, hiddenMachines });
    } catch (e) {
      console.error(e);
      setError('Error al cargar los datos. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [date, shifts]);

  React.useEffect(() => { fetchReport(); }, []); // eslint-disable-line

  // ── Visibility helpers ───────────────────────────────────────────────────────
  const hidden = reportData?.hiddenMachines ?? [];
  const hasTecnotok = ['machine_1', 'machine_2', 'machine_3', 'machine_4'].some(m => !hidden.includes(m));
  const hasGranel = ['machine_5', 'machine_6'].some(m => !hidden.includes(m));
  // For pre-render (before report loaded), peek from initial shift label
  const firstSection = reportData?.sections[0];

  // ── PDF + Email ──────────────────────────────────────────────────────────────
  const handleExport = async (action: 'download' | 'email') => {
    if (!reportData || reportData.sections.length === 0) return;
    setIsGenerating(true);
    setGeneratingType(action === 'download' ? 'pdf' : 'email');
    setProgress(5);

    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const dateFormatted = format(new Date(date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es });
      
      let isFirstPage = true;
      const totalSections = reportData.sections.length;
      let currentSectionIndex = 0;

      for (const section of reportData.sections) {
        const captureEl = document.getElementById(`report-capture-section-${section.shift}`);
        if (!captureEl) continue;

        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        setProgress(15 + (currentSectionIndex / totalSections) * 60);
        await new Promise(r => setTimeout(r, 100)); // Allow UI to update progress

        // Resetear el scroll al principio temporalmente soluciona el problema del texto caído
        const originalScrollY = window.scrollY;
        window.scrollTo(0, 0);
        await document.fonts.ready; // Asegurar que las fuentes estén listas

        // Usar html-to-image en lugar de html2canvas (evita texto caído)
        const imgData = await htmlToImage.toJpeg(captureEl, { 
          quality: 0.98,
          pixelRatio: 3,
        });
        
        // Restauramos el scroll
        window.scrollTo(0, originalScrollY);
        
        setProgress(30 + (currentSectionIndex / totalSections) * 60);
        await new Promise(r => setTimeout(r, 100));

        // PDF Header for this page
        pdf.setFillColor(37, 99, 235);
        pdf.rect(0, 0, pdfWidth, 28, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(16); pdf.setFont('helvetica', 'bold');
        pdf.text('Reporte de Producción y Control de Calidad', pdfWidth / 2, 12, { align: 'center' });
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
        pdf.text(`Fecha: ${dateFormatted}   |   Turno: ${shiftLabel(section.shift)}`, pdfWidth / 2, 21, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(8);
        pdf.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 34);

        // Calc image dimensions
        const margin = 10;
        const contentWidth = pdfWidth - margin * 2;
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = imgProps.width / imgProps.height;
        let finalImgWidth = contentWidth;
        let finalImgHeight = contentWidth / ratio;

        const startY = 38;
        const maxAvailableHeight = pdfHeight - startY - margin;
        
        if (finalImgHeight > maxAvailableHeight) {
            finalImgHeight = maxAvailableHeight;
            finalImgWidth = finalImgHeight * ratio;
        }
        const startX = (pdfWidth - finalImgWidth) / 2;

        pdf.addImage(imgData, 'JPEG', startX, startY, finalImgWidth, finalImgHeight);
        
        currentSectionIndex++;
      }

      setProgress(90);
      await new Promise(r => setTimeout(r, 100));

      const shiftText = reportData.sections.map(s => shiftLabel(s.shift)).join('_');
      const fileName = `Reporte_${date}_${shiftText}.pdf`;
      pdf.save(fileName);

      setProgress(100);

      // Mailto
      if (action === 'email') {
        const shiftTextMail = reportData.sections.map(s => shiftLabel(s.shift)).join(' + ');
        // Asumimos el lote del primer turno cargado
        const loteText = reportData.sections[0]?.lote || '';
        
        const body =
          `${getGreeting()} equipo,\n\n` +
          `Adjunto el Reporte de Producción y Calidad detallado para la jornada del ${dateFormatted} (Turno: ${shiftTextMail}).\n\n` +
          `Quedo a su disposición para cualquier consulta.\n\n` +
          `Saludos`;
          
        const subject = `Reporte de Producción Empaque Azúcar - Lote ${loteText}`;
        
        // Reemplazamos \n por \r\n para asegurar compatibilidad con Outlook Clásico
        const outlookBody = body.replace(/\n/g, '\r\n');
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(outlookBody)}`;
        
        // window.location.href es mucho más confiable que window.open para lanzar clientes de correo locales como Outlook
        window.location.href = mailtoLink;
      }

      await new Promise(r => setTimeout(r, 500));
      setIsModalOpen(false);
    } catch (e) {
      console.error('Error al generar PDF con captura:', e);
      alert('Error al generar PDF con captura de pantalla.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => setProgress(0), 500);
    }
  };



  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b shadow-sm">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/stops"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <FileText className="h-5 w-5 text-blue-600" />
        <h1 className="font-semibold text-sm">Reporte de Pesos por Máquina</h1>
        <div className="flex-1" />
        {reportData && (
          <Dialog open={isModalOpen} onOpenChange={(open) => !isGenerating && setIsModalOpen(open)}>
            <DialogTrigger asChild>
              <Button disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-sm h-8">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isGenerating ? 'Generando PDF...' : 'Opciones de Exportación'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-6 border-slate-200 dark:border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Exportar Reporte</DialogTitle>
                <DialogDescription>
                  Elige el formato y calidad de salida para tu reporte de producción.
                </DialogDescription>
              </DialogHeader>
              
              {!isGenerating ? (
                <div className="flex flex-col gap-4 py-4">
                  <Button onClick={() => handleExport('download')} variant="outline" className="h-20 w-full justify-start gap-4 px-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border-slate-200">
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                      <Download className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-base">Descargar PDF</p>
                      <p className="text-xs text-slate-500 font-normal">Alta resolución • Ideal para imprimir y archivar</p>
                    </div>
                  </Button>
                  <Button onClick={() => handleExport('email')} variant="outline" className="h-20 w-full justify-start gap-4 px-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all border-slate-200">
                    <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-base">Enviar al Correo</p>
                      <p className="text-xs text-slate-500 font-normal">Descarga y adjunta listo para enviar a tus superiores</p>
                    </div>
                  </Button>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-6 text-center">
                  <div className="relative">
                    <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                  <div className="space-y-3 w-full max-w-[85%]">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {generatingType === 'sync' ? 'Sincronizando...' : 'Generando Reporte de Alta Calidad...'}
                    </h3>
                    <Progress value={progress} className="h-2.5" />
                    <p className="text-xs text-slate-500">
                      {generatingType === 'sync' 
                        ? `Conectando y enviando datos de pesos (${Math.round(progress)}%)`
                        : `Procesando capturas y armando el documento PDF (${Math.round(progress)}%)`
                      }
                    </p>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </header>

      <main className="w-full max-w-[1600px] mx-auto p-4 space-y-5">
        {/* Filters */}
        <Card>
          <CardContent className="px-4 pt-4 pb-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Fecha */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-slate-500">Fecha</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs w-40" />
              </div>



              {/* Turnos */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs text-slate-500">Turno(s)</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox id="chk-day" checked={shifts.includes('day')} onCheckedChange={v => {
                      if (v) setShifts(prev => [...prev, 'day']);
                      else setShifts(prev => prev.filter(s => s !== 'day'));
                    }} />
                    <span className="text-xs">☀️ Día</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox id="chk-night" checked={shifts.includes('night')} onCheckedChange={v => {
                      if (v) setShifts(prev => [...prev, 'night']);
                      else setShifts(prev => prev.filter(s => s !== 'night'));
                    }} />
                    <span className="text-xs">🌙 Noche</span>
                  </label>
                </div>
              </div>

              <Button onClick={fetchReport} disabled={loading} className="h-8 text-xs gap-2">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
                Generar Reporte
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-sm">Cargando datos del turno...</span>
          </div>
        )}

        {/* Hide scrollbars during PDF capture */}
        {isGenerating && (
          <style>{`
            .overflow-x-auto, #report-capture-area * {
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
            .overflow-x-auto::-webkit-scrollbar, #report-capture-area *::-webkit-scrollbar {
              display: none !important;
            }
          `}</style>
        )}

        {/* Sections per shift */}
        <div id="report-capture-area" className="flex flex-col gap-6 p-4 rounded-xl">
          {reportData && !loading && reportData.sections.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed mt-4">
              <span className="text-4xl mb-3">📭</span>
              <p>No se encontraron datos de producción para los turnos seleccionados en esta fecha.</p>
            </div>
          )}

          {reportData && !loading && reportData.sections.map(section => {
            const sectionHasTecnotok = section.machines.some(m => ['machine_1', 'machine_2', 'machine_3', 'machine_4'].includes(m.machineId));
            const sectionHasGranel = section.machines.some(m => ['machine_5', 'machine_6'].includes(m.machineId));

            return (
          <div key={section.shift} id={`report-capture-section-${section.shift}`} className="space-y-3 p-2 bg-slate-50 dark:bg-slate-900 rounded-xl">
            {/* Section header */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${section.shift === 'day'
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                }`}>
                {section.shift === 'day' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                Turno {shiftLabel(section.shift)}
              </div>
              <Badge variant="outline" className="text-xs font-normal">
                📅 {format(new Date(date + 'T12:00:00'), "dd 'de' MMMM yyyy", { locale: es })}
              </Badge>
              {section.lote && section.lote !== '—' && (
                <Badge variant="outline" className="text-xs font-normal bg-slate-100 text-slate-700 border-slate-200">
                  🏷️ Lote {section.lote}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs font-normal bg-green-50 text-green-700 border-green-200">
                📊 {section.machines.length} máquinas
              </Badge>
              {/* Operadores en el encabezado de sección */}
              <>
                {section.supervisor !== '—' && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="text-indigo-500">👷</span> {section.supervisor} <span className="text-slate-400 font-normal">(Supervisor)</span>
                  </span>
                )}
                {sectionHasTecnotok && section.operador !== '—' && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="text-blue-500">👤</span> {section.operador} <span className="text-slate-400 font-normal">(Op. Máquinas)</span>
                  </span>
                )}
                {sectionHasGranel && section.operadorGranel !== '—' && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="text-amber-500">👤</span> {section.operadorGranel} <span className="text-slate-400 font-normal">(Op. granel)</span>
                  </span>
                )}
              </>
            </div>

            {/* Machine cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {section.machines.map(m => {
                if (m.count === 0 && m.countBundleWeight === 0) return null;
                
                return (
                <Card key={m.machineId} className="overflow-hidden border shadow-sm">
                  <div
                    className={`flex items-center justify-between px-4 py-2 ${!m.productoColor ? (section.shift === 'day' ? 'bg-blue-600' : 'bg-indigo-700') : ''
                      }`}
                    style={m.productoColor ? { backgroundColor: m.productoColor, color: m.textColor } : {}}
                  >
                    <span className="font-bold text-sm" style={{ color: m.productoColor ? m.textColor : 'white' }}>{m.label}</span>
                    <Badge
                      className="text-xs border-0"
                      style={{
                        backgroundColor: m.productoColor ? (m.textColor === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : 'rgba(255,255,255,0.2)',
                        color: m.productoColor ? m.textColor : 'white'
                      }}
                    >
                      {m.weightLabel}
                    </Badge>
                  </div>
                  <CardContent className="p-4 space-y-4">
                    {m.presentations.map((p, idx) => (
                      <div key={idx} className="space-y-2 border-b last:border-0 pb-3 last:pb-0">
                        {p.producto !== '—' && (
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <div className="flex items-center gap-0.5">
                              <span className="h-2 w-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: p.productoColor || '#ccc' }}></span>
                              <span className="h-2 w-2 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: p.productoColor || '#ccc' }}></span>
                            </div>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{p.producto}</span>
                          </div>
                        )}
                        
                        {(p.count === 0 && p.countBundleWeight === 0) ? (
                           <div className="text-xs text-slate-400 italic py-1">
                             Sin registros
                           </div>
                        ) : (
                          <>
                            {p.count > 0 && (
                              <>
                                <div className="flex flex-col items-center bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
                                  <span className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Peso Promedio {(m.weightLabel === 'P/Fardo' || p.isFardoProduct) ? 'Fardos' : 'Sacos'}</span>
                                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                                    {p.avg} <span className="text-sm font-normal">kg</span>
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                  <div className="flex flex-col">
                                    <span className="text-xs text-slate-400">Mínimo</span>
                                    <span className="text-sm font-semibold text-emerald-600">{p.min} kg</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-slate-400">Máximo</span>
                                    <span className="text-sm font-semibold text-rose-600">{p.max} kg</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-slate-400">Registros</span>
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{p.count}</span>
                                  </div>
                                </div>
                              </>
                            )}
                            {p.countBundleWeight > 0 && (
                              <>
                                <div className="mt-2 flex flex-col items-center bg-indigo-50 dark:bg-indigo-950/40 rounded-lg p-2 border border-indigo-100 dark:border-indigo-900/50">
                                  <span className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Peso Funda Promedio</span>
                                  <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                                    {p.avgBundleWeight} <span className="text-xs font-normal">g</span>
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center mt-1">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400">Mínimo</span>
                                    <span className="text-xs font-semibold text-emerald-600">{p.minBundleWeight} g</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400">Máximo</span>
                                    <span className="text-xs font-semibold text-rose-600">{p.maxBundleWeight} g</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400">Registros</span>
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{p.countBundleWeight}</span>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
            </div>

            {/* Quality Table */}
            {section.qualityRows.length > 0 && (
              <div className="mt-4 border rounded-lg overflow-x-auto bg-card shadow-sm text-[10px]">
                <table className="w-full border-collapse text-center">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="border p-1 bg-slate-100 dark:bg-slate-800 whitespace-nowrap align-middle">Hora</th>
                      <th colSpan={9} className="border p-1 bg-green-200/50 dark:bg-green-900/30 font-semibold align-middle">INGRESO DE PRODUCTO GRASSHOPPER</th>
                      <th colSpan={6} className="border p-1 bg-blue-200/50 dark:bg-blue-900/30 font-semibold align-middle">SALIDA DE PRODUCTO TERMINADO</th>
                      <th rowSpan={2} className="border p-1 bg-purple-200/50 dark:bg-purple-900/30 whitespace-nowrap align-middle">NOVEDADES EMPAQUE</th>
                    </tr>
                    <tr>
                      {/* Grasshopper columns */}
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">Masa</th>
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">Flujo</th>
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">NS-FA</th>
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">NS% 1</th>
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">NS% 2</th>
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">Color</th>
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">Hum</th>
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">Turb</th>
                      <th className="border p-1 bg-green-100/50 dark:bg-green-900/20 align-middle">CV</th>
                      {/* Familiar columns */}
                      <th className="border p-1 bg-blue-100/50 dark:bg-blue-900/20 align-middle" colSpan={3}>Familiar<br /><span className="font-normal text-[8px] flex w-full justify-around mt-0.5"><span>Color</span><span>Hum</span><span>Turb</span></span></th>
                      {/* Granel columns */}
                      <th className="border p-1 bg-cyan-100/50 dark:bg-cyan-900/20 align-middle" colSpan={3}>Granel 50 KG<br /><span className="font-normal text-[8px] flex w-full justify-around mt-0.5"><span>Color</span><span>Hum</span><span>Turb</span></span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.qualityRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-muted/50">
                        <td className="border p-1 font-medium whitespace-nowrap align-middle">{row.time}</td>
                        <td className="border p-1 align-middle">{row.masa || '-'}</td>
                        <td className="border p-1 align-middle">{row.flujo || '-'}</td>
                        <td className="border p-1 align-middle">{row.ns_fam ? `${row.ns_fam.replace(/%/g, '')}%` : '-'}</td>
                        <td className="border p-1 align-middle">{row.ns_1 ? `${row.ns_1.replace(/%/g, '')}%` : '-'}</td>
                        <td className="border p-1 align-middle">{row.ns_2 ? `${row.ns_2.replace(/%/g, '')}%` : '-'}</td>
                        <td className={cn("border p-1 align-middle", getColorForValue('grasshopper_color', row.in_color))}>{row.in_color || '-'}</td>
                        <td className={cn("border p-1 align-middle", getColorForValue('grasshopper_humedad', row.in_hum))}>{row.in_hum || '-'}</td>
                        <td className={cn("border p-1 align-middle", getColorForValue('grasshopper_turbiedad', row.in_turb))}>{row.in_turb || '-'}</td>
                        <td className="border p-1 align-middle">{row.in_cv || '-'}</td>
                        <td className={cn("border p-1 border-l-2 align-middle", getColorForValue('familiar_color', row.out_fam_color))}>{row.out_fam_color || '-'}</td>
                        <td className={cn("border p-1 align-middle", getColorForValue('familiar_humedad', row.out_fam_hum))}>{row.out_fam_hum || '-'}</td>
                        <td className={cn("border p-1 align-middle", getColorForValue('familiar_turbiedad', row.out_fam_turb))}>{row.out_fam_turb || '-'}</td>
                        <td className={cn("border p-1 border-l-2 align-middle", getColorForValue('granel_color', row.out_gra_color))}>{row.out_gra_color || '-'}</td>
                        <td className={cn("border p-1 align-middle", getColorForValue('granel_humedad', row.out_gra_hum))}>{row.out_gra_hum || '-'}</td>
                        <td className={cn("border p-1 align-middle", getColorForValue('granel_turbiedad', row.out_gra_turb))}>{row.out_gra_turb || '-'}</td>
                        <td className="border p-1 border-l-2 text-left min-w-[250px] whitespace-normal align-middle" style={{ wordBreak: 'break-word' }}>{row.empaque_obs || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          );
        })}
        </div>

        {reportData && reportData.sections.length > 0 && (
          <div className="text-xs text-slate-400 text-center pb-2">
            Al pulsar <strong>Enviar Reporte</strong> se descargará el PDF y se abrirá tu cliente de correo con el mensaje pre-escrito.
          </div>
        )}
      </main>
    </div>
  );
}

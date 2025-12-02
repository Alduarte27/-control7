

'use client';

import React from 'react';
import Link from 'next/link';
import { Package, ChevronLeft, PlusCircle, PackageCheck, Inbox, Play, Camera, AlertTriangle, Weight, HardHat, Trash2, Settings, X, Calendar as CalendarIcon, Zap, Edit, Search, Info, FileDown, Separator as SeparatorIcon, Smartphone, QrCode, CheckCircle2, Moon, Sun, ChevronDown, BarChart, Clock, Map, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, MaterialType, MaterialStatus, ProductDefinition, CategoryDefinition, Supplier } from '@/lib/types';
import { materialTypeLabels } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, writeBatch, query, where, getDocs, deleteDoc, onSnapshot, setDoc, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday as isTodayFns, startOfToday, endOfToday, set, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import ScannerModal from './scanner-modal';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Progress } from './ui/progress';
import { QRCodeSVG } from 'qrcode.react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DateRange } from 'react-day-picker';


function ConfigModal({ 
    isOpen, 
    onClose, 
    suppliers,
    onConfigSave,
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    suppliers: Supplier[];
    onConfigSave: (type: 'supplier', data: any, action: 'add' | 'delete') => Promise<void>;
}) {
    const [newSupplierName, setNewSupplierName] = React.useState('');
    const { toast } = useToast();

    const handleAdd = async () => {
        const name = newSupplierName.trim();
        if (!name) {
            toast({ title: 'Error', description: 'El nombre del proveedor es obligatorio.', variant: 'destructive'});
            return;
        }
        await onConfigSave('supplier', { name }, 'add');
        setNewSupplierName('');
    }

    const handleDelete = async (id: string) => {
        await onConfigSave('supplier', { id }, 'delete');
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Configurar Catálogos de Melaza</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <h3 className="font-semibold text-lg">Proveedores de Sacos para Melaza</h3>
                      <div className="flex items-end gap-2">
                          <div className="flex-grow space-y-1.5">
                              <Label htmlFor="new-supplier-name">Nombre del Proveedor</Label>
                              <Input id="new-supplier-name" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} />
                          </div>
                          <Button onClick={handleAdd}><PlusCircle className="h-4 w-4" /></Button>
                      </div>
                      <Separator />
                      <ul className="space-y-2 max-h-60 overflow-y-auto">
                          {suppliers.map(sup => (
                              <li key={sup.id} className="flex items-center justify-between text-sm p-1 hover:bg-muted/50 rounded-md">
                                  <span>{sup.name}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(sup.id)}>
                                      <X className="h-4 w-4 text-destructive" />
                                  </Button>
                              </li>
                          ))}
                      </ul>
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cerrar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function EditMaterialDialog({
  material,
  onClose,
  onSave,
}: {
  material: PackagingMaterial;
  onClose: () => void;
  onSave: (id: string, updates: Partial<PackagingMaterial>) => void;
}) {
    const [editedMaterial, setEditedMaterial] = React.useState<Partial<PackagingMaterial>>({});

    React.useEffect(() => {
        setEditedMaterial({
            code: material.code,
            presentation: material.presentation,
            lote: material.lote,
            quantity: material.quantity,
            totalWeight: material.totalWeight,
            unitWeight: material.unitWeight,
            netWeight: material.netWeight,
            grossWeight: material.grossWeight,
            warehouseLocation: material.warehouseLocation,
        });
    }, [material]);


    const handleChange = (field: keyof PackagingMaterial, value: any) => {
        setEditedMaterial((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveChanges = () => {
        onSave(material.id, editedMaterial);
        onClose();
    };

  const isSacosType = material.type === 'sacos_melaza';
  const isPlasticsacks = material.supplier?.toUpperCase().startsWith('PLASTICSACKS');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Material</DialogTitle>
          <DialogDescription className="break-all">
            Código: <span className="font-mono">{material.code}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-code">Código</Label>
            <Input id="edit-code" value={editedMaterial.code || ''} onChange={e => handleChange('code', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-presentation">Presentación</Label>
            <Input id="edit-presentation" value={editedMaterial.presentation || ''} onChange={e => handleChange('presentation', e.target.value)} />
          </div>

          {isSacosType ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-quantity">Cantidad</Label>
                <Input id="edit-quantity" type="number" value={editedMaterial.quantity || ''} onChange={e => handleChange('quantity', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-unit-weight">Peso/Und (g)</Label>
                <Input id="edit-unit-weight" type="number" value={editedMaterial.unitWeight || ''} onChange={e => handleChange('unitWeight', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-total-weight">Peso Neto (kg)</Label>
                <Input id="edit-total-weight" type="number" value={editedMaterial.totalWeight || ''} onChange={e => handleChange('totalWeight', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-gross-weight">Peso Bruto (kg)</Label>
                <Input id="edit-gross-weight" type="number" value={editedMaterial.grossWeight || ''} onChange={e => handleChange('grossWeight', Number(e.target.value))} />
              </div>
            </div>
          ) : (
             // Fallback for other types, though this view is for sacos_melaza
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-net-weight">Peso Neto (kg)</Label>
                <Input id="edit-net-weight" type="number" value={editedMaterial.netWeight || ''} onChange={e => handleChange('netWeight', Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-gross-weight">Peso Bruto (kg)</Label>
                <Input id="edit-gross-weight" type="number" value={editedMaterial.grossWeight || ''} onChange={e => handleChange('grossWeight', Number(e.target.value))} />
              </div>
            </div>
          )}
           <div className="space-y-1.5">
              <Label htmlFor="edit-location">Ubicación en Bodega</Label>
              <Input id="edit-location" value={editedMaterial.warehouseLocation || ''} onChange={e => handleChange('warehouseLocation', e.target.value)} />
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
          <Button onClick={handleSaveChanges}>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function AdvancedEditDialog({
  material,
  onClose,
  onSave,
}: {
  material: PackagingMaterial;
  onClose: () => void;
  onSave: (id: string, updates: Partial<PackagingMaterial>) => void;
}) {
  const [editedMaterial, setEditedMaterial] = React.useState<Partial<PackagingMaterial>>(material);

  const [plasticWeightUnit, setPlasticWeightUnit] = React.useState<'kg' | 'g'>('kg');
  const [plasticWeightDisplay, setPlasticWeightDisplay] = React.useState('');

  const isSacosType = material.type === 'sacos_melaza';

  React.useEffect(() => {
    setEditedMaterial(material);
    const initialPlasticWeight = material.plasticWeight || 0;
    if (initialPlasticWeight > 0 && initialPlasticWeight < 1) {
      setPlasticWeightUnit('g');
      setPlasticWeightDisplay((initialPlasticWeight * 1000).toString());
    } else {
      setPlasticWeightUnit('kg');
      setPlasticWeightDisplay(initialPlasticWeight.toString());
    }
  }, [material]);
  
  const updateCalculatedFields = (mat: Partial<PackagingMaterial>): Partial<PackagingMaterial> => {
    const newMat = { ...mat };
    const grossWeight = Number(newMat.grossWeight) || 0;
    const netWeight = Number(newMat.totalWeight) || 0;
    newMat.labelTare = grossWeight > 0 && netWeight > 0 ? grossWeight - netWeight : 0;
    
    const plastic = Number(newMat.plasticWeight) || 0;
    const actualTare = plastic;
    newMat.tareWeight = actualTare;

    const actualGross = Number(newMat.actualWeight) || 0;
    if (actualGross > 0) {
        newMat.actualNetWeight = actualGross - actualTare;
    }
    return newMat;
  };

  const handleChange = (field: keyof PackagingMaterial, value: any) => {
    setEditedMaterial((prev) => updateCalculatedFields({ ...prev, [field]: value }));
  };

  const handleWeightInputChange = (displayValue: string) => {
    setPlasticWeightDisplay(displayValue);
    const val = parseFloat(displayValue);
    const kgValue = plasticWeightUnit === 'g' ? (val / 1000) : val;
    handleChange('plasticWeight', isNaN(kgValue) ? 0 : kgValue);
  };

  const handleUnitChange = (newUnit: 'kg' | 'g') => {
    if (plasticWeightUnit !== newUnit) {
      const currentVal = parseFloat(plasticWeightDisplay);
      if (!isNaN(currentVal)) {
        const newDisplayVal = newUnit === 'g' ? currentVal * 1000 : currentVal / 1000;
        setPlasticWeightDisplay(newDisplayVal.toString());
      }
      setPlasticWeightUnit(newUnit);
    }
  };
  
  const handleTimestampChange = (field: keyof PackagingMaterial, value: string) => {
    const timestamp = new Date(value).getTime();
    if (!isNaN(timestamp)) {
      handleChange(field, timestamp);
    }
  };

  const formatTimestampForInput = (timestamp?: number) => {
    if (!timestamp) return "";
    return format(new Date(timestamp), "yyyy-MM-dd'T'HH:mm");
  };

  const handleSaveChanges = () => {
    const finalUpdates = { ...editedMaterial };
    onSave(material.id, finalUpdates);
    onClose();
  };
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Edición Avanzada de Material</DialogTitle>
                <DialogDescription className="break-all">Editando: <span className="font-mono font-bold">{material.code}</span></DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5 lg:col-span-2">
                        <Label htmlFor="adv-presentation">Presentación</Label>
                        <Input id="adv-presentation" value={editedMaterial.presentation || ''} onChange={(e) => handleChange('presentation', e.target.value)} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                        <Label htmlFor="adv-code">Código</Label>
                        <Input id="adv-code" value={editedMaterial.code || ''} onChange={(e) => handleChange('code', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-provider-date">Fecha Proveedor</Label>
                        <Input id="adv-provider-date" type="date" value={editedMaterial.providerDate || ''} onChange={(e) => handleChange('providerDate', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-lote">Lote</Label>
                        <Input id="adv-lote" value={editedMaterial.lote || ''} onChange={(e) => handleChange('lote', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-sacos-quantity">Cantidad (un)</Label>
                        <Input id="adv-sacos-quantity" type="number" value={editedMaterial.quantity || ''} onChange={(e) => handleChange('quantity', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-sacos-unit-weight">Peso/Und (g)</Label>
                        <Input id="adv-sacos-unit-weight" type="number" value={editedMaterial.unitWeight || ''} onChange={(e) => handleChange('unitWeight', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-warehouse-location">Ubicación</Label>
                        <Input id="adv-warehouse-location" value={editedMaterial.warehouseLocation || ''} onChange={(e) => handleChange('warehouseLocation', e.target.value)} />
                    </div>
                </div>

                <Separator />
                <h4 className="font-semibold text-sm text-muted-foreground">Datos de Peso</h4>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border rounded-md">
                    <h5 className="lg:col-span-3 font-medium">Pesos de Etiqueta</h5>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-gross-weight">P. Bruto (Etiqueta)</Label>
                        <Input id="adv-gross-weight" type="number" value={editedMaterial.grossWeight || ''} onChange={(e) => handleChange('grossWeight', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-net-weight">P. Neto (Etiqueta)</Label>
                        <Input id="adv-net-weight" type="number" value={editedMaterial.totalWeight || ''} onChange={(e) => handleChange('totalWeight', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-label-tare">Tara (Etiqueta)</Label>
                        <Input id="adv-label-tare" type="number" value={editedMaterial.labelTare?.toFixed(3) || '0.000'} disabled className="font-mono" />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border rounded-md">
                    <h5 className="lg:col-span-3 font-medium">Pesos Reales (Balanza)</h5>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-actual-weight">P. Bruto (Balanza)</Label>
                        <Input id="adv-actual-weight" type="number" value={editedMaterial.actualWeight || ''} onChange={(e) => handleChange('actualWeight', Number(e.target.value))} />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="adv-plastic-weight">P. Desecho</Label>
                         <div className="flex items-center">
                            <Input id="adv-plastic-weight" type="number" value={plasticWeightDisplay} onChange={(e) => handleWeightInputChange(e.target.value)} />
                             <Select value={plasticWeightUnit} onValueChange={(v) => handleUnitChange(v as 'kg' | 'g')}>
                                <SelectTrigger className="w-[80px] ml-2"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="g">g</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="adv-tare-weight">Tara Real (Total)</Label>
                        <Input id="adv-tare-weight" type="number" value={editedMaterial.tareWeight?.toFixed(3) || 0} disabled />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="adv-actual-net-weight">P. Neto Real</Label>
                        <Input id="adv-actual-net-weight" type="number" value={editedMaterial.actualNetWeight?.toFixed(3) || '0.000'} disabled className="font-bold text-green-600"/>
                    </div>
                </div>

                 <Separator />
                <h4 className="font-semibold text-sm text-muted-foreground">Asignación y Fechas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-assigned-machine">Máquina Asignada</Label>
                         <Input id="adv-assigned-machine" value={editedMaterial.assignedMachine || ''} onChange={(e) => handleChange('assignedMachine', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-received-at">Fecha Recibido</Label>
                        <Input id="adv-received-at" type="datetime-local" value={formatTimestampForInput(editedMaterial.receivedAt)} onChange={(e) => handleTimestampChange('receivedAt', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-inuse-at">Fecha Puesto en Uso</Label>
                        <Input id="adv-inuse-at" type="datetime-local" value={formatTimestampForInput(editedMaterial.inUseAt)} onChange={(e) => handleTimestampChange('inUseAt', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-consumed-at">Fecha Consumido</Label>
                        <Input id="adv-consumed-at" type="datetime-local" value={formatTimestampForInput(editedMaterial.consumedAt)} onChange={(e) => handleTimestampChange('consumedAt', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-tareweighted-at">Fecha Pesaje Tara</Label>
                        <Input id="adv-tareweighted-at" type="datetime-local" value={formatTimestampForInput(editedMaterial.tareWeightedAt)} onChange={(e) => handleTimestampChange('tareWeightedAt', e.target.value)} />
                    </div>
                </div>
            </div>
             <DialogFooter>
                 <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                 <Button onClick={handleSaveChanges}>Guardar Cambios Avanzados</Button>
             </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}


function TraceabilityDialog({ material, onClose }: { material: PackagingMaterial; onClose: () => void }) {
    const formatTimestamp = (ts: number | undefined) => {
        if (!ts) return 'N/A';
        try {
            return format(new Date(ts), "dd/MM/yyyy HH:mm", { locale: es });
        } catch (e) {
            return 'Fecha inválida';
        }
    };

    const timeline = [
        {
            status: 'Recibido',
            timestamp: material.receivedAt,
            icon: Inbox,
            details: `Registrado en el sistema.`
        },
        {
            status: 'En Uso',
            timestamp: material.inUseAt,
            icon: Weight,
            details: `Pesado y puesto en uso. Peso Bruto (Balanza): ${material.actualWeight || 'N/A'} kg. Asignado a: ${material.assignedMachine || 'N/A'}.`
        },
         {
            status: 'Por Pesar Tara',
            timestamp: material.consumedAt,
            icon: AlertTriangle,
            details: `Material marcado como consumido, pendiente de pesar los desechos.`
        },
        {
            status: 'Consumido y Verificado',
            timestamp: material.tareWeightedAt,
            icon: PackageCheck,
            details: `Tara pesada. Peso Neto Real: ${material.actualNetWeight?.toFixed(2) || 'N_A'} kg.`
        }
    ].filter(item => item.timestamp);

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Trazabilidad del Material</DialogTitle>
                    <DialogDescription className="break-all">
                        Historial completo para el código: <span className="font-mono font-bold">{material.code}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ul className="space-y-6">
                        {timeline.map((item, index) => (
                            <li key={item.status} className="flex items-start gap-4">
                                <div className={cn("flex flex-col items-center", index === timeline.length - 1 && "flex-grow-0")}>
                                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    {index < timeline.length - 1 && <div className="w-px h-12 bg-border mt-1"></div>}
                                </div>
                                <div>
                                    <h4 className="font-semibold">{item.status}</h4>
                                    <p className="text-sm text-muted-foreground">{formatTimestamp(item.timestamp)}</p>
                                    <p className="text-sm mt-1">{item.details}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button>Cerrar</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TareWeightDialog({
    material,
    onClose,
    onConfirm,
}: {
    material: PackagingMaterial;
    onClose: () => void;
    onConfirm: (tareData: { plasticWeight: number; coreWeight: number }) => void;
}) {
    const [plasticWeightDisplay, setPlasticWeightDisplay] = React.useState('');
    const [plasticWeightUnit, setPlasticWeightUnit] = React.useState<'kg' | 'g'>('kg');

    const plasticWeightKg = plasticWeightUnit === 'g' ? (parseFloat(plasticWeightDisplay) || 0) / 1000 : (parseFloat(plasticWeightDisplay) || 0);
    
    const totalTare = plasticWeightKg;
    const actualNetWeight = (material.actualWeight || material.grossWeight || 0) - totalTare;

    const handleConfirm = () => {
        onConfirm({
            plasticWeight: plasticWeightKg,
            coreWeight: 0, // No core weight for molasses sacks
        });
    };
    
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pesar Tara del Saco de Melaza</DialogTitle>
                    <DialogDescription>
                        Registra el peso del saco vacío para calcular el peso neto real y el rendimiento.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="plastic-weight">Peso del saco vacío (desecho)</Label>
                            <div className="flex items-center">
                                <Input
                                    id="plastic-weight"
                                    type="number"
                                    value={plasticWeightDisplay}
                                    onChange={(e) => setPlasticWeightDisplay(e.target.value)}
                                    placeholder="0.00"
                                />
                                <Select value={plasticWeightUnit} onValueChange={(v) => setPlasticWeightUnit(v as 'kg' | 'g')}>
                                    <SelectTrigger className="w-[80px] ml-2"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="kg">kg</SelectItem>
                                        <SelectItem value="g">g</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <Separator />
                     <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Peso Bruto (Balanza):</span>
                            <span className="font-medium">{(material.actualWeight || material.grossWeight)?.toFixed(2) || '0.00'} kg</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Peso Total de Tara:</span>
                            <span className="font-medium text-red-600">-{totalTare.toFixed(3)} kg</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Peso Neto Real:</span>
                            <span className="text-green-600">{actualNetWeight.toFixed(3)} kg</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleConfirm} disabled={!plasticWeightDisplay}>Confirmar y Guardar Tara</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function MaterialActionDialog({
  material,
  action,
  onClose,
  onConfirm,
}: {
  material: PackagingMaterial;
  action: 'weigh' | 'consume';
  onClose: () => void;
  onConfirm: (data: { actualWeight?: number, assignedMachine?: string }) => void;
}) {
    const [actualWeight, setActualWeight] = React.useState('');
    const [assignedMachine, setAssignedMachine] = React.useState('');

    if (action === 'consume') {
        return (
             <AlertDialog open={true} onOpenChange={onClose}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Confirmar Consumo?</AlertDialogTitle>
                        <AlertDialogDescriptionComponent>
                            Estás a punto de marcar el material con código <span className="font-mono font-bold break-all">{material.code}</span> como consumido.
                             <span className="block mt-2 font-semibold text-amber-700">A continuación, deberás registrar el peso de la tara.</span>
                        </AlertDialogDescriptionComponent>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onConfirm({})}>Sí, Marcar como Consumido</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pesar y Poner en Uso</DialogTitle>
                    <DialogDescription className="break-all">
                        Registra el peso real del material con código <span className="font-mono font-bold">{material.code}</span> y asígnalo a una máquina.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="space-y-1.5">
                        <Label htmlFor="actual-weight">Peso Bruto (Balanza)</Label>
                        <Input
                            id="actual-weight"
                            type="number"
                            value={actualWeight}
                            onChange={(e) => setActualWeight(e.target.value)}
                            placeholder="Introduce el peso de la balanza"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="assigned-machine">Asignar a Máquina/Área</Label>
                        <Input
                            id="assigned-machine"
                            value={assignedMachine}
                            onChange={(e) => setAssignedMachine(e.target.value)}
                            placeholder="Ej: Área de Melaza 1"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={() => onConfirm({ actualWeight: parseFloat(actualWeight), assignedMachine })} disabled={!actualWeight || !assignedMachine}>Confirmar y Poner en Uso</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function MaterialCard({ 
    material, 
    onActionClick, 
    onSelectionChange, 
    isSelected,
    onTraceClick,
    onDelete,
    onAdvancedEdit,
}: { 
    material: PackagingMaterial, 
    onActionClick: (material: PackagingMaterial, action: 'weigh' | 'consume' | 'weigh_tare') => void, 
    onSelectionChange: (id: string, checked: boolean) => void, 
    isSelected: boolean,
    onTraceClick: (material: PackagingMaterial) => void,
    onDelete: (material: PackagingMaterial) => void,
    onAdvancedEdit: (material: PackagingMaterial) => void,
}) {
    const statusConfig: { [key in MaterialStatus]: { label: string; color: string; icon: React.ElementType } } = {
        recibido: { label: 'Recibido', color: 'bg-blue-500', icon: Inbox },
        en_uso: { label: 'En Uso', color: 'bg-yellow-500', icon: Play },
        consumido: { label: 'Consumido', color: 'bg-green-500', icon: PackageCheck },
        por_pesar_tara: { label: 'Por Pesar Tara', color: 'bg-orange-500', icon: AlertTriangle },
    };
    
    const [formattedInfo, setFormattedInfo] = React.useState<{ 
        received: string | null; 
        inUse: string | null; 
        consumed: string | null; 
        receivedShift: 'Día' | 'Noche' | null,
        inUseShift: 'Día' | 'Noche' | null,
        consumedShift: 'Día' | 'Noche' | null,
    }>({
        received: null,
        inUse: null,
        consumed: null,
        receivedShift: null,
        inUseShift: null,
        consumedShift: null,
    });
    

    React.useEffect(() => {
        const getShift = (timestamp: number | undefined): 'Día' | 'Noche' | null => {
            if (!timestamp) return null;
            const hour = new Date(timestamp).getHours();
            return hour >= 7 && hour < 19 ? 'Día' : 'Noche';
        };

        const formatDate = (timestamp: number | undefined) => {
            if (!timestamp) return null;
            try {
                return format(new Date(timestamp), "dd/MM/yyyy HH:mm", { locale: es });
            } catch (e) {
                return 'Fecha inválida';
            }
        };
        
        setFormattedInfo({
            received: formatDate(material.receivedAt),
            inUse: formatDate(material.inUseAt),
            consumed: formatDate(material.consumedAt),
            receivedShift: getShift(material.receivedAt),
            inUseShift: getShift(material.inUseAt),
            consumedShift: getShift(material.consumedAt),
        });
    }, [material]);

    const getShortCode = (fullCode: string): string => {
        if (!fullCode) return 'N/A';
        if (fullCode.includes('|')) return fullCode.split('|')[0] || 'N/A';
        if (fullCode.length > 4) {
            const lastPart = fullCode.slice(-4);
            if (!isNaN(parseInt(lastPart, 10))) return lastPart;
        }
        return fullCode.slice(-6);
    };

    const currentStatus = statusConfig[material.status];
    const isSacosType = material.type === 'sacos_melaza';

    const getPerformance = () => {
        if (material.status !== 'consumido' || material.actualNetWeight === undefined) return null;
        const referenceWeight = material.totalWeight || 0;
        if(referenceWeight === 0) return null;

        const performance = (material.actualNetWeight / referenceWeight) * 100;
        const color = performance >= 98 ? 'text-green-600' : 'text-yellow-600';
        return (
            <div className="space-y-1">
                <p className="text-muted-foreground">Rendimiento</p>
                <p className={cn("font-semibold text-lg", color)}>{performance.toFixed(1)}%</p>
                <Progress value={performance} indicatorClassName={performance >= 98 ? "bg-green-500" : "bg-yellow-500"} />
            </div>
        )
    }
    
    const getDiscrepancy = () => {
        if (material.status === 'por_pesar_tara') {
            return (
                <div className="space-y-1">
                    <p className="text-muted-foreground">Discrepancia</p>
                    <p className="font-semibold text-lg text-amber-600">Pendiente de pesar</p>
                </div>
            );
        }
    
        if (material.status !== 'consumido' || material.actualNetWeight === undefined) return null;
        const referenceNetWeight = material.totalWeight || 0;
        if (referenceNetWeight === 0) return null;
    
        const discrepancy = material.actualNetWeight - referenceNetWeight;
        const color = discrepancy >= 0 ? 'text-green-600' : 'text-red-600';
        
        return (
            <div className="space-y-1">
                <p className="text-muted-foreground">Discrepancia</p>
                <p className={cn("font-semibold text-lg", color)}>{discrepancy.toFixed(2)} kg</p>
            </div>
        );
    };

    return (
        <Card className={cn("flex flex-col relative", isSelected && "ring-2 ring-primary")}>
             <CardHeader>
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                     <div className={cn("flex items-center gap-1 transition-opacity", isSelected ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => onAdvancedEdit(material)}>
                            <Edit className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" className="h-6 w-6">
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmar Eliminación?</AlertDialogTitle>
                                    <AlertDialogDescriptionComponent className="break-all">
                                        Estás a punto de eliminar permanentemente el material <span className="font-mono font-bold">{material.code}</span>. Esta acción no se puede deshacer.
                                    </AlertDialogDescriptionComponent>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(material)}>Sí, Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                     <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelectionChange(material.id, !!checked)}
                        aria-label={`Seleccionar material ${material.code}`}
                    />
                </div>
                 <div className="flex flex-col">
                    <div>
                        <CardDescription>{materialTypeLabels[material.type]} - {material.presentation || ''}</CardDescription>
                        <CardTitle className="text-4xl font-bold text-primary hover:underline cursor-pointer" onClick={() => onTraceClick(material)}>
                            #{getShortCode(material.code)}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-mono break-all">{material.code}</p>
                    </div>
                     <div className="flex justify-between items-center mt-2">
                        <div className={cn("flex items-center gap-2 text-xs font-bold text-white px-2 py-1 rounded-full self-start", currentStatus.color)}>
                            <currentStatus.icon className="h-3 w-3" />
                            <span>{currentStatus.label}</span>
                        </div>
                        {material.warehouseLocation && (
                             <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{material.warehouseLocation}</span>
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 space-y-0.5">
                        {material.supplier && <p>Proveedor: {material.supplier}</p>}
                        {material.providerDate && <p>Fecha Prov: {material.providerDate}</p>}
                        {material.lote && <p>Lote: {material.lote}</p>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2 text-center">
                         <div className="space-y-1">
                            <p className="text-muted-foreground">P. Bruto (Etiqueta)</p>
                            <p className="font-semibold">{material.grossWeight ? `${material.grossWeight} kg` : 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">P. Neto (Etiqueta)</p>
                            <p className="font-semibold">{material.netWeight} kg</p>
                        </div>
                         <div className="space-y-1">
                            <p className="text-muted-foreground">Tara (Etiqueta)</p>
                            <p className="font-semibold">
                                {material.labelTare !== undefined && material.labelTare !== null ? `${material.labelTare.toFixed(2)} kg` : 'N/A'}
                            </p>
                        </div>
                    </div>
                    <Separator />
                     <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="space-y-1">
                            <p className="text-muted-foreground">P. Bruto (Balanza)</p>
                            <p className="font-semibold text-primary">{material.actualWeight ? `${material.actualWeight.toFixed(2)} kg` : 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">P. Neto Real</p>
                            <p className={cn("font-semibold", (material.actualNetWeight ?? 0) > (material.netWeight ?? 0) ? "text-green-600" : "text-red-600")}>{material.actualNetWeight ? `${material.actualNetWeight.toFixed(2)} kg` : 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-muted-foreground">Tara (Real)</p>
                            <p className="font-semibold text-destructive">{material.tareWeight?.toFixed(2) ?? 'N/A'} kg</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        {getPerformance()}
                        {getDiscrepancy()}
                    </div>
                </div>
                 <div className="text-xs text-muted-foreground space-y-1 border-t pt-2 min-h-[50px]">
                    {material.assignedMachine && (
                        <p className="flex items-center gap-2 font-medium text-primary">
                            <HardHat className="h-3 w-3" />
                            <span>Asignado a: {material.assignedMachine}</span>
                        </p>
                    )}
                    {formattedInfo.received && (
                        <div className="flex items-center gap-2">
                             {formattedInfo.receivedShift && <span className="flex items-center gap-1">
                                {formattedInfo.receivedShift === 'Día' ? <Sun className="h-3 w-3 text-amber-500" /> : <Moon className="h-3 w-3 text-blue-500" />}
                            </span>}
                             <p>Recibido: {formattedInfo.received}</p>
                        </div>
                    )}
                    {formattedInfo.inUse && (
                        <div className="flex items-center gap-2">
                             {formattedInfo.inUseShift && <span className="flex items-center gap-1">
                                {formattedInfo.inUseShift === 'Día' ? <Sun className="h-3 w-3 text-amber-500" /> : <Moon className="h-3 w-3 text-blue-500" />}
                            </span>}
                             <p>En Uso: {formattedInfo.inUse}</p>
                        </div>
                    )}
                    {formattedInfo.consumed && (
                         <div className="flex items-center gap-2">
                             {formattedInfo.consumedShift && <span className="flex items-center gap-1">
                                {formattedInfo.consumedShift === 'Día' ? <Sun className="h-3 w-3 text-amber-500" /> : <Moon className="h-3 w-3 text-blue-500" />}
                            </span>}
                             <p>Consumido: {formattedInfo.consumed}</p>
                        </div>
                    )}
                </div>
            </CardContent>
             {material.status !== 'consumido' && (
                <div className="p-4 pt-0">
                    {material.status === 'recibido' && (
                        <Button className="w-full h-auto whitespace-normal" onClick={() => onActionClick(material, 'weigh')}>
                            <Weight className="mr-2 h-4 w-4 flex-shrink-0" /> Pesar y Poner en Uso
                        </Button>
                    )}
                    {(material.status === 'en_uso') && (
                        <Button className="w-full h-auto whitespace-normal" variant="destructive" onClick={() => onActionClick(material, 'consume')}>
                            <PackageCheck className="mr-2 h-4 w-4 flex-shrink-0" /> Marcar como Consumido
                        </Button>
                    )}
                     {(material.status === 'por_pesar_tara') && (
                        <Button className="w-full h-auto whitespace-normal" variant="secondary" onClick={() => onActionClick(material, 'weigh_tare')}>
                            <Zap className="mr-2 h-4 w-4 flex-shrink-0" /> Pesar Tara
                        </Button>
                    )}
                </div>
            )}
        </Card>
    );
}

export default function MelazaClient({ 
    allProducts,
    allCategories,
    initialSuppliers,
}: { 
    allProducts: ProductDefinition[],
    allCategories: CategoryDefinition[],
    initialSuppliers: Supplier[],
}) {
    const [materials, setMaterials] = React.useState<PackagingMaterial[]>([]);
    const [suppliers, setSuppliers] = React.useState<Supplier[]>(initialSuppliers);
    const [newMaterialType, setNewMaterialType] = React.useState<MaterialType>('sacos_melaza');
    const [newMaterialCode, setNewMaterialCode] = React.useState('');
    const [newMaterialSupplier, setNewMaterialSupplier] = React.useState('');
    const [newMaterialProviderDate, setNewMaterialProviderDate] = React.useState<Date | undefined>();
    
    const [newMaterialPresentation, setNewMaterialPresentation] = React.useState('');
    const [newMaterialQuantity, setNewMaterialQuantity] = React.useState('');
    const [newMaterialUnitWeight, setNewMaterialUnitWeight] = React.useState('');
    const [newMaterialTotalWeight, setNewMaterialTotalWeight] = React.useState('');
    const [newMaterialGrossWeight, setNewMaterialGrossWeight] = React.useState('');
    const [newMaterialLocation, setNewMaterialLocation] = React.useState('');


    const [selectedMaterials, setSelectedMaterials] = React.useState<Set<string>>(new Set());
    const { toast } = useToast();
    const [isScannerOpen, setIsScannerOpen] = React.useState(false);
    const [configOpen, setConfigOpen] = React.useState(false);
    const [isAddMaterialOpen, setIsAddMaterialOpen] = React.useState(true);


    const [actionState, setActionState] = React.useState<{ material: PackagingMaterial; action: 'weigh' | 'consume' | 'weigh_tare' } | null>(null);
    
    const [editingMaterial, setEditingMaterial] = React.useState<PackagingMaterial | null>(null);
    const [advancedEditingMaterial, setAdvancedEditingMaterial] = React.useState<PackagingMaterial | null>(null);
    const [traceMaterial, setTraceMaterial] = React.useState<PackagingMaterial | null>(null);
    
    // Filter states
    const [supplierFilter, setSupplierFilter] = React.useState<string | 'all'>('all');
    const [machineFilter, setMachineFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<MaterialStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [shiftFilter, setShiftFilter] = React.useState<'all' | 'current' | 'day' | 'night'>('all');
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
    const [locationFilter, setLocationFilter] = React.useState<string | null>(null);
    
    const ADD_MATERIAL_COLLAPSIBLE_STATE_KEY = 'addMelazaSackCollapsibleState';

    React.useEffect(() => {
        setDateRange({ from: subDays(new Date(), 30), to: new Date() });

        const q = query(collection(db, "melazaSacks"), orderBy("receivedAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const materialsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial));
            setMaterials(materialsData);
        }, (error) => {
            console.error("Error fetching melaza sacks in real-time:", error);
            toast({
                title: "Error de Sincronización",
                description: "No se pudieron obtener los datos en tiempo real. Intenta recargar la página.",
                variant: "destructive"
            });
        });

        const savedState = localStorage.getItem(ADD_MATERIAL_COLLAPSIBLE_STATE_KEY);
        if (savedState !== null) {
            setIsAddMaterialOpen(JSON.parse(savedState));
        }

        return () => unsubscribe();
    }, [toast]);

    const handleCollapsibleChange = (open: boolean) => {
        setIsAddMaterialOpen(open);
        localStorage.setItem(ADD_MATERIAL_COLLAPSIBLE_STATE_KEY, JSON.stringify(open));
    };

    const handleScanSuccess = React.useCallback((code: string) => {
        setIsScannerOpen(false);
        setNewMaterialCode(code);
    }, []);
    
    const supplierName = suppliers.find(s => s.id === newMaterialSupplier)?.name || '';

    const handleConfigSave = async (type: 'supplier', data: any, action: 'add' | 'delete') => {
        if (type !== 'supplier') return;

        try {
            if (action === 'add') {
                const docRef = await addDoc(collection(db, 'melazaSuppliers'), data);
                setSuppliers(prev => [...prev, {id: docRef.id, ...data}].sort((a,b) => a.name.localeCompare(b.name)));
                toast({ title: "Proveedor añadido" });
            } else if (action === 'delete') {
                await deleteDoc(doc(db, 'melazaSuppliers', data.id));
                setSuppliers(prev => prev.filter(s => s.id !== data.id));
                toast({ title: "Proveedor eliminado" });
            }
        } catch (e) {
            console.error("Error saving supplier config", e);
            toast({ title: "Error", description: "No se pudo actualizar el catálogo de proveedores.", variant: 'destructive'});
        }
    };


    const handleAddMaterial = async () => {
        const fields = [
            { value: newMaterialSupplier, name: "Proveedor" },
            { value: newMaterialCode.trim(), name: "Código" },
            { value: newMaterialPresentation.trim(), name: "Presentación" },
            { value: newMaterialProviderDate, name: "Fecha de Proveedor" },
            { value: newMaterialQuantity, name: "Cantidad" },
            { value: newMaterialUnitWeight, name: "Peso/Und (g)"},
            { value: newMaterialTotalWeight, name: "Peso Neto Total (kg)" },
            { value: newMaterialGrossWeight, name: "Peso Bruto (kg)" },
            { value: newMaterialLocation, name: "Ubicación en Bodega"},
        ];
        
        for (const field of fields) {
            if (!field.value) {
                toast({ title: "Campo Obligatorio", description: `El campo "${field.name}" es obligatorio.`, variant: "destructive" });
                return;
            }
        }

        const trimmedCode = newMaterialCode.trim();
        
        try {
            const q = query(collection(db, 'melazaSacks'), where('code', '==', trimmedCode));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                toast({ title: "Error de Duplicado", description: "El código de material que intentas registrar ya existe en el sistema.", variant: "destructive" });
                return;
            }
            
            const grossWeightNum = parseFloat(newMaterialGrossWeight.replace(',', '.')) || 0;
            const netWeightNum = parseFloat(newMaterialTotalWeight.replace(',', '.')) || 0;
            const labelTare = grossWeightNum > 0 && netWeightNum > 0 ? grossWeightNum - netWeightNum : 0;

            const newMaterialData: Partial<Omit<PackagingMaterial, 'id'>> = {
                type: 'sacos_melaza',
                code: trimmedCode,
                supplier: supplierName,
                lote: '',
                presentation: newMaterialPresentation.trim(),
                status: 'recibido',
                receivedAt: Date.now(),
                grossWeight: grossWeightNum,
                labelTare: labelTare,
                quantity: parseInt(newMaterialQuantity, 10),
                unitWeight: parseFloat(newMaterialUnitWeight),
                totalWeight: netWeightNum, 
                netWeight: netWeightNum,
                providerDate: newMaterialProviderDate ? format(newMaterialProviderDate, 'yyyy-MM-dd') : undefined,
                warehouseLocation: newMaterialLocation,
            };

            await addDoc(collection(db, 'melazaSacks'), newMaterialData);
            
            setNewMaterialCode('');
            setNewMaterialPresentation('');
            setNewMaterialGrossWeight('');
            setNewMaterialQuantity('');
            setNewMaterialUnitWeight('');
            setNewMaterialTotalWeight('');
            setNewMaterialSupplier('');
            setNewMaterialProviderDate(undefined);
            setNewMaterialLocation('');
            
            toast({ title: 'Saco de Melaza Registrado', description: `Se ha registrado el material con código ${trimmedCode}.` });
        } catch (error) {
            console.error("Error adding material:", error);
            toast({ title: 'Error', description: 'No se pudo registrar el material.', variant: 'destructive' });
        }
    };
    

    const handleActionConfirm = async (data: { actualWeight?: number, assignedMachine?: string; plasticWeight?: number; coreWeight?: number; }) => {
        if (!actionState) return;

        const { material, action } = actionState;

        try {
            if (action === 'weigh') {
                const updateData: Partial<PackagingMaterial> = {
                    status: 'en_uso',
                    actualWeight: data.actualWeight,
                    assignedMachine: data.assignedMachine,
                    inUseAt: Date.now(),
                };
                if(!updateData.actualWeight && material.totalWeight) {
                    updateData.actualWeight = material.totalWeight;
                }
                await updateDoc(doc(db, 'melazaSacks', material.id), updateData as any);
                toast({ title: 'Saco en Uso', description: `El material ${material.code} ahora está en uso.` });
            } else if (action === 'consume') {
                 const finalStatus: MaterialStatus = 'por_pesar_tara';
                 const updateData = {
                    status: finalStatus,
                    consumedAt: Date.now(),
                };
                await updateDoc(doc(db, 'melazaSacks', material.id), updateData);
                toast({ title: 'Saco Consumido', description: `El material ${material.code} se ha marcado como consumido.` });
            } else if (action === 'weigh_tare' && data.plasticWeight !== undefined) {
                 const tareWeight = data.plasticWeight + (data.coreWeight || 0);
                 const referenceWeight = material.actualWeight || material.grossWeight || 0;
                 const actualNetWeight = referenceWeight - tareWeight;
                 const updateData: Partial<PackagingMaterial> = {
                    status: 'consumido',
                    tareWeight: tareWeight,
                    plasticWeight: data.plasticWeight,
                    coreWeight: data.coreWeight || 0,
                    actualNetWeight: actualNetWeight,
                    tareWeightedAt: Date.now(),
                };
                await updateDoc(doc(db, 'melazaSacks', material.id), updateData);
                toast({ title: 'Tara Registrada', description: `Se registró la tara para el material ${material.code}.` });
            }
        } catch (error) {
            console.error(`Error updating material to ${action}:`, error);
            toast({ title: 'Error', description: 'No se pudo actualizar el estado del material.', variant: 'destructive' });
        }

        setActionState(null);
    };

     const handleEditSave = async (id: string, updates: Partial<PackagingMaterial>) => {
        try {
            const finalUpdates = { ...updates };
            
            await updateDoc(doc(db, 'melazaSacks', id), finalUpdates);
            toast({ title: 'Material Actualizado', description: `Se guardaron los cambios para el material.` });
            setEditingMaterial(null);
            setAdvancedEditingMaterial(null);
            setSelectedMaterials(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        } catch (error) {
            console.error("Error updating material:", error);
            toast({ title: 'Error', description: 'No se pudo actualizar el material.', variant: 'destructive' });
        }
    };

    const handleSelectionChange = (id: string, checked: boolean) => {
        setSelectedMaterials(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    };

    const handleConfirmDelete = async (material: PackagingMaterial) => {
        try {
            await deleteDoc(doc(db, 'melazaSacks', material.id));
            toast({ title: 'Material Eliminado', description: `Se eliminó el material ${material.code}` });
            if (selectedMaterials.has(material.id)) {
                setSelectedMaterials(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(material.id);
                    return newSet;
                });
            }
        } catch (error) {
            console.error("Error deleting material:", error);
            toast({ title: 'Error', description: 'No se pudo eliminar el material.', variant: 'destructive' });
        }
    }


    const handleDeleteSelected = async () => {
        if (selectedMaterials.size < 2) return;

        try {
            const batch = writeBatch(db);
            selectedMaterials.forEach(id => {
                batch.delete(doc(db, 'melazaSacks', id));
            });
            await batch.commit();

            setSelectedMaterials(new Set());
            toast({ title: `${selectedMaterials.size} material(es) eliminado(s)`, description: 'Se han eliminado los materiales seleccionados.' });
        } catch (error) {
            console.error("Error deleting selected materials:", error);
            toast({ title: 'Error', description: 'No se pudieron eliminar los materiales.', variant: 'destructive' });
        }
    };
    
    const handleExportCSV = () => {
        const headers = [
            'Tipo', 'Código', 'Proveedor', 'Lote', 'Presentación', 'Fecha Proveedor', 'Estado',
            'Fecha Recibido', 'Fecha En Uso', 'Fecha Consumido', 'Máquina Asignada', 'Cantidad', 
            'Peso/Und (g)', 'Peso Total (kg)', 'Peso Neto Etiqueta (kg)', 'Peso Bruto Etiqueta (kg)', 'Tara Etiqueta (kg)',
            'Peso Real Bruto (kg)', 'Tara Real (kg)', 'Peso Neto Real (kg)', 'Fecha Pesaje Tara',
            'Discrepancia (kg)', 'Rendimiento (%)'
        ];

        const rows = materials.map(m => {
            const isSacosType = m.type === 'sacos_melaza';
            
            let referenceNetWeight = m.totalWeight || 0;
            const discrepancy = m.actualNetWeight !== undefined && referenceNetWeight > 0 ? m.actualNetWeight - referenceNetWeight : null;
            
            let performance = null;
            if (m.actualNetWeight !== undefined && referenceNetWeight > 0) {
                performance = (m.actualNetWeight / referenceNetWeight) * 100;
            }

            return [
                materialTypeLabels[m.type],
                `"${m.code.replace(/"/g, '""')}"`,
                m.supplier || '',
                m.lote || '',
                m.presentation || '',
                m.providerDate || '',
                m.status,
                m.receivedAt ? format(new Date(m.receivedAt), 'yyyy-MM-dd HH:mm:ss') : '',
                m.inUseAt ? format(new Date(m.inUseAt), 'yyyy-MM-dd HH:mm:ss') : '',
                m.consumedAt ? format(new Date(m.consumedAt), 'yyyy-MM-dd HH:mm:ss') : '',
                m.assignedMachine || '',
                m.quantity || '',
                m.unitWeight || '',
                m.totalWeight || '',
                m.netWeight || '',
                m.grossWeight || '',
                m.labelTare?.toFixed(2) || '',
                m.actualWeight?.toFixed(2) || '',
                m.tareWeight?.toFixed(2) || '',
                m.actualNetWeight?.toFixed(2) || '',
                m.tareWeightedAt ? format(new Date(m.tareWeightedAt), 'yyyy-MM-dd HH:mm:ss') : '',
                discrepancy?.toFixed(2) || '',
                performance?.toFixed(1) || ''
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'reporte-sacos-melaza.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenAdvancedEdit = (material?: PackagingMaterial) => {
        const materialToEdit = material || (selectedMaterials.size === 1 ? materials.find(m => m.id === selectedMaterials.values().next().value) : null);
        if (materialToEdit) {
            setAdvancedEditingMaterial(materialToEdit);
        }
    };
    
    const applySharedFilters = (material: PackagingMaterial) => {
        const supplierMatch = supplierFilter === 'all' || material.supplier === suppliers.find(s => s.id === supplierFilter)?.name;
        const machineMatch = machineFilter === 'all' ||
            (machineFilter === 'unassigned' && !material.assignedMachine) ||
            material.assignedMachine === machineFilter;
        const searchMatch = !searchQuery ||
            material.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (material.lote && material.lote.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const locationMatch = !locationFilter || material.warehouseLocation === locationFilter;

        let shiftMatch = true;
        if (shiftFilter !== 'all') {
            if (shiftFilter === 'current' && (material.status === 'recibido' || material.status === 'en_uso' || material.status === 'por_pesar_tara')) {
                return supplierMatch && machineMatch && searchMatch && locationMatch; 
            }

            let relevantTimestamp: number | undefined;
            switch(material.status) {
                case 'recibido': relevantTimestamp = material.receivedAt; break;
                case 'en_uso': relevantTimestamp = material.inUseAt; break;
                case 'por_pesar_tara': relevantTimestamp = material.consumedAt; break;
                case 'consumido': relevantTimestamp = material.tareWeightedAt; break;
            }

            if (!relevantTimestamp) {
                shiftMatch = false;
            } else {
                const date = new Date(relevantTimestamp);
                
                switch (shiftFilter) {
                    case 'day':
                        const hourDay = date.getHours();
                        shiftMatch = hourDay >= 7 && hourDay < 19;
                        break;
                    case 'night':
                        const hourNight = date.getHours();
                        shiftMatch = hourNight >= 19 || hourNight < 7;
                        break;
                    case 'current': {
                         const now = new Date();
                         const currentHour = now.getHours();
                         const isCurrentlyDayShift = currentHour >= 7 && currentHour < 19;
                         const materialDate = new Date(relevantTimestamp);

                         if (isCurrentlyDayShift) {
                             const shiftStart = set(startOfToday(), { hours: 7 });
                             const shiftEnd = set(startOfToday(), { hours: 18, minutes: 59, seconds: 59 });
                             shiftMatch = materialDate >= shiftStart && materialDate <= shiftEnd;
                         } else { 
                             let shiftStart: Date;
                             let shiftEnd: Date;
                             if (currentHour >= 19) {
                                 shiftStart = set(startOfToday(), { hours: 19 });
                                 shiftEnd = set(addDays(startOfToday(), 1), { hours: 6, minutes: 59, seconds: 59 });
                             } else { 
                                 shiftStart = set(subDays(startOfToday(), 1), { hours: 19 });
                                 shiftEnd = set(startOfToday(), { hours: 6, minutes: 59, seconds: 59 });
                             }
                              shiftMatch = materialDate >= shiftStart && materialDate <= shiftEnd;
                         }
                         break;
                    }
                }
            }
        }
        
        let dateMatch = true;
        if (dateRange?.from) {
            let relevantTimestamp: number | undefined;
            switch (material.status) {
                case 'recibido': relevantTimestamp = material.receivedAt; break;
                case 'en_uso': relevantTimestamp = material.inUseAt; break;
                case 'por_pesar_tara': relevantTimestamp = material.consumedAt; break;
                case 'consumido': relevantTimestamp = material.tareWeightedAt; break;
            }
            if (!relevantTimestamp) {
                dateMatch = false;
            } else {
                const materialDate = new Date(relevantTimestamp);
                const fromDate = startOfDay(dateRange.from);
                const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
                dateMatch = materialDate >= fromDate && materialDate <= toDate;
            }
        }

        return supplierMatch && machineMatch && searchMatch && shiftMatch && dateMatch && locationMatch;
    };
    
    const allFilteredMaterials = materials.filter(applySharedFilters);

    const getMaterialsForStatus = (status: MaterialStatus) => {
        return allFilteredMaterials.filter(m => m.status === status);
    };

    const recibidoMaterials = getMaterialsForStatus('recibido');
    const enUsoMaterials = getMaterialsForStatus('en_uso');
    const porPesarTaraMaterials = getMaterialsForStatus('por_pesar_tara');
    const consumidoMaterials = getMaterialsForStatus('consumido');

    const renderGrid = (mats: PackagingMaterial[]) => {
        if (mats.length === 0) {
            return (
                <div className="text-center py-12 col-span-full">
                    <p className="font-semibold text-lg">No se encontraron materiales</p>
                    <p className="text-muted-foreground mt-2">No hay materiales que coincidan con el estado y filtros seleccionados.</p>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {mats.map(material => (
                    <MaterialCard
                        key={material.id}
                        material={material}
                        onActionClick={(mat, action) => setActionState({ material: mat, action })}
                        onSelectionChange={handleSelectionChange}
                        isSelected={selectedMaterials.has(material.id)}
                        onTraceClick={setTraceMaterial}
                        onDelete={handleConfirmDelete}
                        onAdvancedEdit={handleOpenAdvancedEdit}
                    />
                ))}
            </div>
        );
    };
    
    return (
        <>
            <div className="bg-background min-h-screen text-foreground">
                <header className="flex items-center justify-between p-4 border-b bg-card z-20 sticky top-0">
                    <div className="flex items-center gap-3">
                        <Package className="h-8 w-8 text-primary" />
                        <h1 className="text-2xl font-bold text-foreground">Material Melaza</h1>
                    </div>
                    <div className="flex items-center gap-2">
                         <Link href="/bodega-melaza">
                            <Button variant="outline">
                                <Map className="mr-2 h-4 w-4" /> Mapa de Bodega
                            </Button>
                        </Link>
                        <Button variant="outline" onClick={handleExportCSV}>
                            <FileDown className="mr-2 h-4 w-4" /> Exportar a CSV
                        </Button>
                        <Link href="/melaza-kpi">
                            <Button variant="outline">
                                <BarChart className="mr-2 h-4 w-4" /> Dashboard
                            </Button>
                        </Link>
                         <Button variant="outline" onClick={() => setConfigOpen(true)}>
                            <Settings className="mr-2 h-4 w-4" />
                            Configuración
                        </Button>
                        <Link href="/">
                            <Button variant="outline">
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Button>
                        </Link>
                    </div>
                </header>

                <main className="p-4 md:p-8 space-y-6 pb-24">
                     <Collapsible open={isAddMaterialOpen} onOpenChange={handleCollapsibleChange}>
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between">
                                <div className="flex-1">
                                    <CardTitle>Registrar Nuevos Sacos</CardTitle>
                                    <CardDescription>Añade una nueva paca de sacos de melaza al inventario.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <ChevronDown className={cn("h-5 w-5 transition-transform", !isAddMaterialOpen && "-rotate-90")}/>
                                        </Button>
                                    </CollapsibleTrigger>
                                </div>
                            </CardHeader>
                            <CollapsibleContent>
                                <CardContent className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                                    <div className="lg:col-span-1 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-end gap-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="material-supplier">Proveedor</Label>
                                                <Select value={newMaterialSupplier} onValueChange={setNewMaterialSupplier}>
                                                    <SelectTrigger id="material-supplier"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                                    <SelectContent>
                                                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="material-presentation-trigger">Presentación</Label>
                                                <Input
                                                    id="material-presentation-trigger"
                                                    value={newMaterialPresentation}
                                                    onChange={(e) => setNewMaterialPresentation(e.target.value)}
                                                    placeholder="Ej: Sacos PP Blancos"
                                                    disabled={!newMaterialSupplier}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="material-code">Código</Label>
                                                <Input id="material-code" value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder="Escribir o escanear..." disabled={!newMaterialSupplier} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Fecha Proveedor</Label>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newMaterialProviderDate && "text-muted-foreground")} disabled={!newMaterialSupplier}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {newMaterialProviderDate ? format(newMaterialProviderDate, 'PPP', {locale: es}) : <span>Elige una fecha</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newMaterialProviderDate} onSelect={setNewMaterialProviderDate} initialFocus /></PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-end gap-4 pt-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="material-quantity">Cantidad</Label>
                                                <Input id="material-quantity" type="number" value={newMaterialQuantity} onChange={(e) => setNewMaterialQuantity(e.target.value)} placeholder="Ej: 500" disabled={!newMaterialSupplier}/>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="material-unit-weight">Peso/Und (g)</Label>
                                                <Input id="material-unit-weight" type="number" value={newMaterialUnitWeight} onChange={(e) => setNewMaterialUnitWeight(e.target.value)} placeholder="Ej: 103,2" disabled={!newMaterialSupplier}/>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="material-total-weight">Peso Neto (kg)</Label>
                                                <Input id="material-total-weight" type="number" value={newMaterialTotalWeight} onChange={(e) => setNewMaterialTotalWeight(e.target.value)} placeholder="Ej: 51.6" disabled={!newMaterialSupplier}/>
                                            </div>
                                             <div className="space-y-1.5">
                                                <Label htmlFor="material-gross-weight-sacos">Peso Bruto (kg)</Label>
                                                <Input id="material-gross-weight-sacos" type="number" value={newMaterialGrossWeight} onChange={(e) => setNewMaterialGrossWeight(e.target.value)} placeholder="Balanza" disabled={!newMaterialSupplier}/>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="material-location">Ubicación</Label>
                                                <Input id="material-location" value={newMaterialLocation} onChange={(e) => setNewMaterialLocation(e.target.value)} placeholder="Ej: A1-1" disabled={!newMaterialSupplier}/>
                                            </div>
                                            <div className="flex items-end gap-2 lg:col-start-5">
                                                 <div className='flex gap-2 w-full'>
                                                    <Button onClick={() => setIsScannerOpen(true)} variant="outline" className="flex-1" disabled={!newMaterialSupplier}>
                                                        <Camera className="mr-2 h-4 w-4" /> Escanear
                                                    </Button>
                                                    <Button onClick={handleAddMaterial} className="flex-1" disabled={!newMaterialSupplier}>
                                                        <PlusCircle className="mr-2 h-4 w-4" /> Registrar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Card>
                    </Collapsible>


                    <Card>
                        <CardHeader>
                            <CardTitle>Inventario de Sacos de Melaza</CardTitle>
                            <CardDescription>Visualiza y gestiona los sacos recibidos, en uso y consumidos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-4">
                                <Input
                                    placeholder="Buscar por código, lote..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange?.from ? (
                                                dateRange.to ? (
                                                    <>
                                                        {format(dateRange.from, "LLL dd, y", { locale: es })} -{' '}
                                                        {format(dateRange.to, "LLL dd, y", { locale: es })}
                                                    </>
                                                ) : (
                                                    format(dateRange.from, "LLL dd, y", { locale: es })
                                                )
                                            ) : (
                                                <span>Elige un rango</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange?.from}
                                            selected={dateRange}
                                            onSelect={setDateRange}
                                            numberOfMonths={2}
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Proveedores</SelectItem>
                                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                 <Input
                                    placeholder="Buscar por área asignada..."
                                    value={machineFilter === 'all' || machineFilter === 'unassigned' ? '' : machineFilter}
                                    onChange={(e) => setMachineFilter(e.target.value || 'all')}
                                />
                                <Select value={shiftFilter} onValueChange={(v) => setShiftFilter(v as any)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Turnos</SelectItem>
                                        <SelectItem value="current">Turno Actual</SelectItem>
                                        <SelectItem value="day">Turno Día (07:00-18:59)</SelectItem>
                                        <SelectItem value="night">Turno Noche (19:00-06:59)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                     <Tabs defaultValue="all" value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                                        <TabsList className="grid w-full grid-cols-5">
                                            <TabsTrigger value="all">Todos ({allFilteredMaterials.length})</TabsTrigger>
                                            <TabsTrigger value="recibido">Recibido ({recibidoMaterials.length})</TabsTrigger>
                                            <TabsTrigger value="en_uso">En Uso ({enUsoMaterials.length})</TabsTrigger>
                                            <TabsTrigger value="por_pesar_tara">Por Pesar Tara ({porPesarTaraMaterials.length})</TabsTrigger>
                                            <TabsTrigger value="consumido">Consumido ({consumidoMaterials.length})</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="all" className="mt-4">{renderGrid(allFilteredMaterials)}</TabsContent>
                                        <TabsContent value="recibido" className="mt-4">{renderGrid(recibidoMaterials)}</TabsContent>
                                        <TabsContent value="en_uso" className="mt-4">{renderGrid(enUsoMaterials)}</TabsContent>
                                        <TabsContent value="por_pesar_tara" className="mt-4">{renderGrid(porPesarTaraMaterials)}</TabsContent>
                                        <TabsContent value="consumido" className="mt-4">{renderGrid(consumidoMaterials)}</TabsContent>
                                    </Tabs>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>

            {selectedMaterials.size >= 2 && (
                <div className="fixed bottom-0 left-0 right-0 z-20 p-4">
                    <Card className="max-w-md mx-auto flex items-center justify-between p-4 shadow-lg">
                        <p className="text-sm font-semibold">{selectedMaterials.size} material(es) seleccionado(s)</p>
                        <div className="flex items-center gap-2">
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar Seleccionados
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Confirmar Eliminación Masiva?</AlertDialogTitle>
                                        <AlertDialogDescriptionComponent>
                                            Estás a punto de eliminar permanentemente {selectedMaterials.size} material(es). Esta acción no se puede deshacer.
                                        </AlertDialogDescriptionComponent>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteSelected}>Sí, Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </Card>
                </div>
            )}
            
            <ScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
            />
            {actionState && (
                actionState.action === 'weigh_tare' ? (
                    <TareWeightDialog
                        material={actionState.material}
                        onClose={() => setActionState(null)}
                        onConfirm={(data) => handleActionConfirm(data)}
                    />
                ) : (
                    <MaterialActionDialog
                        material={actionState.material}
                        action={actionState.action}
                        onClose={() => setActionState(null)}
                        onConfirm={handleActionConfirm}
                    />
                )
            )}
            {editingMaterial && (
                <EditMaterialDialog 
                    material={editingMaterial}
                    onClose={() => setEditingMaterial(null)}
                    onSave={handleEditSave}
                />
            )}
            {advancedEditingMaterial && (
                <AdvancedEditDialog
                    material={advancedEditingMaterial}
                    onClose={() => setAdvancedEditingMaterial(null)}
                    onSave={handleEditSave}
                />
            )}
            {traceMaterial && (
                <TraceabilityDialog
                    material={traceMaterial}
                    onClose={() => setTraceMaterial(null)}
                />
            )}
             {configOpen && (
                <ConfigModal
                    isOpen={configOpen}
                    onClose={() => setConfigOpen(false)}
                    suppliers={suppliers}
                    onConfigSave={handleConfigSave}
                />
            )}
        </>
    );
}

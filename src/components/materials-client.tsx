

'use client';

import React from 'react';
import Link from 'next/link';
import { Boxes, ChevronLeft, PlusCircle, PackageCheck, Inbox, Play, Camera, AlertTriangle, Weight, HardHat, Trash2, Settings, X, Calendar as CalendarIcon, Zap, Edit, Search, Info, FileDown, Separator as SeparatorIcon, Smartphone, QrCode, CheckCircle2, Moon, Sun, ChevronDown, BarChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, MaterialType, MaterialStatus, ProductDefinition, CategoryDefinition, Supplier } from '@/lib/types';
import { materialTypeLabels } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, writeBatch, query, where, getDocs, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
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
                    <DialogTitle>Configurar Catálogos</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <h3 className="font-semibold text-lg">Proveedores</h3>
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
        });
    }, [material]);


    const handleChange = (field: keyof PackagingMaterial, value: any) => {
        setEditedMaterial((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveChanges = () => {
        onSave(material.id, editedMaterial);
        onClose();
    };

  const isSacosType = material.type === 'sacos_granel' || material.type === 'sacos_familiar';
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
          {isPlasticsacks && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-lote">Lote</Label>
              <Input id="edit-lote" value={editedMaterial.lote || ''} onChange={e => handleChange('lote', e.target.value)} />
            </div>
          )}

          {isSacosType ? (
            isPlasticsacks ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-quantity">Cantidad</Label>
                  <Input id="edit-quantity" type="number" value={editedMaterial.quantity || ''} onChange={e => handleChange('quantity', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-total-weight">Peso Neto (kg)</Label>
                  <Input id="edit-total-weight" type="number" value={editedMaterial.totalWeight || ''} onChange={e => handleChange('totalWeight', Number(e.target.value))} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-quantity">Cantidad</Label>
                  <Input id="edit-quantity" type="number" value={editedMaterial.quantity || ''} onChange={e => handleChange('quantity', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-unit-weight">Peso/Und (g)</Label>
                  <Input id="edit-unit-weight" type="number" value={editedMaterial.unitWeight || ''} onChange={e => handleChange('unitWeight', Number(e.target.value))} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="edit-total-weight">Peso Total (kg)</Label>
                  <Input id="edit-total-weight" type="number" value={editedMaterial.totalWeight || ''} onChange={e => handleChange('totalWeight', Number(e.target.value))} />
                </div>
              </div>
            )
          ) : (
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

  React.useEffect(() => {
    setEditedMaterial(material);
  }, [material]);

  const handleChange = (field: keyof PackagingMaterial, value: any) => {
    setEditedMaterial((prev) => ({ ...prev, [field]: value }));
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
    onSave(material.id, editedMaterial);
    onClose();
  };
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edición Avanzada de Material</DialogTitle>
                <DialogDescription className="break-all">Editando: <span className="font-mono font-bold">{material.code}</span></DialogDescription>
            </DialogHeader>
             <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-code">Código</Label>
                        <Input id="adv-code" value={editedMaterial.code || ''} onChange={(e) => handleChange('code', e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-presentation">Presentación</Label>
                        <Input id="adv-presentation" value={editedMaterial.presentation || ''} onChange={(e) => handleChange('presentation', e.target.value)} />
                    </div>
                </div>

                <Separator />
                <h4 className="font-semibold text-sm text-muted-foreground">Datos de Peso</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="space-y-1.5">
                        <Label htmlFor="adv-net-weight">P. Neto (Etiqueta)</Label>
                        <Input id="adv-net-weight" type="number" value={editedMaterial.netWeight || ''} onChange={(e) => handleChange('netWeight', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-gross-weight">P. Bruto (Etiqueta)</Label>
                        <Input id="adv-gross-weight" type="number" value={editedMaterial.grossWeight || ''} onChange={(e) => handleChange('grossWeight', Number(e.target.value))} />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="adv-actual-weight">P. Bruto (Balanza)</Label>
                        <Input id="adv-actual-weight" type="number" value={editedMaterial.actualWeight || ''} onChange={(e) => handleChange('actualWeight', Number(e.target.value))} />
                    </div>
                </div>
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                     <div className="space-y-1.5">
                        <Label htmlFor="adv-plastic-weight">P. Envoltura (kg)</Label>
                        <Input id="adv-plastic-weight" type="number" value={editedMaterial.plasticWeight || ''} onChange={(e) => handleChange('plasticWeight', Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-core-weight">P. Canuto (kg)</Label>
                        <Input id="adv-core-weight" type="number" value={editedMaterial.coreWeight || ''} onChange={(e) => handleChange('coreWeight', Number(e.target.value))} />
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor="adv-tare-weight">Tara Real (Total)</Label>
                        <Input id="adv-tare-weight" type="number" value={editedMaterial.tareWeight || ''} onChange={(e) => handleChange('tareWeight', Number(e.target.value))} />
                    </div>
                </div>

                <Separator />
                 <h4 className="font-semibold text-sm text-muted-foreground">Asignación y Fechas</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="adv-assigned-machine">Máquina Asignada</Label>
                        <Select value={editedMaterial.assignedMachine || ''} onValueChange={(val) => handleChange('assignedMachine', val)}>
                            <SelectTrigger id="adv-assigned-machine"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="machine_1">Máquina 1</SelectItem>
                                <SelectItem value="machine_2">Máquina 2</SelectItem>
                                <SelectItem value="machine_3">Máquina 3</SelectItem>
                                <SelectItem value="wrapper_1">Enfardadora 1</SelectItem>
                                <SelectItem value="wrapper_2">Enfardadora 2</SelectItem>
                            </SelectContent>
                        </Select>
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
        return format(new Date(ts), "PPP p", { locale: es });
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
    const [plasticWeight, setPlasticWeight] = React.useState(material.plasticWeight?.toString() || '');
    const [coreWeight, setCoreWeight] = React.useState(material.coreWeight?.toString() || '');
    const isSacosType = material.type === 'sacos_familiar' || material.type === 'sacos_granel';

    const totalTare = (parseFloat(plasticWeight) || 0) + (parseFloat(coreWeight) || 0);
    const actualNetWeight = (material.actualWeight || 0) - totalTare;

    const handleConfirm = () => {
        onConfirm({
            plasticWeight: parseFloat(plasticWeight) || 0,
            coreWeight: parseFloat(coreWeight) || 0,
        });
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Pesar Tara del Material</DialogTitle>
                    <DialogDescription>
                        Registra el peso de los desechos para calcular el peso neto real y el rendimiento.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className={cn("grid gap-4", isSacosType ? "grid-cols-1" : "grid-cols-2")}>
                        <div className="space-y-1.5">
                            <Label htmlFor="plastic-weight">Peso envoltura (kg)</Label>
                            <Input
                                id="plastic-weight"
                                type="number"
                                value={plasticWeight}
                                onChange={(e) => setPlasticWeight(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        {!isSacosType && (
                            <div className="space-y-1.5">
                                <Label htmlFor="core-weight">Peso del Canuto (kg)</Label>
                                <Input
                                    id="core-weight"
                                    type="number"
                                    value={coreWeight}
                                    onChange={(e) => setCoreWeight(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        )}
                    </div>
                    <Separator />
                     <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Peso Bruto (Balanza):</span>
                            <span className="font-medium">{(material.actualWeight || material.totalWeight)?.toFixed(2) || '0.00'} kg</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Peso Total de Tara:</span>
                            <span className="font-medium text-red-600">-{totalTare.toFixed(2)} kg</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Peso Neto Real:</span>
                            <span className="text-green-600">{actualNetWeight.toFixed(2)} kg</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleConfirm} disabled={!plasticWeight}>Confirmar y Guardar Tara</Button>
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
                        <Label htmlFor="assigned-machine">Asignar a Máquina</Label>
                        <Select value={assignedMachine} onValueChange={setAssignedMachine}>
                            <SelectTrigger id="assigned-machine">
                                <SelectValue placeholder="Seleccionar máquina..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="machine_1">Máquina Envasadora 1</SelectItem>
                                <SelectItem value="machine_2">Máquina Envasadora 2</SelectItem>
                                <SelectItem value="machine_3">Máquina Envasadora 3</SelectItem>
                                <SelectItem value="wrapper_1">Enfardadora 1</SelectItem>
                                <SelectItem value="wrapper_2">Enfardadora 2</SelectItem>
                            </SelectContent>
                        </Select>
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
    onEditClick,
    onTraceClick,
}: { 
    material: PackagingMaterial, 
    onActionClick: (material: PackagingMaterial, action: 'weigh' | 'consume' | 'weigh_tare') => void, 
    onSelectionChange: (id: string, checked: boolean) => void, 
    isSelected: boolean,
    onEditClick: (material: PackagingMaterial) => void,
    onTraceClick: (material: PackagingMaterial) => void,
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
                return format(new Date(timestamp), "PPP p", { locale: es });
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
        
        if (fullCode.includes('|')) {
            return fullCode.split('|')[0] || 'N/A';
        }

        if (fullCode.length > 4) {
            const lastPart = fullCode.slice(-4);
            if (!isNaN(parseInt(lastPart, 10))) {
                 return lastPart;
            }
        }
        
        return fullCode.slice(-6); // Fallback to last 6 chars
    };

    const currentStatus = statusConfig[material.status];
    const isSacosType = material.type === 'sacos_familiar' || material.type === 'sacos_granel';
    const isRollosType = material.type === 'rollo_fardo' || material.type === 'rollo_laminado';

    const getPerformance = () => {
        if (material.status !== 'consumido' || material.actualNetWeight === undefined) return null;
        
        let referenceWeight = 0;
        if (isRollosType && material.netWeight) {
            referenceWeight = material.netWeight;
        } else if (isSacosType && material.totalWeight) {
             // For sacos, the "net" weight from label is the total weight.
            referenceWeight = material.totalWeight;
        }

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
        
        let referenceNetWeight = 0;
        if (isRollosType) {
            referenceNetWeight = material.netWeight || 0;
        } else if (isSacosType) {
            referenceNetWeight = material.totalWeight || 0; 
        }
        
        if (referenceNetWeight === 0) return null;

        const discrepancy = referenceNetWeight - material.actualNetWeight;
        const color = discrepancy > 0 ? 'text-red-600' : 'text-green-600';
        
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
                    {material.status === 'recibido' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditClick(material)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                    )}
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
                     <div className={cn("flex items-center gap-2 text-xs font-bold text-white px-2 py-1 rounded-full self-start mt-2", currentStatus.color)}>
                        <currentStatus.icon className="h-3 w-3" />
                        <span>{currentStatus.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 space-y-0.5">
                        {material.supplier && <p>Proveedor: {material.supplier}</p>}
                        {material.providerDate && <p>Fecha Prov: {material.providerDate}</p>}
                        {material.lote && <p>Lote: {material.lote}</p>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="space-y-4 text-sm">
                    {isSacosType ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Cantidad</p>
                                <p className="font-semibold text-lg">{material.quantity}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Peso/Und.</p>
                                <p className="font-semibold text-lg">{material.unitWeight} g</p>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <p className="text-muted-foreground">Peso Total (Calculado)</p>
                                <p className="font-semibold text-lg">{material.totalWeight} kg</p>
                            </div>
                        </div>
                    ) : (
                         <div className="space-y-3">
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
                                    <p className="font-semibold text-green-600">{material.actualNetWeight ? `${material.actualNetWeight.toFixed(2)} kg` : 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Tara (Real)</p>
                                    <p className="font-semibold text-destructive">{material.tareWeight?.toFixed(2) ?? 'N/A'} kg</p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        {getPerformance()}
                        {getDiscrepancy()}
                    </div>
                </div>
                 <div className="text-xs text-muted-foreground space-y-1 border-t pt-2 min-h-[50px]">
                    {material.assignedMachine && (
                        <p className="flex items-center gap-2 font-medium text-primary">
                            <HardHat className="h-3 w-3" />
                            <span>Asignado a: {material.assignedMachine.replace('_', ' ')}</span>
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

const supplierMaterialMapping: { [key: string]: MaterialType[] } = {
    'PLASTICSACKS CIA LTDA.': ['sacos_granel'],
    'REYSAC': ['sacos_granel', 'sacos_familiar'],
    'MILANPLASTIC': ['rollo_laminado'],
    'PLASTIEMPAQUES S.A': ['rollo_fardo'],
};


export default function MaterialsClient({ 
    initialMaterials,
    allProducts,
    allCategories,
    initialSuppliers,
}: { 
    initialMaterials: PackagingMaterial[],
    allProducts: ProductDefinition[],
    allCategories: CategoryDefinition[],
    initialSuppliers: Supplier[],
}) {
    const [materials, setMaterials] = React.useState<PackagingMaterial[]>(initialMaterials);
    const [suppliers, setSuppliers] = React.useState<Supplier[]>(initialSuppliers);
    const [newMaterialType, setNewMaterialType] = React.useState<MaterialType>('sacos_familiar');
    const [newMaterialCode, setNewMaterialCode] = React.useState('');
    const [newMaterialSupplier, setNewMaterialSupplier] = React.useState('');
    const [newMaterialLote, setNewMaterialLote] = React.useState('');
    const [newMaterialProviderDate, setNewMaterialProviderDate] = React.useState<Date | undefined>();
    
    // States for common fields
    const [newMaterialPresentation, setNewMaterialPresentation] = React.useState('');
    
    // States for net/gross weight types
    const [newMaterialNetWeight, setNewMaterialNetWeight] = React.useState('');
    const [newMaterialGrossWeight, setNewMaterialGrossWeight] = React.useState('');

    // States for sacos type
    const [newMaterialQuantity, setNewMaterialQuantity] = React.useState('');
    const [newMaterialUnitWeight, setNewMaterialUnitWeight] = React.useState('');
    const [newMaterialTotalWeight, setNewMaterialTotalWeight] = React.useState('');

    const [selectedMaterials, setSelectedMaterials] = React.useState<Set<string>>(new Set());
    const { toast } = useToast();
    const [isScannerOpen, setIsScannerOpen] = React.useState(false);
    const [configOpen, setConfigOpen] = React.useState(false);
    const netWeightInputRef = React.useRef<HTMLInputElement>(null);
    const [isAddMaterialOpen, setIsAddMaterialOpen] = React.useState(true);


    const [actionState, setActionState] = React.useState<{ material: PackagingMaterial; action: 'weigh' | 'consume' | 'weigh_tare' } | null>(null);
    
    const [editingMaterial, setEditingMaterial] = React.useState<PackagingMaterial | null>(null);
    const [advancedEditingMaterial, setAdvancedEditingMaterial] = React.useState<PackagingMaterial | null>(null);
    const [traceMaterial, setTraceMaterial] = React.useState<PackagingMaterial | null>(null);
    const [isSyncModalOpen, setIsSyncModalOpen] = React.useState(false);
    const [syncSessionId, setSyncSessionId] = React.useState<string | null>(null);
    const [isMobileDevice, setIsMobileDevice] = React.useState(false);
    const [isDeviceConnected, setIsDeviceConnected] = React.useState(false);

    const [typeFilter, setTypeFilter] = React.useState<MaterialType | 'all'>('all');
    const [supplierFilter, setSupplierFilter] = React.useState<string | 'all'>('all');
    const [machineFilter, setMachineFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<MaterialStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = React.useState('');
    
    const handleScanSuccess = React.useCallback((code: string) => {
        if (isMobileDevice && syncSessionId) {
             try {
                // When on mobile in sync mode, send the code to the session document
                updateDoc(doc(db, 'sessions', syncSessionId), { scannedCode: code, timestamp: Date.now() });
                toast({ title: "Código Enviado", description: `Se envió el código al computador.` });
                // Keep the scanner open on mobile for multiple scans
            } catch (error) {
                toast({ title: "Error de Envío", description: "No se pudo enviar el código. Vuelve a conectar.", variant: "destructive" });
                setSyncSessionId(null); // Disconnect on error
                setIsScannerOpen(false);
            }
            return;
        }
        
        if (code.startsWith('http')) {
            const url = new URL(code);
            const sessionIdFromQr = url.searchParams.get('sessionId');
            
            if (isMobileDevice && sessionIdFromQr) {
                try {
                    updateDoc(doc(db, 'sessions', sessionIdFromQr), { status: 'connected', deviceName: navigator.userAgent });
                    setSyncSessionId(sessionIdFromQr);
                    toast({ title: "Dispositivo Conectado", description: "Ahora puedes escanear códigos de materiales." });
                    setTimeout(() => setIsScannerOpen(true), 500); // Reopen scanner
                } catch (error) {
                    toast({ title: "Error de Conexión", description: "No se pudo conectar a la sesión. Inténtalo de nuevo.", variant: "destructive" });
                }
            }
            return; // Don't process URL as material code
        }
        
        // This part runs on Desktop, or on Mobile if not in sync mode
        setIsScannerOpen(false);
        setNewMaterialCode(code);
    
        if (code.includes('|')) {
            const parts = code.split('|');
            if (parts.length >= 5) {
                const quantity = parts[2];
                const unitWeightGrams = parts[3]?.replace(',', '.');
                const totalWeightKg = parts[4]?.replace(',', '.');
    
                if (quantity && !isNaN(Number(quantity))) {
                    setNewMaterialQuantity(quantity);
                }
                if (unitWeightGrams && !isNaN(Number(unitWeightGrams))) {
                    setNewMaterialUnitWeight(unitWeightGrams);
                }
                 if (totalWeightKg && !isNaN(Number(totalWeightKg))) {
                    setNewMaterialTotalWeight(totalWeightKg);
                    setNewMaterialNetWeight(totalWeightKg); // For plasticsacks
                }
    
                toast({
                    title: "Datos Extraídos del QR",
                    description: `Cant: ${quantity}, P/Und: ${unitWeightGrams}g, Total: ${totalWeightKg}kg`
                });
                
                setTimeout(() => document.getElementById('material-presentation-trigger')?.focus(), 100);
            }
        } else {
            if (newMaterialType === 'rollo_fardo' || newMaterialType === 'rollo_laminado') {
                netWeightInputRef.current?.focus();
            } else if (newMaterialType === 'sacos_familiar' || newMaterialType === 'sacos_granel') {
                 setTimeout(() => document.getElementById('material-presentation-trigger')?.focus(), 100);
            } else {
                 setTimeout(() => document.getElementById('material-presentation-trigger')?.focus(), 100);
            }
        }
    }, [isMobileDevice, newMaterialType, syncSessionId, toast]);
    
    const handleSyncClick = React.useCallback(async () => {
        if (isMobileDevice) {
            // On mobile, just open the scanner. It will handle the connection flow.
            setIsScannerOpen(true);
        } else {
            // On desktop, generate the session and show the QR code.
            const newSessionId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const sessionDocRef = doc(db, 'sessions', newSessionId);
            await setDoc(sessionDocRef, { createdAt: Date.now(), status: 'pending' });
            setSyncSessionId(newSessionId);
            setIsSyncModalOpen(true);
        }
    }, [isMobileDevice]);
    
    React.useEffect(() => {
        setIsMobileDevice(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        
        let unsub: (() => void) | undefined;
        if (syncSessionId && !isMobileDevice) {
            unsub = onSnapshot(doc(db, 'sessions', syncSessionId), (doc) => {
                const data = doc.data();
                if (data?.status === 'connected' && isSyncModalOpen) {
                     toast({ title: "Dispositivo móvil conectado", description: `Conectado a: ${data.deviceName}` });
                     setIsSyncModalOpen(false); // Close the QR dialog on PC
                     setIsDeviceConnected(true);
                }
                if (data?.scannedCode && data.timestamp > (data.lastProcessedTimestamp || 0)) {
                    handleScanSuccess(data.scannedCode);
                    updateDoc(doc.ref, { lastProcessedTimestamp: data.timestamp });
                }
            });
        }
        return () => {
            if (unsub) unsub();
        };
    }, [syncSessionId, isMobileDevice, isSyncModalOpen, handleScanSuccess, toast]);

    const supplierName = suppliers.find(s => s.id === newMaterialSupplier)?.name || '';
    const isSacosType = newMaterialType === 'sacos_granel' || newMaterialType === 'sacos_familiar';
    const isPlasticsacks = supplierName.toUpperCase().startsWith('PLASTICSACKS');
    const isPlastiempaques = supplierName.toUpperCase().startsWith('PLASTIEMPAQUES S.A');
    const isMilanplastic = supplierName.toUpperCase().startsWith('MILANPLASTIC');


    const familiarCategoryId = React.useMemo(() => allCategories.find(c => c.name.toLowerCase() === 'familiar')?.id, [allCategories]);
    const granelCategoryId = React.useMemo(() => allCategories.find(c => c.name.toLowerCase() === 'granel')?.id, [allCategories]);

    const familiarProducts = React.useMemo(() => {
        if (!familiarCategoryId) return [];
        return allProducts.filter(p => p.categoryId === familiarCategoryId && !p.productName.includes('(12'));
    }, [allProducts, familiarCategoryId]);

    const granelProducts = React.useMemo(() => {
        if (!granelCategoryId) return [];
        const dbProducts = allProducts.filter(p => p.categoryId === granelCategoryId && !p.productName.includes('(12'));
        // Manually add the "Sacos sin logo" option
        return [{id: 'sacos-sin-logo', productName: 'Sacos sin logo', order: -1, categoryId: granelCategoryId, isActive: true} as any, ...dbProducts];
    }, [allProducts, granelCategoryId]);

    const availableMaterialTypes = React.useMemo(() => {
        const upperCaseSupplierName = supplierName.trim().toUpperCase();
        const mappedTypesKey = Object.keys(supplierMaterialMapping).find(key => upperCaseSupplierName.startsWith(key));
        
        if (mappedTypesKey) {
            return supplierMaterialMapping[mappedTypesKey];
        }
        return Object.keys(materialTypeLabels) as MaterialType[];
    }, [supplierName]);
    
    React.useEffect(() => {
        if (!availableMaterialTypes.includes(newMaterialType)) {
            setNewMaterialType(availableMaterialTypes[0] || 'sacos_familiar');
        }
    }, [availableMaterialTypes, newMaterialType]);

    const handleConfigSave = async (type: 'supplier', data: any, action: 'add' | 'delete') => {
        if (type !== 'supplier') return;

        try {
            if (action === 'add') {
                const docRef = await addDoc(collection(db, 'suppliers'), data);
                setSuppliers(prev => [...prev, {id: docRef.id, ...data}].sort((a,b) => a.name.localeCompare(b.name)));
                toast({ title: "Proveedor añadido" });
            } else if (action === 'delete') {
                await deleteDoc(doc(db, 'suppliers', data.id));
                setSuppliers(prev => prev.filter(s => s.id !== data.id));
                toast({ title: "Proveedor eliminado" });
            }
        } catch (e) {
            console.error("Error saving supplier config", e);
            toast({ title: "Error", description: "No se pudo actualizar el catálogo de proveedores.", variant: 'destructive'});
        }
    };


    const handleAddMaterial = async () => {
        if (!newMaterialCode.trim()) {
            toast({ title: "Error", description: "El código es obligatorio.", variant: "destructive" });
            return;
        }

        const trimmedCode = newMaterialCode.trim();
        
        try {
            const q = query(collection(db, 'packagingMaterials'), where('code', '==', trimmedCode));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                toast({
                    title: "Error de Duplicado",
                    description: "El código de material que intentas registrar ya existe en el sistema.",
                    variant: "destructive",
                });
                return;
            }
            const netWeight = newMaterialNetWeight ? parseFloat(newMaterialNetWeight.replace(',', '.')) : 0;
            const grossWeight = newMaterialGrossWeight ? parseFloat(newMaterialGrossWeight.replace(',', '.')) : 0;

            const newMaterialData: Partial<Omit<PackagingMaterial, 'id'>> = {
                type: newMaterialType,
                code: trimmedCode,
                supplier: supplierName,
                lote: '',
                presentation: newMaterialPresentation.trim(),
                status: 'recibido',
                receivedAt: Date.now(),
            };
            
            if (isPlasticsacks) {
                 newMaterialData.lote = newMaterialLote.trim();
            }

            if (isSacosType) {
                if (!newMaterialQuantity) {
                    toast({ title: "Error", description: "La cantidad es obligatoria para Sacos.", variant: "destructive" });
                    return;
                }
                newMaterialData.quantity = parseInt(newMaterialQuantity, 10);

                 if (isPlasticsacks) {
                    if (!newMaterialTotalWeight) {
                        toast({ title: "Error", description: "El peso neto es obligatorio para PLASTICSACKS.", variant: "destructive" });
                        return;
                    }
                    newMaterialData.totalWeight = parseFloat(newMaterialTotalWeight.replace(',', '.'));
                 } else { 
                    if (!newMaterialUnitWeight || !newMaterialTotalWeight) {
                        toast({ title: "Error", description: "Peso/Und y Peso Total son obligatorios para este proveedor.", variant: "destructive" });
                        return;
                    }
                    newMaterialData.unitWeight = parseFloat(newMaterialUnitWeight.replace(',', '.'));
                    newMaterialData.totalWeight = parseFloat(newMaterialTotalWeight.replace(',', '.'));
                 }
            } else { // Rollos
                newMaterialData.netWeight = netWeight;
                newMaterialData.grossWeight = grossWeight;
                if (grossWeight > 0 && netWeight > 0) {
                    newMaterialData.labelTare = grossWeight - netWeight;
                }
            }
            
            if (!isPlastiempaques && newMaterialProviderDate) {
                newMaterialData.providerDate = format(newMaterialProviderDate, 'yyyy-MM-dd');
            }

            const docRef = await addDoc(collection(db, 'packagingMaterials'), newMaterialData);
            setMaterials(prev => [{ id: docRef.id, ...newMaterialData } as PackagingMaterial, ...prev].sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0)));

            setNewMaterialCode('');
            setNewMaterialPresentation('');
            setNewMaterialNetWeight('');
            setNewMaterialGrossWeight('');
            setNewMaterialQuantity('');
            setNewMaterialUnitWeight('');
            setNewMaterialTotalWeight('');
            setNewMaterialSupplier('');
            setNewMaterialLote('');
            setNewMaterialProviderDate(undefined);
            
            toast({ title: 'Material Registrado', description: `Se ha registrado el material con código ${trimmedCode}.` });
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
                 // For sacos, the actual weight is the total weight if not specified
                if(!updateData.actualWeight && material.totalWeight) {
                    updateData.actualWeight = material.totalWeight;
                }
                await updateDoc(doc(db, 'packagingMaterials', material.id), updateData as any);
                setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, ...updateData } : m));
                toast({ title: 'Material en Uso', description: `El material ${material.code} ahora está en uso.` });
            } else if (action === 'consume') {
                 const finalStatus: MaterialStatus = 'por_pesar_tara';
                 const updateData = {
                    status: finalStatus,
                    consumedAt: Date.now(),
                };
                await updateDoc(doc(db, 'packagingMaterials', material.id), updateData);
                setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, ...updateData } : m));
                toast({ title: 'Material Consumido', description: `El material ${material.code} se ha marcado como consumido.` });
            } else if (action === 'weigh_tare' && data.plasticWeight !== undefined) {
                 const tareWeight = data.plasticWeight + (data.coreWeight || 0);
                 const referenceWeight = material.actualWeight || material.totalWeight || 0;
                 const actualNetWeight = referenceWeight - tareWeight;
                 const updateData: Partial<PackagingMaterial> = {
                    status: 'consumido',
                    tareWeight: tareWeight,
                    plasticWeight: data.plasticWeight,
                    coreWeight: data.coreWeight || 0,
                    actualNetWeight: actualNetWeight,
                    tareWeightedAt: Date.now(),
                };
                await updateDoc(doc(db, 'packagingMaterials', material.id), updateData);
                setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, ...updateData } : m));
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
            const currentMaterial = materials.find(m => m.id === id);
            const isRollType = currentMaterial?.type.startsWith('rollo');

            if (isRollType) {
                const netWeight = finalUpdates.netWeight ?? currentMaterial?.netWeight ?? 0;
                const grossWeight = finalUpdates.grossWeight ?? currentMaterial?.grossWeight ?? 0;
                if (grossWeight > 0 && netWeight > 0) {
                    finalUpdates.labelTare = grossWeight - netWeight;
                }
            }

            const plasticWeight = finalUpdates.plasticWeight ?? currentMaterial?.plasticWeight ?? 0;
            const coreWeight = finalUpdates.coreWeight ?? currentMaterial?.coreWeight ?? 0;
            const newTareWeight = plasticWeight + coreWeight;

            if (newTareWeight > 0 && (newTareWeight !== (currentMaterial?.tareWeight ?? 0))) {
                 finalUpdates.tareWeight = newTareWeight;
                 const referenceWeight = finalUpdates.actualWeight || currentMaterial?.actualWeight || currentMaterial?.totalWeight || 0;
                 finalUpdates.actualNetWeight = referenceWeight - newTareWeight;
            } else if (finalUpdates.tareWeight !== undefined && finalUpdates.tareWeight !== (currentMaterial?.tareWeight ?? 0)) {
                const referenceWeight = finalUpdates.actualWeight || currentMaterial?.actualWeight || currentMaterial?.totalWeight || 0;
                finalUpdates.actualNetWeight = referenceWeight - finalUpdates.tareWeight;
            }

            await updateDoc(doc(db, 'packagingMaterials', id), finalUpdates);
            setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...finalUpdates } as PackagingMaterial : m));
            toast({ title: 'Material Actualizado', description: `Se guardaron los cambios para el material.` });
            setEditingMaterial(null);
            setAdvancedEditingMaterial(null);
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

    const handleDeleteSelected = async () => {
        if (selectedMaterials.size === 0) return;

        try {
            const batch = writeBatch(db);
            selectedMaterials.forEach(id => {
                batch.delete(doc(db, 'packagingMaterials', id));
            });
            await batch.commit();

            setMaterials(prev => prev.filter(m => !selectedMaterials.has(m.id)));
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
            const isRollosType = m.type === 'rollo_fardo' || m.type === 'rollo_laminado';
            const isSacosType = m.type === 'sacos_familiar' || m.type === 'sacos_granel';
            
            let referenceNetWeight = 0;
            if (isRollosType) {
                referenceNetWeight = m.netWeight || 0;
            } else if (isSacosType) {
                referenceNetWeight = m.totalWeight || 0; 
            }
            const discrepancy = m.actualNetWeight !== undefined && referenceNetWeight > 0 ? referenceNetWeight - m.actualNetWeight : null;
            
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
        link.setAttribute('download', 'reporte-materiales-empaque.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenAdvancedEdit = () => {
        if (selectedMaterials.size !== 1) return;
        const selectedId = selectedMaterials.values().next().value;
        const materialToEdit = materials.find(m => m.id === selectedId);
        if (materialToEdit) {
            setAdvancedEditingMaterial(materialToEdit);
        }
    };
    
    const enUsoMaterials = materials.filter(material => {
        if (statusFilter !== 'all' && material.status !== statusFilter) return false;
        if (material.status !== 'en_uso') return false;
        const typeMatch = typeFilter === 'all' || material.type === typeFilter;
        const supplierMatch = supplierFilter === 'all' || material.supplier === suppliers.find(s => s.id === supplierFilter)?.name;
        const machineMatch = machineFilter === 'all' ||
            (machineFilter === 'unassigned' && !material.assignedMachine) ||
            material.assignedMachine === machineFilter;
        const searchMatch = !searchQuery ||
            material.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (material.lote && material.lote.toLowerCase().includes(searchQuery.toLowerCase()));
        return typeMatch && supplierMatch && machineMatch && searchMatch;
    });
    
    const recibidoMaterials = materials.filter(material => {
        if (statusFilter !== 'all' && material.status !== statusFilter) return false;
        if (material.status !== 'recibido') return false;
        const typeMatch = typeFilter === 'all' || material.type === typeFilter;
        const supplierMatch = supplierFilter === 'all' || material.supplier === suppliers.find(s => s.id === supplierFilter)?.name;
        const machineMatch = machineFilter === 'all' ||
            (machineFilter === 'unassigned' && !material.assignedMachine) ||
            material.assignedMachine === machineFilter;
        const searchMatch = !searchQuery ||
            material.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (material.lote && material.lote.toLowerCase().includes(searchQuery.toLowerCase()));
        return typeMatch && supplierMatch && machineMatch && searchMatch;
    });

    const porPesarTaraMaterials = materials.filter(material => {
        if (statusFilter !== 'all' && material.status !== statusFilter) return false;
        if (material.status !== 'por_pesar_tara') return false;
        const typeMatch = typeFilter === 'all' || material.type === typeFilter;
        const supplierMatch = supplierFilter === 'all' || material.supplier === suppliers.find(s => s.id === supplierFilter)?.name;
        const machineMatch = machineFilter === 'all' ||
            (machineFilter === 'unassigned' && !material.assignedMachine) ||
            material.assignedMachine === machineFilter;
        const searchMatch = !searchQuery ||
            material.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (material.lote && material.lote.toLowerCase().includes(searchQuery.toLowerCase()));
        return typeMatch && supplierMatch && machineMatch && searchMatch;
    });

    const consumidoMaterials = materials.filter(material => {
        if (material.status !== 'consumido') return false;
        const typeMatch = typeFilter === 'all' || material.type === typeFilter;
        const supplierMatch = supplierFilter === 'all' || material.supplier === suppliers.find(s => s.id === supplierFilter)?.name;
        const machineMatch = machineFilter === 'all' ||
            (machineFilter === 'unassigned' && !material.assignedMachine) ||
            material.assignedMachine === machineFilter;
        const searchMatch = !searchQuery ||
            material.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (material.lote && material.lote.toLowerCase().includes(searchQuery.toLowerCase()));
        return typeMatch && supplierMatch && machineMatch && searchMatch;
    });


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
                        onEditClick={setEditingMaterial}
                        onTraceClick={setTraceMaterial}
                    />
                ))}
            </div>
        );
    };

    return (
        <>
            <div className="bg-background min-h-screen text-foreground">
                <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <Boxes className="h-8 w-8 text-primary" />
                        <h1 className="text-2xl font-bold text-foreground">Control de Materiales de Empaque</h1>
                    </div>
                    <div className="flex items-center gap-2">
                         <Button 
                            variant="outline" 
                            onClick={handleSyncClick} 
                            disabled={isDeviceConnected}
                        >
                            {isDeviceConnected ? (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Dispositivo Conectado
                                </>
                            ) : (
                                <>
                                    <Smartphone className="mr-2 h-4 w-4" /> Sincronizar Escáner
                                </>
                            )}
                        </Button>
                        <Button variant="outline" onClick={handleExportCSV}>
                            <FileDown className="mr-2 h-4 w-4" /> Exportar a CSV
                        </Button>
                        <Link href="/materials-kpi">
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

                <main className="p-4 md:p-8 space-y-6">
                    <Collapsible open={isAddMaterialOpen} onOpenChange={setIsAddMaterialOpen}>
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between">
                                <div className="flex-1">
                                    <CardTitle>Registrar Nuevo Material</CardTitle>
                                    <CardDescription>Añade una nueva paca de sacos o rollo que ha llegado al área de empaque desde la bodega.</CardDescription>
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
                                <CardContent>
                                    <div className="space-y-4">
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
                                                <Label htmlFor="material-type">Tipo de Material</Label>
                                                <Select value={newMaterialType} onValueChange={(v) => setNewMaterialType(v as MaterialType)} disabled={!newMaterialSupplier}>
                                                    <SelectTrigger id="material-type"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {availableMaterialTypes.map(key => (
                                                            <SelectItem key={key} value={key}>{materialTypeLabels[key as MaterialType]}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {!isPlastiempaques && (
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="material-presentation-trigger">Presentación</Label>
                                                    {(newMaterialType === 'sacos_familiar' || newMaterialType === 'sacos_granel' || (newMaterialType === 'rollo_laminado' && isMilanplastic)) ? (
                                                        <Select
                                                            value={newMaterialPresentation}
                                                            onValueChange={setNewMaterialPresentation}
                                                            disabled={!newMaterialSupplier}
                                                        >
                                                            <SelectTrigger id="material-presentation-trigger">
                                                                <SelectValue placeholder="Seleccionar producto..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {(newMaterialType === 'sacos_granel' ? granelProducts : familiarProducts).map(p => (
                                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Input
                                                            id="material-presentation-trigger"
                                                            value={newMaterialPresentation}
                                                            onChange={(e) => setNewMaterialPresentation(e.target.value)}
                                                            placeholder="Ej: Azúcar San Juan 1kg"
                                                            disabled={!newMaterialSupplier}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            <div className="space-y-1.5">
                                                <Label htmlFor="material-code">Código</Label>
                                                <Input id="material-code" value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder="Escribir o escanear..." disabled={!newMaterialSupplier} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-end gap-4 pt-4">
                                            {isPlasticsacks && (
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="material-lote">Lote</Label>
                                                    <Input id="material-lote" value={newMaterialLote} onChange={(e) => setNewMaterialLote(e.target.value)} placeholder="Lote del proveedor" disabled={!newMaterialSupplier}/>
                                                </div>
                                            )}
                                            
                                            {!isPlastiempaques && (
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
                                            )}

                                            {isSacosType ? (
                                                isPlasticsacks ? (
                                                    <>
                                                        <div className="space-y-1.5">
                                                            <Label htmlFor="material-quantity-ps">Cantidad</Label>
                                                            <Input id="material-quantity-ps" type="number" value={newMaterialQuantity} onChange={(e) => setNewMaterialQuantity(e.target.value)} placeholder="Ej: 500" disabled={!newMaterialSupplier}/>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label htmlFor="material-total-weight-ps">Peso Neto (kg)</Label>
                                                            <Input id="material-total-weight-ps" type="number" value={newMaterialTotalWeight} onChange={(e) => setNewMaterialTotalWeight(e.target.value)} placeholder="Ej: 51.6" disabled={!newMaterialSupplier}/>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="space-y-1.5">
                                                            <Label htmlFor="material-quantity-rs">Cantidad</Label>
                                                            <Input id="material-quantity-rs" type="number" value={newMaterialQuantity} onChange={(e) => setNewMaterialQuantity(e.target.value)} placeholder="Ej: 500" disabled={!newMaterialSupplier}/>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label htmlFor="material-unit-weight-rs">Peso/Und (g)</Label>
                                                            <Input id="material-unit-weight-rs" type="number" value={newMaterialUnitWeight} onChange={(e) => setNewMaterialUnitWeight(e.target.value)} placeholder="Ej: 103,2" disabled={!newMaterialSupplier}/>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label htmlFor="material-total-weight-rs">Peso Total (kg)</Label>
                                                            <Input id="material-total-weight-rs" type="number" value={newMaterialTotalWeight} onChange={(e) => setNewMaterialTotalWeight(e.target.value)} placeholder="Ej: 51,6" disabled={!newMaterialSupplier}/>
                                                        </div>
                                                    </>
                                                )
                                            ) : (
                                                <>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="material-net-weight">Peso Neto (kg)</Label>
                                                        <Input id="material-net-weight" ref={netWeightInputRef} type="number" value={newMaterialNetWeight} onChange={(e) => setNewMaterialNetWeight(e.target.value)} placeholder="Ej: 72.85" disabled={!newMaterialSupplier}/>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <Label htmlFor="material-gross-weight">Peso Bruto (kg)</Label>
                                                        <Input id="material-gross-weight" type="number" value={newMaterialGrossWeight} onChange={(e) => setNewMaterialGrossWeight(e.target.value)} placeholder="Ej: 74.05" disabled={!newMaterialSupplier}/>
                                                    </div>
                                                </>
                                            )}
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
                             <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle>Inventario en Área de Empaque</CardTitle>
                                    <CardDescription>Visualiza y gestiona los materiales recibidos, en uso y consumidos.</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedMaterials.size > 0 && (
                                        <>
                                            <Button variant="outline" size="sm" onClick={handleOpenAdvancedEdit} disabled={selectedMaterials.size !== 1}>
                                                <Edit className="mr-2 h-4 w-4" /> Edición Avanzada
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Eliminar ({selectedMaterials.size})
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Confirmar Eliminación?</AlertDialogTitle>
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
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                                <Input
                                    placeholder="Buscar por código, lote..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Tipos</SelectItem>
                                        {Object.entries(materialTypeLabels).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los Proveedores</SelectItem>
                                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={machineFilter} onValueChange={setMachineFilter}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas las Máquinas</SelectItem>
                                        <SelectItem value="unassigned">Sin Asignar</SelectItem>
                                        <SelectItem value="machine_1">Máquina 1</SelectItem>
                                        <SelectItem value="machine_2">Máquina 2</SelectItem>
                                        <SelectItem value="machine_3">Máquina 3</SelectItem>
                                        <SelectItem value="wrapper_1">Enfardadora 1</SelectItem>
                                        <SelectItem value="wrapper_2">Enfardadora 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <Tabs defaultValue="en_uso" value={statusFilter} onValueChange={(v) => setStatusFilter(v as MaterialStatus | 'all')}>
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="en_uso">En Uso ({enUsoMaterials.length})</TabsTrigger>
                                    <TabsTrigger value="recibido">Recibido ({recibidoMaterials.length})</TabsTrigger>
                                    <TabsTrigger value="por_pesar_tara">Por Pesar Tara ({porPesarTaraMaterials.length})</TabsTrigger>
                                    <TabsTrigger value="consumido">Consumido ({consumidoMaterials.length})</TabsTrigger>
                                </TabsList>
                                <TabsContent value="en_uso" className="mt-4">{renderGrid(enUsoMaterials)}</TabsContent>
                                <TabsContent value="recibido" className="mt-4">{renderGrid(recibidoMaterials)}</TabsContent>
                                <TabsContent value="por_pesar_tara" className="mt-4">{renderGrid(porPesarTaraMaterials)}</TabsContent>
                                <TabsContent value="consumido" className="mt-4">{renderGrid(consumidoMaterials)}</TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </main>
            </div>
            {isSyncModalOpen && !isMobileDevice && syncSessionId && (
                <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Sincronizar Escáner Móvil</DialogTitle>
                            <DialogDescription>
                                1. Abre esta misma página en tu teléfono. 2. Presiona "Sincronizar Escáner". 3. Escanea este código QR con tu teléfono.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center justify-center p-4">
                             <div className="bg-white p-4 rounded-lg">
                                <QRCodeSVG
                                    value={`${window.location.origin}/materials?sessionId=${syncSessionId}`}
                                    size={256}
                                    includeMargin={true}
                                />
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
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



'use client';

import React from 'react';
import Link from 'next/link';
import { Boxes, ChevronLeft, PlusCircle, PackageCheck, Inbox, Play, Camera, AlertTriangle, Weight, HardHat, Trash2, Settings, X, Calendar as CalendarIcon, Zap, Edit, Search, Info, FileDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, MaterialType, MaterialStatus, ProductDefinition, CategoryDefinition, Supplier } from '@/lib/types';
import { materialTypeLabels } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, writeBatch, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import ScannerModal from './scanner-modal';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { Progress } from './ui/progress';


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
    const [editedMaterial, setEditedMaterial] = React.useState<Partial<PackagingMaterial>>(material);

    React.useEffect(() => {
        setEditedMaterial(material);
    }, [material]);

    const handleChange = (field: keyof PackagingMaterial, value: any) => {
        setEditedMaterial(prev => ({...prev, [field]: value}));
    };

    const handleSaveChanges = () => {
        const { id, type, supplier, receivedAt, status, inUseAt, consumedAt, assignedMachine, ...updates } = editedMaterial;
        onSave(material.id, updates);
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
                                    <Input id="edit-quantity" type="number" value={editedMaterial.quantity || ''} onChange={e => handleChange('quantity', Number(e.target.value))}/>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-total-weight">Peso Neto (kg)</Label>
                                    <Input id="edit-total-weight" type="number" value={editedMaterial.totalWeight || ''} onChange={e => handleChange('totalWeight', Number(e.target.value))}/>
                                </div>
                            </div>
                        ) : (
                             <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-quantity">Cantidad</Label>
                                    <Input id="edit-quantity" type="number" value={editedMaterial.quantity || ''} onChange={e => handleChange('quantity', Number(e.target.value))}/>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-unit-weight">Peso/Und (g)</Label>
                                    <Input id="edit-unit-weight" type="number" value={editedMaterial.unitWeight || ''} onChange={e => handleChange('unitWeight', Number(e.target.value))}/>
                                </div>
                                <div className="col-span-2 space-y-1.5">
                                    <Label htmlFor="edit-total-weight">Peso Total (kg)</Label>
                                    <Input id="edit-total-weight" type="number" value={editedMaterial.totalWeight || ''} onChange={e => handleChange('totalWeight', Number(e.target.value))}/>
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
            details: `Tara pesada. Peso Neto Real: ${material.actualNetWeight?.toFixed(2) || 'N/A'} kg.`
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
    const [plasticWeight, setPlasticWeight] = React.useState('');
    const [coreWeight, setCoreWeight] = React.useState('');

    const totalTare = (parseFloat(plasticWeight) || 0) + (parseFloat(coreWeight) || 0);
    const actualNetWeight = (material.actualWeight || 0) - totalTare;

    const handleConfirm = () => {
        onConfirm({
            plasticWeight: parseFloat(plasticWeight) || 0,
            coreWeight: parseFloat(coreWeight) || 0,
        });
    };

    const isSacosType = material.type === 'sacos_familiar' || material.type === 'sacos_granel';

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
                    <Button onClick={handleConfirm} disabled={!plasticWeight || (!isSacosType && !coreWeight)}>Confirmar y Guardar Tara</Button>
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
                        <Label htmlFor="actual-weight">Peso Real Medido (kg)</Label>
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
                                <SelectItem value="wrapper_1">Máquina Enfardadora 1</SelectItem>
                                <SelectItem value="wrapper_2">Máquina Enfardadora 2</SelectItem>
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
    
    const [formattedDates, setFormattedDates] = React.useState<{ received: string | null, inUse: string | null, consumed: string | null }>({
      received: null,
      inUse: null,
      consumed: null,
    });
    

    React.useEffect(() => {
        const formatDate = (timestamp: number | undefined) => {
            if (!timestamp) return null;
            try {
                return format(new Date(timestamp), "PPP p", { locale: es });
            } catch (e) {
                return 'Fecha inválida';
            }
        };
        setFormattedDates({
            received: formatDate(material.receivedAt),
            inUse: formatDate(material.inUseAt),
            consumed: formatDate(material.consumedAt),
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

    const getPerformance = () => {
        if (material.status !== 'consumido' || !material.actualNetWeight || (!material.netWeight && !material.totalWeight)) return null;
        
        const referenceWeight = material.netWeight || material.totalWeight || 0;
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
        if (material.status !== 'consumido' || material.tareWeight === undefined || material.labelTare === undefined) return null;
        
        const discrepancy = material.tareWeight - material.labelTare;
        const color = Math.abs(discrepancy) > 0.1 ? 'text-red-600' : 'text-green-600';
        
        return (
            <div className="space-y-1">
                <p className="text-muted-foreground">Discrepancia de Tara</p>
                <p className={cn("font-semibold text-lg", color)}>{discrepancy.toFixed(2)} kg</p>
            </div>
        );
    };

    const isSacosType = material.type === 'sacos_granel' || material.type === 'sacos_familiar';
    const isRollosType = material.type === 'rollo_fardo' || material.type === 'rollo_laminado';

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
                        <CardDescription>{material.presentation || materialTypeLabels[material.type]}</CardDescription>
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
                                    <p className="text-muted-foreground">Peso Neto (Etiqueta)</p>
                                    <p className="font-semibold text-lg">{material.netWeight} kg</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Peso Bruto (Etiqueta)</p>
                                    <p className="font-semibold text-lg">{material.grossWeight ? `${material.grossWeight} kg` : 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Tara (Etiqueta)</p>
                                    <p className="font-semibold text-lg">{material.labelTare?.toFixed(2) ?? 'N/A'} kg</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Peso Bruto (Balanza)</p>
                                    <p className="font-semibold text-lg text-primary">{material.actualWeight ? `${material.actualWeight.toFixed(2)} kg` : 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Peso Neto Real</p>
                                    <p className="font-semibold text-lg text-green-600">{material.actualNetWeight ? `${material.actualNetWeight.toFixed(2)} kg` : 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Tara (Real)</p>
                                    <p className="font-semibold text-lg">{material.tareWeight?.toFixed(2) ?? 'N/A'} kg</p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="col-span-2">{getPerformance()}</div>
                    {getDiscrepancy() && (
                        <div className="col-span-2">{getDiscrepancy()}</div>
                    )}
                </div>
                <div className="text-xs text-muted-foreground space-y-1 border-t pt-2 min-h-[50px]">
                    {material.assignedMachine && (
                        <p className="flex items-center gap-2 font-medium text-primary">
                            <HardHat className="h-3 w-3" />
                            <span>Asignado a: {material.assignedMachine.replace('_', ' ')}</span>
                        </p>
                    )}
                    {formattedDates.received && <p>Recibido: {formattedDates.received}</p>}
                    {formattedDates.inUse && <p>En Uso desde: {formattedDates.inUse}</p>}
                    {formattedDates.consumed && <p>Consumido: {formattedDates.consumed}</p>}
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
    const unitWeightInputRef = React.useRef<HTMLInputElement>(null);

    const [actionState, setActionState] = React.useState<{ material: PackagingMaterial; action: 'weigh' | 'consume' | 'weigh_tare' } | null>(null);
    
    const [editingMaterial, setEditingMaterial] = React.useState<PackagingMaterial | null>(null);
    const [traceMaterial, setTraceMaterial] = React.useState<PackagingMaterial | null>(null);

    const [statusFilter, setStatusFilter] = React.useState<MaterialStatus | 'all'>('all');
    const [typeFilter, setTypeFilter] = React.useState<MaterialType | 'all'>('all');
    const [supplierFilter, setSupplierFilter] = React.useState<string | 'all'>('all');
    const [searchQuery, setSearchQuery] = React.useState('');


    const supplierName = suppliers.find(s => s.id === newMaterialSupplier)?.name || '';
    const isSacosType = newMaterialType === 'sacos_granel' || newMaterialType === 'sacos_familiar';
    const isPlasticsacks = supplierName.toUpperCase().startsWith('PLASTICSACKS');
    const isMilanplastic = supplierName.toUpperCase().startsWith('MILANPLASTIC');


    const familiarCategoryId = React.useMemo(() => allCategories.find(c => c.name.toLowerCase() === 'familiar')?.id, [allCategories]);
    const granelCategoryId = React.useMemo(() => allCategories.find(c => c.name.toLowerCase() === 'granel')?.id, [allCategories]);

    const familiarProducts = React.useMemo(() => {
        if (!familiarCategoryId) return [];
        return allProducts.filter(p => p.categoryId === familiarCategoryId && !p.productName.includes('(12'));
    }, [allProducts, familiarCategoryId]);

    const granelProducts = React.useMemo(() => {
        if (!granelCategoryId) return [];
        return allProducts.filter(p => p.categoryId === granelCategoryId && !p.productName.includes('(12'));
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

    const filteredMaterials = React.useMemo(() => {
        return materials.filter(material => {
            const statusMatch = statusFilter === 'all' || material.status === statusFilter;
            const typeMatch = typeFilter === 'all' || material.type === typeFilter;
            const supplierMatch = supplierFilter === 'all' || material.supplier === suppliers.find(s => s.id === supplierFilter)?.name;

            const searchMatch = !searchQuery ||
                material.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (material.lote && material.lote.toLowerCase().includes(searchQuery.toLowerCase()));

            return statusMatch && typeMatch && supplierMatch && searchMatch;
        });
    }, [materials, statusFilter, typeFilter, supplierFilter, searchQuery, suppliers]);


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

            let newMaterialData: Partial<Omit<PackagingMaterial, 'id'>> = {
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
                 if (!newMaterialNetWeight && newMaterialType !== 'rollo_fardo') {
                    toast({ title: "Error", description: "El peso neto es obligatorio para este tipo de material.", variant: "destructive" });
                    return;
                }
                const netWeight = newMaterialNetWeight ? parseFloat(newMaterialNetWeight.replace(',', '.')) : undefined;
                const grossWeight = newMaterialGrossWeight ? parseFloat(newMaterialGrossWeight.replace(',', '.')) : undefined;

                newMaterialData.netWeight = netWeight;
                newMaterialData.grossWeight = grossWeight;
                if(netWeight && grossWeight) {
                    newMaterialData.labelTare = grossWeight - netWeight;
                }
            }
            
            if (isMilanplastic && newMaterialProviderDate) {
                newMaterialData.providerDate = format(newMaterialProviderDate, 'yyyy-MM-dd');
            }

            const docRef = await addDoc(collection(db, 'packagingMaterials'), newMaterialData);
            setMaterials(prev => [{ id: docRef.id, ...newMaterialData } as PackagingMaterial, ...prev]);

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
    
    const handleScanSuccess = (code: string) => {
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
            if (newMaterialType === 'rollo_fardo') {
                netWeightInputRef.current?.focus();
            } else if (isSacosType) {
                 setTimeout(() => document.getElementById('material-presentation-trigger')?.focus(), 100);
            } else {
                 setTimeout(() => document.getElementById('material-presentation-trigger')?.focus(), 100);
            }
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
            await updateDoc(doc(db, 'packagingMaterials', id), updates);
            setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
            toast({ title: 'Material Actualizado', description: `Se guardaron los cambios para el material.` });
            setEditingMaterial(null);
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
            'Peso/Und (g)', 'Peso Total (kg)', 'Peso Neto (kg)', 'Peso Bruto (kg)', 'Peso Real (kg)'
        ];

        const rows = materials.map(m => {
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
                m.actualWeight || '',
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

    return (
        <>
            <div className="bg-background min-h-screen text-foreground">
                <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <Boxes className="h-8 w-8 text-primary" />
                        <h1 className="text-2xl font-bold text-foreground">Control de Materiales de Empaque</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/">
                            <Button variant="outline">
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Volver
                            </Button>
                        </Link>
                    </div>
                </header>

                <main className="p-4 md:p-8 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle>Registrar Nuevo Material</CardTitle>
                                <CardDescription>Añade una nueva paca de sacos o rollo que ha llegado al área de empaque desde la bodega.</CardDescription>
                            </div>
                             <Button variant="outline" onClick={() => setConfigOpen(true)}>
                                <Settings className="mr-2 h-4 w-4" />
                                Configuración
                            </Button>
                        </CardHeader>
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
                                    <div className="space-y-1.5">
                                        <Label htmlFor="material-presentation-trigger">Presentación</Label>
                                        <Input
                                            id="material-presentation-trigger"
                                            value={newMaterialPresentation}
                                            onChange={(e) => setNewMaterialPresentation(e.target.value)}
                                            placeholder="Ej: Azúcar San Juan 1kg"
                                            disabled={!newMaterialSupplier}
                                        />
                                    </div>
                                     <div className="space-y-1.5">
                                        <Label htmlFor="material-code">Código</Label>
                                        <div className="flex gap-2">
                                            <Input id="material-code" value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder="Escribir o escanear..." disabled={!newMaterialSupplier} />
                                            <Button variant="outline" size="icon" onClick={() => setIsScannerOpen(true)} disabled={!newMaterialSupplier}>
                                                <Camera className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-end gap-4 pt-4">
                                     {isPlasticsacks && (
                                        <div className="space-y-1.5">
                                            <Label htmlFor="material-lote">Lote</Label>
                                            <Input id="material-lote" value={newMaterialLote} onChange={(e) => setNewMaterialLote(e.target.value)} placeholder="Lote del proveedor" disabled={!newMaterialSupplier}/>
                                        </div>
                                    )}
                                    
                                    {isMilanplastic && (
                                        <div className="space-y-1.5">
                                            <Label>Fecha</Label>
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
                                                    <Input id="material-unit-weight-rs" type="number" ref={unitWeightInputRef} value={newMaterialUnitWeight} onChange={(e) => setNewMaterialUnitWeight(e.target.value)} placeholder="Ej: 103,2" disabled={!newMaterialSupplier}/>
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

                                    <div className="flex gap-2 lg:col-start-5">
                                        <Button onClick={handleAddMaterial} className="flex-1" disabled={!newMaterialSupplier}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Registrar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader>
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div>
                                    <CardTitle>Inventario en Área de Empaque</CardTitle>
                                    <CardDescription>Visualiza los materiales recibidos, en uso y consumidos.</CardDescription>
                                </div>
                                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
                                    <Input
                                        placeholder="Buscar por código, lote..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="sm:max-w-xs"
                                    />
                                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los Estados</SelectItem>
                                            <SelectItem value="recibido">Recibido</SelectItem>
                                            <SelectItem value="en_uso">En Uso</SelectItem>
                                            <SelectItem value="por_pesar_tara">Por Pesar Tara</SelectItem>
                                            <SelectItem value="consumido">Consumido</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                </div>
                                <div className="flex items-center gap-2">
                                     <Button variant="outline" onClick={handleExportCSV}>
                                        <FileDown className="mr-2 h-4 w-4" /> Exportar a CSV
                                    </Button>
                                    {selectedMaterials.size > 0 && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive">
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
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {filteredMaterials.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {filteredMaterials.map(material => (
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
                            ) : (
                                <div className="text-center py-12">
                                    <p className="font-semibold text-lg">No se encontraron materiales</p>
                                    <p className="text-muted-foreground mt-2">Intenta ajustar tus filtros o registrar un nuevo material.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
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

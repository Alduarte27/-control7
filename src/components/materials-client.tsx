
'use client';

import React from 'react';
import Link from 'next/link';
import { Boxes, ChevronLeft, PlusCircle, PackageCheck, Inbox, Play, Camera, AlertTriangle, Weight, HardHat, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, MaterialType, MaterialStatus, ProductDefinition, CategoryDefinition } from '@/lib/types';
import { materialTypeLabels } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Checkbox } from './ui/checkbox';


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
                            Estás a punto de marcar el material con código <span className="font-mono font-bold">{material.code}</span> como 'Consumido'. Esta acción no se puede deshacer fácilmente.
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
                    <DialogDescription>
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


function MaterialCard({ material, onActionClick, onSelectionChange, isSelected }: { material: PackagingMaterial, onActionClick: (material: PackagingMaterial, action: 'weigh' | 'consume') => void, onSelectionChange: (id: string, checked: boolean) => void, isSelected: boolean }) {
    const [formattedDates, setFormattedDates] = React.useState<{ received: string | null, inUse: string | null, consumed: string | null }>({
      received: null,
      inUse: null,
      consumed: null,
    });
    
    React.useEffect(() => {
        // This effect runs only on the client, preventing hydration mismatch
        setFormattedDates({
            received: material.receivedAt ? format(new Date(material.receivedAt), "PPP p", { locale: es }) : null,
            inUse: material.inUseAt ? format(new Date(material.inUseAt), "PPP p", { locale: es }) : null,
            consumed: material.consumedAt ? format(new Date(material.consumedAt), "PPP p", { locale: es }) : null,
        });
    }, [material]);

    const statusConfig: { [key in MaterialStatus]: { label: string; color: string; icon: React.ElementType } } = {
        recibido: { label: 'Recibido', color: 'bg-blue-500', icon: Inbox },
        en_uso: { label: 'En Uso', color: 'bg-yellow-500', icon: Play },
        consumido: { label: 'Consumido', color: 'bg-green-500', icon: PackageCheck },
    };

    const getShortCode = (fullCode: string): string => {
        if (!fullCode) return '';
        if (fullCode.length <= 4) {
            return String(parseInt(fullCode, 10));
        }
        const lastPart = fullCode.slice(-4);
        return String(parseInt(lastPart, 10));
    };

    const currentStatus = statusConfig[material.status];

    const getDiscrepancy = () => {
        if (material.status === 'recibido' || !material.actualWeight) return null;
        
        let baseWeight;
        if (material.type === 'sacos_granel') {
            baseWeight = material.totalWeight;
        } else {
            baseWeight = material.netWeight;
        }
        
        if (!baseWeight) return null;

        const diff = material.actualWeight - baseWeight;
        const diffPercentage = (diff / baseWeight) * 100;
        const color = diff >= 0 ? 'text-green-600' : 'text-red-600';

        return (
            <p className={cn("text-sm font-bold", color)}>
                {diff.toFixed(2)} kg ({diffPercentage.toFixed(1)}%)
            </p>
        );
    };

    const isGranel = material.type === 'sacos_granel';

    return (
        <Card className={cn("flex flex-col relative", isSelected && "ring-2 ring-primary")}>
            <div className="absolute top-2 right-2">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelectionChange(material.id, !!checked)}
                    aria-label={`Seleccionar material ${material.code}`}
                />
            </div>
            <CardHeader>
                 <div className="flex justify-between items-start">
                    <div>
                        <CardDescription>{material.presentation || materialTypeLabels[material.type]}</CardDescription>
                        <CardTitle className="text-4xl font-bold text-primary">
                            #{getShortCode(material.code)}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground font-mono">{material.code}</p>
                    </div>
                    <div className={cn("flex items-center gap-2 text-xs font-bold text-white px-2 py-1 rounded-full", currentStatus.color)}>
                        <currentStatus.icon className="h-3 w-3" />
                        <span>{currentStatus.label}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                 <div className="grid grid-cols-2 gap-4 text-sm">
                    {isGranel ? (
                        <>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Cantidad</p>
                                <p className="font-semibold text-lg">{material.quantity}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Peso/Und.</p>
                                <p className="font-semibold text-lg">{material.unitWeight} kg</p>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <p className="text-muted-foreground">Peso Total (Calculado)</p>
                                <p className="font-semibold text-lg">{material.totalWeight} kg</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Peso Neto (Etiqueta)</p>
                                <p className="font-semibold text-lg">{material.netWeight} kg</p>
                            </div>
                             <div className="space-y-1">
                                <p className="text-muted-foreground">Peso Bruto (Etiqueta)</p>
                                <p className="font-semibold text-lg">{material.grossWeight ? `${material.grossWeight} kg` : 'N/A'}</p>
                            </div>
                        </>
                    )}
                     <div className="space-y-1">
                        <p className="text-muted-foreground">Peso Real</p>
                        <p className="font-semibold text-lg text-primary">{material.actualWeight ? `${material.actualWeight} kg` : 'N/A'}</p>
                    </div>
                     <div className="space-y-1">
                        <p className="text-muted-foreground">Discrepancia</p>
                        {getDiscrepancy() || <p className="text-sm text-muted-foreground">Pendiente de pesar</p>}
                    </div>
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
                        <Button className="w-full" onClick={() => onActionClick(material, 'weigh')}>
                            <Weight className="mr-2 h-4 w-4" /> Pesar y Poner en Uso
                        </Button>
                    )}
                    {material.status === 'en_uso' && (
                        <Button className="w-full" variant="destructive" onClick={() => onActionClick(material, 'consume')}>
                            <PackageCheck className="mr-2 h-4 w-4" /> Marcar como Consumido
                        </Button>
                    )}
                </div>
            )}
        </Card>
    );
}

function ScannerModal({ isOpen, onClose, onScanSuccess }: { isOpen: boolean; onClose: () => void; onScanSuccess: (code: string) => void; }) {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const isScanningRef = React.useRef(false);

    React.useEffect(() => {
        let animationFrameId: number;
        let barcodeDetector: any;

        const setupScanner = async () => {
            if (!('BarcodeDetector' in window)) {
                setError("Tu navegador no es compatible con el escaneo de códigos de barras.");
                setHasPermission(false);
                return;
            }
            try {
                const supportedFormats = await (window as any).BarcodeDetector.getSupportedFormats();
                barcodeDetector = new (window as any).BarcodeDetector({ formats: supportedFormats });
            } catch (e) {
                 setError("No se pudo inicializar el detector de códigos de barras.");
                 setHasPermission(false);
            }
        };

        const tick = async () => {
            if (isScanningRef.current && videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && barcodeDetector) {
                try {
                    const barcodes = await barcodeDetector.detect(videoRef.current);
                    if (barcodes.length > 0) {
                        onScanSuccess(barcodes[0].rawValue);
                        return; // Stop scanning
                    }
                } catch (e) {
                    console.error("Error detecting barcode:", e);
                }
            }
            if (isScanningRef.current) {
                animationFrameId = requestAnimationFrame(tick);
            }
        };
        

        const startScan = async () => {
            isScanningRef.current = true;
            setError(null);
            setHasPermission(null);
            await setupScanner();

            if (!barcodeDetector) return;

            try {
                streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            } catch (err) {
                console.warn("Back camera not found or failed, trying any available camera...");
                try {
                    streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
                } catch (finalErr: any) {
                    console.error("Error accessing any camera:", finalErr);
                    setHasPermission(false);
                    if (finalErr.name === 'NotAllowedError') {
                        setError("Permiso de cámara denegado. Habilita el acceso en la configuración de tu navegador.");
                    } else {
                        setError("No se encontró una cámara compatible en este dispositivo.");
                    }
                    return;
                }
            }
            
            if (streamRef.current && videoRef.current) {
                videoRef.current.srcObject = streamRef.current;
                await videoRef.current.play();
                setHasPermission(true);
                animationFrameId = requestAnimationFrame(tick);
            } else if (!error) {
                setHasPermission(false);
                setError("No se pudo iniciar el stream de la cámara.");
            }
        };

        if (isOpen) {
            startScan();
        } else {
            isScanningRef.current = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if(animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        }
        
        return () => {
            isScanningRef.current = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
            if(animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Escanear Código</DialogTitle>
                </DialogHeader>
                <div className="relative aspect-video bg-black rounded-md overflow-hidden flex items-center justify-center">
                    {hasPermission === null && !error && <p className="text-white text-center p-4">Solicitando acceso a la cámara...</p>}
                    {error && (
                         <div className="flex flex-col items-center justify-center h-full p-4">
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Error de Cámara</AlertTitle>
                                <AlertDescription>
                                    {error}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                     <video ref={videoRef} playsInline className={cn("w-full h-full object-cover", hasPermission !== true && "hidden")} />
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function MaterialsClient({ 
    initialMaterials,
    allProducts,
    allCategories,
}: { 
    initialMaterials: PackagingMaterial[],
    allProducts: ProductDefinition[],
    allCategories: CategoryDefinition[],
}) {
    const [materials, setMaterials] = React.useState<PackagingMaterial[]>(initialMaterials);
    const [newMaterialType, setNewMaterialType] = React.useState<MaterialType>('sacos_familiar');
    const [newMaterialCode, setNewMaterialCode] = React.useState('');
    
    // States for common fields
    const [newMaterialPresentation, setNewMaterialPresentation] = React.useState('');
    
    // States for net/gross weight types
    const [newMaterialNetWeight, setNewMaterialNetWeight] = React.useState('');
    const [newMaterialGrossWeight, setNewMaterialGrossWeight] = React.useState('');

    // States for granel type
    const [newMaterialQuantity, setNewMaterialQuantity] = React.useState('');
    const [newMaterialUnitWeight, setNewMaterialUnitWeight] = React.useState('');

    const [selectedMaterials, setSelectedMaterials] = React.useState<Set<string>>(new Set());
    const { toast } = useToast();
    const [isScannerOpen, setIsScannerOpen] = React.useState(false);
    const netWeightInputRef = React.useRef<HTMLInputElement>(null);

    const [actionState, setActionState] = React.useState<{ material: PackagingMaterial; action: 'weigh' | 'consume' } | null>(null);

    const isSacoType = newMaterialType === 'sacos_familiar' || newMaterialType === 'sacos_granel';
    const isGranelType = newMaterialType === 'sacos_granel';

    const familiarCategoryId = React.useMemo(() => allCategories.find(c => c.name.toLowerCase() === 'familiar')?.id, [allCategories]);
    const granelCategoryId = React.useMemo(() => allCategories.find(c => c.name.toLowerCase() === 'granel')?.id, [allCategories]);

    const familiarProducts = React.useMemo(() => {
        if (!familiarCategoryId) return [];
        return allProducts.filter(p => p.categoryId === familiarCategoryId);
    }, [allProducts, familiarCategoryId]);

    const granelProducts = React.useMemo(() => {
        if (!granelCategoryId) return [];
        return allProducts.filter(p => p.categoryId === granelCategoryId);
    }, [allProducts, granelCategoryId]);

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

            let newMaterialData: Omit<PackagingMaterial, 'id'>;

            if (isGranelType) {
                 if (!newMaterialQuantity || !newMaterialUnitWeight) {
                    toast({ title: "Error", description: "La cantidad y el peso por unidad son obligatorios para Sacos de Granel.", variant: "destructive" });
                    return;
                }
                const quantity = parseInt(newMaterialQuantity, 10);
                const unitWeight = parseFloat(newMaterialUnitWeight);
                newMaterialData = {
                    type: newMaterialType,
                    code: trimmedCode,
                    presentation: newMaterialPresentation.trim(),
                    quantity,
                    unitWeight,
                    totalWeight: quantity * unitWeight,
                    status: 'recibido',
                    receivedAt: Date.now(),
                };
            } else {
                 if (!newMaterialNetWeight) {
                    toast({ title: "Error", description: "El peso neto es obligatorio para este tipo de material.", variant: "destructive" });
                    return;
                }
                newMaterialData = {
                    type: newMaterialType,
                    code: trimmedCode,
                    presentation: newMaterialPresentation.trim(),
                    netWeight: parseFloat(newMaterialNetWeight),
                    grossWeight: newMaterialGrossWeight ? parseFloat(newMaterialGrossWeight) : undefined,
                    status: 'recibido',
                    receivedAt: Date.now(),
                };
            }

            const docRef = await addDoc(collection(db, 'packagingMaterials'), newMaterialData);
            setMaterials(prev => [{ id: docRef.id, ...newMaterialData } as PackagingMaterial, ...prev]);

            // Reset all fields
            setNewMaterialCode('');
            setNewMaterialPresentation('');
            setNewMaterialNetWeight('');
            setNewMaterialGrossWeight('');
            setNewMaterialQuantity('');
            setNewMaterialUnitWeight('');
            
            toast({ title: 'Material Registrado', description: `Se ha registrado el material con código ${trimmedCode}.` });
        } catch (error) {
            console.error("Error adding material:", error);
            toast({ title: 'Error', description: 'No se pudo registrar el material.', variant: 'destructive' });
        }
    };
    
    const handleScanSuccess = (code: string) => {
        setIsScannerOpen(false);
        setNewMaterialCode(code);
        toast({
            title: "Código Escaneado",
            description: `Código detectado: ${code}`,
        });
        // Focus next logical input
        document.getElementById('material-presentation')?.focus();
    };

    const handleActionConfirm = async (data: { actualWeight?: number, assignedMachine?: string }) => {
        if (!actionState) return;

        const { material, action } = actionState;

        try {
            if (action === 'weigh') {
                const updateData = {
                    status: 'en_uso' as MaterialStatus,
                    actualWeight: data.actualWeight,
                    assignedMachine: data.assignedMachine,
                    inUseAt: Date.now(),
                };
                await updateDoc(doc(db, 'packagingMaterials', material.id), updateData);
                setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, ...updateData } : m));
                toast({ title: 'Material en Uso', description: `El material ${material.code} ahora está en uso.` });
            } else if (action === 'consume') {
                 const updateData = {
                    status: 'consumido' as MaterialStatus,
                    consumedAt: Date.now(),
                };
                await updateDoc(doc(db, 'packagingMaterials', material.id), updateData);
                setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, ...updateData } : m));
                toast({ title: 'Material Consumido', description: `El material ${material.code} se ha marcado como consumido.` });
            }
        } catch (error) {
            console.error(`Error updating material to ${action}:`, error);
            toast({ title: 'Error', description: 'No se pudo actualizar el estado del material.', variant: 'destructive' });
        }

        setActionState(null);
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

    return (
        <>
            <div className="bg-background min-h-screen text-foreground">
                <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <Boxes className="h-8 w-8 text-primary" />
                        <h1 className="text-2xl font-bold text-foreground">Control de Materiales de Empaque</h1>
                    </div>
                    <Link href="/">
                        <Button variant="outline">
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Volver a la Planificación
                        </Button>
                    </Link>
                </header>

                <main className="p-4 md:p-8 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Registrar Nuevo Material</CardTitle>
                            <CardDescription>Añade una nueva paca de sacos o rollo que ha llegado al área de empaque desde la bodega.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                <div className="space-y-1.5">
                                    <Label htmlFor="material-type">Tipo de Material</Label>
                                    <Select value={newMaterialType} onValueChange={(v) => setNewMaterialType(v as MaterialType)}>
                                        <SelectTrigger id="material-type"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(materialTypeLabels).map(([key, label]) => (
                                                <SelectItem key={key} value={key}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="material-code">Código</Label>
                                    <div className="flex gap-2">
                                        <Input id="material-code" value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder="Escanear o escribir..." />
                                        <Button variant="outline" size="icon" onClick={() => setIsScannerOpen(true)}>
                                            <Camera className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                 <div className="space-y-1.5">
                                    <Label htmlFor="material-presentation">Presentación</Label>
                                    {isSacoType ? (
                                        <Select value={newMaterialPresentation} onValueChange={setNewMaterialPresentation}>
                                            <SelectTrigger id="material-presentation">
                                                <SelectValue placeholder="Seleccionar producto..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(newMaterialType === 'sacos_familiar' ? familiarProducts : granelProducts).map(p => (
                                                    <SelectItem key={p.id} value={p.productName}>{p.productName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input id="material-presentation" value={newMaterialPresentation} onChange={(e) => setNewMaterialPresentation(e.target.value)} placeholder="Ej: Rollo Transparente 35cm" />
                                    )}
                                </div>

                                {isGranelType ? (
                                    <div className="grid grid-cols-3 gap-2 col-span-1 lg:col-span-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="material-quantity">Cantidad</Label>
                                            <Input id="material-quantity" type="number" value={newMaterialQuantity} onChange={(e) => setNewMaterialQuantity(e.target.value)} placeholder="Ej: 500" />
                                        </div>
                                         <div className="space-y-1.5">
                                            <Label htmlFor="material-unit-weight">Peso/Und (kg)</Label>
                                            <Input id="material-unit-weight" type="number" value={newMaterialUnitWeight} onChange={(e) => setNewMaterialUnitWeight(e.target.value)} placeholder="Ej: 1" />
                                        </div>
                                         <div className="space-y-1.5 self-end">
                                             <Button onClick={handleAddMaterial} className="w-full">
                                                <PlusCircle className="mr-2 h-4 w-4" /> Registrar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-2 col-span-1 lg:col-span-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="material-net-weight">Peso Neto (kg)</Label>
                                            <Input id="material-net-weight" ref={netWeightInputRef} type="number" value={newMaterialNetWeight} onChange={(e) => setNewMaterialNetWeight(e.target.value)} placeholder="Ej: 72.85" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="material-gross-weight">Peso Bruto (kg)</Label>
                                            <Input id="material-gross-weight" type="number" value={newMaterialGrossWeight} onChange={(e) => setNewMaterialGrossWeight(e.target.value)} placeholder="Ej: 74.05" />
                                        </div>
                                        <div className="space-y-1.5 self-end">
                                            <Button onClick={handleAddMaterial} className="w-full">
                                                <PlusCircle className="mr-2 h-4 w-4" /> Registrar
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Inventario en Área de Empaque</CardTitle>
                                    <CardDescription>Visualiza los materiales recibidos, en uso y consumidos.</CardDescription>
                                </div>
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
                        </CardHeader>
                        <CardContent>
                            {materials.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {materials.map(material => (
                                        <MaterialCard
                                            key={material.id}
                                            material={material}
                                            onActionClick={(mat, action) => setActionState({ material: mat, action })}
                                            onSelectionChange={handleSelectionChange}
                                            isSelected={selectedMaterials.has(material.id)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">No hay materiales registrados. Comienza añadiendo uno.</p>
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
                <MaterialActionDialog
                    material={actionState.material}
                    action={actionState.action}
                    onClose={() => setActionState(null)}
                    onConfirm={handleActionConfirm}
                />
            )}
        </>
    );
}

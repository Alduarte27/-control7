'use client';

import React from 'react';
import Link from 'next/link';
import { Boxes, ChevronLeft, PlusCircle, PackageCheck, Inbox, Play, Camera, AlertTriangle, Weight, HardHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, MaterialType, MaterialStatus } from '@/lib/types';
import { materialTypeLabels } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsQR from 'jsqr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';


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
                        <AlertDialogDescription>
                            Estás a punto de marcar el material con código <span className="font-mono font-bold">{material.code}</span> como 'Consumido'. Esta acción no se puede deshacer fácilmente.
                        </AlertDialogDescription>
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


function MaterialCard({ material, onActionClick }: { material: PackagingMaterial, onActionClick: (material: PackagingMaterial, action: 'weigh' | 'consume') => void }) {
    const statusConfig: { [key in MaterialStatus]: { label: string; color: string; icon: React.ElementType } } = {
        recibido: { label: 'Recibido', color: 'bg-blue-500', icon: Inbox },
        en_uso: { label: 'En Uso', color: 'bg-yellow-500', icon: Play },
        consumido: { label: 'Consumido', color: 'bg-green-500', icon: PackageCheck },
    };

    const currentStatus = statusConfig[material.status];

    const getDiscrepancy = () => {
        if (material.status === 'recibido' || !material.actualWeight) return null;
        const diff = material.actualWeight - material.labelWeight;
        const diffPercentage = (diff / material.labelWeight) * 100;
        const color = diff >= 0 ? 'text-green-600' : 'text-red-600';

        return (
            <p className={cn("text-sm font-bold", color)}>
                {diff.toFixed(2)} kg ({diffPercentage.toFixed(1)}%)
            </p>
        );
    };

    return (
        <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle className="text-lg">{materialTypeLabels[material.type]}</CardTitle>
                    <CardDescription>Código: <span className="font-mono">{material.code}</span></CardDescription>
                </div>
                <div className={cn("flex items-center gap-2 text-xs font-bold text-white px-2 py-1 rounded-full", currentStatus.color)}>
                    <currentStatus.icon className="h-3 w-3" />
                    <span>{currentStatus.label}</span>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Peso Etiqueta</p>
                        <p className="font-semibold text-lg">{material.labelWeight} kg</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground">Peso Real</p>
                        <p className="font-semibold text-lg text-primary">{material.actualWeight ? `${material.actualWeight} kg` : 'N/A'}</p>
                    </div>
                     <div className="col-span-2 space-y-1">
                        <p className="text-muted-foreground">Discrepancia</p>
                        {getDiscrepancy() || <p className="text-sm text-muted-foreground">Pendiente de pesar</p>}
                    </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
                    {material.assignedMachine && (
                        <p className="flex items-center gap-2 font-medium text-primary">
                            <HardHat className="h-3 w-3" />
                            <span>Asignado a: {material.assignedMachine.replace('_', ' ')}</span>
                        </p>
                    )}
                    <p>Recibido: {format(new Date(material.receivedAt), "PPP p", { locale: es })}</p>
                    {material.inUseAt && <p>En Uso desde: {format(new Date(material.inUseAt), "PPP p", { locale: es })}</p>}
                    {material.consumedAt && <p>Consumido: {format(new Date(material.consumedAt), "PPP p", { locale: es })}</p>}
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
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const [hasPermission, setHasPermission] = React.useState<boolean | null>(null);
    const [isScanning, setIsScanning] = React.useState(false);

    React.useEffect(() => {
        let animationFrameId: number;

        const tick = () => {
            if (isScanning && videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                const context = canvas.getContext('2d');
                
                if (context) {
                    canvas.height = video.videoHeight;
                    canvas.width = video.videoWidth;
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert",
                    });

                    if (code) {
                        onScanSuccess(code.data);
                        return; // Stop scanning
                    }
                }
            }
            if (isScanning) {
                animationFrameId = requestAnimationFrame(tick);
            }
        };

        if (isOpen) {
            setIsScanning(true);
            setHasPermission(null);

            const startScan = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        await videoRef.current.play();
                    }
                    setHasPermission(true);
                    animationFrameId = requestAnimationFrame(tick);
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    setHasPermission(false);
                    onClose(); // Close modal if permission is denied
                }
            };
            startScan();
        } else {
            setIsScanning(false);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        }
        

        return () => {
            setIsScanning(false);
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
                    <DialogTitle>Escanear Código de Barras</DialogTitle>
                </DialogHeader>
                <div className="relative aspect-video bg-black rounded-md overflow-hidden">
                    {hasPermission === null && <p className="text-white text-center p-4">Solicitando acceso a la cámara...</p>}
                    {hasPermission === false && (
                         <div className="flex flex-col items-center justify-center h-full text-white bg-destructive p-4">
                            <AlertTriangle className="h-8 w-8 mb-2" />
                            <p className="font-bold">Acceso a la cámara denegado</p>
                            <p className="text-sm text-center">Por favor, habilita los permisos de la cámara en tu navegador para usar esta función.</p>
                        </div>
                    )}
                     <video ref={videoRef} playsInline className={cn("w-full h-full object-cover", hasPermission !== true && "hidden")} />
                     <canvas ref={canvasRef} className="hidden" />
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

export default function MaterialsClient({ initialMaterials }: { initialMaterials: PackagingMaterial[] }) {
    const [materials, setMaterials] = React.useState<PackagingMaterial[]>(initialMaterials);
    const [newMaterialType, setNewMaterialType] = React.useState<MaterialType>('sacos');
    const [newMaterialCode, setNewMaterialCode] = React.useState('');
    const [newMaterialLabelWeight, setNewMaterialLabelWeight] = React.useState('');
    const { toast } = useToast();
    const [isScannerOpen, setIsScannerOpen] = React.useState(false);
    const weightInputRef = React.useRef<HTMLInputElement>(null);

    const [actionState, setActionState] = React.useState<{ material: PackagingMaterial; action: 'weigh' | 'consume' } | null>(null);


    const handleAddMaterial = async () => {
        if (!newMaterialCode.trim() || !newMaterialLabelWeight) {
            toast({ title: "Error", description: "El código y el peso de etiqueta son obligatorios.", variant: "destructive" });
            return;
        }

        const newMaterial: Omit<PackagingMaterial, 'id'> = {
            type: newMaterialType,
            code: newMaterialCode.trim(),
            labelWeight: parseFloat(newMaterialLabelWeight),
            status: 'recibido',
            receivedAt: Date.now(),
        };

        try {
            const docRef = await addDoc(collection(db, 'packagingMaterials'), newMaterial);
            setMaterials(prev => [{ id: docRef.id, ...newMaterial } as PackagingMaterial, ...prev]);

            setNewMaterialCode('');
            setNewMaterialLabelWeight('');
            toast({ title: 'Material Registrado', description: `Se ha registrado el material con código ${newMaterial.code}.` });
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
        weightInputRef.current?.focus();
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
                            <div className="flex flex-col md:flex-row items-end gap-4">
                                <div className="w-full md:w-auto md:flex-grow-[2] space-y-1.5">
                                    <Label htmlFor="material-type">Tipo de Material</Label>
                                    <Select value={newMaterialType} onValueChange={(v) => setNewMaterialType(v as MaterialType)}>
                                        <SelectTrigger id="material-type">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sacos">Paca de Sacos</SelectItem>
                                            <SelectItem value="rollo_envasado">Rollo de Envasado</SelectItem>
                                            <SelectItem value="rollo_enfardado">Rollo de Enfardado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-full md:w-auto md:flex-grow-[3] space-y-1.5">
                                    <Label htmlFor="material-code">Código de Rollo / Paca</Label>
                                    <div className="flex gap-2">
                                        <Input id="material-code" value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder="Ej: ROLLO-12345 o escanear" />
                                        <Button variant="outline" size="icon" onClick={() => setIsScannerOpen(true)}>
                                            <Camera className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="w-full md:w-auto md:flex-grow-[1] space-y-1.5">
                                    <Label htmlFor="material-label-weight">Peso Etiqueta (kg)</Label>
                                    <Input 
                                        id="material-label-weight" 
                                        ref={weightInputRef}
                                        type="number" 
                                        value={newMaterialLabelWeight} 
                                        onChange={(e) => setNewMaterialLabelWeight(e.target.value)} 
                                        placeholder="Ej: 35.6" 
                                    />
                                </div>
                                <Button onClick={handleAddMaterial} className="w-full md:w-auto">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Registrar Material
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader>
                            <CardTitle>Inventario en Área de Empaque</CardTitle>
                            <CardDescription>Visualiza los materiales recibidos, en uso y consumidos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {materials.length > 0 ? (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {materials.map(material => (
                                        <MaterialCard key={material.id} material={material} onActionClick={(mat, action) => setActionState({ material: mat, action })} />
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
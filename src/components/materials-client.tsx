'use client';

import React from 'react';
import Link from 'next/link';
import { Boxes, ChevronLeft, PlusCircle, PackageCheck, Inbox, Play, Camera, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, MaterialType, MaterialStatus } from '@/lib/types';
import { materialTypeLabels } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsQR from 'jsqr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';

function MaterialCard({ material }: { material: PackagingMaterial }) {
    const statusConfig: { [key in MaterialStatus]: { label: string; color: string; icon: React.ElementType } } = {
        recibido: { label: 'Recibido', color: 'bg-blue-500', icon: Inbox },
        en_uso: { label: 'En Uso', color: 'bg-yellow-500', icon: Play },
        consumido: { label: 'Consumido', color: 'bg-green-500', icon: PackageCheck },
    };

    const currentStatus = statusConfig[material.status];

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
                </div>
                 <div className="text-xs text-muted-foreground space-y-1">
                    <p>Recibido: {format(new Date(material.receivedAt), "PPP p", { locale: es })}</p>
                    {material.inUseAt && <p>En Uso desde: {format(new Date(material.inUseAt), "PPP p", { locale: es })}</p>}
                    {material.consumedAt && <p>Consumido: {format(new Date(material.consumedAt), "PPP p", { locale: es })}</p>}
                </div>
            </CardContent>
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
                    requestAnimationFrame(tick);
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
                requestAnimationFrame(tick);
            }
        };

        return () => {
            setIsScanning(false);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
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
                                        <MaterialCard key={material.id} material={material} />
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
        </>
    );
}
```
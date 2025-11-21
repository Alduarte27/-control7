'use client';

import React from 'react';
import Link from 'next/link';
import { Boxes, ChevronLeft, PlusCircle, Check, X, Weight, Inbox, Play, PackageCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, MaterialType, MaterialStatus } from '@/lib/types';
import { materialTypeLabels } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

export default function MaterialsClient({ initialMaterials }: { initialMaterials: PackagingMaterial[] }) {
    const [materials, setMaterials] = React.useState<PackagingMaterial[]>(initialMaterials);
    const [newMaterialType, setNewMaterialType] = React.useState<MaterialType>('sacos');
    const [newMaterialCode, setNewMaterialCode] = React.useState('');
    const [newMaterialLabelWeight, setNewMaterialLabelWeight] = React.useState('');
    const { toast } = useToast();

    // Ref for the weight input to focus after barcode scan
    const weightInputRef = React.useRef<HTMLInputElement>(null);

    // Barcode scanner listener effect
    React.useEffect(() => {
        let barcode = '';
        let lastKeyTime = Date.now();

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore events from input fields to allow manual typing
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const currentTime = Date.now();
            const timeDiff = currentTime - lastKeyTime;
            lastKeyTime = currentTime;

            if (timeDiff > 100) { // If time between keys is too long, reset buffer
                barcode = '';
            }

            if (e.key === 'Enter') {
                if (barcode.length > 3) { // Typical barcode length
                    setNewMaterialCode(barcode);
                    toast({
                        title: "Código Escaneado",
                        description: `Código detectado: ${barcode}`,
                    });
                    // Focus the next input field for faster workflow
                    weightInputRef.current?.focus();
                }
                barcode = ''; // Reset after Enter
            } else if (e.key.length === 1) { // Append character keys
                barcode += e.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [toast]);


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

    return (
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
                                <Input id="material-code" value={newMaterialCode} onChange={(e) => setNewMaterialCode(e.target.value)} placeholder="Ej: ROLLO-12345 o escanear código" />
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
    );
}

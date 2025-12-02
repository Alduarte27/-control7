
'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, onSnapshot, query, where, collection, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const generateAlaLocations = (ala: 'A' | 'B') => {
    const locations = [];
    for (let row = 1; row <= 11; row++) {
        for (let col = 1; col <= 4; col++) {
            locations.push(`${ala}${row}-${col}`);
        }
    }
    return locations;
};

const ALA_A_LOCATIONS = generateAlaLocations('A');
const ALA_B_LOCATIONS = generateAlaLocations('B');

interface BodegaMelazaClientProps {
    initialMaterials: PackagingMaterial[];
}

export default function BodegaMelazaClient({ initialMaterials }: BodegaMelazaClientProps) {
    const [materials, setMaterials] = React.useState(initialMaterials);
    const { toast } = useToast();

    React.useEffect(() => {
        const q = query(
            collection(db, "melazaSacks"),
            orderBy("receivedAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const updatedMaterials = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial))
              .filter(material => material.status === 'recibido');
            setMaterials(updatedMaterials);
        }, (error) => {
            console.error("Error fetching realtime materials for map:", error);
            toast({ title: "Error de Sincronización", description: "No se pudo actualizar el mapa en tiempo real.", variant: "destructive" });
        });

        return () => unsubscribe();
    }, [toast]);
    
    const handleDispatchLot = async (material: PackagingMaterial) => {
        try {
            const materialDocRef = doc(db, 'melazaSacks', material.id);
            await updateDoc(materialDocRef, {
                status: 'en_uso',
                inUseAt: Date.now(),
                assignedMachine: material.assignedMachine || 'Despachado de Bodega',
            });
            toast({
                title: "Lote Despachado",
                description: `El material ${material.presentation} ha sido marcado como 'En Uso' y la ubicación ha sido liberada.`
            });
        } catch (error) {
            console.error("Error dispatching lot:", error);
            toast({ title: "Error", description: "No se pudo despachar el lote.", variant: "destructive" });
        }
    }

    const renderAla = (ala: 'A' | 'B', locations: string[]) => {
        const rows = Array.from({ length: 11 }, (_, i) => i + 1);
        const cols = Array.from({ length: 4 }, (_, i) => i + 1);

        return (
            <Card className="flex-1">
                <CardHeader>
                    <CardTitle>ALA {ala}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <div className="flex flex-col gap-1">
                        {rows.map(rowNum => (
                            <div key={`row-${ala}-${rowNum}`} className="flex gap-1">
                                {cols.map(colNum => {
                                    const loc = `${ala}${rowNum}-${colNum}`;
                                    const material = materials.find(m => m.warehouseLocation === loc);
                                    const isOccupied = !!material;

                                    return (
                                        <TooltipProvider key={loc} delayDuration={300}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className={cn(
                                                        "h-8 w-full rounded-sm border flex items-center justify-center text-xs font-mono transition-colors",
                                                        isOccupied ? "bg-primary/10 border-primary/50 text-primary font-semibold" : "bg-muted/50 border-dashed"
                                                    )}>
                                                        {loc}
                                                    </div>
                                                </TooltipTrigger>
                                                {isOccupied && material && (
                                                    <TooltipContent className="max-w-xs">
                                                        <div className="space-y-2">
                                                            <p className="font-bold text-base">{material.presentation}</p>
                                                            <p><strong className="text-muted-foreground">Ubicación:</strong> {material.warehouseLocation}</p>
                                                            <p><strong className="text-muted-foreground">Sacos:</strong> {material.quantity?.toLocaleString()}</p>
                                                            <p><strong className="text-muted-foreground">Fecha Ingreso:</strong> {new Date(material.receivedAt).toLocaleDateString('es-ES')}</p>
                                                            <p><strong className="text-muted-foreground">Proveedor:</strong> {material.supplier}</p>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="destructive" size="sm" className="w-full mt-2">Despachar Lote</Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>¿Confirmar Despacho?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Estás a punto de despachar el lote de <strong>{material.presentation}</strong> de la ubicación <strong>{material.warehouseLocation}</strong>. Esta acción moverá el material a "En Uso" y liberará la ubicación.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDispatchLot(material)}>Sí, Despachar</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    };


    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <MapPin className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Mapa de Bodega - Melaza</h1>
                </div>
                <Link href="/material-melaza">
                    <Button variant="outline">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Volver a Material Melaza
                    </Button>
                </Link>
            </header>
            <main className="p-4 md:p-8 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Estado Actual de la Bodega</CardTitle>
                        <CardDescription>Visualiza la ocupación de las ubicaciones en tiempo real. Pasa el ratón sobre una celda ocupada para ver los detalles y despachar el lote.</CardDescription>
                    </CardHeader>
                </Card>
                 <div className="flex flex-col lg:flex-row gap-6">
                    {renderAla('A', ALA_A_LOCATIONS)}
                 </div>
                 <div className="flex flex-col lg:flex-row gap-6">
                    {renderAla('B', ALA_B_LOCATIONS)}
                </div>
            </main>
        </div>
    );
}


'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, Supplier } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, onSnapshot, query, collection, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

function AssignLotModal({
    location,
    onClose,
    onSave,
    unassignedMaterials
}: {
    location: string;
    onClose: () => void;
    onSave: (materialId: string, location: string, bins: number, sacksPerBin: number) => Promise<void>;
    unassignedMaterials: PackagingMaterial[];
}) {
    const [selectedMaterialId, setSelectedMaterialId] = React.useState<string>('');
    const [bins, setBins] = React.useState('4');
    const [sacksPerBin, setSacksPerBin] = React.useState('15');
    const selectedMaterial = unassignedMaterials.find(m => m.id === selectedMaterialId);

    const totalSacks = (parseInt(bins) || 0) * (parseInt(sacksPerBin) || 0);

    const handleSave = () => {
        if (!selectedMaterialId) {
            alert("Por favor, selecciona un material para asignar.");
            return;
        }
        onSave(selectedMaterialId, location, parseInt(bins) || 0, parseInt(sacksPerBin) || 0);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Asignar Material a Ubicación: {location}</DialogTitle>
                    <DialogDescription>Selecciona un material existente de la lista de 'recibidos' sin ubicación.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="material-select">Material a Asignar</Label>
                        <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                            <SelectTrigger id="material-select"><SelectValue placeholder="Seleccionar material..." /></SelectTrigger>
                            <SelectContent>
                                {unassignedMaterials.length > 0 ? (
                                    unassignedMaterials.map(m => (
                                        <SelectItem key={m.id} value={m.id}>
                                            {m.presentation} ({m.code}) - {m.supplier}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <div className="p-4 text-sm text-muted-foreground">No hay materiales sin asignar.</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedMaterial && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="bins">Cantidad de Bins (Máx. 4)</Label>
                                <Input id="bins" type="number" value={bins} onChange={e => setBins(e.target.value)} max="4" min="1" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sacksPerBin">Sacos por Bin</Label>
                                <Input id="sacksPerBin" type="number" value={sacksPerBin} onChange={e => setSacksPerBin(e.target.value)} />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <Label htmlFor="total-sacks">Total Sacos Asignados</Label>
                                <Input id="total-sacks" value={totalSacks} disabled />
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleSave} disabled={!selectedMaterialId}>Asignar a Ubicación</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface BodegaMelazaClientProps {
    initialMaterials: PackagingMaterial[];
    initialSuppliers: Supplier[];
}

export default function BodegaMelazaClient({ initialMaterials, initialSuppliers }: BodegaMelazaClientProps) {
    const [materials, setMaterials] = React.useState(initialMaterials);
    const { toast } = useToast();
    const [modalState, setModalState] = React.useState<{location: string, material?: PackagingMaterial | null} | null>(null);

    React.useEffect(() => {
        const q = query(collection(db, "melazaSacks"), orderBy("receivedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const updatedMaterials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial));
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
                warehouseLocation: '',
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
    
    const handleSaveLot = async (materialId: string, location: string, bins: number, sacksPerBin: number) => {
        try {
            const docRef = doc(db, 'melazaSacks', materialId);
            const totalSacks = bins * sacksPerBin;
            await updateDoc(docRef, {
                warehouseLocation: location,
                quantity: bins, 
                totalWeight: totalSacks,
            });
            toast({ title: "Material Asignado", description: `Se ha asignado el material a la ubicación ${location}.` });
            setModalState(null);
        } catch (error) {
            console.error("Error assigning material: ", error);
            toast({ title: 'Error', description: 'No se pudo asignar el material a la ubicación.', variant: 'destructive' });
        }
    };

    const assignedMaterials = materials.filter(m => m.warehouseLocation);
    const unassignedMaterials = materials.filter(m => m.status === 'recibido' && !m.warehouseLocation);

    const handleCellDoubleClick = (material?: PackagingMaterial) => {
        if (material) {
            // Future edit logic can go here
             toast({ title: "Función no implementada", description: "La edición con doble clic aún no está disponible."})
        }
    };

    const renderBlock = (block: 'A' | 'B') => {
        const ROWS = Array.from({ length: 11 }, (_, i) => i + 1);
        const COLS = block === 'A' ? [1, 2, 3, 4] : [4, 3, 2, 1];
        
        return (
            <div className="border rounded-lg p-4 bg-card">
                <h3 className="font-bold text-center text-lg mb-2">BLOQUE {block}</h3>
                <div className="grid grid-cols-5 gap-2 items-center">
                    <div></div>
                    {COLS.map(col => <div key={`header-${block}-${col}`} className="font-bold text-center text-muted-foreground">Col {col}</div>)}
                    
                    {ROWS.map(rowNum => (
                        <React.Fragment key={`row-${block}-${rowNum}`}>
                            <div className="font-bold text-center text-muted-foreground">Fila {rowNum}</div>
                            {COLS.map(colNum => {
                                const location = `${block}${rowNum}-${colNum}`;
                                const material = assignedMaterials.find(m => m.warehouseLocation === location);
                                
                                return (
                                    <div 
                                        key={location}
                                        className={cn(
                                            "aspect-[4/5] border rounded-md flex flex-col items-center justify-center text-center p-2 relative group",
                                            material ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700' : 'bg-muted/50 hover:bg-accent/50 cursor-pointer',
                                        )}
                                        onClick={() => !material && setModalState({ location })}
                                        onDoubleClick={() => handleCellDoubleClick(material)}
                                    >
                                        {material ? (
                                            <>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <button className="absolute top-1 right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <X size={12}/>
                                                        </button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>¿Despachar Lote?</AlertDialogTitle></AlertDialogHeader>
                                                        <AlertDialogDescription>Se marcará como 'En Uso' y se liberará la ubicación.</AlertDialogDescription>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDispatchLot(material)}>Despachar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <span className="font-bold text-2xl text-blue-800 dark:text-blue-200">{material.quantity || 0}</span>
                                                <span className="text-sm text-blue-700 dark:text-blue-300">{material.totalWeight || 0}</span>
                                            </>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">Vacío</span>
                                        )}
                                    </div>
                                )
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };


    return (
        <>
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">Mapa de Bodega - Melaza</h1>
                </div>
                <Link href="/material-melaza">
                    <Button variant="outline">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                </Link>
            </header>
            <main className="p-4 md:p-8 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Estado Actual de la Bodega</CardTitle>
                        <CardDescription>
                            Haz clic en una celda vacía para asignar un material. Haz doble clic en una ocupada para editar.
                        </CardDescription>
                    </CardHeader>
                </Card>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {renderBlock('A')}
                    {renderBlock('B')}
                </div>
            </main>
        </div>
        {modalState && !modalState.material && (
            <AssignLotModal 
                location={modalState.location}
                onClose={() => setModalState(null)}
                onSave={handleSaveLot}
                unassignedMaterials={unassignedMaterials}
            />
        )}
        </>
    );
}

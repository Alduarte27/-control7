
'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, MapPin, Edit, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, Supplier } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, onSnapshot, query, collection, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose, DialogDescription } from './ui/dialog';
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
            // Toast can be used here if you have a useToast hook
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
    const [suppliers] = React.useState(initialSuppliers);
    const { toast } = useToast();
    const [modalState, setModalState] = React.useState<{location: string, material?: PackagingMaterial | null} | null>(null);

    React.useEffect(() => {
        const q = query(collection(db, "melazaSacks"), orderBy("receivedAt", "desc"));
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
                warehouseLocation: '', // Free up the location
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
                quantity: bins, // Storing number of bins
                totalWeight: totalSacks, // Storing total sacks
            });
            toast({ title: "Material Asignado", description: `Se ha asignado el material a la ubicación ${location}.` });
            setModalState(null);
        } catch (error) {
            console.error("Error assigning material: ", error);
            toast({ title: 'Error', description: 'No se pudo asignar el material a la ubicación.', variant: 'destructive' });
        }
    };

    const assignedMaterials = materials.filter(m => m.warehouseLocation);
    const unassignedMaterials = materials.filter(m => !m.warehouseLocation);

    const renderCell = (location: string) => {
        const material = assignedMaterials.find(m => m.warehouseLocation === location);
        
        const handleCellClick = () => {
            if (!material) {
                setModalState({ location });
            }
        };

        const handleDoubleClick = () => {
             if (material) {
                 toast({ title: "Función no implementada", description: "La edición con doble clic aún no está disponible."})
             }
        }

        if (!material) {
            return (
                <div className="h-full p-2 border-b cursor-pointer hover:bg-accent/10" onClick={handleCellClick}>
                    <p className="text-sm text-muted-foreground">&nbsp;</p>
                </div>
            )
        }

        const CellContent = () => (
             <div className={cn("h-full p-2 border-b bg-yellow-100 border-yellow-200")}>
                <p className="font-mono text-xs font-bold text-yellow-800">{material.lote}</p>
                 <p className="text-xs text-yellow-700">{material.providerDate}</p>
                <div className="mt-2 text-right">
                    <p className="text-sm text-yellow-900">{material.quantity || 0} Bins</p>
                    <p className="font-bold text-yellow-900">{material.totalWeight || 0} Sacos</p>
                </div>
            </div>
        );

        return (
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                       <div className="h-full cursor-pointer hover:bg-accent/20" onDoubleClick={handleDoubleClick}>
                          <CellContent />
                       </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <div className="space-y-2">
                            <p className="font-bold text-base">{material.presentation}</p>
                            <p><strong className="text-muted-foreground">Proveedor:</strong> {material.supplier}</p>
                            <p><strong className="text-muted-foreground">Ubicación:</strong> {material.warehouseLocation}</p>
                            <p><strong className="text-muted-foreground">Lote:</strong> {material.lote || 'N/A'}</p>
                            <p><strong className="text-muted-foreground">Bins:</strong> {material.quantity?.toLocaleString()}</p>
                            <p><strong className="text-muted-foreground">Sacos:</strong> {material.totalWeight?.toLocaleString()}</p>
                            <p><strong className="text-muted-foreground">Fecha Ingreso:</strong> {new Date(material.receivedAt).toLocaleDateString('es-ES')}</p>
                            <div className="flex gap-2 pt-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" className="flex-1">Despachar Lote</Button>
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
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    };
    
    const ROWS = Array.from({ length: 11 }, (_, i) => i + 1);
    const COLS_A = Array.from({ length: 4 }, (_, i) => i + 1);
    const COLS_B = Array.from({ length: 4 }, (_, i) => i + 1).reverse();

    const getTotalsForRow = (row: number, block: 'A' | 'B') => {
        const cols = block === 'A' ? COLS_A : COLS_B;
        let totalBins = 0;
        let totalSacos = 0;
        cols.forEach(col => {
             const material = assignedMaterials.find(m => m.warehouseLocation === `${block}${row}-${col}`);
             if (material) {
                 totalBins += material.quantity || 0;
                 totalSacos += material.totalWeight || 0;
             }
        });
        return { totalBins, totalSacos };
    };


    return (
        <>
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
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
                        <CardDescription>
                            Haz clic en una celda vacía para asignar un material. Pasa el ratón para ver detalles y despachar.
                        </CardDescription>
                    </CardHeader>
                </Card>
                <div className="overflow-x-auto border rounded-lg">
                   <Table className="min-w-full table-fixed">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[80px] text-center font-bold">FILAS</TableHead>
                                <TableHead className="text-center p-2 font-bold" colSpan={5}>BLOQUE A</TableHead>
                                <TableHead className="text-center p-2 font-bold" colSpan={5}>BLOQUE B</TableHead>
                            </TableRow>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[80px] text-center"></TableHead>
                                {COLS_A.map(col => <TableHead key={`ha-${col}`} className="w-1/12 text-center border-x">{col}</TableHead>)}
                                <TableHead className="w-1/12 text-center border-r bg-accent/30 font-semibold">TOTAL</TableHead>
                                {COLS_B.map(col => <TableHead key={`hb-${col}`} className="w-1/12 text-center border-x">{col}</TableHead>)}
                                <TableHead className="w-1/12 text-center border-r bg-accent/30 font-semibold">TOTAL</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ROWS.map(rowNum => {
                                 const totalsA = getTotalsForRow(rowNum, 'A');
                                 const totalsB = getTotalsForRow(rowNum, 'B');
                                return (
                                    <TableRow key={`row-${rowNum}`}>
                                        <TableCell className="border-r font-bold text-center text-lg p-0 align-middle">
                                            <span>#{rowNum}</span>
                                        </TableCell>
                                        
                                        {COLS_A.map(colNum => (
                                            <TableCell key={`cell-A-${rowNum}-${colNum}`} className="p-0 align-top border-r">
                                               {renderCell(`A${rowNum}-${colNum}`)}
                                            </TableCell>
                                        ))}

                                        <TableCell className="p-2 border-r bg-green-50 align-middle">
                                             <div className="text-right">
                                                <p className="text-sm">{totalsA.totalBins}</p>
                                                <p className="font-bold">{totalsA.totalSacos}</p>
                                            </div>
                                        </TableCell>
                                        
                                        {COLS_B.map(colNum => (
                                            <TableCell key={`cell-B-${rowNum}-${colNum}`} className="p-0 align-top border-r">
                                                {renderCell(`B${rowNum}-${colNum}`)}
                                            </TableCell>
                                        ))}
                                        <TableCell className="p-2 border-r bg-green-50 align-middle">
                                            <div className="text-right">
                                                <p className="text-sm">{totalsB.totalBins}</p>
                                                <p className="font-bold">{totalsB.totalSacos}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                   </Table>
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


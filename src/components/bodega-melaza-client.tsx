
'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, MapPin, Edit, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial, Supplier } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, onSnapshot, query, collection, orderBy, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { getDayOfYear, format } from 'date-fns';

const ROWS = Array.from({ length: 11 }, (_, i) => i + 1);
const COLS_A = [1, 2, 3, 4];
const COLS_B = [4, 3, 2, 1];


function AssignLotModal({
    location,
    onClose,
    onSave,
    suppliers,
    products,
    materialToEdit,
}: {
    location: string;
    onClose: () => void;
    onSave: (data: Partial<PackagingMaterial>, id?: string) => Promise<void>;
    suppliers: Supplier[];
    products: any[]; // Simplified for this context
    materialToEdit?: PackagingMaterial | null;
}) {
    const [supplier, setSupplier] = React.useState(materialToEdit?.supplier || '');
    const [presentation, setPresentation] = React.useState(materialToEdit?.presentation || '');
    const [bins, setBins] = React.useState(materialToEdit?.quantity ? String(materialToEdit.quantity) : '4');
    const [sacksPerBin, setSacksPerBin] = React.useState('15');
    const [lote, setLote] = React.useState(materialToEdit?.lote || String(getDayOfYear(new Date())));
    const [elaborationDate, setElaborationDate] = React.useState(materialToEdit?.providerDate || format(new Date(), 'yyyy-MM-dd'));

    const totalSacks = (parseInt(bins) || 0) * (parseInt(sacksPerBin) || 0);

    const handleSave = () => {
        const data: Partial<PackagingMaterial> = {
            warehouseLocation: location,
            supplier,
            presentation,
            lote,
            providerDate: elaborationDate,
            quantity: parseInt(bins) || 0, // Storing number of bins here
            totalWeight: totalSacks, // Storing total sacks here
            status: 'recibido',
            receivedAt: materialToEdit?.receivedAt || Date.now(),
            type: 'sacos_melaza',
            code: materialToEdit?.code || `${location}-${Date.now()}` // Generate a unique code
        };
        onSave(data, materialToEdit?.id);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{materialToEdit ? 'Editar' : 'Asignar'} Lote en Ubicación: {location}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                            <Label htmlFor="supplier">Proveedor</Label>
                            <Select value={supplier} onValueChange={setSupplier}>
                                <SelectTrigger id="supplier"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="presentation">Producto Envasado</Label>
                            <Input id="presentation" value={presentation} onChange={e => setPresentation(e.target.value)} placeholder="Ej: Melaza 50kg" />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="bins">Cantidad de Bins (Máx. 4)</Label>
                            <Input id="bins" type="number" value={bins} onChange={e => setBins(e.target.value)} max="4" min="1" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="sacksPerBin">Sacos por Bin</Label>
                            <Input id="sacksPerBin" type="number" value={sacksPerBin} onChange={e => setSacksPerBin(e.target.value)} />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="total-sacks">Total Sacos</Label>
                            <Input id="total-sacks" value={totalSacks} disabled />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="elaboration-date">Fecha de Elaboración</Label>
                            <Input id="elaboration-date" type="date" value={elaborationDate} onChange={e => setElaborationDate(e.target.value)} />
                        </div>
                         <div className="space-y-1.5 col-span-2">
                            <Label htmlFor="lote">Lote (Día del Año)</Label>
                            <Input id="lote" value={lote} onChange={e => setLote(e.target.value)} />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                    <Button onClick={handleSave}>Guardar Lote</Button>
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
    
    const handleSaveLot = async (data: Partial<PackagingMaterial>, id?: string) => {
        try {
            if (id) { // Editing existing lot
                const docRef = doc(db, 'melazaSacks', id);
                await updateDoc(docRef, data);
                toast({ title: "Lote Actualizado", description: `Se guardaron los cambios para el lote en ${data.warehouseLocation}.` });
            } else { // Creating new lot
                await addDoc(collection(db, 'melazaSacks'), data);
                toast({ title: "Lote Asignado", description: `Se ha asignado un nuevo lote a la ubicación ${data.warehouseLocation}.` });
            }
            setModalState(null);
        } catch (error) {
            console.error("Error saving lot: ", error);
            toast({ title: 'Error', description: 'No se pudo guardar la información del lote.', variant: 'destructive' });
        }
    };

    const renderCell = (location: string) => {
        const material = materials.find(m => m.warehouseLocation === location);
        
        const handleCellClick = () => {
            setModalState({ location, material });
        };

        if (!material) {
            return (
                <div className="h-full p-2 border-b cursor-pointer hover:bg-accent/10" onClick={handleCellClick}>
                    <p className="text-sm text-muted-foreground">&nbsp;</p>
                    <p className="text-sm text-muted-foreground">&nbsp;</p>
                </div>
            )
        }

        const CellContent = () => (
             <div className={cn("h-full p-2 border-b bg-yellow-100 border-yellow-200")}>
                {material.lote && (
                    <p className="font-mono text-xs font-bold text-yellow-800">{material.lote}</p>
                )}
                 {material.providerDate && (
                    <p className="text-xs text-yellow-700">{material.providerDate}</p>
                )}
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
                       <div className="h-full cursor-pointer hover:bg-accent/20" onClick={handleCellClick}>
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
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => setModalState({ location, material })}>
                                    <Edit className="h-3 w-3 mr-1"/> Editar Lote
                                </Button>
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
    
    const getTotalsForRow = (row: number, block: 'A' | 'B') => {
        const cols = block === 'A' ? COLS_A : COLS_B;
        let totalBins = 0;
        let totalSacos = 0;
        cols.forEach(col => {
             const material = materials.find(m => m.warehouseLocation === `${block}${row}-${col}`);
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
                        <CardDescription>Haz clic en una celda vacía para asignar un nuevo lote, o en una celda ocupada para editar o despachar el lote existente.</CardDescription>
                    </CardHeader>
                </Card>
                <div className="overflow-x-auto border rounded-lg">
                   <Table className="min-w-full table-fixed">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[80px] text-center font-bold" rowSpan={2}>FILAS</TableHead>
                                <TableHead className="text-center p-2 font-bold" colSpan={5}>BLOQUE A</TableHead>
                                <TableHead className="text-center p-2 font-bold" colSpan={5}>BLOQUE B</TableHead>
                            </TableRow>
                            <TableRow className="bg-muted/50">
                                {COLS_A.map(col => <TableHead key={`ha-${col}`} className="w-1/12 text-center border-x">{col}</TableHead>)}
                                <TableHead className="w-1/12 text-center border-r bg-accent/30 font-semibold">TOTAL</TableHead>
                                <TableHead className="w-1/12 text-center border-r bg-accent/30 font-semibold">TOTAL</TableHead>
                                {COLS_B.map(col => <TableHead key={`hb-${col}`} className="w-1/12 text-center border-r">{col}</TableHead>)}
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
                                        
                                        <TableCell className="p-2 border-r bg-green-50 align-middle">
                                            <div className="text-right">
                                                <p className="text-sm">{totalsB.totalBins}</p>
                                                <p className="font-bold">{totalsB.totalSacos}</p>
                                            </div>
                                        </TableCell>

                                         {[4, 3, 2, 1].map(colNum => (
                                            <TableCell key={`cell-B-${rowNum}-${colNum}`} className="p-0 align-top border-r">
                                                {renderCell(`B${rowNum}-${colNum}`)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                   </Table>
                </div>
            </main>
        </div>
        {modalState && (
            <AssignLotModal 
                location={modalState.location}
                onClose={() => setModalState(null)}
                onSave={handleSaveLot}
                suppliers={suppliers}
                products={[]} // Products list is not used for melaza sacks directly
                materialToEdit={modalState.material}
            />
        )}
        </>
    );
}



'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { PackagingMaterial } from '@/lib/types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, onSnapshot, query, collection, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const ROWS = Array.from({ length: 11 }, (_, i) => i + 1);
const COLS_A = [1, 2, 3];
const COLS_B = [4, 3, 2, 1];


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

    const renderCell = (location: string) => {
        const material = materials.find(m => m.warehouseLocation === location);

        if (!material) {
            return (
                <div className="h-full p-2 border-b">
                    <p className="text-sm text-muted-foreground">&nbsp;</p>
                    <p className="text-sm text-muted-foreground">&nbsp;</p>
                </div>
            )
        }

        const CellContent = () => (
            <div className={cn("h-full p-2 border-b", material.code && "bg-yellow-100/50")}>
                {material.code && (
                    <p className="font-mono text-xs font-bold text-yellow-800">{material.code}</p>
                )}
                 {material.providerDate && (
                    <p className="text-xs text-yellow-700">{material.providerDate}</p>
                )}
                <div className="mt-2 text-right">
                    <p className="text-sm">{material.quantity || 0}</p>
                    <p className="font-bold">{material.totalWeight || 0}</p>
                </div>
            </div>
        );

        return (
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                       <div className="h-full cursor-pointer hover:bg-accent">
                          <CellContent />
                       </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                        <div className="space-y-2">
                            <p className="font-bold text-base">{material.presentation}</p>
                            <p><strong className="text-muted-foreground">Ubicación:</strong> {material.warehouseLocation}</p>
                            <p><strong className="text-muted-foreground">Lote:</strong> {material.code || 'N/A'}</p>
                            <p><strong className="text-muted-foreground">Bins:</strong> {material.quantity?.toLocaleString()}</p>
                            <p><strong className="text-muted-foreground">Sacos:</strong> {material.totalWeight?.toLocaleString()}</p>
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
                        <CardDescription>Visualiza la ocupación de las ubicaciones en tiempo real. Pasa el ratón sobre una celda ocupada para ver los detalles y despachar el lote.</CardDescription>
                    </CardHeader>
                </Card>
                <div className="overflow-x-auto border rounded-lg">
                   <Table className="min-w-full table-fixed">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[100px] text-center border-r" rowSpan={2}>FILAS</TableHead>
                                <TableHead className="text-center" colSpan={4}>BLOQUE A</TableHead>
                                <TableHead className="text-center" colSpan={5}>BLOQUE B</TableHead>
                            </TableRow>
                             <TableRow className="bg-muted/50">
                                <TableHead className="w-1/12 text-center border-x">1</TableHead>
                                <TableHead className="w-1/12 text-center border-r">2</TableHead>
                                <TableHead className="w-1/12 text-center border-r">3</TableHead>
                                <TableHead className="w-1/12 text-center border-r bg-accent/30">TOTAL</TableHead>

                                <TableHead className="w-1/12 text-center border-r bg-accent/30">TOTAL</TableHead>
                                <TableHead className="w-1/12 text-center border-r">4</TableHead>
                                <TableHead className="w-1/12 text-center border-r">3</TableHead>
                                <TableHead className="w-1/12 text-center border-r">2</TableHead>
                                <TableHead className="w-1/12 text-center border-r">1</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ROWS.map(rowNum => {
                                 const totalsA = getTotalsForRow(rowNum, 'A');
                                 const totalsB = getTotalsForRow(rowNum, 'B');
                                return (
                                    <TableRow key={`row-${rowNum}`}>
                                        <TableCell className="border-r font-bold text-center text-lg p-2 align-top">
                                            <div className="h-full flex items-start justify-between">
                                                <span>#{rowNum}</span>
                                                <div className="text-xs text-left font-normal text-muted-foreground mt-1 space-y-2">
                                                    <p>LOTE:</p>
                                                    <p>FECHA ELAB:</p>
                                                    <p>BINS:</p>
                                                    <p>SACOS:</p>
                                                </div>
                                            </div>
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
    );
}

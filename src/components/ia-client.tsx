'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, PackageCheck, ArrowRight, AlertTriangle, Upload, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProductDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/kpi-card';
import { Separator } from '@/components/ui/separator';
import { Pie, Cell, ResponsiveContainer, PieChart, Tooltip as RechartsTooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const KG_PER_QUINTAL = 45.3592;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

type MachineState = {
    id: number;
    productId: string;
    speed: number;
    loss: number;
    unitsPerSack: number;
    imageUrl: string | null;
};

function MachineEditDialog({
    machine,
    products,
    open,
    onOpenChange,
    onSave,
}: {
    machine: MachineState;
    products: ProductDefinition[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (updatedMachine: MachineState) => void;
}) {
    const [editedMachine, setEditedMachine] = React.useState(machine);

    React.useEffect(() => {
        setEditedMachine(machine);
    }, [machine]);

    const handleFieldChange = (field: keyof MachineState, value: any) => {
        const newMachine = { ...editedMachine, [field]: value };
        if (field === 'productId') {
            const product = products.find(p => p.id === value);
            newMachine.unitsPerSack = product?.unitsPerSack || 1;
        }
        setEditedMachine(newMachine);
    };

    const handleImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            handleFieldChange('imageUrl', reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const fileInputId = `modal-image-upload-${machine.id}`;
    
    const handleSaveChanges = () => {
        onSave(editedMachine);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Máquina {machine.id}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-4">
                     <div className="space-y-2">
                        <Label>Previsualización de la Imagen</Label>
                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                            <Image 
                                src={editedMachine.imageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"} 
                                alt={`Máquina ${editedMachine.id}`}
                                width={600}
                                height={400}
                                className="object-contain w-full h-full"
                            />
                        </div>
                        <input
                            type="file"
                            id={fileInputId}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => e.target.files && handleImageUpload(e.target.files[0])}
                        />
                        <Button variant="outline" size="sm" className="w-full" onClick={() => document.getElementById(fileInputId)?.click()}>
                            <Upload className="mr-2 h-3 w-3" />
                            Cambiar Foto
                        </Button>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor={`product-${machine.id}`}>Producto</Label>
                        <Select value={editedMachine.productId} onValueChange={(val) => handleFieldChange('productId', val)}>
                            <SelectTrigger id={`product-${machine.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="inactive">-- Inactiva --</SelectItem>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor={`speed-${machine.id}`}>Velocidad (fundas/min)</Label>
                            <Input id={`speed-${machine.id}`} type="number" value={editedMachine.speed} onChange={e => handleFieldChange('speed', Number(e.target.value))}/>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor={`loss-${machine.id}`}>Merma (%)</Label>
                            <Input id={`loss-${machine.id}`} type="number" value={editedMachine.loss} onChange={e => handleFieldChange('loss', Number(e.target.value))}/>
                        </div>
                    </div>
                     <div className="space-y-1.5">
                        <Label htmlFor={`units-${machine.id}`}>Unidades por Saco</Label>
                        <Input id={`units-${machine.id}`} type="number" value={editedMachine.unitsPerSack} onChange={e => handleFieldChange('unitsPerSack', Number(e.target.value))}/>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSaveChanges}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function OperationsClient({ 
  prefetchedProducts,
}: { 
  prefetchedProducts: ProductDefinition[],
}) {
    const [isClient, setIsClient] = React.useState(false);
    const products = React.useMemo(() => prefetchedProducts.filter(p => p.isActive), [prefetchedProducts]);
    const [editingMachine, setEditingMachine] = React.useState<MachineState | null>(null);
    
    // Etapa 1: Materia Prima
    const [tachosQQ, setTachosQQ] = React.useState(0);
    const [familiarQQ, setFamiliarQQ] = React.useState(0);
    const [granelQQ, setGranelQQ] = React.useState(700);

    const totalQuintales = tachosQQ + familiarQQ + granelQQ;
    const siloAmount = totalQuintales * KG_PER_QUINTAL;

    // Etapa 2: Envasadoras
    const [machines, setMachines] = React.useState<MachineState[]>(() => {
        const firstProduct = prefetchedProducts.find(p => p.isActive);
        return [
            { id: 1, productId: firstProduct?.id || 'inactive', speed: 40, loss: 2, unitsPerSack: firstProduct?.unitsPerSack || 1, imageUrl: null },
            { id: 2, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null },
            { id: 3, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null },
            { id: 4, productId: 'inactive', speed: 40, loss: 2, unitsPerSack: 1, imageUrl: null },
        ];
    });

    // Etapa 3: Enfardadora
    const [wrapperScenario, setWrapperScenario] = React.useState<'single' | 'dual'>('single');
    const [sacksPerBundle, setSacksPerBundle] = React.useState(12);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const handleSaveMachine = (updatedMachine: MachineState) => {
        setMachines(prev => prev.map(m => m.id === updatedMachine.id ? updatedMachine : m));
    };

    // Lógica del Simulador de Línea Completa
    const simulationResults = React.useMemo(() => {
        const calculateProduction = (machineList: MachineState[]) => {
            const packingCapacity = machineList.map(machine => {
                const product = products.find(p => p.id === machine.productId);
                if (!product) return { machineId: machine.id, sacksPerHour: 0, kgPerHour: 0, productName: 'N/A' };
                
                const effectiveSacksPerMinute = machine.speed * (1 - machine.loss / 100);
                const sacksPerHour = effectiveSacksPerMinute * 60;
                
                return {
                    machineId: machine.id,
                    sacksPerHour: sacksPerHour,
                    kgPerHour: sacksPerHour * (product.sackWeight || 50),
                    productName: product.productName,
                };
            });

            const totalSacksPerHourFromPackers = packingCapacity.reduce((sum, m) => sum + m.sacksPerHour, 0);
            const totalKgPerHourFromPackers = packingCapacity.reduce((sum, m) => sum + m.kgPerHour, 0);

            let fardosPerMin = 0;
            if (machineList.length === 1) fardosPerMin = 4;
            if (machineList.length > 1) fardosPerMin = 6;
            
            const wrapperSacksPerHour = fardosPerMin * sacksPerBundle * 60;
            const isWrapperBottleneck = totalSacksPerHourFromPackers > wrapperSacksPerHour;
            const effectiveSacksPerHour = Math.min(totalSacksPerHourFromPackers, wrapperSacksPerHour);

            let effectiveKgPerHour = 0;
            if (effectiveSacksPerHour > 0 && totalSacksPerHourFromPackers > 0) {
                const reductionFactor = isWrapperBottleneck ? wrapperSacksPerHour / totalSacksPerHourFromPackers : 1;
                effectiveKgPerHour = totalKgPerHourFromPackers * reductionFactor;
            }
            
            return { packingCapacity, isWrapperBottleneck, effectiveSacksPerHour, effectiveKgPerHour, totalSacksPerHourFromPackers, totalKgPerHourFromPackers, wrapperSacksPerHour };
        };
        
        if (wrapperScenario === 'single') {
            const activeMachines = machines.filter(m => m.productId !== 'inactive');
            const { packingCapacity, isWrapperBottleneck, effectiveSacksPerHour, effectiveKgPerHour, totalSacksPerHourFromPackers, totalKgPerHourFromPackers, wrapperSacksPerHour } = calculateProduction(activeMachines);
            
            const bottleneckDescription = `La enfardadora (cap: ${wrapperSacksPerHour.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos/hr) limita a las envasadoras (cap: ${totalSacksPerHourFromPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos/hr).`;
            const noBottleneckDescription = `Las envasadoras (cap: ${totalSacksPerHourFromPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos/hr) operan dentro de la capacidad de la enfardadora (${wrapperSacksPerHour.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos/hr).`;

            const timeToEmptyHours = effectiveKgPerHour > 0 ? siloAmount / effectiveKgPerHour : 0;
            const totalSacksProduced = effectiveSacksPerHour * timeToEmptyHours;
            
            const machineContribution = packingCapacity.map(m => ({ 
                name: `Máq. ${m.machineId} (${m.productName})`, 
                value: isNaN(m.sacksPerHour / totalSacksPerHourFromPackers * totalSacksProduced) ? 0 : (m.sacksPerHour / totalSacksPerHourFromPackers * totalSacksProduced) 
            }));

            return {
                timeToEmptyHours,
                totalSacksProduced,
                isWrapperBottleneck,
                bottleneckDescription,
                noBottleneckDescription,
                machineProduction: packingCapacity.map(m => {
                    const totalKgProduced = effectiveKgPerHour * timeToEmptyHours;
                    const machineKgShare = totalKgPerHourFromPackers > 0 ? m.kgPerHour / totalKgPerHourFromPackers : 0;
                    return {
                        id: m.machineId,
                        productName: m.productName,
                        sacks: (totalSacksPerHourFromPackers > 0 ? m.sacksPerHour / totalSacksPerHourFromPackers : 0) * totalSacksProduced,
                        weight: machineKgShare * totalKgProduced,
                    }
                }),
                machineContribution,
                totalSacksPerHourFromAllPackers: totalSacksPerHourFromPackers,
                effectiveWrapperSacksPerHour: wrapperSacksPerHour,
            };

        } else { // dual wrapper scenario
            const machinesForWrapper1 = machines.filter(m => m.id <= 2 && m.productId !== 'inactive');
            const machinesForWrapper2 = machines.filter(m => m.id > 2 && m.productId !== 'inactive');
            
            const result1 = calculateProduction(machinesForWrapper1);
            const result2 = calculateProduction(machinesForWrapper2);
            
            const isOverallBottleneck = result1.isWrapperBottleneck || result2.isWrapperBottleneck;
            let bottleneckDescription = `Línea 1: ${result1.isWrapperBottleneck ? 'Cuello de botella.' : 'OK.'} Línea 2: ${result2.isWrapperBottleneck ? 'Cuello de botella.' : 'OK.'}`;
            if (!result1.isWrapperBottleneck && !result2.isWrapperBottleneck) {
                bottleneckDescription = "Ambas líneas operan de forma eficiente sin cuellos de botella en las enfardadoras.";
            }

            const totalEffectiveKgPerHour = result1.effectiveKgPerHour + result2.effectiveKgPerHour;
            const timeToEmptyHours = totalEffectiveKgPerHour > 0 ? siloAmount / totalEffectiveKgPerHour : 0;
            
            const sacksFromLine1 = result1.effectiveSacksPerHour * timeToEmptyHours;
            const sacksFromLine2 = result2.effectiveSacksPerHour * timeToEmptyHours;
            const totalSacksProduced = sacksFromLine1 + sacksFromLine2;
            
            const combinedMachineProd = [
                ...result1.packingCapacity.map(m => {
                    const lineShare = (result1.totalSacksPerHourFromPackers > 0 ? m.sacksPerHour / result1.totalSacksPerHourFromPackers : 0);
                    return { id: m.machineId, productName: m.productName, sacks: lineShare * sacksFromLine1 || 0, weight: lineShare * (result1.effectiveKgPerHour * timeToEmptyHours) || 0 }
                }),
                ...result2.packingCapacity.map(m => {
                    const lineShare = (result2.totalSacksPerHourFromPackers > 0 ? m.sacksPerHour / result2.totalSacksPerHourFromPackers : 0);
                    return { id: m.machineId, productName: m.productName, sacks: lineShare * sacksFromLine2 || 0, weight: lineShare * (result2.effectiveKgPerHour * timeToEmptyHours) || 0 }
                })
            ];
             const machineContribution = combinedMachineProd.map(m => ({
                name: `Máq. ${m.id} (${m.productName})`, value: isNaN(m.sacks) ? 0 : m.sacks
             }));

            return {
                timeToEmptyHours,
                totalSacksProduced,
                isWrapperBottleneck: isOverallBottleneck,
                bottleneckDescription,
                noBottleneckDescription: bottleneckDescription, // Use the same for simplicity
                machineProduction: combinedMachineProd.filter(m => m.sacks > 0),
                machineContribution,
                totalSacksPerHourFromAllPackers: result1.totalSacksPerHourFromPackers + result2.totalSacksPerHourFromPackers,
                effectiveWrapperSacksPerHour: result1.wrapperSacksPerHour + result2.wrapperSacksPerHour,
            }
        }
    }, [siloAmount, machines, products, wrapperScenario, sacksPerBundle]);
    
    const formatTime = (hours: number) => {
        if (!isFinite(hours) || hours <= 0) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };
    
  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Panel de Operaciones</h1>
        </div>
        <Link href="/"><Button variant="outline"><ChevronLeft className="mr-2 h-4 w-4" />Volver a la Planificación</Button></Link>
      </header>
      
      <main className="p-4 md:p-8 space-y-8">
        {!isClient ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-muted-foreground">Cargando panel de operaciones...</p>
          </div>
        ) : (
        <>
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-center mb-4">Flujo del Proceso de Producción</h3>
                <div className="flex justify-around items-center p-4 border rounded-lg bg-muted/30">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <Warehouse className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Silo</h4>
                                    <p className="text-sm text-muted-foreground">{totalQuintales.toLocaleString()} QQ</p>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Materia prima total disponible para la producción.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />
                    
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <div className={cn("flex flex-col items-center gap-2 text-center p-2 rounded-md", simulationResults.isWrapperBottleneck && 'bg-destructive/10')}>
                                    <Package className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Envasadoras</h4>
                                    <p className={cn("text-sm", simulationResults.isWrapperBottleneck ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                                        {simulationResults.totalSacksPerHourFromAllPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos/hr
                                    </p>
                                </div>
                            </TooltipTrigger>
                             <TooltipContent>
                                <p>Capacidad total de las envasadoras activas.</p>
                                {simulationResults.isWrapperBottleneck && <p className="text-destructive font-semibold">¡Limitadas por la enfardadora!</p>}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    
                    <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />
                    
                    <TooltipProvider>
                         <Tooltip>
                            <TooltipTrigger>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <PackageCheck className="h-10 w-10 text-primary" />
                                    <h4 className="font-semibold">Enfardadora</h4>
                                    <p className={cn("text-sm", simulationResults.isWrapperBottleneck ? 'text-destructive font-bold' : 'text-muted-foreground')}>
                                        {simulationResults.effectiveWrapperSacksPerHour.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos/hr
                                    </p>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Capacidad de la línea de empaque final.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
            
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">1. Materia Prima</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-1.5">
                            <Label htmlFor="tachos-qq">Tachos (QQ)</Label>
                            <Input id="tachos-qq" type="number" value={tachosQQ} onChange={e => setTachosQQ(Number(e.target.value))} min="0" />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="familiar-qq">Silo Familiar (QQ)</Label>
                            <Input id="familiar-qq" type="number" value={familiarQQ} onChange={e => setFamiliarQQ(Number(e.target.value))} min="0" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="granel-qq">Silo a Granel (QQ)</Label>
                            <Input id="granel-qq" type="number" value={granelQQ} onChange={e => setGranelQQ(Number(e.target.value))} min="0" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Total en Silo</Label>
                            <p className="text-2xl font-bold text-primary p-1 border rounded-md text-center">{totalQuintales.toLocaleString()} QQ</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">2. Configuración de Línea de Empaque</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <h3 className="font-semibold text-lg">Parámetros de las Envasadoras</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {machines.map((machine) => {
                                const product = products.find(p => p.id === machine.productId);
                                const unitsPerHourNeto = (machine.speed * 60) * (1 - machine.loss / 100);
                                const sacksPerHourNeto = (machine.unitsPerSack > 0) ? (unitsPerHourNeto / machine.unitsPerSack) : 0;
                                
                                return (
                                    <div key={machine.id} className="p-3 border rounded-lg space-y-3 bg-background relative">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold text-primary">Máquina {machine.id}</Label>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingMachine(machine)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        
                                        <div className="aspect-video bg-white border rounded-md flex items-center justify-center overflow-hidden">
                                            <Image 
                                                src={machine.imageUrl || "https://placehold.co/600x400/e2e8f0/e2e8f0"} 
                                                alt={`Máquina ${machine.id}`}
                                                width={600}
                                                height={400}
                                                className="object-contain w-full h-full"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground">Producto</p>
                                            <p className="font-semibold truncate" title={product?.productName || 'Inactiva'}>
                                                {product?.productName || 'Inactiva'}
                                            </p>
                                        </div>

                                        {machine.productId !== 'inactive' && (
                                          <>
                                            <div className="space-y-2 rounded-lg bg-muted/30 p-2 border text-xs">
                                                <h3 className="font-semibold text-center text-muted-foreground">Configuración Clave</h3>
                                                <div className="grid grid-cols-3 gap-1 text-center">
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Velocidad</p>
                                                        <p className="font-bold text-sm">{machine.speed} <span className="text-xs font-normal">f/min</span></p>
                                                    </div>
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Merma</p>
                                                        <p className="font-bold text-sm">{machine.loss}%</p>
                                                    </div>
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Unidades</p>
                                                        <p className="font-bold text-sm">{machine.unitsPerSack}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2 rounded-lg bg-muted/30 p-2 border text-xs">
                                                <h3 className="font-semibold text-center text-muted-foreground">Indicadores de Rendimiento</h3>
                                                <div className="grid grid-cols-2 gap-2 text-center">
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Unid/Hora (Neto)</p>
                                                        <p className="font-bold text-sm">{unitsPerHourNeto.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                                    </div>
                                                    <div className="bg-background p-1 rounded-md border">
                                                        <p className="text-muted-foreground">Sacos/Hora (Neto)</p>
                                                        <p className="font-bold text-sm text-green-600">{sacksPerHourNeto.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                                                    </div>
                                                </div>
                                            </div>
                                          </>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        
                        <Separator />
                        
                        <div>
                            <h3 className="font-semibold text-lg mb-4">Parámetros de Empaque</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="sacks-per-bundle">Sacos por Paquete (Fardo)</Label>
                                    <Input id="sacks-per-bundle" type="number" value={sacksPerBundle} onChange={e => setSacksPerBundle(Number(e.target.value))}/>
                                </div>
                                <div className="space-y-1.5 md:col-span-1">
                                    <Label>Escenario de Enfardado</Label>
                                    <Select value={wrapperScenario} onValueChange={(val: 'single' | 'dual') => setWrapperScenario(val)}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">1 Enfardadora Central</SelectItem>
                                            <SelectItem value="dual">2 Líneas Paralelas (Máq. 1-2 y 3-4)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-xs text-muted-foreground md:col-span-2">Nota: La velocidad de la enfardadora se ajusta automáticamente. Con 1 envasadora activa, usa 4 fardos/min. Con 2 o más, usa 6 fardos/min.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <div className="space-y-6">
                    <h3 className="font-semibold text-xl text-center">Resultados Globales de la Línea</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KpiCard title="Tiempo para Agotar Silo" value={formatTime(simulationResults.timeToEmptyHours)} icon={Factory} description="Tiempo total estimado para procesar toda la materia prima." />
                        <KpiCard title="Producción Total (Sacos)" value={simulationResults.totalSacksProduced} icon={Package} description="Cantidad total de sacos que se producirán." fractionDigits={0} />
                        <KpiCard title="Producción Total (QQ)" value={simulationResults.machineProduction.reduce((sum, p) => sum + p.weight, 0) / KG_PER_QUINTAL} icon={Warehouse} description={`Basado en la cantidad del silo (${totalQuintales.toLocaleString()} QQ).`} fractionDigits={1}/>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">Análisis de Cuello de Botella</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-sm p-3 rounded-md flex items-start gap-3", simulationResults.isWrapperBottleneck ? 'bg-destructive/10 text-destructive' : 'bg-green-600/10 text-green-700')}>
                                <AlertTriangle className="h-5 w-5 mt-0.5" />
                                <div>
                                    <h4 className="font-bold mb-1">{simulationResults.isWrapperBottleneck ? "¡Cuello de Botella Detectado!" : "Operación Eficiente"}</h4>
                                    <p>{simulationResults.isWrapperBottleneck ? simulationResults.bottleneckDescription : simulationResults.noBottleneckDescription}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">Contribución por Máquina</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {simulationResults.machineContribution.every(m => m.value === 0) ? (
                                <p className="text-center text-muted-foreground h-[200px] flex items-center justify-center">Activa una máquina para ver la contribución.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie data={simulationResults.machineContribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                            {simulationResults.machineContribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `${value.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
            {editingMachine && (
                <MachineEditDialog
                    open={!!editingMachine}
                    onOpenChange={(isOpen) => !isOpen && setEditingMachine(null)}
                    machine={editingMachine}
                    products={products}
                    onSave={handleSaveMachine}
                />
            )}
        </>
        )}
      </main>
    </div>
  );
}

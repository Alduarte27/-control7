'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, ArrowRight, AlertTriangle, CheckCircle2, SlidersHorizontal, PackageCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProductDefinition, CategoryDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/kpi-card';
import { Separator } from '@/components/ui/separator';

const KG_PER_QUINTAL = 50;

export default function OperationsClient({ 
  prefetchedProducts,
}: { 
  prefetchedProducts: ProductDefinition[],
  prefetchedCategories: CategoryDefinition[]
}) {
    const [isClient, setIsClient] = React.useState(false);
    const products = React.useMemo(() => prefetchedProducts.filter(p => p.isActive), [prefetchedProducts]);

    // STATE
    const [siloAmount, setSiloAmount] = React.useState(25000);
    const [machines, setMachines] = React.useState([
        { id: 1, productId: products[0]?.id || 'inactive', speed: 2000, loss: 2 },
        { id: 2, productId: 'inactive', speed: 2000, loss: 2 },
        { id: 3, productId: 'inactive', speed: 2000, loss: 2 },
        { id: 4, productId: 'inactive', speed: 2000, loss: 2 },
    ]);
    const [wrapperSpeed, setWrapperSpeed] = React.useState(8000);
    const [sacksPerBundle, setSacksPerBundle] = React.useState(1);

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const handleMachineChange = (id: number, field: string, value: any) => {
        setMachines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const simulationResults = React.useMemo(() => {
        const activeMachines = machines.filter(m => m.productId !== 'inactive');
        
        // 1. Calculate total packing capacity
        const packingCapacity = activeMachines.map(machine => {
            const product = products.find(p => p.id === machine.productId);
            if (!product) return { machineId: machine.id, sacksPerHour: 0, kgPerHour: 0 };
            const effectiveSpeed = machine.speed * (1 - machine.loss / 100);
            return {
                machineId: machine.id,
                sacksPerHour: effectiveSpeed,
                kgPerHour: effectiveSpeed * (product.sackWeight || 50),
            };
        });

        const totalSacksPerHourFromPackers = packingCapacity.reduce((sum, m) => sum + m.sacksPerHour, 0);
        const totalKgPerHourFromPackers = packingCapacity.reduce((sum, m) => sum + m.kgPerHour, 0);

        // 2. Calculate wrapping capacity in sacks per hour
        const wrapperSacksPerHour = wrapperSpeed * sacksPerBundle;

        // 3. Determine the bottleneck
        const isWrapperBottleneck = totalSacksPerHourFromPackers > wrapperSacksPerHour;
        const effectiveSacksPerHour = Math.min(totalSacksPerHourFromPackers, wrapperSacksPerHour);
        
        let effectiveKgPerHour = 0;
        if (effectiveSacksPerHour > 0) {
            if (isWrapperBottleneck) {
                 // If wrapper is bottleneck, kg/hr is proportional to the reduced sack rate
                 const reductionFactor = wrapperSacksPerHour / totalSacksPerHourFromPackers;
                 effectiveKgPerHour = totalKgPerHourFromPackers * reductionFactor;
            } else {
                effectiveKgPerHour = totalKgPerHourFromPackers;
            }
        }

        // 4. Final calculations
        const timeToEmptyHours = effectiveKgPerHour > 0 ? siloAmount / effectiveKgPerHour : 0;
        const totalSacksProduced = effectiveSacksPerHour * timeToEmptyHours;
        const totalQuintales = (totalSacksProduced * KG_PER_QUINTAL) / KG_PER_QUINTAL;


        return {
            timeToEmptyHours,
            totalSacksProduced,
            totalQuintales,
            isWrapperBottleneck,
            packingSacksPerHour: totalSacksPerHourFromPackers,
            wrapperSacksPerHour,
        };
    }, [siloAmount, machines, products, wrapperSpeed, sacksPerBundle]);
    
    const formatTime = (hours: number) => {
        if (!isFinite(hours) || hours <= 0) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    if (!isClient) {
        return (
            <div className="flex justify-center items-center h-full">
                <p>Cargando simulador...</p>
            </div>
        );
    }

  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Panel de Operaciones</h1>
        </div>
        <Link href="/"><Button variant="outline"><ChevronLeft className="mr-2" />Volver</Button></Link>
      </header>
      
      <main className="p-4 md:p-8 space-y-8">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <SlidersHorizontal className="h-6 w-6 text-primary" />
                    Simulador de Línea de Empaque
                </CardTitle>
                <CardDescription>
                    Modela tu línea de producción desde el silo hasta la enfardadora. Ajusta los valores para ver el impacto en tiempo real e identificar cuellos de botella.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Visual Flow */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_2fr_auto_1fr] items-center gap-6 p-4 border rounded-lg bg-muted/20">
                    {/* 1. Silo */}
                    <div className="flex flex-col items-center gap-2 text-center">
                        <Warehouse className="h-12 w-12 text-primary" />
                        <h3 className="font-semibold">Silo</h3>
                        <p className="text-xs text-muted-foreground">{siloAmount.toLocaleString()} Kg</p>
                    </div>

                    <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />

                    {/* 2. Packers */}
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {machines.map(m => (
                            <div key={m.id} className="flex flex-col items-center gap-2 text-center p-2 border rounded-md bg-background w-24">
                                <Package className="h-8 w-8 text-primary" />
                                <p className="text-xs font-semibold">Máq. {m.id}</p>
                                <p className="text-xs text-muted-foreground truncate w-full">{m.productId === 'inactive' ? 'Inactiva' : products.find(p=>p.id === m.productId)?.productName}</p>
                            </div>
                        ))}
                    </div>
                    
                    <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />

                    {/* 3. Wrapper */}
                    <div className="flex flex-col items-center gap-2 text-center">
                        <PackageCheck className="h-12 w-12 text-primary" />
                        <h3 className="font-semibold">Enfardadora</h3>
                        <p className="text-xs text-muted-foreground">{simulationResults.wrapperSacksPerHour.toLocaleString()} sacos/hr</p>
                    </div>
                </div>

                <Separator />
                
                {/* Inputs */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="font-semibold text-lg">Parámetros de las Envasadoras</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {machines.map((machine) => (
                                <div key={machine.id} className="p-4 border rounded-lg space-y-3 bg-muted/50">
                                    <Label className="font-bold">Máquina {machine.id}</Label>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`product-${machine.id}`} className="text-xs">Producto</Label>
                                        <Select value={machine.productId} onValueChange={(val) => handleMachineChange(machine.id, 'productId', val)}>
                                            <SelectTrigger id={`product-${machine.id}`}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="inactive">-- Inactiva --</SelectItem>
                                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={`speed-${machine.id}`} className="text-xs">Velocidad (sacos/hr)</Label>
                                        <Input id={`speed-${machine.id}`} type="number" value={machine.speed} onChange={e => handleMachineChange(machine.id, 'speed', Number(e.target.value))}/>
                                    </div>
                                     <div className="space-y-1.5">
                                        <Label htmlFor={`loss-${machine.id}`} className="text-xs">Merma (%)</Label>
                                        <Input id={`loss-${machine.id}`} type="number" value={machine.loss} onChange={e => handleMachineChange(machine.id, 'loss', Number(e.target.value))}/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="space-y-4">
                        <h3 className="font-semibold text-lg">Materia Prima y Empaque</h3>
                        <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                            <div className="space-y-1.5">
                                <Label htmlFor="silo-amount">Cantidad en Silo (Kg)</Label>
                                <Input id="silo-amount" type="number" value={siloAmount} onChange={e => setSiloAmount(Number(e.target.value))}/>
                            </div>
                            <Separator />
                            <div className="space-y-1.5">
                                <Label htmlFor="wrapper-speed">Velocidad Enfardadora (paquetes/hr)</Label>
                                <Input id="wrapper-speed" type="number" value={wrapperSpeed} onChange={e => setWrapperSpeed(Number(e.target.value))}/>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="sacks-per-bundle">Sacos por Paquete</Label>
                                <Input id="sacks-per-bundle" type="number" value={sacksPerBundle} onChange={e => setSacksPerBundle(Number(e.target.value))}/>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />
                
                {/* Results */}
                <div className="space-y-6">
                    <h3 className="font-semibold text-lg text-center">Resultados de la Simulación</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <KpiCard title="Tiempo para Agotar Silo" value={formatTime(simulationResults.timeToEmptyHours)} icon={Factory} description="Tiempo total estimado para procesar toda la materia prima." />
                         <KpiCard title="Producción Total (Sacos)" value={simulationResults.totalSacksProduced.toLocaleString(undefined, {maximumFractionDigits: 0})} icon={Package} description="Cantidad total de sacos que se producirán." />
                         <KpiCard title="Producción Total (QQ)" value={simulationResults.totalQuintales.toLocaleString(undefined, {maximumFractionDigits: 1})} icon={Warehouse} description="Cantidad total de quintales que se producirán." />
                    </div>
                    <Card className={simulationResults.isWrapperBottleneck ? 'border-destructive' : 'border-green-500'}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                {simulationResults.isWrapperBottleneck ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                Análisis de Cuello de Botella
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {simulationResults.isWrapperBottleneck ? (
                                <p>
                                    La <span className="font-bold">Enfardadora</span> es el cuello de botella. Su capacidad es de <span className="font-bold">{simulationResults.wrapperSacksPerHour.toLocaleString()} sacos/hr</span>, pero las envasadoras activas podrían producir a <span className="font-bold">{simulationResults.packingSacksPerHour.toLocaleString()} sacos/hr</span>. La producción está limitada por la enfardadora.
                                </p>
                            ) : (
                                <p>
                                    Las <span className="font-bold">Envasadoras</span> son el factor limitante. Su capacidad combinada es de <span className="font-bold">{simulationResults.packingSacksPerHour.toLocaleString()} sacos/hr</span>, lo cual está dentro de la capacidad de la enfardadora de <span className="font-bold">{simulationResults.wrapperSacksPerHour.toLocaleString()} sacos/hr</span>. La línea está balanceada o limitada por la velocidad de envasado.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, Settings, Clock, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProductDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/kpi-card';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const KG_PER_QUINTAL = 50;

type MachineState = {
    productId: string;
    speed: number; // sacks per hour
    loss: number; // percentage
};

const initialMachineState: MachineState = { productId: 'inactive', speed: 0, loss: 0 };

export default function OperationsClient({ 
  prefetchedProducts 
}: { 
  prefetchedProducts: ProductDefinition[]
}) {
    const products = React.useMemo(() => prefetchedProducts.filter(p => p.isActive), [prefetchedProducts]);
    const [isClient, setIsClient] = React.useState(false);
    
    const [siloAmount, setSiloAmount] = React.useState(25000); // Default 25 Ton
    const [machines, setMachines] = React.useState<MachineState[]>([
        { productId: products[0]?.id || 'inactive', speed: 2000, loss: 0 },
        { ...initialMachineState },
        { ...initialMachineState },
        { ...initialMachineState },
    ]);
    
    const [balerScenario, setBalerScenario] = React.useState('scenario1');
    const [baler1Capacity, setBaler1Capacity] = React.useState(4000); // sacks per hour
    const [baler2Capacity, setBaler2Capacity] = React.useState(4000); // sacks per hour

    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const handleMachineChange = (index: number, field: keyof MachineState, value: any) => {
        const newMachines = [...machines];
        const numValue = Number(value);
        newMachines[index] = { ...newMachines[index], [field]: field === 'productId' ? value : (isNaN(numValue) ? 0 : numValue) };
        setMachines(newMachines);
    };
    
    const simulationResults = React.useMemo(() => {
        const activeMachines = machines.map((machine, index) => {
            if (machine.productId === 'inactive' || !machine.productId) return null;
            
            const product = products.find(p => p.id === machine.productId);
            if (!product || machine.speed <= 0) return null;

            const sackWeight = product.sackWeight || 50;
            const effectiveSpeedSacks = machine.speed * (1 - machine.loss / 100);
            const kgPerHour = effectiveSpeedSacks * sackWeight;

            return {
                index,
                ...machine,
                product,
                sackWeight,
                effectiveSpeedSacks,
                kgPerHour
            };
        }).filter(Boolean) as (MachineState & { index: number; product: ProductDefinition; sackWeight: number; effectiveSpeedSacks: number; kgPerHour: number; })[];
        
        if (siloAmount <= 0 || activeMachines.length === 0) {
            return { timeToEmptyHours: 0, productionPerMachine: [], totalSacks: 0, totalQuintales: 0, bottleneck: 'No hay producción activa.' };
        }

        const totalKgPerHour = activeMachines.reduce((sum, m) => sum + m.kgPerHour, 0);
        const timeToEmptyHours = totalKgPerHour > 0 ? siloAmount / totalKgPerHour : 0;
        
        let bottleneck = 'OK';
        let totalSacksPerHourFromEnvasadoras = activeMachines.reduce((sum, m) => sum + m.effectiveSpeedSacks, 0);

        if (balerScenario === 'scenario1') {
            if (totalSacksPerHourFromEnvasadoras > baler1Capacity) {
                bottleneck = `Enfardadora 1. Capacidad: ${baler1Capacity.toLocaleString()} sacos/hr. Carga: ${totalSacksPerHourFromEnvasadoras.toLocaleString()} sacos/hr.`;
            }
        } else {
            const line1Machines = activeMachines.filter(m => m.index < 2);
            const line2Machines = activeMachines.filter(m => m.index >= 2);
            const line1Load = line1Machines.reduce((sum, m) => sum + m.effectiveSpeedSacks, 0);
            const line2Load = line2Machines.reduce((sum, m) => sum + m.effectiveSpeedSacks, 0);

            if (line1Load > baler1Capacity) bottleneck = `Enfardadora 1. Carga: ${line1Load.toLocaleString()} > Capacidad: ${baler1Capacity.toLocaleString()}`;
            else if (line2Load > baler2Capacity) bottleneck = `Enfardadora 2. Carga: ${line2Load.toLocaleString()} > Capacidad: ${baler2Capacity.toLocaleString()}`;
        }
        
        const productionPerMachine = activeMachines.map(m => {
            const totalSacks = m.effectiveSpeedSacks * timeToEmptyHours;
            const totalKg = m.kgPerHour * timeToEmptyHours;
            return {
                productName: m.product.productName,
                sacks: totalSacks,
                quintales: totalKg / KG_PER_QUINTAL
            };
        });
        
        const totalSacks = productionPerMachine.reduce((sum, p) => sum + p.sacks, 0);
        const totalQuintales = productionPerMachine.reduce((sum, p) => sum + p.quintales, 0);

        return { timeToEmptyHours, productionPerMachine, totalSacks, totalQuintales, bottleneck };

    }, [siloAmount, machines, products, balerScenario, baler1Capacity, baler2Capacity]);

    const formatTime = (hours: number) => {
        if (hours <= 0) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Planificador de Línea de Empaque</h1>
        </div>
        <Link href="/"><Button variant="outline"><ChevronLeft className="mr-2" />Volver</Button></Link>
      </header>
      
      <main className="p-4 md:p-8 space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Simulador de Línea de Empaque</CardTitle>
                <CardDescription>
                    Modela tu proceso desde el silo hasta la enfardadora. Ajusta los valores para ver los resultados en tiempo real y detectar cuellos de botella.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Visual Representation */}
                <div className="flex flex-col md:flex-row items-center justify-around gap-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <Warehouse className="h-12 w-12 text-primary" />
                        <h3 className="font-semibold">Silo</h3>
                        {isClient ? <p className="text-xs text-muted-foreground">{siloAmount.toLocaleString()} Kg</p> : <p className="text-xs text-muted-foreground">...</p>}
                    </div>
                    <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {machines.map((m, i) => (
                           m.productId && m.productId !== 'inactive' && m.speed > 0 && <Package key={i} className="h-10 w-10 text-green-600" />
                        ))}
                        <p className="w-full text-center text-xs font-semibold">Envasadoras</p>
                    </div>
                     <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />
                     <div className="flex flex-col items-center gap-2 text-center">
                        <Settings className="h-12 w-12 text-primary" />
                        <h3 className="font-semibold">Enfardadora(s)</h3>
                        <p className="text-xs text-muted-foreground">{balerScenario === 'scenario1' ? '1 Enfardadora' : '2 Enfardadoras'}</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* INPUTS */}
                    <div className="space-y-6">
                        {/* Silo Input */}
                        <div className="p-4 border rounded-lg">
                            <Label htmlFor="silo-amount" className="font-semibold text-lg flex items-center gap-2"><Warehouse className="text-primary"/>Silo de Materia Prima</Label>
                            <Input id="silo-amount" type="number" value={siloAmount} onChange={e => setSiloAmount(Number(e.target.value) || 0)} className="mt-2" placeholder="Kg de materia prima"/>
                        </div>

                        {/* Machines Input */}
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg flex items-center gap-2"><Package className="text-primary"/>Envasadoras</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {machines.map((machine, index) => (
                                    <div key={index} className="space-y-2 p-3 bg-muted/30 rounded-md border">
                                        <Label className="font-semibold">Máquina {index + 1}</Label>
                                        <Select value={machine.productId} onValueChange={(val) => handleMachineChange(index, 'productId', val)}>
                                            <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="inactive">-- Inactiva --</SelectItem>
                                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <Label htmlFor={`speed-${index}`} className="text-xs">Velocidad (sacos/hr)</Label>
                                                <Input id={`speed-${index}`} type="number" value={machine.speed} onChange={e => handleMachineChange(index, 'speed', e.target.value)} />
                                            </div>
                                            <div>
                                                <Label htmlFor={`loss-${index}`} className="text-xs">Merma (%)</Label>
                                                <Input id={`loss-${index}`} type="number" value={machine.loss} onChange={e => handleMachineChange(index, 'loss', e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                         {/* Baler Input */}
                        <div className="space-y-4 p-4 border rounded-lg">
                            <h3 className="font-semibold text-lg flex items-center gap-2"><Settings className="text-primary"/>Enfardadoras</h3>
                             <RadioGroup defaultValue="scenario1" value={balerScenario} onValueChange={setBalerScenario}>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="scenario1" id="sc1" />
                                        <Label htmlFor="sc1" className="font-normal">Escenario 1: 1 Enfardadora Central</Label>
                                    </div>
                                     <Input type="number" value={baler1Capacity} onChange={e => setBaler1Capacity(Number(e.target.value) || 0)} placeholder="Capacidad Enfardadora 1 (sacos/hr)" className="h-8 text-sm ml-6 w-auto"/>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="scenario2" id="sc2" />
                                        <Label htmlFor="sc2" className="font-normal">Escenario 2: 2 Líneas Paralelas</Label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 ml-6">
                                        <Input type="number" value={baler1Capacity} onChange={e => setBaler1Capacity(Number(e.target.value) || 0)} placeholder="Capacidad L1 (sacos/hr)" className="h-8 text-sm"/>
                                        <Input type="number" value={baler2Capacity} onChange={e => setBaler2Capacity(Number(e.target.value) || 0)} placeholder="Capacidad L2 (sacos/hr)" className="h-8 text-sm"/>
                                    </div>
                                    <p className="text-xs text-muted-foreground ml-6">Línea 1: Máquinas 1-2. Línea 2: Máquinas 3-4.</p>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    {/* OUTPUTS */}
                    <div className="space-y-6">
                         <Card>
                             <CardHeader>
                                 <CardTitle>Resultados de la Simulación</CardTitle>
                             </CardHeader>
                             <CardContent className="space-y-4">
                                {isClient ? (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <KpiCard title="Tiempo para Vaciar Silo" value={formatTime(simulationResults.timeToEmptyHours)} icon={Clock} description="Tiempo estimado para consumir toda la materia prima." />
                                            <KpiCard title="Producción Total (Sacos)" value={Math.floor(simulationResults.totalSacks).toLocaleString()} icon={Package} description="Total de sacos producidos por todas las máquinas." />
                                            <KpiCard title="Producción Total (QQ)" value={simulationResults.totalQuintales.toLocaleString(undefined, {maximumFractionDigits: 1})} icon={Factory} description="Total de quintales producidos." />
                                            <KpiCard 
                                              title="Cuello de Botella" 
                                              value={simulationResults.bottleneck === 'OK' ? 'OK' : 'Detectado'}
                                              icon={simulationResults.bottleneck === 'OK' ? CheckCircle2 : AlertTriangle}
                                              valueColor={simulationResults.bottleneck === 'OK' ? 'text-green-600' : 'text-destructive'}
                                              description={simulationResults.bottleneck === 'OK' ? 'La capacidad de las enfardadoras es suficiente.' : `La capacidad de la enfardadora es superada: ${simulationResults.bottleneck}`}
                                            />
                                        </div>
                                        <Separator />
                                        <div>
                                            <h4 className="font-semibold mb-2">Desglose de Producción</h4>
                                            <div className="space-y-2">
                                                {simulationResults.productionPerMachine.length > 0 ? simulationResults.productionPerMachine.map((p, i) => (
                                                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded-md">
                                                        <span className="font-medium">{p.productName}</span>
                                                        <div className="text-right">
                                                            <p>{p.sacks.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos</p>
                                                            <p className="text-xs text-muted-foreground">{p.quintales.toLocaleString(undefined, {maximumFractionDigits: 1})} QQ</p>
                                                        </div>
                                                    </div>
                                                )) : <p className="text-sm text-center text-muted-foreground py-4">No hay producción para mostrar.</p>}
                                            </div>
                                        </div>
                                    </>
                                 ) : (
                                    <p className="text-center text-muted-foreground py-8">Calculando resultados...</p>
                                 )}
                             </CardContent>
                         </Card>
                    </div>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

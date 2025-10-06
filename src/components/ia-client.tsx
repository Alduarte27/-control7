'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, SlidersHorizontal, PackageCheck, Clock, Percent, Hash, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProductDefinition, CategoryDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/kpi-card';
import { Separator } from '@/components/ui/separator';
import { Pie, Cell, ResponsiveContainer, PieChart, Tooltip as RechartsTooltip } from 'recharts';

const KG_PER_QUINTAL = 50;
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function OperationsClient({ 
  prefetchedProducts,
  prefetchedCategories,
}: { 
  prefetchedProducts: ProductDefinition[],
  prefetchedCategories: CategoryDefinition[]
}) {
    const [isClient, setIsClient] = React.useState(false);
    const products = React.useMemo(() => prefetchedProducts.filter(p => p.isActive), [prefetchedProducts]);
    
    // Global state for the entire operations panel
    const [siloAmount, setSiloAmount] = React.useState(25000);
    const [machines, setMachines] = React.useState([
        { id: 1, productId: products[0]?.id || 'inactive', speed: 2400, loss: 2 },
        { id: 2, productId: 'inactive', speed: 2400, loss: 2 },
        { id: 3, productId: 'inactive', speed: 2400, loss: 2 },
        { id: 4, productId: 'inactive', speed: 2400, loss: 2 },
    ]);
    const [wrapperScenario, setWrapperScenario] = React.useState<'single' | 'dual'>('single');
    const [wrapper1Speed, setWrapper1Speed] = React.useState(8000);
    const [wrapper2Speed, setWrapper2Speed] = React.useState(8000);
    const [sacksPerBundle, setSacksPerBundle] = React.useState(1);

    React.useEffect(() => {
        setIsClient(true);
        if (products.length > 0 && machines.find(m => m.productId === 'inactive')) {
             setMachines(prev => prev.map(m => m.id === 1 ? { ...m, productId: products[0].id } : m));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [products]);

    const handleMachineChange = (id: number, field: string, value: any) => {
        setMachines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    const simulationResults = React.useMemo(() => {
        const activeMachines = machines.filter(m => m.productId !== 'inactive');

        const calculateProduction = (machineList: typeof activeMachines, wrapperSpeed: number) => {
            const packingCapacity = machineList.map(machine => {
                const product = products.find(p => p.id === machine.productId);
                if (!product) return { machineId: machine.id, sacksPerHour: 0, kgPerHour: 0, productName: 'N/A' };
                const effectiveSpeed = machine.speed * (1 - machine.loss / 100);
                return {
                    machineId: machine.id,
                    sacksPerHour: effectiveSpeed,
                    kgPerHour: effectiveSpeed * (product.sackWeight || 50),
                    productName: product.productName,
                };
            });

            const totalSacksPerHourFromPackers = packingCapacity.reduce((sum, m) => sum + m.sacksPerHour, 0);
            const totalKgPerHourFromPackers = packingCapacity.reduce((sum, m) => sum + m.kgPerHour, 0);
            const wrapperSacksPerHour = wrapperSpeed * sacksPerBundle;

            const isWrapperBottleneck = totalSacksPerHourFromPackers > wrapperSacksPerHour;
            const effectiveSacksPerHour = Math.min(totalSacksPerHourFromPackers, wrapperSacksPerHour);

            let effectiveKgPerHour = 0;
            if (effectiveSacksPerHour > 0) {
                if (isWrapperBottleneck && totalSacksPerHourFromPackers > 0) {
                    const reductionFactor = wrapperSacksPerHour / totalSacksPerHourFromPackers;
                    effectiveKgPerHour = totalKgPerHourFromPackers * reductionFactor;
                } else {
                    effectiveKgPerHour = totalKgPerHourFromPackers;
                }
            }

            return { packingCapacity, isWrapperBottleneck, effectiveSacksPerHour, effectiveKgPerHour, totalSacksPerHourFromPackers, totalKgPerHourFromPackers, wrapperSacksPerHour };
        };
        
        let totalSacksPerHourFromAllPackers = 0;
        let effectiveWrapperSacksPerHour = 0;

        if (wrapperScenario === 'single') {
            const { packingCapacity, isWrapperBottleneck, effectiveSacksPerHour, effectiveKgPerHour, totalSacksPerHourFromPackers, wrapperSacksPerHour } = calculateProduction(activeMachines, wrapper1Speed);
            totalSacksPerHourFromAllPackers = totalSacksPerHourFromPackers;
            effectiveWrapperSacksPerHour = wrapperSacksPerHour;

            const timeToEmptyHours = effectiveKgPerHour > 0 ? siloAmount / effectiveKgPerHour : 0;
            const totalSacksProduced = effectiveSacksPerHour * timeToEmptyHours;
            const totalQuintales = (siloAmount) / KG_PER_QUINTAL;
            
            const machineContribution = packingCapacity.map(m => ({ 
                name: `Máq. ${m.machineId} (${m.productName})`, 
                value: isNaN(m.sacksPerHour / totalSacksPerHourFromPackers * totalSacksProduced) ? 0 : (m.sacksPerHour / totalSacksPerHourFromPackers * totalSacksProduced) 
            }));

            return {
                timeToEmptyHours,
                totalSacksProduced,
                totalQuintales,
                isWrapperBottleneck,
                bottleneckDescription: `La enfardadora (cap: ${wrapperSacksPerHour.toLocaleString()} sacos/hr) limita a las envasadoras (cap: ${totalSacksPerHourFromPackers.toLocaleString()} sacos/hr).`,
                noBottleneckDescription: `Las envasadoras (cap: ${totalSacksPerHourFromPackers.toLocaleString()} sacos/hr) operan dentro de la capacidad de la enfardadora (${wrapperSacksPerHour.toLocaleString()} sacos/hr).`,
                machineProduction: packingCapacity.map(m => ({
                    id: m.machineId,
                    productName: m.productName,
                    sacks: (totalSacksPerHourFromPackers > 0 ? m.sacksPerHour / totalSacksPerHourFromPackers : 0) * totalSacksProduced,
                    weight: (totalSacksPerHourFromPackers > 0 ? m.sacksPerHour / totalSacksPerHourFromPackers : 0) * siloAmount
                })),
                machineContribution,
                totalSacksPerHourFromAllPackers,
                effectiveWrapperSacksPerHour,
            };

        } else { // dual wrapper scenario
            const machinesForWrapper1 = machines.filter(m => m.id <= 2 && m.productId !== 'inactive');
            const machinesForWrapper2 = machines.filter(m => m.id > 2 && m.productId !== 'inactive');
            
            const result1 = calculateProduction(machinesForWrapper1, wrapper1Speed);
            const result2 = calculateProduction(machinesForWrapper2, wrapper2Speed);

            totalSacksPerHourFromAllPackers = result1.totalSacksPerHourFromPackers + result2.totalSacksPerHourFromPackers;
            effectiveWrapperSacksPerHour = result1.wrapperSacksPerHour + result2.wrapperSacksPerHour;

            const totalEffectiveKgPerHour = result1.effectiveKgPerHour + result2.effectiveKgPerHour;
            const timeToEmptyHours = totalEffectiveKgPerHour > 0 ? siloAmount / totalEffectiveKgPerHour : 0;
            
            const totalSacksProduced = (result1.effectiveSacksPerHour * timeToEmptyHours) + (result2.effectiveSacksPerHour * timeToEmptyHours);
            const totalQuintales = siloAmount / KG_PER_QUINTAL;
            
            const combinedMachineProd = [
                ...result1.packingCapacity.map(m => ({ id: m.machineId, productName: m.productName, sacks: (result1.totalSacksPerHourFromPackers > 0 ? m.sacksPerHour / result1.totalSacksPerHourFromPackers : 0) * (result1.effectiveSacksPerHour * timeToEmptyHours) || 0, weight: (result1.totalKgPerHourFromPackers > 0 ? m.kgPerHour / result1.totalKgPerHourFromPackers : 0) * (result1.effectiveKgPerHour * timeToEmptyHours) || 0 })),
                ...result2.packingCapacity.map(m => ({ id: m.machineId, productName: m.productName, sacks: (result2.totalSacksPerHourFromPackers > 0 ? m.sacksPerHour / result2.totalSacksPerHourFromPackers : 0) * (result2.effectiveSacksPerHour * timeToEmptyHours) || 0, weight: (result2.totalKgPerHourFromPackers > 0 ? m.kgPerHour / result2.totalKgPerHourFromPackers : 0) * (result2.effectiveKgPerHour * timeToEmptyHours) || 0 }))
            ];
             const machineContribution = combinedMachineProd.map(m => ({
                name: `Máq. ${m.id} (${m.productName})`, value: isNaN(m.sacks) ? 0 : m.sacks
             }));

            return {
                timeToEmptyHours,
                totalSacksProduced,
                totalQuintales,
                isWrapperBottleneck: result1.isWrapperBottleneck || result2.isWrapperBottleneck,
                bottleneckDescription: `Línea 1: ${result1.isWrapperBottleneck ? 'Cuello de botella.' : 'OK.'} Línea 2: ${result2.isWrapperBottleneck ? 'Cuello de botella.' : 'OK.'}`,
                noBottleneckDescription: `Ambas líneas operan dentro de su capacidad.`,
                machineProduction: combinedMachineProd.filter(m => m.sacks > 0),
                machineContribution,
                totalSacksPerHourFromAllPackers,
                effectiveWrapperSacksPerHour,
            }
        }
    }, [siloAmount, machines, products, wrapperScenario, wrapper1Speed, wrapper2Speed, sacksPerBundle]);
    
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
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <SlidersHorizontal className="h-6 w-6 text-primary" />
                    Simulador de Línea de Producción
                </CardTitle>
                <CardDescription>
                    Modela tu línea de producción completa en una sola vista. Ajusta los parámetros en cada etapa para ver el impacto en tiempo real e identificar cuellos de botella.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Visual Flow Diagram */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold text-center mb-4">Flujo del Proceso de Producción</h3>
                    <div className="flex justify-around items-center p-4 border rounded-lg bg-muted/30">
                        {/* Step 1: Silo */}
                        <div className="flex flex-col items-center gap-2 text-center">
                            <Warehouse className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">1. Silo</h4>
                            {isClient ? <p className="text-sm text-muted-foreground">{siloAmount.toLocaleString()} Kg</p> : <p className="text-sm text-muted-foreground">- Kg</p>}
                        </div>
                        <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />

                        {/* Step 2: Packers */}
                        <div className="flex flex-col items-center gap-2 text-center">
                            <Package className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">2. Envasadoras</h4>
                             {isClient ? <p className="text-sm text-muted-foreground">{simulationResults.totalSacksPerHourFromAllPackers.toLocaleString(undefined, {maximumFractionDigits: 0})} fundas/hr</p> : <p className="text-sm text-muted-foreground">- fundas/hr</p>}
                        </div>
                        <ArrowRight className="h-8 w-8 text-muted-foreground shrink-0" />

                        {/* Step 3: Wrapper */}
                        <div className="flex flex-col items-center gap-2 text-center">
                            <PackageCheck className="h-10 w-10 text-primary" />
                            <h4 className="font-semibold">3. Enfardadora</h4>
                            {isClient ? <p className="text-sm text-muted-foreground">{simulationResults.effectiveWrapperSacksPerHour.toLocaleString(undefined, {maximumFractionDigits: 0})} fundas/hr</p> : <p className="text-sm text-muted-foreground">- fundas/hr</p>}
                        </div>
                    </div>
                </div>

                <Separator className="my-8" />
                
                {/* Configuration Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Side: Parameters */}
                    <div className="space-y-6">
                        {/* Step 1: Packers Config */}
                        <div className="p-4 border rounded-lg bg-muted/30">
                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Package className="h-5 w-5" />Parámetros de las Envasadoras</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {machines.map((machine) => (
                                    <div key={machine.id} className="p-3 border rounded-lg space-y-3 bg-background">
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
                                            <Label htmlFor={`speed-${machine.id}`} className="text-xs">Velocidad (fundas/hr)</Label>
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

                        {/* Step 2: Silo & Wrapper Config */}
                        <div className="p-4 border rounded-lg bg-muted/30">
                             <h3 className="font-semibold text-lg mb-4 flex items-center gap-2"><Warehouse className="h-5 w-5" />Materia Prima y Empaque</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="silo-amount">Cantidad en Silo (Kg)</Label>
                                    <Input id="silo-amount" type="number" value={siloAmount} onChange={e => setSiloAmount(Number(e.target.value))}/>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="sacks-per-bundle">Sacos por Paquete</Label>
                                    <Input id="sacks-per-bundle" type="number" value={sacksPerBundle} onChange={e => setSacksPerBundle(Number(e.target.value))}/>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label>Escenario de Enfardado</Label>
                                    <Select value={wrapperScenario} onValueChange={(val: 'single' | 'dual') => setWrapperScenario(val)}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">1 Enfardadora Central</SelectItem>
                                            <SelectItem value="dual">2 Líneas Paralelas (Máq. 1-2 y 3-4)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="wrapper1-speed">Velocidad Enfardadora 1 (paquetes/hr)</Label>
                                    <Input id="wrapper1-speed" type="number" value={wrapper1Speed} onChange={e => setWrapper1Speed(Number(e.target.value))}/>
                                </div>
                                {wrapperScenario === 'dual' && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="wrapper2-speed">Velocidad Enfardadora 2 (paquetes/hr)</Label>
                                        <Input id="wrapper2-speed" type="number" value={wrapper2Speed} onChange={e => setWrapper2Speed(Number(e.target.value))}/>
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>

                    {/* Right Side: Results */}
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg text-center">Resultados de la Simulación</h3>
                         {isClient ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <KpiCard title="Tiempo para Agotar Silo" value={formatTime(simulationResults.timeToEmptyHours)} icon={Clock} description="Tiempo total estimado para procesar toda la materia prima." />
                                    <KpiCard title="Producción Total (Sacos)" value={simulationResults.totalSacksProduced} icon={Package} description="Cantidad total de sacos que se producirán." fractionDigits={0} />
                                    <KpiCard title="Producción Total (QQ)" value={simulationResults.totalQuintales} icon={Hash} description={`Basado en la cantidad del silo (${siloAmount.toLocaleString()} kg).`} fractionDigits={1}/>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <PieChart className="h-5 w-5" />
                                                Contribución por Máquina
                                            </CardTitle>
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
                                                        <RechartsTooltip />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-base">
                                                <PackageCheck className="h-5 w-5" />
                                                Desglose de Producción
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <ul className="space-y-2 text-sm max-h-[200px] overflow-y-auto pr-2">
                                                {simulationResults.machineProduction.length > 0 ? simulationResults.machineProduction.map(mp => (
                                                    <li key={mp.id} className="flex justify-between items-center border-b pb-1">
                                                        <span>Máquina {mp.id} ({mp.productName})</span>
                                                        <span className="font-medium">{mp.sacks.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos</span>
                                                    </li>
                                                )) : <p className="text-center text-muted-foreground">No hay producción simulada.</p>}
                                                <li className="flex justify-between items-center pt-2 font-bold text-base">
                                                    <span>Total</span>
                                                    <span>{simulationResults.totalSacksProduced.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos</span>
                                                </li>
                                            </ul>
                                        </CardContent>
                                    </Card>
                                </div>
                                 <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">Análisis de Cuello de Botella</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className={`text-sm p-3 rounded-md ${simulationResults.isWrapperBottleneck ? 'bg-destructive/10 text-destructive' : 'bg-green-600/10 text-green-700'}`}>
                                            {simulationResults.isWrapperBottleneck ? simulationResults.bottleneckDescription : simulationResults.noBottleneckDescription}
                                        </p>
                                    </CardContent>
                                </Card>
                            </>
                        ) : (
                            <p className="text-center py-8 text-muted-foreground">Calculando resultados...</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, ArrowRight, PieChart, PackageCheck, SlidersHorizontal, Settings, Clock, Percent, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProductDefinition, CategoryDefinition } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/kpi-card';
import { Separator } from '@/components/ui/separator';
import { Bar as RechartsBar, Pie, Cell, ResponsiveContainer } from 'recharts';
import { BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Switch } from './ui/switch';


const KG_PER_QUINTAL = 50;

function SiloSimulator({ products, isClient }: { products: ProductDefinition[], isClient: boolean }) {
    // STATE for Silo Simulator
    const [siloAmount, setSiloAmount] = React.useState(25000);
    const [machines, setMachines] = React.useState([
        { id: 1, productId: products[0]?.id || 'inactive', speed: 2000, loss: 2 },
        { id: 2, productId: 'inactive', speed: 2000, loss: 2 },
        { id: 3, productId: 'inactive', speed: 2000, loss: 2 },
        { id: 4, productId: 'inactive', speed: 2000, loss: 2 },
    ]);
    const [wrapperScenario, setWrapperScenario] = React.useState<'single' | 'dual'>('single');
    const [wrapper1Speed, setWrapper1Speed] = React.useState(8000);
    const [wrapper2Speed, setWrapper2Speed] = React.useState(8000);
    const [sacksPerBundle, setSacksPerBundle] = React.useState(1);

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

        if (wrapperScenario === 'single') {
            const { packingCapacity, isWrapperBottleneck, effectiveSacksPerHour, effectiveKgPerHour, totalSacksPerHourFromPackers, totalKgPerHourFromPackers, wrapperSacksPerHour } = calculateProduction(activeMachines, wrapper1Speed);
            const timeToEmptyHours = effectiveKgPerHour > 0 ? siloAmount / effectiveKgPerHour : 0;
            const totalSacksProduced = effectiveSacksPerHour * timeToEmptyHours;
            const totalQuintales = (siloAmount) / KG_PER_QUINTAL;
            
            const machineContribution = packingCapacity.map(m => {
                const machineSacks = m.sacksPerHour / totalSacksPerHourFromPackers * totalSacksProduced;
                return { name: `Máq. ${m.machineId} (${m.productName})`, value: isNaN(machineSacks) ? 0 : machineSacks, color: products.find(p => p.id === m.productName)?.color || '#cccccc' };
            });

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
                    sacks: m.sacksPerHour / totalSacksPerHourFromPackers * totalSacksProduced,
                    weight: m.kgPerHour / totalKgPerHourFromPackers * siloAmount
                })),
                machineContribution,
            };

        } else { // dual wrapper scenario
            const machinesForWrapper1 = machines.filter(m => m.id <= 2 && m.productId !== 'inactive');
            const machinesForWrapper2 = machines.filter(m => m.id > 2 && m.productId !== 'inactive');
            
            const result1 = calculateProduction(machinesForWrapper1, wrapper1Speed);
            const result2 = calculateProduction(machinesForWrapper2, wrapper2Speed);

            const totalEffectiveKgPerHour = result1.effectiveKgPerHour + result2.effectiveKgPerHour;
            const timeToEmptyHours = totalEffectiveKgPerHour > 0 ? siloAmount / totalEffectiveKgPerHour : 0;
            
            const totalSacksProduced = (result1.effectiveSacksPerHour * timeToEmptyHours) + (result2.effectiveSacksPerHour * timeToEmptyHours);
            const totalQuintales = siloAmount / KG_PER_QUINTAL;
            
            const combinedMachineProd = [
                ...result1.packingCapacity.map(m => ({ id: m.machineId, productName: m.productName, sacks: (m.sacksPerHour / (result1.totalSacksPerHourFromPackers || 1)) * (result1.effectiveSacksPerHour * timeToEmptyHours) || 0, weight: (m.kgPerHour / (result1.totalKgPerHourFromPackers || 1)) * (result1.effectiveKgPerHour * timeToEmptyHours) || 0 })),
                ...result2.packingCapacity.map(m => ({ id: m.machineId, productName: m.productName, sacks: (m.sacksPerHour / (result2.totalSacksPerHourFromPackers || 1)) * (result2.effectiveSacksPerHour * timeToEmptyHours) || 0, weight: (m.kgPerHour / (result2.totalKgPerHourFromPackers || 1)) * (result2.effectiveKgPerHour * timeToEmptyHours) || 0 }))
            ];
             const machineContribution = combinedMachineProd.map(m => ({
                name: `Máq. ${m.id} (${m.productName})`, value: isNaN(m.sacks) ? 0 : m.sacks
             }));

            return {
                timeToEmptyHours,
                totalSacksProduced,
                totalQuintales,
                isWrapperBottleneck: result1.isWrapperBottleneck || result2.isWrapperBottleneck,
                bottleneckDescription: `Línea 1: ${result1.isWrapperBottleneck ? 'Enfardadora es cuello de botella.' : 'OK.'} Línea 2: ${result2.isWrapperBottleneck ? 'Enfardadora es cuello de botella.' : 'OK.'}`,
                noBottleneckDescription: `Ambas líneas operan dentro de su capacidad.`,
                machineProduction: combinedMachineProd.filter(m => m.sacks > 0),
                machineContribution,
            }
        }
    }, [siloAmount, machines, products, wrapperScenario, wrapper1Speed, wrapper2Speed, sacksPerBundle]);
    
    const formatTime = (hours: number) => {
        if (!isFinite(hours) || hours <= 0) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };

    const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <SlidersHorizontal className="h-6 w-6 text-primary" />
                    Simulador de Vaciado de Silo
                </CardTitle>
                <CardDescription>
                    Modela tu línea de producción desde el silo hasta la enfardadora. Ajusta los valores para ver el impacto en tiempo real e identificar cuellos de botella.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Visual Flow */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_2fr_auto_1fr] items-center gap-6 p-4 border rounded-lg bg-muted/20">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <Warehouse className="h-12 w-12 text-primary" />
                        <h3 className="font-semibold">Silo</h3>
                        {isClient ? <p className="text-xs text-muted-foreground">{siloAmount.toLocaleString()} Kg</p> : <p className="text-xs text-muted-foreground">- Kg</p>}
                    </div>

                    <ArrowRight className="h-8 w-8 text-muted-foreground hidden md:block" />

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

                    <div className="flex flex-col items-center gap-2 text-center">
                        <PackageCheck className="h-12 w-12 text-primary" />
                        <h3 className="font-semibold">Enfardado</h3>
                        <p className="text-xs text-muted-foreground">{wrapperScenario === 'single' ? '1 Línea' : '2 Líneas'}</p>
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
                                <Label htmlFor="sacks-per-bundle">Sacos por Paquete</Label>
                                <Input id="sacks-per-bundle" type="number" value={sacksPerBundle} onChange={e => setSacksPerBundle(Number(e.target.value))}/>
                            </div>
                             <Separator />
                            <div className="space-y-1.5">
                                <Label>Escenario de Enfardado</Label>
                                <Select value={wrapperScenario} onValueChange={(val: 'single' | 'dual') => setWrapperScenario(val)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="single">1 Enfardadora Central</SelectItem>
                                        <SelectItem value="dual">2 Líneas Paralelas (1-2 y 3-4)</SelectItem>
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

                <Separator />
                
                {/* Results */}
                <div className="space-y-6">
                    <h3 className="font-semibold text-lg text-center">Resultados de la Simulación</h3>
                    {isClient ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <KpiCard title="Tiempo para Agotar Silo" value={formatTime(simulationResults.timeToEmptyHours)} icon={Clock} description="Tiempo total estimado para procesar toda la materia prima." />
                                <KpiCard title="Producción Total (Sacos)" value={simulationResults.totalSacksProduced} icon={Package} description="Cantidad total de sacos que se producirán." fractionDigits={0} />
                                <KpiCard title="Producción Total (QQ)" value={simulationResults.totalQuintales} icon={Warehouse} description={`Basado en la cantidad del silo (${siloAmount.toLocaleString()} kg).`} fractionDigits={1}/>
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
                                        <ul className="space-y-2 text-sm">
                                            {simulationResults.machineProduction.map(mp => (
                                                <li key={mp.id} className="flex justify-between items-center border-b pb-1">
                                                    <span>Máquina {mp.id} ({mp.productName})</span>
                                                    <span className="font-medium">{mp.sacks.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos</span>
                                                </li>
                                            ))}
                                             <li className="flex justify-between items-center pt-2 font-bold text-base">
                                                <span>Total</span>
                                                <span>{simulationResults.totalSacksProduced.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos</span>
                                            </li>
                                        </ul>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    ) : (
                        <p className="text-center py-8 text-muted-foreground">Calculando resultados...</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ProductionSimulator({ products, isClient }: { products: ProductDefinition[], isClient: boolean }) {
    
    // Sim Params
    const [selectedProductId, setSelectedProductId] = React.useState<string | undefined>(products[0]?.id);
    const [speed, setSpeed] = React.useState(40); // Units per minute
    const [loss, setLoss] = React.useState(8); // Percentage
    const [numMachines, setNumMachines] = React.useState(1);
    const [dayHours, setDayHours] = React.useState(11);
    const [nightHours, setNightHours] = React.useState(11);
    const [activeDays, setActiveDays] = React.useState({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false });

    const results = React.useMemo(() => {
        const selectedProduct = products.find(p => p.id === selectedProductId);
        if (!selectedProduct) {
            return {
                sacksPerMinute: 0,
                sacksPerHourGross: 0,
                sacksPerHourNet: 0,
                productionPerDayShift: 0,
                productionPerNightShift: 0,
                dailyProduction: { mon: {day:0, night:0}, tue: {day:0, night:0}, wed: {day:0, night:0}, thu: {day:0, night:0}, fri: {day:0, night:0}, sat: {day:0, night:0}, sun: {day:0, night:0} },
                totalWeeklySacks: 0,
                totalWeeklyQuintales: 0,
            };
        }

        const sacksPerMinute = speed;
        const sacksPerHourGross = sacksPerMinute * 60;
        const sacksPerHourNet = sacksPerHourGross * (1 - (loss / 100));
        
        const productionPerDayShift = sacksPerHourNet * dayHours;
        const productionPerNightShift = sacksPerHourNet * nightHours;
        
        const dailyProduction = Object.entries(activeDays).reduce((acc, [day, isActive]) => {
            if (isActive) {
                acc[day as keyof typeof acc] = {
                    day: productionPerDayShift,
                    night: productionPerNightShift
                };
            } else {
                acc[day as keyof typeof acc] = { day: 0, night: 0 };
            }
            return acc;
        }, { mon: {day:0, night:0}, tue: {day:0, night:0}, wed: {day:0, night:0}, thu: {day:0, night:0}, fri: {day:0, night:0}, sat: {day:0, night:0}, sun: {day:0, night:0} });

        const totalWeeklySacks = Object.values(dailyProduction).reduce((sum, day) => sum + day.day + day.night, 0) * numMachines;
        const totalWeeklyQuintales = (totalWeeklySacks * (selectedProduct?.sackWeight || 50)) / KG_PER_QUINTAL;
        
        return {
            sacksPerMinute,
            sacksPerHourGross,
            sacksPerHourNet,
            productionPerDayShift,
            productionPerNightShift,
            dailyProduction,
            totalWeeklySacks,
            totalWeeklyQuintales,
        };
    }, [speed, loss, dayHours, nightHours, activeDays, numMachines, selectedProductId, products]);

    const handleDayToggle = (day: keyof typeof activeDays) => {
        setActiveDays(prev => ({ ...prev, [day]: !prev[day] }));
    };

    const dayNames: { key: keyof typeof activeDays, short: string, long: string }[] = [
        { key: 'mon', short: 'L', long: 'Lunes' }, { key: 'tue', short: 'M', long: 'Martes' },
        { key: 'wed', short: 'X', long: 'Miércoles' }, { key: 'thu', short: 'J', long: 'Jueves' },
        { key: 'fri', short: 'V', long: 'Viernes' }, { key: 'sat', short: 'S', long: 'Sábado' },
        { key: 'sun', short: 'D', long: 'Domingo' }
    ];

    if (!isClient) return <p className="text-center py-8 text-muted-foreground">Cargando simulador...</p>;

    return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <Factory className="h-6 w-6 text-primary" />
                    Simulador de Producción Detallada
                </CardTitle>
                <CardDescription>
                    Estima la producción semanal para un producto específico ajustando los parámetros de maquinaria y horario para un análisis más granular.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* INPUTS */}
                <div className="space-y-6">
                    {/* Product Parameters */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold text-md">1. Parámetros del Producto</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 col-span-2">
                                <Label htmlFor="sim-product">Producto a Simular</Label>
                                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                    <SelectTrigger id="sim-product"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {products.map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-1.5">
                                <Label>Peso por Saco (kg)</Label>
                                <Input type="number" value={products.find(p => p.id === selectedProductId)?.sackWeight || 50} readOnly disabled/>
                            </div>
                        </div>
                    </div>
                     {/* Machinery Parameters */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold text-md">2. Parámetros de Maquinaria</h3>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="sim-speed">Velocidad (fundas/min)</Label>
                                <Input id="sim-speed" type="number" value={speed} onChange={e => setSpeed(Number(e.target.value))}/>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="sim-loss">Pérdida (%)</Label>
                                <Input id="sim-loss" type="number" value={loss} onChange={e => setLoss(Number(e.target.value))}/>
                            </div>
                             <div className="space-y-1.5 col-span-2">
                                <Label htmlFor="sim-machines">Número de Máquinas a Simular</Label>
                                <Input id="sim-machines" type="number" value={numMachines} onChange={e => setNumMachines(Number(e.target.value))}/>
                            </div>
                        </div>
                    </div>
                    {/* Schedule Parameters */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold text-md">3. Horario de Producción</h3>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="sim-day-hours">Horas Turno Día</Label>
                                <Input id="sim-day-hours" type="number" value={dayHours} onChange={e => setDayHours(Number(e.target.value))}/>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sim-night-hours">Horas Turno Noche</Label>
                                <Input id="sim-night-hours" type="number" value={nightHours} onChange={e => setNightHours(Number(e.target.value))}/>
                            </div>
                        </div>
                        <div className="space-y-2 pt-2">
                            <Label>Días de Producción</Label>
                            <div className="flex items-center justify-between gap-1 rounded-lg bg-muted p-2">
                                {dayNames.map(day => (
                                    <Button 
                                        key={day.key}
                                        variant={activeDays[day.key] ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => handleDayToggle(day.key)}
                                        className="h-8 w-8 rounded-full"
                                        title={day.long}
                                    >
                                        {day.short}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RESULTS */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Resultados Consolidados</CardTitle>
                        </CardHeader>
                         <CardContent className="grid grid-cols-2 gap-4">
                            <KpiCard title="Producción Semanal (Sacos)" value={results.totalWeeklySacks} icon={Package} description="Producción total estimada para la semana con los parámetros actuales." fractionDigits={0} />
                            <KpiCard title="Producción Semanal (QQ)" value={results.totalWeeklyQuintales} icon={Warehouse} description="Peso total estimado de la producción semanal." fractionDigits={1}/>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Desglose por Máquina</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                           <IndicatorDisplay label="Fundas/Minuto" value={results.sacksPerMinute} icon={Settings}/>
                           <IndicatorDisplay label="Fundas/Hora (Bruto)" value={results.sacksPerHourGross} icon={Factory} fractionDigits={0}/>
                           <IndicatorDisplay label="Fundas/Hora (Neto)" value={results.sacksPerHourNet} icon={PackageCheck} fractionDigits={0}/>
                           <IndicatorDisplay label="Sacos por Hora (Neto)" value={results.sacksPerHourNet} icon={Hash} fractionDigits={2}/>
                           <IndicatorDisplay label="Producción Turno Día" value={results.productionPerDayShift} icon={Clock} fractionDigits={2}/>
                           <IndicatorDisplay label="Producción Turno Noche" value={results.productionPerNightShift} icon={Clock} fractionDigits={2}/>
                        </CardContent>
                    </Card>
                    
                    <Card>
                         <CardHeader>
                            <CardTitle>Proyección de Producción Diaria (Total)</CardTitle>
                             <CardDescription>Producción estimada combinada de las {numMachines} máquina(s).</CardDescription>
                        </CardHeader>
                         <CardContent>
                            <ChartContainer config={{}} className="w-full h-[250px]">
                                <RechartsBarChart data={dayNames.map(d => ({ name: d.short, día: results.dailyProduction[d.key].day * numMachines, noche: results.dailyProduction[d.key].night * numMachines }))}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                                    <YAxis />
                                    <RechartsTooltip content={<ChartTooltipContent />} />
                                    <RechartsBar dataKey="día" fill="var(--color-chart-2)" radius={4} />
                                    <RechartsBar dataKey="noche" fill="var(--color-chart-4)" radius={4} />
                                </RechartsBarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
         </Card>
    )
}

const IndicatorDisplay = ({ label, value, icon: Icon, fractionDigits = 0 }: { label: string, value: number, icon: React.ElementType, fractionDigits?: number }) => (
    <div className="flex items-start gap-3 rounded-lg border p-3">
        <div className="p-2 bg-muted rounded-md mt-1">
            <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
            <p className="text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits})}</p>
        </div>
    </div>
);


export default function OperationsClient({ 
  prefetchedProducts,
  prefetchedCategories,
}: { 
  prefetchedProducts: ProductDefinition[],
  prefetchedCategories: CategoryDefinition[]
}) {
    const [isClient, setIsClient] = React.useState(false);
    const products = React.useMemo(() => prefetchedProducts.filter(p => p.isActive), [prefetchedProducts]);
    
    React.useEffect(() => {
        setIsClient(true);
    }, []);
    
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
        <SiloSimulator products={products} isClient={isClient} />
        <ProductionSimulator products={products} isClient={isClient} />
      </main>
    </div>
  );
}

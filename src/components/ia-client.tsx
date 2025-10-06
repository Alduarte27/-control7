'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, Warehouse, Package, Settings, Clock, AlertTriangle, ArrowRight, CheckCircle2, SlidersHorizontal, BrainCircuit, PieChart, Info, CalendarClock, Bot, BarChart, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ProductDefinition, CategoryDefinition, ProductData } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/kpi-card';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar as RechartsBar, Pie, Cell, ResponsiveContainer } from 'recharts';
import { BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useToast } from '@/hooks/use-toast';
import { Switch } from './ui/switch';

const KG_PER_QUINTAL = 50;

function ProductionSimulatorTab({ products, categories }: { products: ProductDefinition[], categories: CategoryDefinition[] }) {
    const { toast } = useToast();
    const [isSimulating, setIsSimulating] = React.useState(false);

    const [productId, setProductId] = React.useState<string>(products[0]?.id || '');
    const [sacksPerHour, setSacksPerHour] = React.useState(2000);
    const [lossPercentage, setLossPercentage] = React.useState(0);
    const [numMachines, setNumMachines] = React.useState(1);
    const [dayShiftHours, setDayShiftHours] = React.useState(12);
    const [nightShiftHours, setNightShiftHours] = React.useState(12);
    const [activeDays, setActiveDays] = React.useState({ mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false });

    const selectedProduct = React.useMemo(() => products.find(p => p.id === productId), [productId, products]);

    const simulationResults = React.useMemo(() => {
        if (!selectedProduct) return null;

        const sackWeight = selectedProduct.sackWeight || 50;
        const effectiveSacksPerHour = sacksPerHour * (1 - (lossPercentage / 100));

        let totalSacks = 0;
        const dailyBreakdown = (Object.keys(activeDays) as (keyof typeof activeDays)[]).map(day => {
            if (!activeDays[day]) return { day, daySacks: 0, nightSacks: 0 };
            
            const daySacks = effectiveSacksPerHour * dayShiftHours * numMachines;
            const nightSacks = effectiveSacksPerHour * nightShiftHours * numMachines;
            totalSacks += daySacks + nightSacks;

            return { day, daySacks, nightSacks };
        });

        return {
            totalSacks,
            totalQuintales: (totalSacks * sackWeight) / KG_PER_QUINTAL,
            productionPerMachine: totalSacks / numMachines,
            efficiency: 100 - lossPercentage,
            dailyBreakdown,
        }

    }, [selectedProduct, sacksPerHour, lossPercentage, numMachines, dayShiftHours, nightShiftHours, activeDays]);
    
    const handleDayToggle = (day: keyof typeof activeDays) => {
        setActiveDays(prev => ({ ...prev, [day]: !prev[day] }));
    };

    const dayNames: { [key: string]: string } = { mon: 'L', tue: 'M', wed: 'X', thu: 'J', fri: 'V', sat: 'S', sun: 'D' };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* INPUTS */}
            <div className="space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><SlidersHorizontal />Parámetros de Simulación</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="sim-product">1. Producto a Simular</Label>
                            <Select value={productId} onValueChange={setProductId}>
                                <SelectTrigger id="sim-product"><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                                <SelectContent>
                                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.productName}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>2. Parámetros de Maquinaria</Label>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-muted/30 rounded-md border">
                                <div>
                                    <Label htmlFor="sim-speed" className="text-xs">Velocidad (sacos/hr)</Label>
                                    <Input id="sim-speed" type="number" value={sacksPerHour} onChange={e => setSacksPerHour(Number(e.target.value))} />
                                </div>
                                <div>
                                    <Label htmlFor="sim-loss" className="text-xs">Merma (%)</Label>
                                    <Input id="sim-loss" type="number" value={lossPercentage} onChange={e => setLossPercentage(Number(e.target.value))} />
                                </div>
                                <div>
                                    <Label htmlFor="sim-machines" className="text-xs">Nº Máquinas</Label>
                                    <Input id="sim-machines" type="number" value={numMachines} onChange={e => setNumMachines(Number(e.target.value))} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>3. Horario de Producción</Label>
                             <div className="p-3 bg-muted/30 rounded-md border space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                     <div>
                                        <Label htmlFor="sim-day-hours" className="text-xs">Horas Turno Día</Label>
                                        <Input id="sim-day-hours" type="number" value={dayShiftHours} onChange={e => setDayShiftHours(Number(e.target.value))} />
                                    </div>
                                    <div>
                                        <Label htmlFor="sim-night-hours" className="text-xs">Horas Turno Noche</Label>
                                        <Input id="sim-night-hours" type="number" value={nightShiftHours} onChange={e => setNightShiftHours(Number(e.target.value))} />
                                    </div>
                                </div>
                                <div>
                                     <Label className="text-xs mb-2 block">Días Activos</Label>
                                     <div className="flex items-center justify-center gap-1">
                                        {Object.keys(dayNames).map(day => (
                                            <Button 
                                                key={day} 
                                                variant={activeDays[day as keyof typeof activeDays] ? 'default' : 'outline'} 
                                                size="icon" 
                                                className="h-8 w-8"
                                                onClick={() => handleDayToggle(day as keyof typeof activeDays)}
                                            >
                                                {dayNames[day]}
                                            </Button>
                                        ))}
                                     </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
             {/* OUTPUTS */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Resultados de la Simulación</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {!selectedProduct ? (
                            <p className="text-center text-muted-foreground py-8">Selecciona un producto para empezar.</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <KpiCard title="Producción Estimada" value={simulationResults?.totalSacks.toLocaleString() || '0'} icon={Package} description="Sacos totales que se producirían en el período." subValue={`(${simulationResults?.totalQuintales.toLocaleString(undefined, { maximumFractionDigits: 1 }) || '0'} QQ)`} />
                                    <KpiCard title="Producción por Máquina" value={simulationResults?.productionPerMachine.toLocaleString() || '0'} icon={Factory} description="Sacos que cada máquina produciría en el período." />
                                    <KpiCard title="Eficiencia" value={`${simulationResults?.efficiency || 0}%`} icon={Percent} description="Eficiencia neta de la producción considerando la merma." valueColor={simulationResults && simulationResults.efficiency >= 90 ? 'text-green-600' : 'text-yellow-600'} />
                                </div>
                                <Separator />
                                <div>
                                    <h4 className="font-semibold mb-2">Desglose de Producción Diaria (Sacos)</h4>
                                     <div className="space-y-2">
                                        <div className="grid grid-cols-7 text-center text-xs font-bold text-muted-foreground">
                                            {Object.values(dayNames).map(name => <div key={name}>{name}</div>)}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1">
                                            {simulationResults?.dailyBreakdown.map(d => (
                                                <div key={d.day} className="p-1.5 rounded-md bg-muted/50 text-center text-sm">
                                                    <p className="font-bold">{(d.daySacks + d.nightSacks).toLocaleString()}</p>
                                                    <p className="text-xs text-muted-foreground">{d.daySacks.toLocaleString()} / {d.nightSacks.toLocaleString()}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center pt-1">Total / (Día / Noche)</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}


function SiloSimulatorTab({ products }: { products: ProductDefinition[] }) {
    const [isClient, setIsClient] = React.useState(false);
    
    const [siloAmount, setSiloAmount] = React.useState(25000); // Default 25 Ton
    const [machines, setMachines] = React.useState<any[]>([
        { productId: products[0]?.id || 'inactive', speed: 2000, loss: 0 },
        { productId: 'inactive', speed: 0, loss: 0 },
        { productId: 'inactive', speed: 0, loss: 0 },
    ]);
    
    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const handleMachineChange = (index: number, field: string, value: any) => {
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
        }).filter(Boolean);
        
        if (siloAmount <= 0 || activeMachines.length === 0) {
            return { timeToEmptyHours: 0, productionPerMachine: [], totalSacks: 0, totalQuintales: 0, chartData: [] };
        }

        const totalKgPerHour = activeMachines.reduce((sum, m) => sum + m.kgPerHour, 0);
        const timeToEmptyHours = totalKgPerHour > 0 ? siloAmount / totalKgPerHour : 0;
        
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

        const chartData = productionPerMachine.map(p => ({ name: p.productName, value: p.sacks }));

        return { timeToEmptyHours, productionPerMachine, totalSacks, totalQuintales, chartData };

    }, [siloAmount, machines, products]);

    const formatTime = (hours: number) => {
        if (hours <= 0) return '0h 0m';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}h ${m}m`;
    };
    
    const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* INPUTS */}
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Warehouse className="text-primary"/>Silo y Envasadoras</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="silo-amount">1. Cantidad en Silo (Kg)</Label>
                        <Input id="silo-amount" type="number" value={siloAmount} onChange={e => setSiloAmount(Number(e.target.value) || 0)} className="mt-2" placeholder="Kg de materia prima"/>
                    </div>
                     <div className="space-y-2">
                        <Label>2. Configuración de Envasadoras</Label>
                        <div className="space-y-3">
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
                                            <Label htmlFor={`silo-speed-${index}`} className="text-xs">Velocidad (sacos/hr)</Label>
                                            <Input id={`silo-speed-${index}`} type="number" value={machine.speed} onChange={e => handleMachineChange(index, 'speed', e.target.value)} />
                                        </div>
                                        <div>
                                            <Label htmlFor={`silo-loss-${index}`} className="text-xs">Merma (%)</Label>
                                            <Input id={`silo-loss-${index}`} type="number" value={machine.loss} onChange={e => handleMachineChange(index, 'loss', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
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
                            </div>
                            <Separator />
                            <div>
                                <h4 className="font-semibold mb-2 flex items-center gap-2"><PieChart /> Desglose de Producción por Máquina</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                    <div className="w-full h-40">
                                         <ResponsiveContainer width="100%" height="100%">
                                             <Pie
                                                data={simulationResults.chartData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={60}
                                                labelLine={false}
                                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                                    const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
                                                    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                                    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                                    return (
                                                    <text x={x} y={y} fill="currentColor" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs">
                                                        {`${(percent * 100).toFixed(0)}%`}
                                                    </text>
                                                    );
                                                }}
                                             >
                                                {simulationResults.chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                             </Pie>
                                         </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-2">
                                        {simulationResults.productionPerMachine.length > 0 ? simulationResults.productionPerMachine.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded-md">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                                    <span className="font-medium">{p.productName}</span>
                                                </div>
                                                <div className="text-right">
                                                    <p>{p.sacks.toLocaleString(undefined, {maximumFractionDigits: 0})} sacos</p>
                                                    <p className="text-xs text-muted-foreground">{p.quintales.toLocaleString(undefined, {maximumFractionDigits: 1})} QQ</p>
                                                </div>
                                            </div>
                                        )) : <p className="text-sm text-center text-muted-foreground py-4">No hay producción para mostrar.</p>}
                                    </div>
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
  );
}

export default function OperationsClient({ 
  prefetchedProducts,
  prefetchedCategories
}: { 
  prefetchedProducts: ProductDefinition[],
  prefetchedCategories: CategoryDefinition[]
}) {
    const products = React.useMemo(() => prefetchedProducts.filter(p => p.isActive), [prefetchedProducts]);

  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Centro de Operaciones</h1>
        </div>
        <Link href="/"><Button variant="outline"><ChevronLeft className="mr-2" />Volver</Button></Link>
      </header>
      
      <main className="p-4 md:p-8 space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Herramientas de Simulación y Análisis</CardTitle>
                <CardDescription>
                    Utiliza estas herramientas para planificar la producción, simular la capacidad de la planta y obtener pronósticos de demanda basados en IA.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="production-simulator" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="production-simulator">
                            <CalendarClock className="mr-2" /> Simulador de Producción
                        </TabsTrigger>
                         <TabsTrigger value="silo-simulator">
                            <Warehouse className="mr-2" /> Simulador de Silo
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="production-simulator" className="pt-6">
                        <ProductionSimulatorTab products={products} categories={prefetchedCategories} />
                    </TabsContent>
                    <TabsContent value="silo-simulator" className="pt-6">
                       <SiloSimulatorTab products={products} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

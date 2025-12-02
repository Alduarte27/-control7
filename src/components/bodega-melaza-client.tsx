
'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PackagingMaterial } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ChevronLeft, Factory } from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';

const ALA_A_LAYOUT = {
  rows: 11,
  cols: 3,
  getLabel: (r: number, c: number) => `A-${r + 1}-${c + 1}`,
};

const ALA_B_LAYOUT = {
  rows: 11,
  cols: 4,
  getLabel: (r: number, c: number) => `B-${r + 1}-${ALA_B_LAYOUT.cols - c}`,
};

interface LocationDetail {
    location: string;
    code: string;
    supplier: string;
    lote: string;
    fechaElab: string;
    bins: number;
    sacos: number;
}

const WarehouseSection = ({
  title,
  layout,
  occupiedLocations,
}: {
  title: string;
  layout: { rows: number; cols: number; getLabel: (r: number, c: number) => string };
  occupiedLocations: LocationDetail[];
}) => {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-1.5", `grid-cols-${layout.cols}`)} style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: layout.rows }).map((_, r) =>
            Array.from({ length: layout.cols }).map((_, c) => {
              const locId = layout.getLabel(r, c);
              const detail = occupiedLocations.find(d => d.location === locId);
              const isOccupied = !!detail;

              const cell = (
                <div
                  key={locId}
                  className={cn(
                    "aspect-video rounded-md flex flex-col items-center justify-center text-xs border p-1 transition-colors duration-200",
                    isOccupied 
                        ? "bg-primary/10 border-primary/50 text-primary-foreground font-semibold" 
                        : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <div className="font-mono">{locId}</div>
                  {isOccupied && (
                     <div className="text-center text-[10px] leading-tight mt-1 opacity-80">
                        <p>L: {detail.lote}</p>
                        <p>{detail.sacos} sacos</p>
                    </div>
                  )}
                </div>
              );

              if (isOccupied) {
                return (
                  <TooltipProvider key={locId} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>{cell}</TooltipTrigger>
                      <TooltipContent>
                        <div className="space-y-1 text-sm">
                            <p className="font-bold">Ubicación: {detail.location}</p>
                            <p><span className="font-semibold">Lote:</span> {detail.lote}</p>
                            <p><span className="font-semibold">Fecha Elab:</span> {detail.fechaElab}</p>
                            <p><span className="font-semibold">Cantidad:</span> {detail.sacos} sacos</p>
                            <p><span className="font-semibold">Proveedor:</span> {detail.supplier}</p>
                            <p className="text-xs text-muted-foreground break-all"><span className="font-semibold">Código:</span> {detail.code}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }
              return cell;
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};


export default function BodegaMelazaClient() {
  const [materials, setMaterials] = useState<PackagingMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "melazaSacks"), where("status", "==", "recibido"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const materialsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial));
      setMaterials(materialsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const occupiedLocations: LocationDetail[] = materials
    .filter(m => m.warehouseLocation)
    .map(m => ({
        location: m.warehouseLocation!,
        code: m.code,
        supplier: m.supplier || 'N/A',
        lote: m.lote || 'N/A',
        fechaElab: m.providerDate || 'N/A',
        bins: 4, 
        sacos: m.quantity || 0,
    }));

  return (
    <div className="bg-background min-h-screen">
        <header className="flex items-center justify-between p-4 border-b bg-card z-10 sticky top-0">
            <div className="flex items-center gap-3">
                <Factory className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Mapa de Bodega - Melaza</h1>
                    <p className="text-sm text-muted-foreground">Visualización en tiempo real de las ubicaciones de sacos llenos.</p>
                </div>
            </div>
             <Link href="/material-melaza">
                <Button variant="outline"><ChevronLeft className="h-4 w-4 mr-2" />Volver a Material Melaza</Button>
            </Link>
        </header>

        <main className="p-4 md:p-8">
            {loading ? (
                <div className="text-center py-20 text-muted-foreground">Cargando mapa de la bodega...</div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                     <WarehouseSection 
                        title="ALA A"
                        layout={ALA_A_LAYOUT}
                        occupiedLocations={occupiedLocations.filter(loc => loc.location.startsWith('A'))}
                    />
                     <WarehouseSection 
                        title="ALA B"
                        layout={ALA_B_LAYOUT}
                        occupiedLocations={occupiedLocations.filter(loc => loc.location.startsWith('B'))}
                    />
                </div>
            )}
        </main>
    </div>
  );
}

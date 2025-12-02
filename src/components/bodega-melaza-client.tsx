
'use client';

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PackagingMaterial } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Factory } from 'lucide-react';
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
    <div className="p-4 border rounded-lg bg-card shadow-sm">
      <h2 className="text-xl font-bold mb-4 text-center">{title}</h2>
      <div className={cn("grid gap-1", `grid-cols-${layout.cols}`)} style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: layout.rows }).map((_, r) =>
          Array.from({ length: layout.cols }).map((_, c) => {
            const locId = layout.getLabel(r, c);
            const detail = occupiedLocations.find(d => d.location === locId);
            const isOccupied = !!detail;

            const cell = (
              <div
                key={locId}
                className={cn(
                  "aspect-[3/2] rounded-sm flex flex-col items-center justify-center text-xs border p-1",
                  isOccupied ? "bg-blue-200 border-blue-400" : "bg-muted/30"
                )}
              >
                <div className="font-mono font-bold">{locId}</div>
                {isOccupied && (
                   <div className="text-center text-[10px] leading-tight mt-1">
                      <p>Lote: {detail.lote}</p>
                      <p>Bins: {detail.bins}</p>
                      <p>Sacos: {detail.sacos}</p>
                  </div>
                )}
              </div>
            );

            if (isOccupied) {
              return (
                <TooltipProvider key={locId}>
                  <Tooltip>
                    <TooltipTrigger asChild>{cell}</TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">Ubicación: {detail.location}</p>
                      <p>Lote: {detail.lote}</p>
                      <p>Fecha Elab: {detail.fechaElab}</p>
                      <p>Bins: {detail.bins}</p>
                      <p>Sacos: {detail.sacos}</p>
                      <p>Proveedor: {detail.supplier}</p>
                      <p>Código: {detail.code}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }
            return cell;
          })
        )}
      </div>
    </div>
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
        bins: 4, // This seems to be a fixed value in the image for occupied spots
        sacos: m.quantity || 0,
    }));

  return (
    <div className="bg-background min-h-screen p-4 md:p-8">
        <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <Factory className="h-8 w-8 text-primary" />
                <h1 className="text-2xl md:text-3xl font-bold">Mapa de Bodega - Melaza</h1>
            </div>
             <Link href="/material-melaza">
                <Button variant="outline">Volver a Material Melaza</Button>
            </Link>
        </header>
      
        {loading ? (
            <div className="text-center py-20">Cargando mapa de la bodega...</div>
        ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
    </div>
  );
}

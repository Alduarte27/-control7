
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const WAREHOUSE_LOCATIONS = [
    'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8',
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8',
];

interface WarehouseMapProps {
    id?: string;
    occupiedLocations: string[];
    selectedLocation: string | null;
    onLocationSelect: (location: string) => void;
    disabled?: boolean;
    interactive?: boolean;
    details?: { location: string; code: string; supplier: string }[];
}

const WarehouseMap: React.FC<WarehouseMapProps> = ({ 
    id, 
    occupiedLocations, 
    selectedLocation, 
    onLocationSelect, 
    disabled = false,
    interactive = false,
    details = []
}) => {
    return (
        <div id={id} className={cn("grid grid-cols-8 gap-1 p-2 border rounded-lg bg-muted/30", disabled && "opacity-50 pointer-events-none")}>
            <TooltipProvider>
                {WAREHOUSE_LOCATIONS.map(loc => {
                    const isOccupied = occupiedLocations.includes(loc);
                    const isSelected = selectedLocation === loc;
                    const detail = details.find(d => d.location === loc);

                    const locationButton = (
                        <button
                            key={loc}
                            type="button"
                            onClick={() => onLocationSelect(loc)}
                            disabled={interactive ? false : isOccupied && !isSelected}
                            className={cn(
                                "aspect-square rounded-sm text-xs font-mono transition-colors border",
                                isOccupied 
                                    ? "bg-blue-200 border-blue-400 text-blue-800"
                                    : "bg-background hover:bg-accent",
                                isSelected && "ring-2 ring-primary ring-offset-2",
                                isOccupied && interactive && "hover:bg-blue-300",
                                disabled && "cursor-not-allowed"
                            )}
                        >
                            {loc}
                        </button>
                    );

                    if (interactive && isOccupied && detail) {
                        return (
                            <Tooltip key={loc}>
                                <TooltipTrigger asChild>
                                    {locationButton}
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="font-bold">Ubicación: {detail.location}</p>
                                    <p>Código: {detail.code}</p>
                                    <p>Proveedor: {detail.supplier}</p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    }
                    
                    return locationButton;
                })}
            </TooltipProvider>
        </div>
    );
};

export default WarehouseMap;

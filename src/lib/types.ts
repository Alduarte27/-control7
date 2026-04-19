

'use client';

export type ShiftProduction = {
  day: number;
  night: number;
  lotNumber?: string;
  dayNote?: string;
  nightNote?: string;
};

export type DailyProduction = {
  mon: ShiftProduction;
  tue: ShiftProduction;
  wed: ShiftProduction;
  thu: ShiftProduction;
  fri: ShiftProduction;
  sat: ShiftProduction;
  sun: ShiftProduction;
};

export type CategoryDefinition = {
  id: string;
  name: string;
  isPlanned: boolean;
}

export type ProductDefinition = {
  id: string;
  productName: string;
  order: number;
  categoryId: string;
  color?: string; // e.g., '#ff0000'
  isActive: boolean;
  sackWeight?: number | null; // Weight of one sack in kg
  bundleWeight?: number | null; // Weight of one bundle (fardo) in kg
  presentationWeight?: number | null; // Weight of one presentation/bag in kg
  primaryPackaging?: 'saco' | 'fardo' | 'granel' | null;
  unitsPerPallet?: number | null; // Number of sacks/bundles per pallet
}

export type ProductData = ProductDefinition & {
  categoryName: string;
  categoryIsPlanned: boolean;
  planned: number;
  actual: DailyProduction;
  isSuggested?: boolean; // To flag if the plan was AI-suggested
};


// --- Production Log (Stops) Types ---
export type StopCause = {
    id: string;
    name: string;
    color: string;
    type: 'planned' | 'unplanned';
};

export type Operator = {
    id: string;
    name: string;
};

export type Supervisor = {
    id: string;
    name: string;
};

export type MaintenanceType = {
    id: string;
    name: string;
};


export type StopData = {
    id: string; // Unique ID for the stop event, e.g., a timestamp or UUID
    startTime: string; // The time slot, e.g., "07:00"
    endTime: string;
    duration: number; // in minutes
    type: 'planned' | 'unplanned';
    maintenanceType?: string; // e.g., 'preventive'
    reason: string; // The selected stop cause from the catalog (e.g., "Daño Eléctrico")
    cause: string; // Specific detail (e.g., "Cable suelto")
    solution?: string;
};

export type TimeSlot = {
    // Machine specific observations are nested under machine ID
    [key: string]: any;
    // Quality Input
    masa?: string;
    flujo?: string;
    ns_fam?: string;
    ns_1?: string;
    ns_2?: string;
    in_color?: string;
    in_hum?: string;
    in_turb?: string;
    in_cv?: string;
    // Quality Output
    out_fam_color?: string;
    out_fam_hum?: string;
    out_fam_turb?: string;
    out_gra_color?: string;
    out_gra_hum?: string;
    out_gra_turb?: string;
    // Packaging
    empaque_obs?: string;
};


export type MachineLog = {
  productId: string;
  theoreticalSpeed?: number; // Theoretical speed in bags/min for the whole shift (legacy/fallback)
};

export type DailyLog = {
  id: string; // YYYY-MM-DD_shift
  operador: string;
  supervisor: string;
  lote: string;
  shift: 'day' | 'night';
  machines: { [machineId: string]: MachineLog };
  timeSlots: { [time: string]: Partial<TimeSlot> };
};

export type BitacoraSettings = {
    weightHeaderType: { [key: string]: string };
};

export type MachineOEE = {
    availability: number;
    performance: number;
    quality: number;
    oee: number;
};

// --- Packaging Materials Control ---

export type Supplier = {
    id: string;
    name: string;
    requiredFields?: string[];
};

export type MaterialType = 'sacos_familiar' | 'sacos_granel' | 'rollo_laminado' | 'rollo_fardo' | 'sacos_melaza';
export type MaterialStatus = 'recibido' | 'en_uso' | 'consumido' | 'por_pesar_tara';

export const materialTypeLabels: { [key in MaterialType]: string } = {
  sacos_familiar: "Sacos de Familiar",
  sacos_granel: "Sacos de Granel",
  rollo_laminado: "Rollo Laminado",
  rollo_fardo: "Rollo de Fardo",
  sacos_melaza: "Sacos de Melaza",
};

export type PackagingMaterial = {
    id: string;
    type: MaterialType;
    code: string;
    supplier?: string;
    lote?: string;
    providerDate?: string; // Fecha de la etiqueta del proveedor
    presentation?: string; // Nombre del producto envasado
    netWeight?: number; 
    grossWeight?: number;
    labelTare?: number;
    quantity?: number;
    unitWeight?: number; // in grams
    totalWeight?: number; // in kg
    actualWeight?: number;
    status: MaterialStatus;
    receivedAt: number;
    inUseAt?: number;
    consumedAt?: number;
    assignedMachine?: string;
    tareWeight?: number; // Peso de la tara (plastico + canuto)
    plasticWeight?: number; // Peso de la envoltura
    coreWeight?: number; // Peso del canuto
    actualNetWeight?: number; // Peso neto real (Peso Real - Tara)
    tareWeightedAt?: number; // Timestamp de cuando se pesó la tara
    warehouseLocation?: string; // Ubicación en bodega
};

declare module 'jsqr';



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
  defaultSpeed?: number | null; // Default production speed (bpm)
}

export type ProductData = ProductDefinition & {
  categoryName: string;
  categoryIsPlanned: boolean;
  planned: number;
  actual: DailyProduction; // represents Interzafra by default
  actualZafra?: DailyProduction;
  actualReempaque?: DailyProduction;
  actualReenvase?: DailyProduction;
  isSuggested?: boolean; // To flag if the plan was AI-suggested
  isZafra?: boolean;
};


// --- Production Log (Stops) Types ---
export type StopType = {
  id: string;
  name: string;
  isPlanned: boolean;
};

export type StopCause = {
  id: string;
  name: string;
  color: string;
  type: 'planned' | 'unplanned' | 'observation'; // Legacy/fallback
  typeId?: string; // New dynamic type reference
  maintenanceType?: string; // ID of the maintenance type/category
  description?: string; // Informative description of the cause
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
  description?: string;
};


export type StopData = {
  id: string; // Unique ID for the stop event, e.g., a timestamp or UUID
  startTime: string; // The time slot, e.g., "07:00"
  endTime: string;
  duration: number; // in minutes
  type: 'planned' | 'unplanned' | 'observation'; // Legacy/fallback
  typeId?: string; // New dynamic type reference
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
  // Peso de la funda en gramos (Enfardadoras #1 y #2)
  peso_funda?: string;
};


export type ProductChangeEvent = {
  from: string; // Product ID anterior ('' = sin producción)
  to: string;   // Product ID nuevo
  at: string;   // Hora del cambio "HH:mm"
};

export type MachineLog = {
  productId: string;
  theoreticalSpeed?: number; // Theoretical speed in bags/min for the whole shift (legacy/fallback)
  productChanges?: ProductChangeEvent[]; // Historial de cambios de presentación/producto durante el turno
};

export type DailyLog = {
  id: string; // YYYY-MM-DD_shift
  operador: string;
  operadorGranel?: string;
  supervisor: string;
  lote: string;
  shift: 'day' | 'night';
  shiftConfig?: { startHour: number; endHour: number };
  machines: { [machineId: string]: MachineLog };
  timeSlots: { [time: string]: Partial<TimeSlot> };
  hiddenMachines?: string[];
};

export type QualityRange = {
  id: string;
  min: number;
  max: number;
  color: string;
};

export type QualityParams = {
  [category: string]: QualityRange[]; // e.g. 'grasshopper_humedad', 'granel_color'
};

// Parámetros de peso por presentación y tipo de peso (Funda / Sacos / Fardos)
export type WeightUnit = 'g' | 'kg';
export type WeightTypeKey = 'funda' | 'sacos' | 'fardos';

// Rango de peso configurable por presentación y tipo (igual que los rangos de calidad)
export type WeightRange = {
  id: string;
  min: number;
  max: number;
  avg: number; // promedio auto-calculado (min + max) / 2
  unit: WeightUnit;
  color: string; // Clases Tailwind@|
};

export type QualityWeights = {
  [productId: string]: Partial<Record<WeightTypeKey, WeightRange[]>>;
};

export type BitacoraSettings = {
  weightHeaderType: { [key: string]: string };
  qualityParams?: QualityParams;
  qualityWeights?: QualityWeights;
  hiddenMachines?: string[];
  enfardadoraConnections?: { [enfardadoraId: string]: string[] };
  dispatchSyncActive?: boolean;
  dispatchSyncTime?: string;
  dispatchApiUrl?: string;
  dispatchApiToken?: string;
};

export type ProductionSettings = {
  isZafraGlobal?: boolean;
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

export type MaterialType = 'sacos_familiar' | 'sacos_granel' | 'rollo_laminado' | 'rollo_fardo';
export type MaterialStatus = 'recibido' | 'en_uso' | 'consumido' | 'por_pesar_tara';

export const materialTypeLabels: { [key in MaterialType]: string } = {
  sacos_familiar: "Sacos de Familiar",
  sacos_granel: "Sacos de Granel",
  rollo_laminado: "Rollo Laminado",
  rollo_fardo: "Rollo de Fardo",
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

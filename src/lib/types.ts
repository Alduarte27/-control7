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
  sackWeight?: number; // Weight of one sack in kg
  presentationWeight?: number; // Weight of one presentation/bag in kg
}

export type ProductData = ProductDefinition & {
  categoryName: string;
  categoryIsPlanned: boolean;
  planned: number;
  actual: DailyProduction;
  isSuggested?: boolean; // To flag if the plan was AI-suggested
};


// --- Production Log (Stops) Types ---

export type TimeSlotLog = {
    // Machine specific observations are nested under machine ID
    [machineId: string]: {
      observation?: string;
      weight?: string;
    },
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
};

export type DailyLog = {
  id: string; // YYYY-MM-DD
  operador: string;
  supervisor: string;
  lote: string;
  shift: 'day' | 'night';
  machines: { [machineId: string]: MachineLog };
  timeSlots: { [time: string]: Partial<TimeSlotLog> };
};

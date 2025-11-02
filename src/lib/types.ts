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

export type StopData = {
  id: string;
  machineId: string;
  cause: string;
  startTime: string; // ISO 8601 format
  endTime: string;   // ISO 8601 format
  durationMinutes: number;
  type: 'planned' | 'unplanned';
};
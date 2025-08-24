'use client';

export type ShiftProduction = {
  day: number;
  night: number;
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
}

export type ProductData = ProductDefinition & {
  categoryName: string;
  categoryIsPlanned: boolean;
  planned: number;
  actual: DailyProduction;
  isSuggested?: boolean; // To flag if the plan was AI-suggested
};

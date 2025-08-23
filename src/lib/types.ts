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

export type ProductDefinition = {
  id: string;
  productName: string;
}

export type ProductData = ProductDefinition & {
  planned: number;
  actual: DailyProduction;
};

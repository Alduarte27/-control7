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

export type ProductData = {
  id: string;
  productName: string;
  planned: number;
  actual: DailyProduction;
};

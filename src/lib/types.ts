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

export type ProductCategory = 'Familiar' | 'Granel';

export type ProductDefinition = {
  id: string;
  productName: string;
  order: number;
  category: ProductCategory;
}

export type ProductData = ProductDefinition & {
  planned: number;
  actual: DailyProduction;
};

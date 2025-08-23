export type DailyProduction = {
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  sun: number;
};

export type ProductData = {
  id: string;
  productName: string;
  planned: number;
  actual: DailyProduction;
};

import type { ProductData, DailyProduction } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

type ProductionTableProps = {
  data: ProductData[];
  onDataChange: (id: string, field: 'planned' | 'actual', day: keyof DailyProduction | null, value: number) => void;
};

const days: (keyof DailyProduction)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function ProductionTable({ data, onDataChange }: ProductionTableProps) {
  const handleInputChange = (id: string, field: 'planned' | 'actual', day: keyof DailyProduction | null, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) || value === '') {
      onDataChange(id, field, day, isNaN(numValue) ? 0 : numValue);
    }
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px] sticky left-0 bg-card z-10">Product</TableHead>
              <TableHead className="text-right min-w-[120px]">Weekly Plan</TableHead>
              {days.map(day => <TableHead key={day} className="text-right min-w-[100px] capitalize">{day}</TableHead>)}
              <TableHead className="text-right min-w-[120px]">Total Actual</TableHead>
              <TableHead className="text-right min-w-[120px]">Variance</TableHead>
              <TableHead className="min-w-[150px]">Weekly Compliance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center">
                  No products match your search.
                </TableCell>
              </TableRow>
            ) : (
              data.map(item => {
                const totalActual = Object.values(item.actual).reduce((sum, val) => sum + (val || 0), 0);
                const variance = totalActual - item.planned;
                const compliance = item.planned > 0 ? (totalActual / item.planned) * 100 : 0;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium sticky left-0 bg-card z-10">{item.productName}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.planned}
                        onChange={(e) => handleInputChange(item.id, 'planned', null, e.target.value)}
                        className="text-right"
                        min="0"
                      />
                    </TableCell>
                    {days.map(day => (
                      <TableCell key={day}>
                        <Input
                          type="number"
                          value={item.actual[day]}
                          onChange={(e) => handleInputChange(item.id, 'actual', day, e.target.value)}
                          className="text-right"
                          min="0"
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">{totalActual.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-medium ${variance < 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {variance.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={compliance > 100 ? 100 : compliance} className="w-[70%]" />
                        <span className="text-sm font-medium w-[50px] text-right">{compliance.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import StopsClient from '@/components/stops-client';
import { getProducts } from '@/services/data-service';

export const dynamic = 'force-dynamic';

export default async function StopsPage({ searchParams }: { searchParams: Promise<{ date?: string, shift?: string, mode?: string }> }) {
  const { date, shift, mode } = await searchParams;
  const products = await getProducts();
  const activeProducts = products.filter(p => p.isActive);
  
  return (
    <StopsClient 
      prefetchedProducts={activeProducts} 
      initialDate={date} 
      initialShift={shift as 'day' | 'night' | undefined} 
      initialMode={mode as 'read' | 'edit' | undefined} 
    />
  );
}

import StopsClient from '@/components/stops-client';
import { getCachedProducts } from '@/services/data-service';

export const dynamic = 'force-dynamic';

export default async function StopsPage() {
  // Fetch active products to be available in the dropdowns
  const products = await getCachedProducts();
  const activeProducts = products.filter(p => p.isActive);
  
  return <StopsClient prefetchedProducts={activeProducts} />;
}

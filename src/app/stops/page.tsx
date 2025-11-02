import StopsClient from '@/components/stops-client';
import { getCachedProducts } from '@/services/data-service';

export default async function StopsPage() {
  const products = await getCachedProducts();
  
  return <StopsClient prefetchedProducts={products} />;
}

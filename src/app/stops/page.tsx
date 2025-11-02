import StopsClient from '@/components/stops-client';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';

export default async function StopsPage() {
  const products = await getCachedProducts();
  const categories = await getCachedCategories();
  
  return <StopsClient prefetchedProducts={products} prefetchedCategories={categories} />;
}
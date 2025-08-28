import Control7Client from '@/components/control-7-client';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';

export default async function Home({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const planId = typeof searchParams?.planId === 'string' ? searchParams.planId : undefined;
  
  // Pre-fetch data on the server. This will be cached.
  const categories = await getCachedCategories();
  const products = await getCachedProducts();

  return <Control7Client 
    initialPlanId={planId} 
    prefetchedCategories={categories}
    prefetchedProducts={products}
  />;
}

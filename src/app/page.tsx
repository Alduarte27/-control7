import Control7Client from '@/components/control-7-client';
import { getCategories, getProducts } from '@/services/data-service';
import { redirect } from 'next/navigation';

// This is a server component, so we can check for permissions here.
// However, the actual permission logic is handled client-side for dynamic UI updates.
// A more robust solution might involve server-side session management.
export default async function Home({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  
  const planId = typeof searchParams?.planId === 'string' ? searchParams.planId : undefined;
  
  // Pre-fetch data on the server. This will be cached.
  const categories = await getCategories();
  const products = await getProducts();

  return <Control7Client 
    initialPlanId={planId} 
    prefetchedCategories={categories}
    prefetchedProducts={products}
  />;
}

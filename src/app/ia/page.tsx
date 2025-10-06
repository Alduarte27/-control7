'use client';

import OperationsClient from '@/components/ia-client';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';

export default async function OperationsPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const planId = typeof searchParams?.planId === 'string' ? searchParams.planId : undefined;
  
  const categories = await getCachedCategories();
  const products = await getCachedProducts();

  return <OperationsClient 
    initialPlanId={planId} 
    prefetchedCategories={categories}
    prefetchedProducts={products}
  />;
}

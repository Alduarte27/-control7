'use server';

import OperationsClient from '@/components/ia-client';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';

export default async function OperationsPage() {
  const categories = await getCachedCategories();
  const products = await getCachedProducts();

  return <OperationsClient 
    prefetchedCategories={categories}
    prefetchedProducts={products}
  />;
}

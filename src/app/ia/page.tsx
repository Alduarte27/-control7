'use server';

import OperationsClient from '@/components/ia-client';
import { getCategories, getProducts } from '@/services/data-service';

export default async function OperationsPage() {
  const categories = await getCategories();
  const products = await getProducts();

  return <OperationsClient 
    prefetchedCategories={categories}
    prefetchedProducts={products}
  />;
}

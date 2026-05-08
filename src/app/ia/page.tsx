import { Suspense } from 'react';
import OperationsClient from '@/components/ia-client';
import { getCategories, getProducts } from '@/services/data-service';

export default async function OperationsPage() {
  const categories = await getCategories();
  const products = await getProducts();

  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <OperationsClient 
        prefetchedCategories={categories}
        prefetchedProducts={products}
      />
    </Suspense>
  );
}

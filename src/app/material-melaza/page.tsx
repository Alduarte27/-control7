

import MelazaClient from '@/components/melaza-client';
import { db } from '@/lib/firebase';
import type { Supplier } from '@/lib/types';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// Note: We are no longer pre-fetching suppliers here.
// The client will fetch them in real-time.

export default async function MaterialMelazaPage() {
  const products = await getCachedProducts();
  const categories = await getCachedCategories();
  
  return <MelazaClient
    allProducts={products}
    allCategories={categories}
  />;
}

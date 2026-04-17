

import MelazaClient from '@/components/melaza-client';
import { db } from '@/lib/firebase';
import type { Supplier } from '@/lib/types';
import { getCategories, getProducts } from '@/services/data-service';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// Note: We are no longer pre-fetching suppliers here.
// The client will fetch them in real-time.

export default async function MaterialMelazaPage() {
  const products = await getProducts();
  const categories = await getCategories();
  
  return <MelazaClient
    allProducts={products}
    allCategories={categories}
  />;
}

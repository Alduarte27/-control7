

import MelazaClient from '@/components/melaza-client';
import { db } from '@/lib/firebase';
import type { Supplier } from '@/lib/types';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

async function getMelazaSuppliers(): Promise<Supplier[]> {
    try {
        const suppliersSnap = await getDocs(query(collection(db, 'melazaSuppliers'), orderBy('name')));
        return suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
    } catch (error) {
        console.error("Error fetching melaza suppliers:", error);
        return [];
    }
}

export default async function MaterialMelazaPage() {
  const products = await getCachedProducts();
  const categories = await getCachedCategories();
  const suppliers = await getMelazaSuppliers();
  
  return <MelazaClient
    allProducts={products}
    allCategories={categories}
    initialSuppliers={suppliers}
  />;
}

import MaterialsClient from '@/components/materials-client';
import { db } from '@/lib/firebase';
import type { Supplier } from '@/lib/types';
import { getCategories, getProducts } from '@/services/data-service';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// Note: We are no longer pre-fetching materials here.
// The client will fetch them in real-time.

async function getSuppliers(): Promise<Supplier[]> {
    try {
        const suppliersSnap = await getDocs(query(collection(db, 'suppliers'), orderBy('name')));
        return suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
    } catch (error) {
        console.error("Error fetching suppliers:", error);
        return [];
    }
}

export default async function MaterialsPage() {
  const products = await getProducts();
  const categories = await getCategories();
  const suppliers = await getSuppliers();
  
  return <MaterialsClient 
    allProducts={products}
    allCategories={categories}
    initialSuppliers={suppliers}
  />;
}

import MaterialsClient from '@/components/materials-client';
import { db } from '@/lib/firebase';
import type { PackagingMaterial, ProductDefinition, CategoryDefinition, Supplier } from '@/lib/types';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

async function getInitialMaterials(): Promise<PackagingMaterial[]> {
    try {
        const materialsSnap = await getDocs(query(collection(db, 'packagingMaterials'), orderBy('receivedAt', 'desc')));
        return materialsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial));
    } catch (error) {
        console.error("Error fetching initial packaging materials:", error);
        return [];
    }
}

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
  const initialMaterials = await getInitialMaterials();
  const products = await getCachedProducts();
  const categories = await getCachedCategories();
  const suppliers = await getSuppliers();
  
  return <MaterialsClient 
    initialMaterials={initialMaterials} 
    allProducts={products}
    allCategories={categories}
    initialSuppliers={suppliers}
  />;
}

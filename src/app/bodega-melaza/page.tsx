
import BodegaMelazaClient from '@/components/bodega-melaza-client';
import { db } from '@/lib/firebase';
import type { PackagingMaterial, Supplier } from '@/lib/types';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

async function getStoredMelazaSacks(): Promise<PackagingMaterial[]> {
    try {
        const q = query(
            collection(db, "melazaSacks"),
            orderBy("receivedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const materials = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial))
            .filter(material => material.status === 'recibido');
        return materials;
    } catch (error) {
        console.error("Error fetching stored melaza sacks:", error);
        return [];
    }
}

async function getMelazaSuppliers(): Promise<Supplier[]> {
    try {
        const suppliersSnap = await getDocs(query(collection(db, 'melazaSuppliers'), orderBy('name')));
        return suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
    } catch (error) {
        console.error("Error fetching melaza suppliers:", error);
        return [];
    }
}


export default async function BodegaMelazaPage() {
  const initialMaterials = await getStoredMelazaSacks();
  const initialSuppliers = await getMelazaSuppliers();
  
  return <BodegaMelazaClient initialMaterials={initialMaterials} initialSuppliers={initialSuppliers} />;
}

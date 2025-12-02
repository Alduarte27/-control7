

import BodegaMelazaClient from '@/components/bodega-melaza-client';
import { db } from '@/lib/firebase';
import type { PackagingMaterial } from '@/lib/types';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';

async function getStoredMelazaSacks(): Promise<PackagingMaterial[]> {
    try {
        const q = query(
            collection(db, "melazaSacks"),
            orderBy("receivedAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        // Filter in code to avoid composite index
        const materials = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial))
            .filter(material => material.status === 'recibido');
        return materials;
    } catch (error) {
        console.error("Error fetching stored melaza sacks:", error);
        return [];
    }
}


export default async function BodegaMelazaPage() {
  const initialMaterials = await getStoredMelazaSacks();
  
  return <BodegaMelazaClient initialMaterials={initialMaterials} />;
}

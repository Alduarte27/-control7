import MaterialsClient from '@/components/materials-client';
import { db } from '@/lib/firebase';
import type { PackagingMaterial } from '@/lib/types';
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

export default async function MaterialsPage() {
  const initialMaterials = await getInitialMaterials();
  
  return <MaterialsClient initialMaterials={initialMaterials} />;
}

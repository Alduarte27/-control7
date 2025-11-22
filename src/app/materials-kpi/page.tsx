
import MaterialsKpiClient from '@/components/materials-kpi-client';
import { db } from '@/lib/firebase';
import type { PackagingMaterial } from '@/lib/types';
import { collection, getDocs, query, where } from 'firebase/firestore';

async function getConsumedMaterials(): Promise<PackagingMaterial[]> {
    try {
        const materialsQuery = query(collection(db, 'packagingMaterials'), where('status', '==', 'consumido'));
        const materialsSnap = await getDocs(materialsQuery);
        return materialsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackagingMaterial));
    } catch (error) {
        console.error("Error fetching consumed packaging materials:", error);
        return [];
    }
}


export default async function MaterialsKpiPage() {
  const consumedMaterials = await getConsumedMaterials();
  
  return <MaterialsKpiClient 
    consumedMaterials={consumedMaterials} 
  />;
}


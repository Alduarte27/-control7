import OeeClient from '@/components/oee-client';
import { getCachedProducts } from '@/services/data-service';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { StopCause } from '@/lib/types';


async function getStopCauses(): Promise<StopCause[]> {
    try {
        const causesSnap = await getDocs(query(collection(db, 'stopCauses'), orderBy('name')));
        return causesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StopCause));
    } catch (error) {
        console.error("Error fetching stop causes:", error);
        return [];
    }
}

export default async function OeePage() {
  const products = await getCachedProducts();
  const stopCauses = await getStopCauses();
  
  return <OeeClient prefetchedProducts={products} prefetchedStopCauses={stopCauses} />;
}

import OeeClient from '@/components/oee-client';
import { db } from '@/lib/firebase';
import type { StopCause } from '@/lib/types';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

async function getStopCauses(): Promise<StopCause[]> {
    try {
        const causesSnap = await getDocs(query(collection(db, 'stopCauses'), orderBy('name')));
        return causesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StopCause));
    } catch (error) {
        console.error("Failed to fetch stop causes:", error);
        return [];
    }
}

export default async function OeePage() {
    const stopCauses = await getStopCauses();

    return <OeeClient prefetchedStopCauses={stopCauses} />;
}

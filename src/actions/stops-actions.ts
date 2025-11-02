'use server';

import { db } from '@/lib/firebase';
import type { StopData } from '@/lib/types';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { revalidateTag } from 'next/cache';

const CACHE_TAG_STOPS = 'stops';

export async function addStopAction(newStopData: Omit<StopData, 'id'>) {
    const docRef = await addDoc(collection(db, 'stops'), newStopData);
    revalidateTag(CACHE_TAG_STOPS);
    return { id: docRef.id, ...newStopData };
}

export async function deleteStopAction(stopId: string) {
    await deleteDoc(doc(db, 'stops', stopId));
    revalidateTag(CACHE_TAG_STOPS);
}
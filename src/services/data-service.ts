import 'server-only';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CategoryDefinition, ProductDefinition } from '@/lib/types';
import { revalidateTag } from 'next/cache';

const CACHE_TAG_PRODUCTS = 'products';
const CACHE_TAG_CATEGORIES = 'categories';

// Note: These functions no longer use Next.js cache to ensure fresh data on every request.
// This is to address the issue of the dashboard not updating.

export async function getFreshCategories(): Promise<CategoryDefinition[]> {
    try {
        const categoriesSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name')));
        return categoriesSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            isPlanned: doc.data().isPlanned ?? true, 
            ...doc.data() 
        } as CategoryDefinition));
    } catch (error) {
        console.error("Error fetching categories from Firestore:", error);
        return [];
    }
}

export async function getFreshProducts(): Promise<ProductDefinition[]> {
    try {
        const productsSnapshot = await getDocs(query(collection(db, 'products'), orderBy('order')));
        return productsSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            isActive: doc.data().isActive ?? true, 
            ...doc.data() 
        } as ProductDefinition));
    } catch (error) {
        console.error("Error fetching products from Firestore:", error);
        return [];
    }
}

// Re-exporting getCached functions for other parts of the app that might still use them,
// but they now fetch fresh data. The name is kept for compatibility to avoid breaking imports.
export const getCachedCategories = getFreshCategories;
export const getCachedProducts = getFreshProducts;

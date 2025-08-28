import 'server-only';
import { unstable_cache as cache } from 'next/cache';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CategoryDefinition, ProductDefinition } from '@/lib/types';

const CACHE_TAG_PRODUCTS = 'products';
const CACHE_TAG_CATEGORIES = 'categories';
const CACHE_LIFETIME_SECONDS = 300; // 5 minutes

export const getCachedCategories = cache(
    async (): Promise<CategoryDefinition[]> => {
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
    },
    [CACHE_TAG_CATEGORIES],
    {
        revalidate: CACHE_LIFETIME_SECONDS,
        tags: [CACHE_TAG_CATEGORIES],
    }
);


export const getCachedProducts = cache(
    async (): Promise<ProductDefinition[]> => {
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
    },
    [CACHE_TAG_PRODUCTS],
    {
        revalidate: CACHE_LIFETIME_SECONDS,
        tags: [CACHE_TAG_PRODUCTS],
    }
);

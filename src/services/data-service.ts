import 'server-only';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CategoryDefinition, ProductDefinition } from '@/lib/types';

export async function getCategories(): Promise<CategoryDefinition[]> {
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

export async function getProducts(): Promise<ProductDefinition[]> {
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

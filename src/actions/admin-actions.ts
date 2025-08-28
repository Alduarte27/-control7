'use server';

import { db } from '@/lib/firebase';
import type { CategoryDefinition, ProductDefinition } from '@/lib/types';
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { revalidateTag } from 'next/cache';

const CACHE_TAG_PRODUCTS = 'products';
const CACHE_TAG_CATEGORIES = 'categories';

// --- Product Actions ---

export async function addProductAction(newProductData: Omit<ProductDefinition, 'id'>) {
    const docRef = await addDoc(collection(db, 'products'), newProductData);
    revalidateTag(CACHE_TAG_PRODUCTS);
    return { id: docRef.id, ...newProductData };
}

export async function updateProductAction(updatedProduct: ProductDefinition) {
    const productRef = doc(db, 'products', updatedProduct.id);
    await updateDoc(productRef, {
        productName: updatedProduct.productName,
        categoryId: updatedProduct.categoryId,
        color: updatedProduct.color,
    });
    revalidateTag(CACHE_TAG_PRODUCTS);
}

export async function toggleProductStatusAction(product: ProductDefinition) {
    const updatedProduct = { ...product, isActive: !product.isActive };
    await updateDoc(doc(db, 'products', product.id), { isActive: updatedProduct.isActive });
    revalidateTag(CACHE_TAG_PRODUCTS);
}

export async function updateProductOrderAction(newOrderedProducts: ProductDefinition[]) {
    const batch = writeBatch(db);
    newOrderedProducts.forEach((product, index) => {
        const productRef = doc(db, 'products', product.id);
        batch.update(productRef, { order: index });
    });
    await batch.commit();
    revalidateTag(CACHE_TAG_PRODUCTS);
}


// --- Category Actions ---

export async function addCategoryAction(newCategoryData: Omit<CategoryDefinition, 'id'>) {
    const docRef = await addDoc(collection(db, 'categories'), newCategoryData);
    revalidateTag(CACHE_TAG_CATEGORIES);
    return { id: docRef.id, ...newCategoryData };
}

export async function deleteCategoryAction(categoryId: string) {
    await deleteDoc(doc(db, 'categories', categoryId));
    revalidateTag(CACHE_TAG_CATEGORIES);
    revalidateTag(CACHE_TAG_PRODUCTS); // Products might be affected by category deletion vis-a-vis display logic
}

export async function toggleCategoryIsPlannedAction(category: CategoryDefinition) {
    const updatedCategory = { ...category, isPlanned: !category.isPlanned };
    await updateDoc(doc(db, 'categories', category.id), { isPlanned: updatedCategory.isPlanned });
    revalidateTag(CACHE_TAG_CATEGORIES);
}

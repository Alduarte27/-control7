'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, PlusCircle, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, writeBatch, doc, query, orderBy } from 'firebase/firestore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


function SortableItem({ product }: { product: ProductDefinition }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: product.id });
  
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
  
    return (
      <li ref={setNodeRef} style={style} className="border p-3 rounded-md bg-muted/50 flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab p-1">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        {product.productName}
      </li>
    );
}

export default function AdminClient() {
  const [products, setProducts] = React.useState<ProductDefinition[]>([]);
  const [newProductName, setNewProductName] = React.useState('');
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    const fetchProducts = async () => {
        try {
            const productsCollection = collection(db, 'products');
            const q = query(productsCollection, orderBy('order'));
            const productsSnapshot = await getDocs(q);
            const productsList = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDefinition));
            setProducts(productsList);
        } catch (error) {
            console.error('Error loading products from Firestore', error);
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los productos.',
                variant: 'destructive',
            });
        }
    };
    fetchProducts();
  }, [toast]);

  const handleAddProduct = async () => {
    if (newProductName.trim() === '') {
      toast({
        title: 'Error',
        description: 'El nombre del producto no puede estar vacío.',
        variant: 'destructive',
      });
      return;
    }

    try {
        const newOrder = products.length > 0 ? Math.max(...products.map(p => p.order)) + 1 : 0;
        const docRef = await addDoc(collection(db, 'products'), {
            productName: newProductName.trim(),
            order: newOrder,
        });

        const newProduct: ProductDefinition = {
            id: docRef.id,
            productName: newProductName.trim(),
            order: newOrder,
        };

        setProducts(prevProducts => [...prevProducts, newProduct]);
        setNewProductName('');
        toast({
            title: 'Producto Añadido',
            description: `Se ha añadido "${newProduct.productName}".`,
        });

    } catch (error) {
        console.error('Error adding product to Firestore: ', error);
        toast({
            title: 'Error',
            description: 'No se pudo añadir el producto.',
            variant: 'destructive',
        });
    }
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setProducts((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over!.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update order in Firestore
        updateProductOrder(newItems);

        return newItems;
      });
    }
  };
  
  const updateProductOrder = async (newOrderedProducts: ProductDefinition[]) => {
      try {
          const batch = writeBatch(db);
          newOrderedProducts.forEach((product, index) => {
              const productRef = doc(db, 'products', product.id);
              batch.update(productRef, { order: index });
          });
          await batch.commit();
          toast({
              title: 'Orden Actualizado',
              description: 'El orden de los productos ha sido guardado.',
          });
      } catch (error) {
          console.error('Error updating product order: ', error);
          toast({
              title: 'Error',
              description: 'No se pudo guardar el nuevo orden de los productos.',
              variant: 'destructive',
          });
          // Optionally revert optimistic UI update
      }
  };

  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Administración</h1>
        </div>
        <Link href="/">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver a la Planificación
          </Button>
        </Link>
      </header>
      <main className="p-4 md:p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Gestionar Productos</CardTitle>
            <CardDescription>Añade nuevas presentaciones y reordénalas arrastrando y soltando.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-grow">
                <Label htmlFor="new-product">Nombre del Nuevo Producto</Label>
                <Input 
                  id="new-product"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Ej: Azúcar 1kg (50kg) San Juan"
                />
              </div>
              <Button onClick={handleAddProduct}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Producto
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lista de Productos Actual</CardTitle>
          </CardHeader>
          <CardContent>
             {products.length > 0 ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={products} strategy={verticalListSortingStrategy}>
                        <ul className="space-y-2">
                            {products.map((product) => (
                                <SortableItem key={product.id} product={product} />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
             ) : (
                <p className="text-muted-foreground text-center py-4">No hay productos definidos. Comienza añadiendo uno.</p>
             )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
